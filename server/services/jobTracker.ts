import { storage } from '../storage';
import { goCanvasService } from './gocanvas';
import { googleSheetsService } from './googleSheets';

export class JobTrackerService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30000; // 30 seconds for faster job completion detection

  startPolling(): void {
    if (this.pollingInterval) {
      return; // Already polling
    }

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

  private async checkJobCompletion(job: any): Promise<void> {
    try {
      const result = await goCanvasService.checkSubmissionStatus(job.jobId);
      
      if (!result) {
        console.warn(`Could not get status for job ${job.jobId}`);
        return;
      }

      const { status, submittedAt } = result;
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
          const handoffData = await goCanvasService.getHandoffTimeData(job.jobId);
          if (handoffData && handoffData.handoffFields) {
            const handoffDateField = handoffData.handoffFields.find((f: any) => f.label === 'Handoff Date');
            const handoffTimeField = handoffData.handoffFields.find((f: any) => f.label === 'Handoff Time');
            
            if (handoffDateField && handoffTimeField) {
              // Combine handoff date and time into a proper timestamp
              const handoffDateStr = handoffDateField.value; // e.g., "08/26/2025"
              const handoffTimeStr = handoffTimeField.value; // e.g., "02:50 PM"
              
              // Parse the handoff date and time more reliably
              // handoffDateStr format: "08/26/2025", handoffTimeStr format: "02:50 PM"
              const [month, day, year] = handoffDateStr.split('/');
              let [time, ampm] = handoffTimeStr.trim().split(' ').filter((part: string) => part); // Remove extra spaces
              let handoffDateTime: Date;
              let hours = 0;
              let minutes = 0;
              
              if (time && ampm) {
                [hours, minutes] = time.split(':').map(Number);
              
                // Convert to 24-hour format
                if (ampm === 'PM' && hours !== 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                
                handoffDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
              } else {
                console.error(`Invalid time format for job ${job.jobId}: "${handoffTimeStr}"`);
                handoffDateTime = new Date(NaN); // Force invalid date
              }
              
              console.log(`🔍 HANDOFF TIME DEBUG for job ${job.jobId}:`);
              console.log(`  - Raw handoff date: "${handoffDateStr}", Raw handoff time: "${handoffTimeStr}"`);
              console.log(`  - Parsed components: Month=${month}, Day=${day}, Year=${year}, Hours=${hours}, Minutes=${minutes}`);
              console.log(`  - Final handoff timestamp: ${handoffDateTime.toISOString()}`);
              console.log(`  - Completion timestamp: ${completedTime.toISOString()}`);
              
              if (!isNaN(handoffDateTime.getTime())) {
                handoffTime = handoffDateTime;
                
                // Calculate Time with Tech (Handoff to Completed)
                timeWithTech = Math.round((completedTime.getTime() - handoffTime.getTime()) / (1000 * 60));
                
                console.log(`  - Time difference calculation: ${completedTime.getTime()} - ${handoffTime.getTime()} = ${completedTime.getTime() - handoffTime.getTime()} ms`);
                console.log(`  - Time with Tech: ${timeWithTech} minutes (${Math.round(timeWithTech / 60 * 10) / 10} hours)`);
              } else {
                console.warn(`Could not parse handoff time for job ${job.jobId}: ${handoffDateStr} ${handoffTimeStr}`);
              }
            }
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
