import { storage } from '../storage';
import { jobEventsService } from './jobEvents';
import { goCanvasService } from './gocanvas';
import { getFormTypeFromId } from '@shared/formVersions';
import { updatePartsFromSubmission, handleAdditionalComments } from './parts-update';

export type FormType = 'PICKUP' | 'EMISSIONS' | 'DELIVERY';
export type SubmissionSource = 'push_notification' | 'manual_check' | 'polling';

export interface ExtractedPickupData {
  driverNotes?: string;
  pickupDateTime?: Date;
  gpsData?: { lat: number; lon: number; timestamp: Date };
  photoUrl?: string;
}

export interface ExtractedEmissionsData {
  handoffTime?: Date;
  gpsData?: { lat: number; lon: number; timestamp: Date };
  additionalComments?: string;
}

export interface ExtractedDeliveryData {
  driverNotes?: string;
  deliveryDateTime?: Date;
  deliveredTo?: string;
  gpsData?: { lat: number; lon: number; timestamp: Date };
  photoUrl?: string;
}

export interface ProcessedSubmission {
  jobId: string;
  formType: FormType;
  submittedAt: Date;
  userId?: string;
  source: SubmissionSource;
  pickup?: ExtractedPickupData;
  emissions?: ExtractedEmissionsData;
  delivery?: ExtractedDeliveryData;
}

export function extractJobId(responses: any[]): string | null {
  if (!Array.isArray(responses)) {
    return null;
  }

  const jobIdField = responses.find(r => 
    r.label?.toLowerCase().includes('job') && 
    r.value?.startsWith('ECS-')
  );
  
  return jobIdField?.value || null;
}

function extractGpsTimestamp(gpsValue: string): Date | null {
  if (!gpsValue) return null;
  
  const timeMatch = gpsValue.match(/Time:(\d+\.?\d*)/);
  
  if (!timeMatch || !timeMatch[1]) return null;
  
  const unixTimestamp = parseFloat(timeMatch[1]);
  const timestampMs = unixTimestamp > 10000000000 ? unixTimestamp : unixTimestamp * 1000;
  const timestamp = new Date(timestampMs);
  
  if (isNaN(timestamp.getTime()) || 
      timestamp.getFullYear() < 2020 || 
      timestamp.getFullYear() > 2100) {
    console.warn(`Invalid GPS timestamp parsed: "${timeMatch[1]}" → year ${timestamp.getFullYear()}`);
    return null;
  }
  
  return timestamp;
}

function extractPickupData(responses: any[]): ExtractedPickupData {
  const data: ExtractedPickupData = {};
  
  for (const response of responses) {
    switch (response.label) {
      case 'Driver Notes':
        if (response.value?.trim()) {
          data.driverNotes = response.value.trim();
        }
        break;
      case 'GPS':
        if (response.value) {
          const timestamp = extractGpsTimestamp(response.value);
          if (timestamp) {
            data.gpsData = { lat: 0, lon: 0, timestamp };
          }
        }
        break;
    }
  }
  
  return data;
}

function extractEmissionsData(responses: any[]): ExtractedEmissionsData {
  const data: ExtractedEmissionsData = {};
  
  for (const response of responses) {
    switch (response.label) {
      case 'New GPS':
        if (response.value) {
          const timestamp = extractGpsTimestamp(response.value);
          if (timestamp) {
            data.handoffTime = timestamp;
            data.gpsData = { lat: 0, lon: 0, timestamp };
          }
        }
        break;
    }
  }
  
  return data;
}

function extractDeliveryData(responses: any[]): ExtractedDeliveryData {
  const data: ExtractedDeliveryData = {};
  
  for (const response of responses) {
    switch (response.label) {
      case 'Driver Notes':
        if (response.value?.trim()) {
          data.driverNotes = response.value.trim();
        }
        break;
      case 'Delivered To':
        if (response.value?.trim()) {
          data.deliveredTo = response.value.trim();
        }
        break;
      case 'GPS':
        if (response.value) {
          const timestamp = extractGpsTimestamp(response.value);
          if (timestamp) {
            data.gpsData = { lat: 0, lon: 0, timestamp };
          }
        }
        break;
    }
  }
  
  return data;
}

async function getSubmitterName(userId: string | undefined, role: string = 'Driver'): Promise<string> {
  if (!userId) return role;
  
  try {
    const userData = await goCanvasService.getGoCanvasUserById(userId);
    const firstName = userData.first_name || '';
    const lastName = userData.last_name || '';
    const name = `${firstName} ${lastName}`.trim() || `User ${userId}`;
    return role ? `${name} (${role})` : name;
  } catch (error) {
    console.warn(`Could not fetch GoCanvas user ${userId}:`, error);
    return `${role} (ID: ${userId})`;
  }
}

