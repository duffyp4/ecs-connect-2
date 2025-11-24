import { GoCanvasService } from '../server/services/gocanvas';
import { fieldMapper } from '../shared/fieldMapper';

/**
 * Test script to validate GoCanvas loop screen response ordering assumption
 * 
 * Tests 4 completed emissions submissions to verify:
 * 1. Do all fields for Part 1 come before all fields for Part 2?
 * 2. Where does the serial number appear in each part's field sequence?
 * 3. Are responses ever interleaved by field type?
 */

async function testResponseOrdering() {
  console.log('='.repeat(80));
  console.log('GOCANVAS RESPONSE ORDERING TEST');
  console.log('='.repeat(80));
  console.log('');
  
  const gocanvas = new GoCanvasService(
    process.env.GOCANVAS_USERNAME!,
    process.env.GOCANVAS_PASSWORD!,
    '5692831', // Emissions Service Log form ID
    false // not dry run
  );
  
  // Dispatch IDs from recent completed jobs
  const dispatchIds = [
    '47221004', // ECS-20251124202349-8111
    '47220794', // ECS-20251124201139-3852
    '47220365', // ECS-20251124194150-1725
    '47220139', // ECS-20251124190619-4383
  ];
  
  const PARTS_FIELD_IDS = fieldMapper.getPartsFieldIds();
  
  for (const dispatchId of dispatchIds) {
    console.log('\n' + '='.repeat(80));
    console.log(`DISPATCH ID: ${dispatchId}`);
    console.log('='.repeat(80));
    
    // Step 1: Get submission ID from dispatch
    const dispatch = await gocanvas.getDispatchById(dispatchId);
    
    if (!dispatch.submission_id) {
      console.log('❌ No submission found for this dispatch (not completed yet)');
      continue;
    }
    
    console.log(`Submission ID: ${dispatch.submission_id}`);
    
    // Step 2: Fetch full submission details
    const submission = await gocanvas.getSubmissionById(dispatch.submission_id);
    
    if (submission.error) {
      console.log(`❌ Error fetching submission: ${submission.error}`);
      continue;
    }
    
    const responses = submission.rawData?.responses || [];
    console.log(`Total responses: ${responses.length}`);
    
    // Step 3: Find all ECS Serial Number fields
    const serialResponses = responses.filter((r: any) => 
      r.entry_id === PARTS_FIELD_IDS.ecsSerial && r.value
    );
    
    console.log(`\nFound ${serialResponses.length} parts with serial numbers:`);
    serialResponses.forEach((r: any, i: number) => {
      console.log(`  Part ${i + 1}: ${r.value} (multi_key: "${r.multi_key}")`);
    });
    
    // Step 4: Analyze response ordering
    console.log('\n--- RESPONSE ORDERING ANALYSIS ---');
    
    // Find indices of serial numbers in response array
    const serialIndices: number[] = [];
    responses.forEach((r: any, idx: number) => {
      if (r.entry_id === PARTS_FIELD_IDS.ecsSerial && r.value) {
        serialIndices.push(idx);
      }
    });
    
    console.log(`Serial number positions in response array: [${serialIndices.join(', ')}]`);
    
    // For each serial, show what comes before/after it
    serialIndices.forEach((serialIdx, partIndex) => {
      const serial = responses[serialIdx];
      const nextSerialIdx = partIndex < serialIndices.length - 1 
        ? serialIndices[partIndex + 1] 
        : responses.length;
      
      console.log(`\n📦 PART ${partIndex + 1}: Serial "${serial.value}" at index ${serialIdx}`);
      console.log(`   Range: ${serialIdx} to ${nextSerialIdx - 1} (${nextSerialIdx - serialIdx} responses)`);
      
      // Show all responses in this range
      const partResponses = responses.slice(serialIdx, nextSerialIdx);
      const partsOnlyResponses = partResponses.filter((r: any) => r.multi_key === serial.multi_key);
      
      console.log(`   Responses with same multi_key "${serial.multi_key}": ${partsOnlyResponses.length}`);
      
      // Show first 5 responses to see ordering pattern
      console.log(`   First 5 responses in range:`);
      partResponses.slice(0, 5).forEach((r: any, i: number) => {
        const fieldName = Object.entries(PARTS_FIELD_IDS).find(([_, id]) => id === r.entry_id)?.[0] || 'UNKNOWN';
        console.log(`     [${serialIdx + i}] ${fieldName} (${r.entry_id}) = "${r.value}" | multi_key: "${r.multi_key}"`);
      });
      
      // Check if serial is first in its group
      const firstInGroup = partsOnlyResponses[0];
      const serialPosition = partsOnlyResponses.findIndex((r: any) => r.entry_id === PARTS_FIELD_IDS.ecsSerial);
      
      if (serialPosition === 0) {
        console.log(`   ✅ Serial is FIRST in this part's responses`);
      } else {
        console.log(`   ⚠️  Serial is at position ${serialPosition} (not first!)`);
        console.log(`   Fields before serial:`);
        partsOnlyResponses.slice(0, serialPosition).forEach((r: any) => {
          const fieldName = Object.entries(PARTS_FIELD_IDS).find(([_, id]) => id === r.entry_id)?.[0] || 'UNKNOWN';
          console.log(`     - ${fieldName}: "${r.value}"`);
        });
      }
    });
    
    // Step 5: Test our slicing algorithm
    console.log('\n--- TESTING OUR SLICING ALGORITHM ---');
    
    const partsBySerial = new Map<string, any>();
    
    for (let i = 0; i < serialIndices.length; i++) {
      const serialIdx = serialIndices[i];
      const serialResponse = responses[serialIdx];
      const serialNumber = serialResponse.value;
      const multiKey = serialResponse.multi_key;
      
      const nextSerialIdx = i < serialIndices.length - 1 
        ? serialIndices[i + 1] 
        : responses.length;
      
      const thisPartResponses = responses
        .slice(serialIdx, nextSerialIdx)
        .filter((r: any) => r.multi_key === multiKey);
      
      const partData: any = { ecsSerial: serialNumber, part: multiKey };
      
      thisPartResponses.forEach((r: any) => {
        if (r.entry_id === PARTS_FIELD_IDS.part) partData.part = r.value;
        if (r.entry_id === PARTS_FIELD_IDS.process) partData.process = r.value;
        if (r.entry_id === PARTS_FIELD_IDS.filterPn) partData.filterPn = r.value;
        if (r.entry_id === PARTS_FIELD_IDS.ecsPartNumber) partData.ecsPartNumber = r.value;
        if (r.entry_id === PARTS_FIELD_IDS.passOrFail) partData.passOrFail = r.value;
      });
      
      partsBySerial.set(serialNumber, partData);
    }
    
    console.log(`\nExtracted ${partsBySerial.size} parts:`);
    partsBySerial.forEach((partData, serial) => {
      console.log(`  ${serial}: ${partData.part} | Process: ${partData.process || 'N/A'} | Filter: ${partData.filterPn || 'N/A'}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

testResponseOrdering().catch(console.error);
