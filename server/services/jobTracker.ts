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
      
      // Check for service form completions (at_shop/in_service -> service_complete)
      const atShopJobs = await storage.getJobsByState('at_shop');
      const inServiceJobs = await storage.getJobsByState('in_service');
      const jobsToCheck = [...atShopJobs, ...inServiceJobs];
      
      for (const job of jobsToCheck) {
        await this.checkServiceCompletion(job);
      }
      
      // Check for delivery form completions (out_for_delivery -> delivered)
      const outForDeliveryJobs = await storage.getJobsByState('out_for_delivery');
      for (const job of outForDeliveryJobs) {
        await this.checkDeliveryCompletion(job);
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

  /**
   * Check if Emissions Service Log has been completed and transition to ready state
   */
  private async checkServiceCompletion(job: any): Promise<void> {
    try {
      // Check for Emissions Service Log submission (form 5594156)
      const result = await goCanvasService.checkSubmissionStatusForForm(job.jobId, '5594156');
      
      if (!result) {
        return; // No submission found yet
      }

      const { status, submittedAt, submissionId } = result;
      console.log(`🔍 Service completion check for ${job.jobId}: status=${status}, submittedAt=${submittedAt}`);

      // If service is in progress, mark as in_service state (tech is working on it)
      if (status === 'in_progress' && job.state === 'at_shop') {
        console.log(`✅ Service started for job ${job.jobId}, transitioning to in_service state`);
        
        const { jobEventsService } = await import('./jobEvents');
        await jobEventsService.markInService(job.id, {
          metadata: {
            submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
            autoDetected: true,
          },
        });
        return; // Exit early after state transition
      }
      
      // If service form is completed
      if (status === 'completed') {
        const { jobEventsService } = await import('./jobEvents');
        
        // Get handoff time from GPS field for accurate "Service Started" timestamp in UTC
        let handoffTime: Date | null = null;
        
        try {
          const handoffData = await goCanvasService.getHandoffTimeData(job.jobId);
          if (handoffData?.handoffFields) {
            // Look for the GPS field which has a UTC timestamp
            const gpsField = handoffData.handoffFields.find((f: any) => f.label === 'New GPS');
            
            if (gpsField?.value) {
              // GPS format: "Lat:41.908562,Lon:-87.677940,Acc:5.000000,Alt:190.268737,Bear:-1.000000,Speed:-1.000000,Time:1759423565.073100"
              // Extract the Time value (Unix timestamp)
              const timeMatch = gpsField.value.match(/Time:(\d+\.?\d*)/);
              
              if (timeMatch && timeMatch[1]) {
                const unixTimestamp = parseFloat(timeMatch[1]);
                // Convert Unix timestamp (seconds) to milliseconds and create Date
                handoffTime = new Date(unixTimestamp * 1000);
                
                if (isNaN(handoffTime.getTime())) {
                  console.warn(`Invalid GPS timestamp parsed: "${timeMatch[1]}"`);
                  handoffTime = null;
                } else {
                  console.log(`✅ Found handoff time from GPS field: ${handoffTime.toISOString()}`);
                }
              } else {
                console.warn(`Could not extract timestamp from GPS field: "${gpsField.value}"`);
              }
            } else {
              console.warn('GPS field not found in handoff data');
            }
          }
        } catch (error) {
          console.warn(`Could not retrieve handoff time from GPS: ${error}`);
        }
        
        // If still at_shop, first transition to in_service, then to service_complete
        if (job.state === 'at_shop') {
          console.log(`✅ Service completed for job ${job.jobId} (at_shop), transitioning through in_service to service_complete`);
          
          // First transition to in_service using the handoff time
          await jobEventsService.transitionJobState(job.id, 'in_service', {
            actor: 'Technician',
            timestamp: handoffTime || undefined, // Use handoff time if available
            metadata: {
              autoDetected: true,
              handoffTime: handoffTime?.toISOString(),
            },
          });
          
          // Then transition to service_complete using submission time
          await jobEventsService.transitionJobState(job.id, 'service_complete', {
            actor: 'System',
            timestamp: submittedAt ? new Date(submittedAt) : undefined,
            metadata: {
              completedAt: submittedAt ? new Date(submittedAt) : new Date(),
              autoDetected: true,
            },
          });
        } 
        // If already in_service, transition to service_complete
        else if (job.state === 'in_service') {
          console.log(`✅ Emissions Service Log completed for job ${job.jobId}, transitioning to service_complete`);
          
          await jobEventsService.transitionJobState(job.id, 'service_complete', {
            actor: 'System',
            timestamp: submittedAt ? new Date(submittedAt) : undefined,
            metadata: {
              completedAt: submittedAt ? new Date(submittedAt) : new Date(),
              autoDetected: true,
            },
          });
        }
      }
    } catch (error) {
      console.error(`Error checking job completion for ${job.jobId}:`, error);
    }
  }

  /**
   * Check if delivery form has been completed and transition to delivered
   */
  private async checkDeliveryCompletion(job: any): Promise<void> {
    try {
      // Check for Delivery Log submission (form 5632656)
      const result = await goCanvasService.checkSubmissionStatusForForm(job.jobId, '5632656');
      
      if (!result || result.status !== 'completed') {
        return; // No completed submission found yet
      }

      console.log(`✅ Delivery form completed for job ${job.jobId}, transitioning to delivered state`);
      
      // Transition job to delivered state using jobEvents service
      const { jobEventsService } = await import('./jobEvents');
      await jobEventsService.markDelivered(job.jobId, {
        timestamp: result.submittedAt ? new Date(result.submittedAt) : undefined,
        metadata: {
          submittedAt: result.submittedAt ? new Date(result.submittedAt) : new Date(),
          autoDetected: true,
        },
      });
      
    } catch (error) {
      console.error(`Error checking delivery completion for job ${job.jobId}:`, error);
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