async function handlePickupCompletion(
  processed: ProcessedSubmission
): Promise<void> {
  const { jobId, submittedAt, source, userId, pickup } = processed;
  
  console.log(`✅ Pickup form completed for job ${jobId} (${source})`);
  
  await jobEventsService.markPickedUp(
    jobId,
    1,
    {
      metadata: {
        submittedAt,
        autoDetected: true,
        source,
      },
    }
  );

  if (pickup?.driverNotes) {
    const submitterName = await getSubmitterName(userId, 'Driver');
    
    await storage.createJobComment({
      jobId,
      userId: submitterName,
      commentText: `[Driver Notes] ${pickup.driverNotes}`,
    });
    
    console.log(`✅ Added driver notes as job comment for ${jobId} by ${submitterName}`);
  }
}

async function handleEmissionsCompletion(
  processed: ProcessedSubmission,
  responses: any[]
): Promise<void> {
  const { jobId, submittedAt, source, userId, emissions } = processed;
  
  console.log(`✅ Service form completed for job ${jobId} (${source})`);
  
  const job = await storage.getJobByJobId(jobId);
  
  if (!job) {
    console.error(`Job ${jobId} not found`);
    return;
  }

  const handoffTime = emissions?.handoffTime;
  
  if (handoffTime) {
    console.log(`✅ Found handoff time from GPS field: ${handoffTime.toISOString()}`);
  }

  if (job.state === 'at_shop') {
    console.log(`✅ Service completed for job ${jobId} (at_shop), transitioning through in_service to service_complete`);
    
    await jobEventsService.transitionJobState(jobId, 'in_service', {
      actor: 'Technician',
      timestamp: handoffTime || undefined,
      metadata: {
        autoDetected: true,
        source,
        handoffTime: handoffTime?.toISOString(),
      },
    });
    
    await jobEventsService.transitionJobState(jobId, 'service_complete', {
      actor: 'System',
      timestamp: submittedAt,
      metadata: {
        completedAt: submittedAt,
        autoDetected: true,
        source,
      },
    });
  } else if (job.state === 'in_service') {
    console.log(`✅ Service form completed for job ${jobId}, transitioning to service_complete`);
    
    await jobEventsService.transitionJobState(jobId, 'service_complete', {
      actor: 'System',
      timestamp: submittedAt,
      metadata: {
        completedAt: submittedAt,
        autoDetected: true,
        source,
      },
    });
  }
  
  console.log('📦 Extracting parts data from GoCanvas submission...');
  await updatePartsFromSubmission(jobId, responses, storage);
  
  await handleAdditionalComments(jobId, responses, userId, storage);
}

async function handleDeliveryCompletion(
  processed: ProcessedSubmission
): Promise<void> {
  const { jobId, submittedAt, source, userId, delivery } = processed;
  
  console.log(`✅ Delivery form completed for job ${jobId} (${source})`);
  
  await jobEventsService.markDelivered(jobId, {
    timestamp: submittedAt,
    metadata: {
      submittedAt,
      autoDetected: true,
      source,
    },
  });
  
  if (delivery?.driverNotes) {
    const submitterName = await getSubmitterName(userId);
    
    await storage.createJobComment({
      jobId,
      userId: submitterName,
      commentText: `[Driver Notes] ${delivery.driverNotes}`,
    });
    
    console.log(`✅ Added delivery driver notes as job comment for ${jobId} by ${submitterName}`);
  }
}

export async function processCompletedSubmission(
  formId: string,
  submissionData: any,
  source: SubmissionSource
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const responses = submissionData.responses || submissionData.rawData?.responses || [];
    const jobId = extractJobId(responses);
    
    if (!jobId) {
      console.warn('⚠️ No Job ID found in submission:', submissionData.id);
      return { success: false, error: 'No Job ID found in submission' };
    }

    console.log(`📋 Processing submission for Job ID: ${jobId}, Form: ${formId}, Source: ${source}`);

    const formType = getFormTypeFromId(formId);
    
    if (!formType) {
      console.warn('⚠️ Unknown form ID:', formId);
      return { success: false, error: `Unknown form ID: ${formId}` };
    }

    const submittedAt = submissionData.submitted_at 
      ? new Date(submissionData.submitted_at) 
      : new Date();
    
    const userId = submissionData.user_id || submissionData.rawData?.user_id;

    const processed: ProcessedSubmission = {
      jobId,
      formType,
      submittedAt,
      userId,
      source,
    };

    switch (formType) {
      case 'PICKUP':
        processed.pickup = extractPickupData(responses);
        await handlePickupCompletion(processed);
        break;
      
      case 'EMISSIONS':
        processed.emissions = extractEmissionsData(responses);
        await handleEmissionsCompletion(processed, responses);
        break;
      
      case 'DELIVERY':
        processed.delivery = extractDeliveryData(responses);
        await handleDeliveryCompletion(processed);
        break;
    }

    console.log(`✅ Successfully processed ${formType} submission for job ${jobId}`);
    return { success: true, jobId };
    
  } catch (error) {
    console.error('Error processing submission:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
