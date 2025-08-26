const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('/tmp/submission_timing.json', 'utf8'));
  
  console.log('=== SUBMISSION TIMING FOR: 54D15E00-BD53-4E10-A63C-9EAD13042DBE ===');
  console.log('');
  console.log('created_at:', data.created_at);
  console.log('updated_at:', data.updated_at);
  console.log('submitted_at:', data.submitted_at);
  console.log('');
  console.log('Additional Info:');
  console.log('- ID:', data.id);
  console.log('- Status:', data.status);
  
} catch (error) {
  console.log('Error parsing JSON:', error.message);
  console.log('Raw response (first 200 chars):');
  const raw = fs.readFileSync('/tmp/submission_timing.json', 'utf8');
  console.log(raw.substring(0, 200) + '...');
}