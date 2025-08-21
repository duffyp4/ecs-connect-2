#!/usr/bin/env node

// Script to manually add Job ID field mapping when it becomes available in GoCanvas
// Usage: node scripts/updateJobIdMapping.js <field_id> <field_label>

import { readFileSync, writeFileSync } from 'fs';

const fieldId = process.argv[2];
const fieldLabel = process.argv[3] || 'Job ID';

if (!fieldId) {
  console.error('Usage: node scripts/updateJobIdMapping.js <field_id> [field_label]');
  console.error('Example: node scripts/updateJobIdMapping.js 708148999 "Job ID"');
  process.exit(1);
}

try {
  // Read current field map
  const fieldMapPath = './gocanvas_field_map.json';
  const fieldMap = JSON.parse(readFileSync(fieldMapPath, 'utf8'));
  
  // Check if Job ID field already exists
  const existingJobIdField = fieldMap.entries.find(entry => 
    entry.label.toLowerCase().includes('job id') || 
    entry.label.toLowerCase().includes('job number') ||
    entry.id === parseInt(fieldId)
  );
  
  if (existingJobIdField) {
    console.log(`Job ID field already exists:`, existingJobIdField);
    process.exit(0);
  }
  
  // Add the new Job ID field
  const newField = {
    id: parseInt(fieldId),
    label: fieldLabel,
    required: false,
    type: "Text"
  };
  
  fieldMap.entries.push(newField);
  fieldMap.total_fields = fieldMap.entries.length;
  fieldMap.updated_at = new Date().toISOString();
  
  // Write updated field map
  writeFileSync(fieldMapPath, JSON.stringify(fieldMap, null, 2));
  
  console.log(`✅ Added Job ID field mapping:`);
  console.log(`   Field ID: ${fieldId}`);
  console.log(`   Label: "${fieldLabel}"`);
  console.log(`   Total fields: ${fieldMap.total_fields}`);
  
} catch (error) {
  console.error('❌ Failed to update Job ID mapping:', error.message);
  process.exit(1);
}