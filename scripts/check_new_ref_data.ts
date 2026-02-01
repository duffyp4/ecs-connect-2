import { goCanvasService } from '../server/services/gocanvas';

async function checkNewRefData() {
  try {
    console.log('=== Reference Data 1031258 (new Filter Part Numbers) ===\n');
    
    const refData = await goCanvasService.getReferenceDataById('1031258');
    
    console.log('Name:', refData.name);
    console.log('Total rows:', refData.rows?.length || 0);
    console.log('\nColumns:');
    if (refData.columns) {
      refData.columns.forEach((col: any, i: number) => {
        console.log(`  [${i}] ${col}`);
      });
    }
    
    console.log('\nSample row with column mapping:');
    if (refData.rows && refData.rows.length > 5) {
      const sampleRow = refData.rows[5];
      refData.columns.forEach((col: any, i: number) => {
        console.log(`  ${col}: "${sampleRow[i] || ''}"`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkNewRefData();
