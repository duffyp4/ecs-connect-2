#!/usr/bin/env node

// Script to verify CSR payload only uses Check-In entry_ids and never Parts Log entry_ids
// This will help identify "ghost parts" issues

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 Verifying CSR Payload Entry IDs vs Field Categories');
console.log('====================================================');

try {
  // Load the field analysis
  const analysisPath = '/tmp/field_mapping_analysis.json';
  const analysis = JSON.parse(readFileSync(analysisPath, 'utf8'));
  
  console.log(`📊 Analysis loaded: ${analysis.summary.totalFields} total fields`);
  console.log(`✅ Check-In Fields: ${analysis.summary.checkInCount}`);
  console.log(`🔧 Parts Log Fields: ${analysis.summary.partsLogCount}`);
  console.log(`⚠️  Required Parts Log Fields: ${analysis.summary.requiredPartsLogCount}`);
  console.log('');

  // Extract Check-In and Parts Log entry IDs for easy lookup
  const checkInEntryIds = new Set(analysis.checkInFields.map(f => f.id));
  const partsLogEntryIds = new Set(analysis.partsLogFields.map(f => f.id));
  const requiredPartsLogIds = new Set(analysis.requiredPartsLogFields.map(f => f.id));
  
  console.log('🎯 CHECK-IN ENTRY IDS (CSR should use these):');
  console.log('===========================================');
  console.log([...checkInEntryIds].sort().join(', '));
  console.log('');
  
  console.log('🚫 PARTS LOG ENTRY IDS (CSR should NEVER use these):');
  console.log('===================================================');
  console.log([...partsLogEntryIds].sort().join(', '));
  console.log('');
  
  console.log('⚠️  CRITICAL: Required Parts Log Entry IDs (these cause errors if triggered):');
  console.log('============================================================================');
  console.log([...requiredPartsLogIds].sort().join(', '));
  console.log('');

  // Now let's simulate what the CSR mapping produces
  console.log('🧪 SIMULATING CSR PAYLOAD GENERATION:');
  console.log('====================================');
  
  // Create test job data similar to what CSR would send
  const testJobData = {
    jobId: 'ECS-20240918123456-TEST',
    p21OrderNumber: 'TEST-ORDER-123',
    userId: 'test-user',
    permissionToStart: 'Yes',
    permissionDeniedStop: 'No',
    shopName: 'Test Shop',
    customerName: 'Test Customer',
    customerShipTo: 'Test Ship To',
    p21ShipToId: 'TEST-SHIP-123',
    customerSpecificInstructions: 'Test instructions',
    sendClampsGaskets: 'Yes',
    preferredProcess: 'Standard',
    anyOtherSpecificInstructions: 'None',
    anyCommentsForTech: 'No',
    noteToTechAboutCustomer: '',
    contactName: 'John Doe',
    contactNumber: '555-1234',
    poNumber: 'PO-12345',
    serialNumbers: 'SN-123, SN-456',
    techCustomerQuestionInquiry: 'sales@ecspart.com',
    shopHandoff: 'tech@example.com',
    handoffEmailWorkflow: 'workflow@example.com'
  };

  // Load the field mapping to simulate the real mapping
  const mapPath = join(process.cwd(), 'gocanvas_field_map.json');
  const mapData = JSON.parse(readFileSync(mapPath, 'utf8'));
  
  // Create label-to-ID mapping (same as in gocanvas.ts)
  const fieldMap = {};
  mapData.entries.forEach(field => {
    fieldMap[field.label] = field.id;
  });

  // Simulate the exact mapping from mapJobDataToFormResponses
  const mappings = [
    { data: testJobData.jobId, labels: ['Job ID', 'ECS Job ID', 'Job Id', 'Job Number'] },
    { data: testJobData.p21OrderNumber, labels: ['P21 Order Number (Enter after invoicing)'] },
    { data: testJobData.userId, labels: ['User ID'] },
    { data: testJobData.permissionToStart, labels: ['Permission to Start'] },
    { data: testJobData.permissionDeniedStop, labels: ['Permission Denied Stop'] },
    { data: testJobData.shopName, labels: ['Shop Name'] },
    { data: testJobData.customerName, labels: ['Customer Name'] },
    { data: testJobData.customerShipTo, labels: ['Customer Ship To'] },
    { data: testJobData.p21ShipToId, labels: ['P21 Ship to ID'] },
    { data: testJobData.customerSpecificInstructions, labels: ['Customer Specific Instructions?'] },
    { data: testJobData.sendClampsGaskets, labels: ['Send Clamps & Gaskets?'] },
    { data: testJobData.preferredProcess, labels: ['Preferred Process?'] },
    { data: testJobData.anyOtherSpecificInstructions, labels: ['Any Other Specific Instructions?'] },
    { data: testJobData.anyCommentsForTech, labels: ['Any comments for the tech about this submission?'] },
    { data: testJobData.noteToTechAboutCustomer, labels: ['Note to Tech about Customer or service:'] },
    { data: testJobData.contactName, labels: ['Contact Name'] },
    { data: testJobData.contactNumber, labels: ['Contact Number'] },
    { data: testJobData.poNumber, labels: ['PO Number (Check In)', 'PO Number'] },
    { data: testJobData.serialNumbers, labels: ['Serial Number(s)'] },
    { data: testJobData.techCustomerQuestionInquiry, labels: ['Tech Customer Question Inquiry'] },
    { data: testJobData.shopHandoff, labels: ['Shop Handoff'] },
    { data: testJobData.handoffEmailWorkflow, labels: ['Handoff Email workflow'] },
  ];

  const responses = [];
  const usedEntryIds = [];
  
  for (const mapping of mappings) {
    if (mapping.data !== undefined && mapping.data !== null) {
      for (const label of mapping.labels) {
        const entryId = fieldMap[label];
        if (entryId) {
          const value = mapping.data || "N/A";
          responses.push({
            entry_id: entryId,
            value: String(value)
          });
          usedEntryIds.push(entryId);
          console.log(`✅ ${label} -> ${entryId} = "${value}"`);
          break;
        }
      }
    }
  }
  
  // Add Submission Status (as done in the real code)
  const submissionStatusId = fieldMap['Submission Status'];
  if (submissionStatusId && !responses.find(r => r.entry_id === submissionStatusId)) {
    responses.push({
      entry_id: submissionStatusId,
      value: "New Submission"
    });
    usedEntryIds.push(submissionStatusId);
    console.log(`✅ Submission Status -> ${submissionStatusId} = "New Submission"`);
  }

  console.log('');
  console.log('📊 CSR PAYLOAD ANALYSIS RESULTS:');
  console.log('===============================');
  console.log(`Total responses generated: ${responses.length}`);
  console.log(`Entry IDs used: ${usedEntryIds.join(', ')}`);
  console.log('');

  // Critical analysis: Check if any used entry IDs are from Parts Log
  const usedPartsLogIds = usedEntryIds.filter(id => partsLogEntryIds.has(id));
  const usedCheckInIds = usedEntryIds.filter(id => checkInEntryIds.has(id));
  const usedUnknownIds = usedEntryIds.filter(id => !checkInEntryIds.has(id) && !partsLogEntryIds.has(id));

  console.log('🎯 CRITICAL VALIDATION:');
  console.log('=====================');
  if (usedPartsLogIds.length === 0) {
    console.log('✅ SUCCESS: No Parts Log entry IDs found in CSR payload');
  } else {
    console.log('🚨 CRITICAL ERROR: Parts Log entry IDs found in CSR payload:');
    usedPartsLogIds.forEach(id => {
      const field = analysis.partsLogFields.find(f => f.id === id);
      const requiredFlag = field?.required ? ' (REQUIRED - WILL CAUSE ERROR!)' : '';
      console.log(`   ⚠️  ${id}: "${field?.label}"${requiredFlag}`);
    });
  }
  console.log('');

  console.log(`✅ Check-In entry IDs used: ${usedCheckInIds.length}/${analysis.summary.checkInCount}`);
  console.log(`   IDs: ${usedCheckInIds.join(', ')}`);
  console.log('');

  if (usedUnknownIds.length > 0) {
    console.log(`❓ Unknown category entry IDs: ${usedUnknownIds.length}`);
    console.log(`   IDs: ${usedUnknownIds.join(', ')}`);
    console.log('');
  }

  // Export the payload for inspection
  const payloadAnalysis = {
    responses,
    usedEntryIds,
    usedCheckInIds,
    usedPartsLogIds,
    usedUnknownIds,
    validation: {
      hasPartsLogIds: usedPartsLogIds.length > 0,
      isValid: usedPartsLogIds.length === 0
    }
  };

  const outputPath = '/tmp/csr_payload_analysis.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(payloadAnalysis, null, 2));
  console.log(`💾 Payload analysis saved to: ${outputPath}`);
  
  // Create a summary
  console.log('');
  console.log('📋 SUMMARY & RECOMMENDATIONS:');
  console.log('============================');
  if (usedPartsLogIds.length === 0) {
    console.log('✅ CSR payload is CLEAN - no Parts Log entry IDs detected');
    console.log('✅ This configuration should NOT cause "ghost parts" errors');
  } else {
    console.log('🚨 CSR payload contains Parts Log entry IDs - THIS COULD CAUSE ERRORS');
    console.log('🔧 RECOMMENDATION: Remove these fields from CSR mapping');
  }

} catch (error) {
  console.error('❌ Error verifying CSR payload:', error.message);
  process.exit(1);
}