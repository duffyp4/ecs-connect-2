/**
 * Shared service for updating job parts from GoCanvas submissions
 * Used by both webhook handler and manual "Check for Updates" button
 * 
 * CRITICAL: This service uses ECS Serial Number as the unique identifier
 * for matching parts, not the part name. This prevents data loss when
 * multiple parts have the same name (e.g., two DPFs).
 */

import { fieldMapper } from '../../shared/fieldMapper';
import type { IStorage } from '../storage';

/**
 * Extract and update parts data from GoCanvas submission
 * Matches parts by ECS Serial Number for accuracy
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

    // Group responses by ECS Serial Number (unique identifier)
    // This is CRITICAL: We must use serial number, not part name, because
    // jobs can have multiple parts with the same name (e.g., 3 DOCs)
    const partsBySerial = new Map<string, any>();
    const serialToPartName = new Map<string, string>();
    
    // DEBUG: Log first 10 part-related responses to see actual field IDs
    const partsRelatedResponses = responses.filter(r => 
      r.entry_id >= 736551799 && r.entry_id <= 736551920 && r.value
    ).slice(0, 15);
    if (partsRelatedResponses.length > 0) {
      console.log('🔍 Sample parts-related field IDs in submission:');
      partsRelatedResponses.forEach(r => {
        console.log(`   Field ${r.entry_id}: "${r.value}" (multi_key: ${r.multi_key || 'none'})`);
      });
    }
    
    // FIRST PASS: Extract ECS Serial Numbers and map them to part names (multi_key)
    for (const response of responses) {
      const entryId = response.entry_id;
      const value = response.value;
      const multiKey = response.multi_key;
      
      // ECS Serial Number field - this is the unique identifier
      if (entryId === PARTS_FIELD_IDS.ecsSerial && value && multiKey) {
        serialToPartName.set(value, multiKey); // Map serial -> part name
        if (!partsBySerial.has(value)) {
          partsBySerial.set(value, { ecsSerial: value, part: multiKey });
        }
      }
    }
    
    console.log(`📋 Found ${serialToPartName.size} ECS Serial Numbers in GoCanvas submission`);
    if (serialToPartName.size > 0) {
      console.log(`   Serials: ${Array.from(serialToPartName.keys()).join(', ')}`);
    }
    
    // SECOND PASS: Fill in all other fields using the serial number as the key
    for (const response of responses) {
      const entryId = response.entry_id;
      const value = response.value;
      const multiKey = response.multi_key;
      
      // Skip if no multi_key (title row has no multi_key)
      if (!multiKey) continue;
      
      // Find the serial number for this multi_key (part name)
      let serialForThisPart: string | undefined;
      for (const [serial, partName] of Array.from(serialToPartName.entries())) {
        if (partName === multiKey) {
          serialForThisPart = serial;
          break;
        }
      }
      
      // Use the serial number as the key (or fallback to part name if no serial)
      const partKey = serialForThisPart || multiKey;
      
      // Ensure we have an entry for this part
      if (!partsBySerial.has(partKey)) {
        partsBySerial.set(partKey, { 
          part: multiKey,
          ...(serialForThisPart ? { ecsSerial: serialForThisPart } : {})
        });
      }
      
      const partData = partsBySerial.get(partKey)!;
      
      // CSR-filled fields (might be updated by technician)
      if (entryId === PARTS_FIELD_IDS.process) partData.process = value;
      if (entryId === PARTS_FIELD_IDS.filterPn) partData.filterPn = value;
      if (entryId === PARTS_FIELD_IDS.ecsSerial) partData.ecsSerial = value;
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
        // Format repairs: replace newlines with commas for clean display
        partData.repairsPerformed = value ? value.split('\n').filter((s: string) => s.trim()).join(', ') : value;
      }
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
 * Uses ECS Serial Number to identify which part the comment belongs to
 */
export async function handleAdditionalComments(
  jobId: string,
  responses: any[],
  userId: string | undefined,
  storage: IStorage
): Promise<void> {
  try {
    const additionalCommentsFields = responses.filter((r: any) => 
      r.entry_id === 736551926 && r.value && r.value.trim() // "Additional Comments"
    );
    
    if (additionalCommentsFields.length === 0) {
      return; // No comments to process
    }
    
    const { goCanvasService } = await import('./gocanvas');
    const PARTS_FIELD_IDS = fieldMapper.getPartsFieldIds();
    
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
    for (const commentField of additionalCommentsFields) {
      const partKey = commentField.multi_key;
      
      // Find ECS Serial Number for this part (same multi_key)
      const ecsSerialField = responses.find((r: any) => 
        r.entry_id === PARTS_FIELD_IDS.ecsSerial && r.multi_key === partKey
      );
      
      const ecsSerial = ecsSerialField?.value || partKey || 'Unknown Part';
      
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
