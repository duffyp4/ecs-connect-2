/**
 * Shared service for updating job parts from GoCanvas submissions
 * Used by both webhook handler and manual "Check for Updates" button
 * 
 * CRITICAL: This service uses ECS Serial Number as the unique identifier
 * for matching parts, not the part name. This prevents data loss when
 * multiple parts have the same name (e.g., two DPFs).
 * 
 * UPDATED: multi_key is now the ECS Serial Number (not the part name).
 * This simplifies extraction - just group by multi_key directly.
 */

import { fieldMapper } from '../../shared/fieldMapper';
import type { IStorage } from '../storage';

/**
 * Extract and update parts data from GoCanvas submission
 * Now uses multi_key directly as the serial number (after GoCanvas form update)
 */
export async function updatePartsFromSubmission(
  jobId: string,
  responses: any[],
  storage: IStorage
): Promise<void> {
  try {
    // Dynamically load field IDs from the field mapping JSON
    // This automatically updates when the form changes and field map is regenerated
    const PARTS_FIELD_IDS = fieldMapper.getPartsFieldIds();

    // SIMPLIFIED: multi_key IS now the ECS Serial Number (unique per part)
    // Just group all responses by multi_key - no complex position-based slicing needed!
    const partsBySerial = new Map<string, any>();
    
    // Also collect ALL raw fields for each part (for the detailed modal view)
    const rawFieldsBySerial = new Map<string, Array<{label: string, value: string | null, entry_id?: number}>>();
    
    // First pass: Find all unique serial numbers from responses with multi_key
    // The title field (ECS Serial) has no multi_key, but its VALUE is the serial
    // All other fields have multi_key = serial number
    for (const response of responses) {
      // Skip responses without multi_key (non-loop fields or title fields)
      if (!response.multi_key) {
        // Check if this is a title field (ECS Serial without multi_key)
        if (response.entry_id === PARTS_FIELD_IDS.ecsSerial && response.value) {
          const serialNumber = response.value;
          if (!partsBySerial.has(serialNumber)) {
            partsBySerial.set(serialNumber, { ecsSerial: serialNumber });
            rawFieldsBySerial.set(serialNumber, []);
          }
          // Add the ECS Serial as the first raw field
          rawFieldsBySerial.get(serialNumber)?.push({
            label: response.label || 'ECS Serial Number',
            value: response.value ?? null,
            entry_id: response.entry_id,
          });
        }
        continue;
      }
      
      const serialNumber = response.multi_key;
      
      // Initialize part data if not exists
      if (!partsBySerial.has(serialNumber)) {
        partsBySerial.set(serialNumber, { ecsSerial: serialNumber });
        rawFieldsBySerial.set(serialNumber, []);
      }
      
      // Store ALL raw fields for this part (for detailed modal view)
      rawFieldsBySerial.get(serialNumber)?.push({
        label: response.label || `Field ${response.entry_id}`,
        value: response.value ?? null,
        entry_id: response.entry_id,
      });
      
      const partData = partsBySerial.get(serialNumber);
      const entryId = response.entry_id;
      const value = response.value;
      
      // Extract field values based on entry_id
      // CSR-filled fields (might be updated by technician)
      if (entryId === PARTS_FIELD_IDS.part) partData.part = value;
      if (entryId === PARTS_FIELD_IDS.process) partData.process = value;
      if (entryId === PARTS_FIELD_IDS.filterPn) partData.filterPn = value;
      if (entryId === PARTS_FIELD_IDS.poNumber) partData.poNumber = value;
      if (entryId === PARTS_FIELD_IDS.mileage) partData.mileage = value;
      if (entryId === PARTS_FIELD_IDS.unitVin) partData.unitVin = value;
      if (entryId === PARTS_FIELD_IDS.gasketClamps) partData.gasketClamps = value;
      if (entryId === PARTS_FIELD_IDS.ec) partData.ec = value;
      if (entryId === PARTS_FIELD_IDS.eg) partData.eg = value;
      if (entryId === PARTS_FIELD_IDS.ek) partData.ek = value;
      
      // Technician-filled fields
      if (entryId === PARTS_FIELD_IDS.ecsPartNumber) partData.ecsPartNumber = value;
      if (entryId === PARTS_FIELD_IDS.passOrFail) partData.passOrFail = value;
      if (entryId === PARTS_FIELD_IDS.requireRepairs) partData.requireRepairs = value;
      if (entryId === PARTS_FIELD_IDS.failedReason) partData.failedReason = value;
      if (entryId === PARTS_FIELD_IDS.repairsPerformed) {
        partData.repairsPerformed = value ? value.split('\n').filter((s: string) => s.trim()).join(', ') : value;
      }
    }
    
    console.log(`📋 Found ${partsBySerial.size} parts by multi_key (ECS Serial) in GoCanvas submission`);
    for (const [serial, data] of Array.from(partsBySerial.entries())) {
      const fieldCount = Object.keys(data).length;
      console.log(`   Serial ${serial} (${data.part || 'unknown part'}): ${fieldCount} fields`);
    }
    
    if (partsBySerial.size === 0) {
      console.log('No parts data found in submission');
      return;
    }
    
    console.log(`Found ${partsBySerial.size} parts in submission`);
    
    // Get existing parts for this job
    const existingParts = await storage.getJobParts(jobId);
    
    // Process each part from GoCanvas submission (keyed by serial number)
    for (const [serialOrName, goCanvasData] of Array.from(partsBySerial.entries())) {
      const partName = goCanvasData.part;
      const serialNumber = goCanvasData.ecsSerial;
      
      // CRITICAL: Match by ECS Serial Number (unique identifier)
      // This handles multiple parts with the same name (e.g., three DOCs)
      let existingPart;
      
      if (serialNumber) {
        // If we have an ECS Serial, use it to find the exact part
        existingPart = existingParts.find((p: any) => p.ecsSerial === serialNumber);
        
        if (existingPart) {
          console.log(`Found existing part by serial "${serialNumber}" (${partName})`);
        } else {
          console.log(`No existing part found with serial "${serialNumber}" - technician may have added new part`);
        }
      } else {
        // Fallback: if no serial number, try matching by part name (for backward compatibility)
        // This should rarely happen if CSRs are using the auto-generation
        existingPart = existingParts.find((p: any) => p.part === partName && !p.ecsSerial);
        console.log(`⚠️ Part "${partName}" has no serial number - using name-based matching`);
      }
      
      // Build update/insert object with all fields from GoCanvas
      const partData: any = {};
      
      // Always include the part name
      partData.part = partName;
      
      // CSR-filled fields (technician might have changed them)
      if (goCanvasData.process !== undefined) partData.process = goCanvasData.process;
      if (goCanvasData.filterPn !== undefined) partData.filterPn = goCanvasData.filterPn;
      if (goCanvasData.ecsSerial !== undefined) partData.ecsSerial = goCanvasData.ecsSerial;
      if (goCanvasData.poNumber !== undefined) partData.poNumber = goCanvasData.poNumber;
      if (goCanvasData.mileage !== undefined) partData.mileage = goCanvasData.mileage;
      if (goCanvasData.unitVin !== undefined) partData.unitVin = goCanvasData.unitVin;
      if (goCanvasData.gasketClamps !== undefined) partData.gasketClamps = goCanvasData.gasketClamps;
      if (goCanvasData.ec !== undefined) partData.ec = goCanvasData.ec;
      if (goCanvasData.eg !== undefined) partData.eg = goCanvasData.eg;
      if (goCanvasData.ek !== undefined) partData.ek = goCanvasData.ek;
      
      // Technician-filled fields
      if (goCanvasData.ecsPartNumber !== undefined) partData.ecsPartNumber = goCanvasData.ecsPartNumber;
      if (goCanvasData.passOrFail !== undefined) partData.passOrFail = goCanvasData.passOrFail;
      if (goCanvasData.requireRepairs !== undefined) partData.requireRepairs = goCanvasData.requireRepairs;
      if (goCanvasData.failedReason !== undefined) partData.failedReason = goCanvasData.failedReason;
      if (goCanvasData.repairsPerformed !== undefined) partData.repairsPerformed = goCanvasData.repairsPerformed;
      
      // Include ALL raw fields for the detailed modal view
      const rawFields = rawFieldsBySerial.get(serialNumber) || [];
      if (rawFields.length > 0) {
        partData.rawGocanvasFields = rawFields;
        console.log(`   Captured ${rawFields.length} raw GoCanvas fields for part ${serialNumber}`);
      }
      
      if (existingPart) {
        // Update existing part with GoCanvas data
        await storage.updateJobPart(existingPart.id, partData);
        console.log(`✅ Updated part serial "${serialNumber}" (${partName}) with ${Object.keys(partData).length} fields from GoCanvas`);
      } else {
        // Technician added a new part in GoCanvas - create it
        await storage.createJobPart({
          jobId,
          ...partData,
        });
        console.log(`✅ Created new part serial "${serialNumber}" (${partName}) - technician added in GoCanvas`);
      }
    }
    
    console.log('✅ Parts data extraction complete');
  } catch (error) {
    console.error('Error updating parts from submission:', error);
    throw error;
  }
}

