const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/latest_response.json', 'utf8'));

console.log('=== GOCANVAS SUBMISSION ANALYSIS ===');
console.log('Top-level keys:', Object.keys(data));
console.log('Submission ID:', data.submissionId);
console.log('Status:', data.status);
console.log('Created:', data.created_at);
console.log('Submitted:', data.submitted_at);

console.log('\n=== WORKFLOW FIELDS ===');
console.log('Workflow fields found:', Object.keys(data.workflowFields || {}));
Object.entries(data.workflowFields || {}).forEach(([key, value]) => {
  console.log(`- ${key}:`, JSON.stringify(value, null, 2));
});

console.log('\n=== SUBMISSION CHECK-IN FIELDS ===');
console.log('Check-in fields found:', data.submissionCheckInFields?.length || 0);
(data.submissionCheckInFields || []).forEach((field, index) => {
  console.log(`${index + 1}. ${field.field} (${field.type}):`, field.value);
});

console.log('\n=== TIMESTAMP FIELDS IN RESPONSES ===');
if (data.rawData?.responses) {
  data.rawData.responses.forEach((response, index) => {
    if (response.type === 'Time' || response.type === 'Date' || response.type === 'DateTime') {
      console.log(`- ${response.label}: ${response.value} (entry_id: ${response.entry_id})`);
    }
  });
}

console.log('\n=== ALL AVAILABLE KEYS ===');
console.log('Keys:', data.allKeys);