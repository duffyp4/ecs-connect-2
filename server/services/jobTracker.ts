import { storage } from '../storage';
import { goCanvasService } from './gocanvas';
import { googleSheetsService } from './googleSheets';

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
          console.log(`\n🕒 CHECKING FOR WORKFLOW TIMESTAMPS IN REVISION HISTORY...`);
          
          // FIRST: Try to get workflow timestamps from revision history (more accurate)
          let handoffDateTime: Date | null = null;
          const submissionId = result.submissionId;
          
          if (submissionId) {
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
            console.log(`⚠️ No workflow revisions found, falling back to form field parsing...`);
            const handoffData = await goCanvasService.getHandoffTimeData(job.jobId);
            if (handoffData && handoffData.handoffFields) {
              const handoffDateField = handoffData.handoffFields.find((f: any) => f.label === 'Handoff Date');
              const handoffTimeField = handoffData.handoffFields.find((f: any) => f.label === 'Handoff Time');
              // Combine handoff date and time into a proper timestamp
              const handoffDateStr = handoffDateField.value; // e.g., "08/26/2025"
              const handoffTimeStr = handoffTimeField.value; // e.g., "02:50 PM"
              
              // Parse the handoff date and time more reliably
              // handoffDateStr format: "08/26/2025", handoffTimeStr format: "02:50 PM"
              const [month, day, year] = handoffDateStr.split('/');
              let [time, ampm] = handoffTimeStr.trim().split(' ').filter((part: string) => part); // Remove extra spaces
              let hours = 0;
              let minutes = 0;
              
              if (time && ampm) {
                [hours, minutes] = time.split(':').map(Number);
              
                // Convert to 24-hour format
                if (ampm === 'PM' && hours !== 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                
                // Create handoff time in the same timezone context as GoCanvas submitted_at
                // GoCanvas submitted_at comes as ISO string (e.g., "2025-08-26T21:53:51.000Z")
                // We need to create handoff time that's consistent with that timezone context
                
                // Parse the submitted_at to understand the timezone context
                const submittedDate = submittedAt ? new Date(submittedAt) : new Date();
                console.log(`🔍 TIMEZONE CONTEXT from GoCanvas submitted_at: ${submittedDate.toISOString()}`);
                
                // TIMEZONE FIX: Users enter handoff times in their local timezone (likely EST/CST)
                // but we need to convert to UTC to match GoCanvas submitted_at timestamps
                
                // First, create handoff time assuming user's local timezone (EST = UTC-5)
                const userLocalHandoff = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
                
                // Estimate timezone offset based on completion time vs handoff time comparison
                const submittedHour = submittedDate.getHours();
                const estimatedLocalHour = hours + (ampm === 'PM' && hours !== 12 ? 12 : 0) + (ampm === 'AM' && hours === 12 ? -12 : 0);
                const hourDifference = submittedHour - estimatedLocalHour;
                
                console.log(`🔍 TIMEZONE ANALYSIS:`);
                console.log(`  - Submitted hour (UTC): ${submittedHour}`);
                console.log(`  - Handoff hour (as entered): ${estimatedLocalHour}`);
                console.log(`  - Estimated timezone offset: ${hourDifference} hours`);
                
                // Apply timezone offset to convert user local time to UTC
                // Common US timezones: EST (-5), CST (-6), MST (-7), PST (-8)
                let timezoneOffsetHours = 5; // Default to EST (UTC-5)
                if (Math.abs(hourDifference - 5) < 2) timezoneOffsetHours = 5; // EST
                else if (Math.abs(hourDifference - 6) < 2) timezoneOffsetHours = 6; // CST
                else if (Math.abs(hourDifference - 7) < 2) timezoneOffsetHours = 7; // MST
                else if (Math.abs(hourDifference - 8) < 2) timezoneOffsetHours = 8; // PST
                
                // Convert to UTC by adding the timezone offset
                handoffDateTime = new Date(userLocalHandoff.getTime() + (timezoneOffsetHours * 60 * 60 * 1000));
                
                console.log(`🔧 TIMEZONE CORRECTION:`);
                console.log(`  - User local time: ${userLocalHandoff.toISOString()}`);
                console.log(`  - Applied offset: +${timezoneOffsetHours} hours (UTC-${timezoneOffsetHours})`);
                console.log(`  - Corrected UTC time: ${handoffDateTime.toISOString()}`);
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
