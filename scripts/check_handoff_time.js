const GOCANVAS_USERNAME = process.env.GOCANVAS_USERNAME;
const GOCANVAS_PASSWORD = process.env.GOCANVAS_PASSWORD;
const FORM_ID = '5594156'; // Emissions Service Log
const JOB_ID = 'ECS-20251001220953-3011';

async function getSubmissionDetails() {
  try {
    // First, get all submissions for this form
    const authHeader = 'Basic ' + Buffer.from(`${GOCANVAS_USERNAME}:${GOCANVAS_PASSWORD}`).toString('base64');
    
    const response = await fetch(`https://www.gocanvas.com/apiv2/submissions.json?form_id=${FORM_ID}`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response length:', text.length, 'characters');
    console.log('First 200 chars:', text.substring(0, 200));
    
    if (!text || response.status !== 200) {
      console.log('❌ Failed to get submissions:', response.status);
      return;
    }

    const data = JSON.parse(text);
    const submissions = Array.isArray(data) ? data : (data.submissions || data.data || []);
    
    console.log(`Found ${submissions.length} total submissions`);
    
    // Find the submission for this job by getting details for each completed submission
    let targetSubmission = null;
    
    for (const sub of submissions) {
      if (sub.status === 'completed') {
        // Get detailed submission
        const detailResponse = await fetch(`https://www.gocanvas.com/apiv2/submissions/${sub.id}.json`, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          const submission = detailData.submission || detailData;
          
          // Check if this submission has our job ID
          const responses = submission.responses || [];
          if (responses.some(r => r.value === JOB_ID)) {
            targetSubmission = submission;
            break;
          }
        }
      }
    }

    if (!targetSubmission) {
      console.log('❌ No submission found for job:', JOB_ID);
      return;
    }

    const submission = targetSubmission;
    console.log('✅ Found submission ID:', submission.id);
    console.log('\n📋 ALL FIELDS IN SUBMISSION:');
    console.log('='.repeat(80));
    
    submission.responses.forEach(response => {
      console.log(`\nField: ${response.label}`);
      console.log(`  Entry ID: ${response.entry_id}`);
      console.log(`  Value: ${response.value}`);
      console.log(`  Type: ${response.type || 'N/A'}`);
    });

    // Look for handoff-related fields
    console.log('\n\n🔍 HANDOFF-RELATED FIELDS:');
    console.log('='.repeat(80));
    
    const handoffFields = submission.responses.filter(r => 
      r.label?.toLowerCase().includes('handoff') || 
      r.label?.toLowerCase().includes('hand off')
    );

    if (handoffFields.length > 0) {
      handoffFields.forEach(field => {
        console.log(`\n✅ ${field.label}:`);
        console.log(`   Value: ${field.value}`);
        console.log(`   Entry ID: ${field.entry_id}`);
      });
    } else {
      console.log('\n❌ No handoff-related fields found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

getSubmissionDetails();