/**
 * Extract "Additional Comments" from GoCanvas submission and add as job comments
 * Uses multi_key directly as the ECS Serial Number (after GoCanvas form update)
 */
export async function handleAdditionalComments(
  jobId: string,
  responses: any[],
  userId: string | undefined,
  storage: IStorage
): Promise<void> {
  try {
    // Dynamically look up the Additional Comments field ID from the field mapping
    const additionalCommentsFieldId = fieldMapper.getFieldIdByType('emissions', 'Additional Comments');
    if (!additionalCommentsFieldId) {
      console.warn('Additional Comments field not found in field mapping - skipping comments extraction');
      return;
    }
    
    const additionalCommentsFields = responses.filter((r: any) => 
      r.entry_id === additionalCommentsFieldId && r.value && r.value.trim()
    );
    
    if (additionalCommentsFields.length === 0) {
      return; // No comments to process
    }
    
    const { goCanvasService } = await import('./gocanvas');
    
    // Get technician name from GoCanvas user API
    let submitterName = 'Technician';
    if (userId) {
      try {
        const userData = await goCanvasService.getGoCanvasUserById(userId);
        const firstName = userData.first_name || '';
        const lastName = userData.last_name || '';
        submitterName = `${firstName} ${lastName}`.trim() || `User ${userId}`;
      } catch (error) {
        console.warn(`Could not fetch GoCanvas user ${userId}:`, error);
        submitterName = `Technician (ID: ${userId})`;
      }
    }
    
    // Create one comment per part
    // multi_key IS now the ECS Serial Number directly
    for (const commentField of additionalCommentsFields) {
      const ecsSerial = commentField.multi_key || 'Unknown Part';
      
      await storage.createJobComment({
        jobId,
        userId: submitterName,
        commentText: `[Additional Comments - ${ecsSerial}] ${commentField.value.trim()}`,
      });
      
      console.log(`✅ Added additional comments for part "${ecsSerial}" as job comment for ${jobId} by ${submitterName}`);
    }
  } catch (error) {
    console.error('Error handling additional comments:', error);
    // Don't throw - comments are non-critical
  }
}
