import { parseStringPromise } from 'xml2js';
import { goCanvasService, FORM_IDS } from './gocanvas';
import { jobEventsService } from './jobEvents';

// In-memory metrics for webhooks
export const webhookMetrics = {
  totalReceived: 0,
  totalProcessed: 0,
  duplicatesIgnored: 0,
  errors: 0,
  ignoredForms: 0,
  byForm: {} as Record<string, number>,
  averageProcessingTime: 0,
  lastReceivedByForm: {} as Record<string, string>,
  processingTimes: [] as number[],
};

// In-memory idempotency cache (submission ID -> timestamp)
const processedSubmissions = new Map<string, number>();
const CACHE_TTL_MS = 3600000; // 1 hour

interface ParsedNotification {
  formId: string;
  formName: string;
  formGuid: string;
  submissionId: string;
  submissionGuid: string;
  dispatchItemId?: string;
}

export class WebhookService {
  /**
   * Parse GoCanvas XML webhook notification
   */
  private async parseNotificationXML(xmlBody: string): Promise<ParsedNotification> {
    try {
      const result = await parseStringPromise(xmlBody, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      });

      console.log('📦 Raw parsed XML:', JSON.stringify(result, null, 2));

      const notification = result['submission-notification'];
      
      if (!notification || !notification.form || !notification.submission) {
        throw new Error('Invalid webhook notification structure');
      }

      // Helper to extract text value from xml2js parsed object
      const extractValue = (obj: any): string => {
        if (typeof obj === 'string') return obj;
        if (typeof obj === 'number') return String(obj);
        if (obj && typeof obj === 'object') {
          // xml2js might wrap text in '_' property
          if ('_' in obj) return String(obj._);
          // Or it might just be in the object directly
          return String(obj);
        }
        return '';
      };

      const parsed = {
        formId: extractValue(notification.form.id),
        formName: extractValue(notification.form.name),
        formGuid: extractValue(notification.form.guid),
        submissionId: extractValue(notification.submission.id || notification.submission.guid),
        submissionGuid: extractValue(notification.submission.guid),
        dispatchItemId: notification['dispatch-item']?.id 
          ? extractValue(notification['dispatch-item'].id) 
          : undefined,
      };

      console.log('✅ Extracted values:', parsed);
      
      return parsed;
    } catch (error) {
      console.error('❌ XML parsing error:', error);
      throw new Error(`Failed to parse webhook XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up expired idempotency cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, timestamp] of Array.from(processedSubmissions.entries())) {
      if (now - timestamp > CACHE_TTL_MS) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => processedSubmissions.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired idempotency cache entries`);
    }
  }

  /**
   * Extract Job ID from submission responses
   */
  private extractJobId(responses: any[]): string | null {
    if (!Array.isArray(responses)) {
      return null;
    }

    // Search for field labeled "Job ID" containing ECS-formatted ID
    const jobIdField = responses.find(r => 
      r.label?.toLowerCase().includes('job') && 
      r.value?.startsWith('ECS-')
    );
    
    return jobIdField?.value || null;
  }

  /**
   * Handle pickup form completion
   */
  private async handlePickupCompletion(jobId: string, submissionData: any): Promise<void> {
    try {
      console.log(`✅ Pickup form completed for job ${jobId} (webhook)`);
      
      await jobEventsService.markPickedUp(
        jobId,
        1, // Default item count (actual count not available from form)
        {
          metadata: {
            submittedAt: submissionData.submitted_at ? new Date(submissionData.submitted_at) : new Date(),
            autoDetected: true,
            source: 'push_notification',
          },
        }
      );
    } catch (error) {
      console.error(`Error handling pickup completion for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Handle service form completion
   */
  private async handleServiceCompletion(jobId: string, submissionData: any): Promise<void> {
    try {
      const submittedAt = submissionData.submitted_at ? new Date(submissionData.submitted_at) : new Date();
      
      console.log(`✅ Service form completed for job ${jobId} (webhook)`);
      
      // Get job to check current state
      const { storage } = await import('../storage');
      const job = await storage.getJobByJobId(jobId);
      
      if (!job) {
        console.error(`Job ${jobId} not found`);
        return;
      }

      // Get handoff time from GPS field for accurate "Service Started" timestamp
      let handoffTime: Date | null = null;
      
      try {
        // Extract GPS field directly from submission data (no extra API call needed!)
        const gpsField = submissionData.responses?.find((f: any) => f.label === 'New GPS');
        
        if (gpsField?.value) {
          const timeMatch = gpsField.value.match(/Time:(\d+\.?\d*)/);
          
          if (timeMatch && timeMatch[1]) {
            const unixTimestamp = parseFloat(timeMatch[1]);
            const timestampMs = unixTimestamp > 10000000000 ? unixTimestamp : unixTimestamp * 1000;
            handoffTime = new Date(timestampMs);
            
            if (isNaN(handoffTime.getTime()) || 
                handoffTime.getFullYear() < 2020 || 
                handoffTime.getFullYear() > 2100) {
              console.warn(`Invalid GPS timestamp parsed: "${timeMatch[1]}" → year ${handoffTime.getFullYear()}`);
              handoffTime = null;
            } else {
              console.log(`✅ Found handoff time from GPS field: ${handoffTime.toISOString()}`);
            }
          }
        }
      } catch (error) {
        console.warn(`Could not retrieve handoff time from GPS: ${error}`);
      }

      // If still at_shop, transition through in_service to service_complete
      if (job.state === 'at_shop') {
        console.log(`✅ Service completed for job ${jobId} (at_shop), transitioning through in_service to service_complete`);
        
        await jobEventsService.transitionJobState(jobId, 'in_service', {
          actor: 'Technician',
          timestamp: handoffTime || undefined,
          metadata: {
            autoDetected: true,
            source: 'push_notification',
            handoffTime: handoffTime?.toISOString(),
          },
        });
        
        await jobEventsService.transitionJobState(jobId, 'service_complete', {
          actor: 'System',
          timestamp: submittedAt,
          metadata: {
            completedAt: submittedAt,
            autoDetected: true,
            source: 'push_notification',
          },
        });
      } 
      // If already in_service, transition to service_complete
      else if (job.state === 'in_service') {
        console.log(`✅ Service form completed for job ${jobId}, transitioning to service_complete`);
        
        await jobEventsService.transitionJobState(jobId, 'service_complete', {
          actor: 'System',
          timestamp: submittedAt,
          metadata: {
            completedAt: submittedAt,
            autoDetected: true,
            source: 'push_notification',
          },
        });
      }
    } catch (error) {
      console.error(`Error handling service completion for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Handle delivery form completion
   */
  private async handleDeliveryCompletion(jobId: string, submissionData: any): Promise<void> {
    try {
      console.log(`✅ Delivery form completed for job ${jobId} (webhook)`);
      
      await jobEventsService.markDelivered(jobId, {
        timestamp: submissionData.submitted_at ? new Date(submissionData.submitted_at) : undefined,
        metadata: {
          submittedAt: submissionData.submitted_at ? new Date(submissionData.submitted_at) : new Date(),
          autoDetected: true,
          source: 'push_notification',
        },
      });
    } catch (error) {
      console.error(`Error handling delivery completion for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Handle submission completion based on form type
   */
  private async handleSubmissionCompleted(
    formId: string,
    submissionData: any
  ): Promise<void> {
    // Extract Job ID from submission responses
    const jobId = this.extractJobId(submissionData.responses || []);
    
    if (!jobId) {
      console.warn('⚠️ No Job ID found in submission:', submissionData.id);
      return;
    }

    console.log(`📋 Processing submission for Job ID: ${jobId}, Form: ${formId}`);

    // Route to appropriate handler based on form ID
    switch (formId) {
      case FORM_IDS.PICKUP:
        await this.handlePickupCompletion(jobId, submissionData);
        break;
      
      case FORM_IDS.EMISSIONS:
        await this.handleServiceCompletion(jobId, submissionData);
        break;
      
      case FORM_IDS.DELIVERY:
        await this.handleDeliveryCompletion(jobId, submissionData);
        break;
      
      default:
        console.warn('⚠️ Unknown form ID in webhook:', formId);
    }
  }

  /**
   * Process GoCanvas webhook
   */
  async processGoCanvasWebhook(
    xmlBody: string,
    contentType?: string
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('\n🔔 ===== WEBHOOK RECEIVED =====');
      console.log('Content-Type:', contentType);
      console.log('Body length:', xmlBody.length);
      
      // Update metrics
      webhookMetrics.totalReceived++;
      
      // Parse XML notification
      const notification = await this.parseNotificationXML(xmlBody);
      
      console.log('📋 Parsed notification:', {
        formId: notification.formId,
        formName: notification.formName,
        submissionId: notification.submissionId,
        dispatchItemId: notification.dispatchItemId,
      });
      
      // Filter: Only process webhooks for our 3 target forms
      const targetFormIds: string[] = [FORM_IDS.PICKUP, FORM_IDS.EMISSIONS, FORM_IDS.DELIVERY];
      if (!targetFormIds.includes(notification.formId)) {
        console.log(`⏭️ Ignoring webhook for non-target form: ${notification.formId} (${notification.formName})`);
        webhookMetrics.ignoredForms++;
        console.log('===== END WEBHOOK (IGNORED) =====\n');
        return;
      }
      
      // Idempotency check
      if (processedSubmissions.has(notification.submissionId)) {
        console.log(`⚠️ Duplicate notification for submission ${notification.submissionId}, skipping`);
        webhookMetrics.duplicatesIgnored++;
        return;
      }
      
      // Mark as processed
      processedSubmissions.set(notification.submissionId, Date.now());
      
      // Clean up expired entries
      this.cleanupExpiredEntries();
      
      // Update form-specific metrics
      if (!webhookMetrics.byForm[notification.formId]) {
        webhookMetrics.byForm[notification.formId] = 0;
      }
      webhookMetrics.byForm[notification.formId]++;
      webhookMetrics.lastReceivedByForm[notification.formId] = new Date().toISOString();
      
      // Fetch full submission data from GoCanvas API
      console.log(`🔍 Fetching full submission data for ID: ${notification.submissionId}`);
      const submissionData = await goCanvasService.getSubmissionById(notification.submissionId);
      
      if (!submissionData || submissionData.error) {
        throw new Error(`Failed to fetch submission data: ${submissionData?.error || 'Unknown error'}`);
      }
      
      // Extract responses from rawData if available
      const responses = submissionData.rawData?.responses || [];
      const enrichedSubmissionData = {
        ...submissionData,
        responses,
      };
      
      // Process submission
      await this.handleSubmissionCompleted(notification.formId, enrichedSubmissionData);
      
      // Update metrics
      webhookMetrics.totalProcessed++;
      
      const processingTime = Date.now() - startTime;
      webhookMetrics.processingTimes.push(processingTime);
      
      // Keep only last 100 processing times for average calculation
      if (webhookMetrics.processingTimes.length > 100) {
        webhookMetrics.processingTimes.shift();
      }
      
      // Calculate average processing time
      webhookMetrics.averageProcessingTime = Math.round(
        webhookMetrics.processingTimes.reduce((sum, time) => sum + time, 0) / 
        webhookMetrics.processingTimes.length
      );
      
      console.log(`✅ Push notification processed successfully in ${processingTime}ms`);
      console.log('===== END WEBHOOK =====\n');
      
    } catch (error) {
      webhookMetrics.errors++;
      console.error('❌ Push notification processing error:', error);
      console.log('===== END WEBHOOK (ERROR) =====\n');
      throw error;
    }
  }
}

export const webhookService = new WebhookService();
