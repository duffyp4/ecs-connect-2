import { GoCanvasService } from '../server/services/gocanvas';
import { fieldMapper } from '../shared/fieldMapper';

/**
 * Show the EXACT field order for the first part in submission 246540919
 * to compare with the GoCanvas UI
 */

async function showDetailedFieldOrder() {
  const gocanvas = new GoCanvasService(
    process.env.GOCANVAS_USERNAME!,
    process.env.GOCANVAS_PASSWORD!,
    '5692831',
    false
  );
  
  const PARTS_FIELD_IDS = fieldMapper.getPartsFieldIds();
  const fieldIdToName = new Map<number, string>();
  Object.entries(PARTS_FIELD_IDS).forEach(([name, id]) => {
    fieldIdToName.set(id, name);
  });
  
  // Fetch submission 246540919 (the one in the screenshot)
  const dispatchId = '47221004';
  
  console.log('Fetching dispatch...');
  const dispatch = await gocanvas.getDispatchById(dispatchId);
  
  console.log('Fetching submission...');
  const submission = await gocanvas.getSubmissionById(dispatch.submission_id);
  
  const responses = submission.rawData?.responses || [];
  
  // Find serial positions
  const serialIndices: number[] = [];
  responses.forEach((r: any, idx: number) => {
    if (r.entry_id === PARTS_FIELD_IDS.ecsSerial && r.value) {
      serialIndices.push(idx);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('FIRST PART - COMPLETE FIELD ORDER FROM API');
  console.log('='.repeat(80));
  
  const firstSerialIdx = serialIndices[0];
  const secondSerialIdx = serialIndices[1];
  
  console.log(`\nStarting at index ${firstSerialIdx}, ending at index ${secondSerialIdx - 1}`);
  console.log(`Total responses: ${secondSerialIdx - firstSerialIdx}\n`);
  
  // Show every single field in order
  for (let i = firstSerialIdx; i < secondSerialIdx; i++) {
    const r = responses[i];
    const fieldName = fieldIdToName.get(r.entry_id) || 'UNKNOWN';
    const value = r.value || '(empty)';
    
    // Highlight parts-related fields
    const isPartsField = fieldIdToName.has(r.entry_id);
    const prefix = isPartsField ? '📍' : '  ';
    
    console.log(`${prefix} [${i}] ${fieldName.padEnd(20)} (ID: ${r.entry_id}) = "${value}"`);
    
    // Stop after showing 30 fields to avoid too much output
    if (i - firstSerialIdx >= 29) {
      console.log(`\n... (${secondSerialIdx - i - 1} more fields) ...\n`);
      break;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON: What order should they be in the UI?');
  console.log('='.repeat(80));
  console.log(`
Based on typical form design, the UI probably shows:
1. Part Name
2. Process
3. ECS Serial Number  ← You're worried this isn't first in JSON
4. Filter Part Number
5. PO Number
6. Mileage
7. Unit VIN
8. Gasket/Clamps
9. EC
10. EG
11. EK
... (tech fields)

But in the JSON API response, we're seeing:
Index ${firstSerialIdx}: ECS Serial Number ← This IS first!
Index ${firstSerialIdx + 1}: (next field)
Index ${firstSerialIdx + 2}: (next field)
...
`);
}

showDetailedFieldOrder().catch(console.error);
