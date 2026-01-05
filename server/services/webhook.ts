import { parseStringPromise } from 'xml2js';
import { goCanvasService, getAllKnownFormIds } from './gocanvas';
import { processCompletedSubmission } from './submissionProcessor';

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
      
      // Filter: Only process webhooks for our 3 target forms (current + historical versions)
      const targetFormIds: string[] = getAllKnownFormIds();
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
      
      // Process submission using unified processor
      const result = await processCompletedSubmission(
        notification.formId, 
        enrichedSubmissionData, 
        'push_notification'
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process submission');
      }
      
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
