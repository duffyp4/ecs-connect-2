#!/usr/bin/env node

// Script to analyze GoCanvas field mapping and categorize Check-In vs Parts Log fields
// This helps identify if we're accidentally including Parts Log entry_ids in CSR submissions

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 Analyzing GoCanvas Field Mapping for Check-In vs Parts Log Fields');
console.log('==============================================================');

try {
  // Read the field mapping
  const mapPath = join(process.cwd(), 'gocanvas_field_map.json');
  const mapData = JSON.parse(readFileSync(mapPath, 'utf8'));
  
  console.log(`📋 Form ID: ${mapData.form_id}`);
  console.log(`📊 Total Fields: ${mapData.total_fields}`);
  console.log(`🗓️  Last Updated: ${mapData.updated_at}`);
  console.log('');

  // Define CSR Check-In field patterns (based on our mapping in gocanvas.ts)
  const checkInFields = [
    'P21 Order Number',
    'Job ID',
    'ECS Job ID', 
    'Job Id',
    'Job Number',
    'User ID',
    'Permission to Start',
    'Permission Denied Stop',
    'Shop Name',
    'Customer Name',
    'Customer Ship To',
    'P21 Ship to ID',
    'Customer Specific Instructions',
    'Send Clamps & Gaskets',
    'Preferred Process',
    'Any Other Specific Instructions',
    'Any comments for the tech',
    'Note to Tech about Customer',
    'Contact Name',
    'Contact Number',
    'PO Number (Check In)',
    'PO Number',
    'Serial Number(s)',
    'Tech Customer Question Inquiry',
    'Shop Handoff',
    'Handoff Email workflow',
    'Submission Status',
    'Handoff Date',
    'Handoff Time'
  ];

  // Known Parts Log field patterns (based on field map analysis)
  const partsLogPatterns = [
    'Did the Part Pass or Fail',
    'Process Being Performed',
    'Filter Part Number',
    'ECS Part Number',
    'Part Description',
    'Unknown Part Number',
    'ECS Serial Number',
    'OE Serial Number',
    'Mileage',
    'Unit / Vin Number',
    'Pre-repair Photo',
    'Post-repair Photo',
    'Repair Description',
    'Crystallization',
    'Inlet Color',
    'Outlet Color',
    'Inlet Damage',
    'Outlet Damage',
    'Sealing Ring',
    'Bung & Fitting',
    'Collector Condition',
    'Gasket or Clamps',
    'Canister Inspection',
    'Weight',
    'Flow Rate',
    'Drop Rod Test',
    'Light Test',
    'Failed Reason',
    'FORCE STOP'
  ];

  const checkInEntryIds = [];
  const partsLogEntryIds = [];
  const uncategorizedEntryIds = [];

  // Categorize each field
  mapData.entries.forEach(field => {
    const label = field.label.trim();
    
    // Check if it's a Check-In field
    const isCheckIn = checkInFields.some(pattern => 
      label.toLowerCase().includes(pattern.toLowerCase()) ||
      pattern.toLowerCase().includes(label.toLowerCase())
    );
    
    // Check if it's a Parts Log field
    const isPartsLog = partsLogPatterns.some(pattern => 
      label.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isCheckIn) {
      checkInEntryIds.push({
        id: field.id,
        label: label,
        required: field.required,
        type: field.type
      });
    } else if (isPartsLog) {
      partsLogEntryIds.push({
        id: field.id,
        label: label,
        required: field.required,
        type: field.type
      });
    } else {
      uncategorizedEntryIds.push({
        id: field.id,
        label: label,
        required: field.required,
        type: field.type
      });
    }
  });

  console.log('📊 FIELD CATEGORIZATION RESULTS:');
  console.log('================================');
  console.log(`✅ Check-In Fields: ${checkInEntryIds.length}`);
  console.log(`🔧 Parts Log Fields: ${partsLogEntryIds.length}`);
  console.log(`❓ Uncategorized Fields: ${uncategorizedEntryIds.length}`);
  console.log('');

  console.log('✅ CHECK-IN FIELDS (CSR Portal should use these):');
  console.log('================================================');
  checkInEntryIds.forEach(field => {
    const requiredFlag = field.required ? ' (REQUIRED)' : '';
    console.log(`  📋 ${field.id}: "${field.label}" [${field.type}]${requiredFlag}`);
  });
  console.log('');

  console.log('🔧 PARTS LOG FIELDS (CSR Portal should NEVER use these):');
  console.log('=======================================================');
  partsLogEntryIds.forEach(field => {
    const requiredFlag = field.required ? ' (REQUIRED)' : '';
    console.log(`  🚫 ${field.id}: "${field.label}" [${field.type}]${requiredFlag}`);
  });
  console.log('');

  console.log('❓ UNCATEGORIZED FIELDS (Need manual review):');
  console.log('============================================');
  uncategorizedEntryIds.forEach(field => {
    const requiredFlag = field.required ? ' (REQUIRED)' : '';
    console.log(`  ❓ ${field.id}: "${field.label}" [${field.type}]${requiredFlag}`);
  });
  console.log('');

  // Find required Parts Log fields that could cause issues
  const requiredPartsLogFields = partsLogEntryIds.filter(f => f.required);
  if (requiredPartsLogFields.length > 0) {
    console.log('🚨 CRITICAL ANALYSIS - REQUIRED Parts Log Fields:');
    console.log('=================================================');
    console.log('These fields are REQUIRED and could cause "ghost parts" errors if accidentally triggered:');
    requiredPartsLogFields.forEach(field => {
      console.log(`  ⚠️  ${field.id}: "${field.label}" [${field.type}]`);
    });
    console.log('');
  }

  // Export results for use in other scripts
  const analysis = {
    checkInFields: checkInEntryIds,
    partsLogFields: partsLogEntryIds,
    uncategorizedFields: uncategorizedEntryIds,
    requiredPartsLogFields: requiredPartsLogFields,
    summary: {
      totalFields: mapData.total_fields,
      checkInCount: checkInEntryIds.length,
      partsLogCount: partsLogEntryIds.length,
      uncategorizedCount: uncategorizedEntryIds.length,
      requiredPartsLogCount: requiredPartsLogFields.length
    }
  };

  // Write analysis to tmp file for other scripts to use
  const outputPath = '/tmp/field_mapping_analysis.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
  console.log(`💾 Analysis saved to: ${outputPath}`);

} catch (error) {
  console.error('❌ Error analyzing field mapping:', error.message);
  process.exit(1);
}