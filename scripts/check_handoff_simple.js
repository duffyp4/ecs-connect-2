import { goCanvasService } from '../server/services/gocanvas.js';

const JOB_ID = 'ECS-20251001220953-3011';

async function checkHandoffTime() {
  try {
    console.log(`\n🔍 Checking handoff time for job: ${JOB_ID}\n`);
    
    const handoffData = await goCanvasService.getHandoffTimeData(JOB_ID);
    
    if (!handoffData) {
      console.log('❌ No handoff data found');
      return;
    }

    console.log('📋 HANDOFF DATA FOUND:');
    console.log('='.repeat(80));
    
    if (handoffData.handoffFields) {
      console.log('\n✅ Handoff Fields:');
      handoffData.handoffFields.forEach(field => {
        console.log(`\n  Field: ${field.label}`);
        console.log(`  Value: ${field.value}`);
        console.log(`  Entry ID: ${field.entry_id}`);
      });
    }
    
    if (handoffData.responses) {
      console.log('\n\n📄 ALL RESPONSE FIELDS:');
      console.log('='.repeat(80));
      handoffData.responses.forEach(r => {
        if (r.label && r.label.toLowerCase().includes('handoff') || r.label && r.label.toLowerCase().includes('time')) {
          console.log(`\n  ${r.label}:`);
          console.log(`    Value: ${r.value}`);
          console.log(`    Entry ID: ${r.entry_id}`);
        }
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkHandoffTime();
