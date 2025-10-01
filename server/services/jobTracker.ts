import { storage } from '../storage';
import { goCanvasService } from './gocanvas';
import { googleSheetsService } from './googleSheets';
import { timezoneService } from './timezone';

export class JobTrackerService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30000; // 30 seconds for faster job completion detection

  private logEnvironmentInfo() {
    console.log('🌍 ===== ENVIRONMENT DEBUG INFO =====');
    console.log('Node.js timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('Process TZ env var:', process.env.TZ || 'undefined');
    console.log('Date.now() sample:', new Date().toISOString());
    console.log('Local time sample:', new Date().toLocaleString());
    console.log('UTC offset (minutes):', new Date().getTimezoneOffset());
    console.log('Server timezone offset:', new Date().toString().match(/GMT[+-]\d{4}/)?.[0] || 'unknown');
    console.log('=========================================');
  }

  startPolling(): void {
    if (this.pollingInterval) {
      return; // Already polling
    }

    this.logEnvironmentInfo();
    console.log('Starting job tracking polling...');
    this.pollingInterval = setInterval(() => {
      this.checkPendingJobs();
    }, this.POLL_INTERVAL_MS);

    // Run initial check
    this.checkPendingJobs();
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('Stopped job tracking polling');
    }
  }

  private async checkPendingJobs(): Promise<void> {
    try {
      // Check for pickup form completions (queued_for_pickup -> picked_up)
      const queuedForPickupJobs = await storage.getJobsByState('queued_for_pickup');
      for (const job of queuedForPickupJobs) {
        await this.checkPickupCompletion(job);
      }
      
      // Check for service form completions (at_shop/in_service -> completed)
      const pendingJobs = await storage.getJobsByStatus('pending');
      const inProgressJobs = await storage.getJobsByStatus('in_progress');
      const jobsToCheck = [...pendingJobs, ...inProgressJobs];
      
      for (const job of jobsToCheck) {
        await this.checkJobCompletion(job);
      }
    } catch (error) {
      console.error('Error checking pending jobs:', error);
    }
  }

  /**
   * Check if pickup form has been completed and transition to picked_up
   */
  private async checkPickupCompletion(job: any): Promise<void> {
    try {
      // Check for pickup form submission (form 5631022)
      const result = await goCanvasService.checkSubmissionStatusForForm(job.jobId, '5631022');
      
      if (!result || result.status !== 'completed') {
        return;
      }

      console.log(`✅ Pickup form completed for job ${job.jobId}, transitioning to picked_up state`);
      
      // Transition job to picked_up state using jobEvents service
      const { jobEventsService } = await import('./jobEvents');
      await jobEventsService.markPickedUp(
        job.id,
        1, // Default item count (actual count not available from form)
        {
          metadata: {
            submittedAt: result.submittedAt ? new Date(result.submittedAt) : new Date(),
            autoDetected: true,
          },
        }
      );
      
    } catch (error) {
      console.error(`Error checking pickup completion for job ${job.jobId}:`, error);
    }
  }

  private async checkJobCompletion(job: any): Promise<void> {
    try {
      const result = await goCanvasService.checkSubmissionStatus(job.jobId);
      
      if (!result) {
        console.warn(`Could not get status for job ${job.jobId}`);
        return;
      }

      const { status, submittedAt, submissionId } = result;
      console.log(`🔍 DEBUG: checkSubmissionStatus returned: status=${status}, submittedAt=${submittedAt}, submissionId=${submissionId}`);
      let updates: any = {};

      // Update job status based on GoCanvas submission status
      if (status === 'completed' && job.status !== 'completed') {
        // Use the actual GoCanvas submission time instead of our detection time
        const completedTime = submittedAt ? new Date(submittedAt) : new Date();
        
        // Calculate Full Turnaround Time (Initiated to Completed)
        const turnaroundTime = job.initiatedAt ? 
          Math.round((completedTime.getTime() - new Date(job.initiatedAt).getTime()) / (1000 * 60)) : 
          null;

        // Get handoff time data and calculate Time with Tech
        let handoffTime = null;
        let timeWithTech = null;
        
        try {
          console.log(`\n🕒 CHECKING FOR WORKFLOW TIMESTAMPS IN REVISION HISTORY...`);
          
          // FIRST: Try to get workflow timestamps from revision history (more accurate)
          let handoffDateTime: Date | null = null;
          const submissionId = result.submissionId;
          
          console.log(`🔍 DEBUG: About to check revision history with submissionId: ${submissionId}`);
          if (submissionId) {
            console.log(`✅ SubmissionId exists, calling getSubmissionRevisions...`);
            const revisionData = await goCanvasService.getSubmissionRevisions(submissionId);
            if (revisionData && revisionData.workflow_revisions?.length > 0) {
              console.log(`🎯 Found ${revisionData.workflow_revisions.length} workflow revisions - checking for handoff timestamps...`);
              
              // Look for handoff or check-in related revisions with timestamps
              const handoffRevision = revisionData.workflow_revisions.find((rev: any) => 
                rev.value?.toLowerCase().includes('check') || 
                rev.value?.toLowerCase().includes('handoff')
              );
              
              if (handoffRevision && handoffRevision.created_at) {
                handoffDateTime = new Date(handoffRevision.created_at);
                console.log(`✅ FOUND WORKFLOW TIMESTAMP: ${handoffDateTime.toISOString()} from revision history`);
              }
            }
          }
          
          // FALLBACK: If no revision data, try the handoff form fields approach
          if (!handoffDateTime) {
            console.log(`⚠️ No workflow timestamp found from revision history, falling back to form field parsing...`);
            const handoffData = await goCanvasService.getHandoffTimeData(job.jobId);
            if (handoffData && handoffData.handoffFields) {
              const handoffDateField = handoffData.handoffFields.find((f: any) => f.label === 'Handoff Date');
              const handoffTimeField = handoffData.handoffFields.find((f: any) => f.label === 'Handoff Time');
              
              // NEW: Check for GPS field for accurate timezone conversion
              const gpsField = handoffData.responses?.find((f: any) => 
                f.label === 'New GPS' || f.entry_id === 714491454
              );
              if (handoffDateField && handoffTimeField) {
                const handoffDateStr = handoffDateField.value; // e.g., "08/26/2025"
                const handoffTimeStr = handoffTimeField.value; // e.g., "02:50 PM"
                console.log(`🔄 Processing handoff fields: Date="${handoffDateStr}", Time="${handoffTimeStr}"`);
                
                if (gpsField && gpsField.value) {
                  console.log(`📍 GPS field available: "${gpsField.value}"`);
                  
                  // PRIORITY 1: Try GPS timestamp first (most accurate, already UTC)
                  const gpsTimestamp = timezoneService.extractGPSTimestamp(gpsField.value);
                  if (gpsTimestamp) {
                    console.log(`✅ Using GPS timestamp: ${gpsTimestamp.toISOString()}`);
                    handoffDateTime = gpsTimestamp;
                  } else {
                    console.log(`⚠️ GPS timestamp extraction failed, trying timezone conversion...`);
                    
                    // PRIORITY 2: GPS-based timezone conversion of manual times
                    try {
                      handoffDateTime = await timezoneService.convertHandoffTimeWithGPS(
                        gpsField.value,
                        handoffDateStr,
                        handoffTimeStr
                      );
                      
                      if (handoffDateTime) {
                        console.log(`✅ GPS timezone conversion successful: ${handoffDateTime.toISOString()}`);
                      } else {
                        console.log(`❌ GPS timezone conversion failed`);
                      }
                    } catch (gpsError) {
                      console.error(`❌ GPS timezone conversion error:`, gpsError);
                    }
                  }
                } else {
                  console.log(`❌ No GPS field found - cannot determine accurate handoff time`);
                }
              } else {
                console.log(`❌ Missing handoff date or time fields`);
              }
            } else {
              console.log(`❌ No handoff date/time fields found in form responses`);
            }
          }
          
          // Final processing - set handoffTime from whichever method worked
          if (handoffDateTime && !isNaN(handoffDateTime.getTime())) {
            handoffTime = handoffDateTime;
            
            // Calculate Time with Tech (Handoff to Completed)
            timeWithTech = Math.round((completedTime.getTime() - handoffTime.getTime()) / (1000 * 60));
            
            console.log(`✅ FINAL HANDOFF TIME CALCULATION:`);
            console.log(`  - Handoff timestamp: ${handoffTime.toISOString()}`);
            console.log(`  - Completion timestamp: ${completedTime.toISOString()}`);
            console.log(`  - Time with Tech: ${timeWithTech} minutes (${Math.round(timeWithTech / 60 * 10) / 10} hours)`);
          } else {
            console.warn(`❌ Could not determine handoff time for job ${job.jobId}`);
          }
          
        } catch (handoffError) {
          console.warn(`Could not retrieve handoff time for job ${job.jobId}:`, handoffError);
        }

        updates = {
          status: 'completed',
          completedAt: completedTime,
          turnaroundTime, // Full Turnaround Time (Initiated to Completed)
          handoffAt: handoffTime,
          timeWithTech, // Time with Tech (Handoff to Completed)
        };

        console.log(`Job ${job.jobId} completed:
          - Full Turnaround Time: ${turnaroundTime} minutes (${Math.round(turnaroundTime / 60 * 10) / 10} hours)
          - Time with Tech: ${timeWithTech || 'N/A'} minutes${timeWithTech ? ` (${Math.round(timeWithTech / 60 * 10) / 10} hours)` : ''}`);
      } else if (status === 'in_progress' && job.status === 'pending') {
        updates = {
          status: 'in_progress',
        };

        console.log(`Job ${job.jobId} moved to in-progress`);
      }

      // Check for overdue jobs (more than 6 hours)
      if (job.status === 'in_progress' && job.initiatedAt) {
        const currentTime = new Date();
        const hoursElapsed = (currentTime.getTime() - new Date(job.initiatedAt).getTime()) / (1000 * 60 * 60);
        if (hoursElapsed > 6) {
          updates.status = 'overdue';
          console.log(`Job ${job.jobId} marked as overdue (${hoursElapsed.toFixed(1)} hours)`);
        }
      }

      if (Object.keys(updates).length > 0) {
        await storage.updateJob(job.id, updates);

        // Sync to Google Sheets if job is completed
        if (updates.status === 'completed') {
          const updatedJob = await storage.getJob(job.id);
          if (updatedJob) {
            const syncSuccess = await googleSheetsService.syncJobToSheet(updatedJob);
            if (syncSuccess) {
              await storage.updateJob(job.id, { googleSheetsSynced: "true" });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error checking job completion for ${job.jobId}:`, error);
    }
  }

  async calculateMetrics(): Promise<{
    activeJobs: number;
    completedToday: number;
    averageTurnaround: number;
    averageTimeWithTech: number;
    overdueJobs: number;
  }> {
    try {
      const allJobs = await storage.getAllJobs();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeJobs = allJobs.filter(job => 
        job.status === 'pending' || job.status === 'in_progress'
      ).length;

      const completedToday = allJobs.filter(job => 
        job.status === 'completed' && 
        job.completedAt && 
        new Date(job.completedAt) >= today
      ).length;

      // Jobs with Full Turnaround Time data
      const completedJobsWithTurnaround = allJobs.filter(job => 
        job.status === 'completed' && job.turnaroundTime
      );

      const averageTurnaround = completedJobsWithTurnaround.length > 0 ? 
        completedJobsWithTurnaround.reduce((sum, job) => sum + (job.turnaroundTime || 0), 0) / completedJobsWithTurnaround.length :
        0;

      // Jobs with Time with Tech data
      const completedJobsWithTechTime = allJobs.filter(job => 
        job.status === 'completed' && job.timeWithTech
      );

      const averageTimeWithTech = completedJobsWithTechTime.length > 0 ? 
        completedJobsWithTechTime.reduce((sum, job) => sum + (job.timeWithTech || 0), 0) / completedJobsWithTechTime.length :
        0;

      const overdueJobs = allJobs.filter(job => job.status === 'overdue').length;

      return {
        activeJobs,
        completedToday,
        averageTurnaround: Math.round(averageTurnaround), // Keep in minutes
        averageTimeWithTech: Math.round(averageTimeWithTech), // Keep in minutes
        overdueJobs,
      };
    } catch (error) {
      console.error('Error calculating metrics:', error);
      return { activeJobs: 0, completedToday: 0, averageTurnaround: 0, averageTimeWithTech: 0, overdueJobs: 0 };
    }
  }
}

export const jobTrackerService = new JobTrackerService();
