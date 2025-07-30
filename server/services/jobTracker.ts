import { storage } from '../storage';
import { goCanvasService } from './gocanvas';
import { googleSheetsService } from './googleSheets';

export class JobTrackerService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30000; // 30 seconds

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
      const inProgressJobs = await storage.getJobsByStatus('in-progress');
      
      const jobsToCheck = [...pendingJobs, ...inProgressJobs];

      for (const job of jobsToCheck) {
        if (job.gocanvasSubmissionId) {
          await this.checkJobCompletion(job);
        }
      }
    } catch (error) {
      console.error('Error checking pending jobs:', error);
    }
  }

  private async checkJobCompletion(job: any): Promise<void> {
    try {
      const status = await goCanvasService.checkSubmissionStatus(job.gocanvasSubmissionId!);
      
      if (!status) {
        console.warn(`Could not get status for job ${job.jobId}`);
        return;
      }

      const currentTime = new Date();
      let updates: any = {};

      // Update job status based on GoCanvas submission status
      if (status === 'completed' && job.status !== 'completed') {
        const turnaroundTime = job.initiatedAt ? 
          Math.round((currentTime.getTime() - new Date(job.initiatedAt).getTime()) / (1000 * 60)) : 
          null;

        updates = {
          status: 'completed',
          completedAt: currentTime,
          turnaroundTime,
        };

        console.log(`Job ${job.jobId} completed with turnaround time: ${turnaroundTime} minutes`);
      } else if (status === 'in-progress' && job.status === 'pending') {
        updates = {
          status: 'in-progress',
        };

        console.log(`Job ${job.jobId} moved to in-progress`);
      }

      // Check for overdue jobs (more than 6 hours)
      if (job.status === 'in-progress' && job.initiatedAt) {
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
    overdueJobs: number;
  }> {
    try {
      const allJobs = await storage.getAllJobs();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeJobs = allJobs.filter(job => 
        job.status === 'pending' || job.status === 'in-progress'
      ).length;

      const completedToday = allJobs.filter(job => 
        job.status === 'completed' && 
        job.completedAt && 
        new Date(job.completedAt) >= today
      ).length;

      const completedJobs = allJobs.filter(job => 
        job.status === 'completed' && job.turnaroundTime
      );

      const averageTurnaround = completedJobs.length > 0 ? 
        completedJobs.reduce((sum, job) => sum + (job.turnaroundTime || 0), 0) / completedJobs.length :
        0;

      const overdueJobs = allJobs.filter(job => job.status === 'overdue').length;

      return {
        activeJobs,
        completedToday,
        averageTurnaround: Math.round(averageTurnaround / 60 * 10) / 10, // Convert to hours with 1 decimal
        overdueJobs,
      };
    } catch (error) {
      console.error('Error calculating metrics:', error);
      return { activeJobs: 0, completedToday: 0, averageTurnaround: 0, overdueJobs: 0 };
    }
  }
}

export const jobTrackerService = new JobTrackerService();
