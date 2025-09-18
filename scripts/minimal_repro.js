#!/usr/bin/env node

// Minimal repro script to test CSR payload generation and identify ghost parts issues
// This can be run independently to simulate CSR form submission without affecting production

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🧪 Minimal GoCanvas CSR Repro Script');
console.log('===================================');

// Test data that simulates typical CSR form submission
const testJobData = {
  jobId: 'ECS-REPRO-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-001',
  p21OrderNumber: 'REPRO-ORDER-' + Math.floor(Math.random() * 1000),
  userId: 'repro-user-' + Math.floor(Math.random() * 100),
  permissionToStart: 'Yes',
  permissionDeniedStop: 'No',  // This could be a critical trigger
  shopName: 'Test Shop - Repro',
  customerName: 'Test Customer - Repro',
  customerShipTo: 'Test Ship To Location',
  p21ShipToId: 'SHIP-123-REPRO',
  customerSpecificInstructions: 'Test instructions for repro',
  sendClampsGaskets: 'Yes',  // This could be a trigger
  preferredProcess: 'Standard',
  anyOtherSpecificInstructions: 'N/A',
  anyCommentsForTech: 'No',  // This could be a trigger
  noteToTechAboutCustomer: 'Test notes for tech',
  contactName: 'John Doe - Repro',
  contactNumber: '555-REPRO',
  poNumber: 'PO-REPRO-' + Math.floor(Math.random() * 10000),
  serialNumbers: 'SN-REPRO-001, SN-REPRO-002',
  techCustomerQuestionInquiry: 'sales@ecspart.com',
  shopHandoff: 'tech-repro@example.com',
  handoffEmailWorkflow: 'workflow-repro@example.com'
};

console.log('📋 Test Job Data Generated:');
console.log('===========================');
Object.entries(testJobData).forEach(([key, value]) => {
  console.log(`   ${key}: "${value}"`);
});
console.log('');

try {
  // Load field mapping
  const mapPath = join(process.cwd(), 'gocanvas_field_map.json');
  const mapData = JSON.parse(readFileSync(mapPath, 'utf8'));
  
  console.log('📊 Field Map Loaded:');
  console.log(`   Form ID: ${mapData.form_id}`);
  console.log(`   Total fields: ${mapData.total_fields}`);
  console.log('');

  // Create label-to-ID mapping
  const fieldMap = {};
  mapData.entries.forEach(field => {
    fieldMap[field.label] = field.id;
  });

  // Simulate the exact mapping from mapJobDataToFormResponses
  console.log('🎯 Simulating CSR Payload Generation:');
  console.log('====================================');
  
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
  const mappingResults = [];
  
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
          mappingResults.push({
            label,
            entryId,
            value,
            found: true
          });
          console.log(`✅ ${label} -> ${entryId} = "${value}"`);
          break;
        }
      }
    }
  }
  
  // Add Submission Status (critical trigger field)
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
  console.log('🔍 GHOST PARTS ANALYSIS:');
  console.log('========================');
  
  // Load analysis data to check for Issues
  let riskAnalysis = null;
  try {
    const fieldAnalysis = JSON.parse(readFileSync('/tmp/field_mapping_analysis.json', 'utf8'));
    
    // Check if any used entry IDs are from Parts Log
    const checkInIds = new Set(fieldAnalysis.checkInFields.map(f => f.id));
    const partsLogIds = new Set(fieldAnalysis.partsLogFields.map(f => f.id));
    const requiredPartsLogIds = new Set(fieldAnalysis.requiredPartsLogFields.map(f => f.id));
    
    const usedPartsLogIds = usedEntryIds.filter(id => partsLogIds.has(id));
    const usedRequiredPartsLogIds = usedEntryIds.filter(id => requiredPartsLogIds.has(id));
    
    console.log(`📊 Entry IDs used: ${usedEntryIds.length}`);
    console.log(`✅ Check-In IDs: ${usedEntryIds.filter(id => checkInIds.has(id)).length}`);
    console.log(`🚫 Parts Log IDs: ${usedPartsLogIds.length}`);
    console.log(`⚠️  Required Parts Log IDs: ${usedRequiredPartsLogIds.length}`);
    
    if (usedRequiredPartsLogIds.length > 0) {
      console.log('🚨 CRITICAL: Required Parts Log IDs detected!');
      usedRequiredPartsLogIds.forEach(id => {
        const field = fieldAnalysis.requiredPartsLogFields.find(f => f.id === id);
        console.log(`   ${id}: "${field?.label}"`);
      });
    }
    
    riskAnalysis = {
      totalResponses: responses.length,
      checkInCount: usedEntryIds.filter(id => checkInIds.has(id)).length,
      partsLogCount: usedPartsLogIds.length,
      requiredPartsLogCount: usedRequiredPartsLogIds.length,
      isRisky: usedRequiredPartsLogIds.length > 0
    };
    
  } catch (e) {
    console.log('⚠️  Could not load field analysis data');
  }
  
  // Check for potential triggers
  console.log('');
  console.log('🎯 POTENTIAL TRIGGERS:');
  console.log('=====================');
  
  const triggers = [];
  responses.forEach(response => {
    const value = response.value.toLowerCase();
    
    if (value === 'new submission') {
      triggers.push(`Submission Status = "New Submission" (entry_id: ${response.entry_id})`);
    }
    if (value === 'yes') {
      triggers.push(`Yes value detected (entry_id: ${response.entry_id})`);
    }
    if (response.entry_id === 718414077) { // FORCE STOP
      triggers.push(`FORCE STOP field detected (entry_id: ${response.entry_id}) - CRITICAL!`);
    }
  });
  
  if (triggers.length > 0) {
    triggers.forEach((trigger, index) => {
      console.log(`   ${index + 1}. ${trigger}`);
    });
  } else {
    console.log('   ✅ No obvious triggers detected');
  }

  // Create the final dispatch payload
  const dispatchData = {
    dispatch_type: 'immediate_dispatch',
    form_id: parseInt(mapData.form_id),
    name: `ECS Job: ${testJobData.jobId}`,
    description: `Repro test for ${testJobData.customerName} - ${testJobData.shopName}`,
    responses: responses,
    send_notification: true
  };

  console.log('');
  console.log('📦 FINAL DISPATCH PAYLOAD:');
  console.log('==========================');
  console.log(JSON.stringify(dispatchData, null, 2));
  
  // Save comprehensive results
  const reproResults = {
    timestamp: new Date().toISOString(),
    testJobData,
    mappingResults,
    responses,
    usedEntryIds,
    triggers,
    riskAnalysis,
    dispatchData,
    recommendations: [
      'Test this payload in DRY_RUN mode first',
      'Monitor for "required field" errors in GoCanvas response',
      'Check if FORCE STOP or conditional logic is being triggered',
      'Verify no Parts Log entry_ids are accidentally included'
    ]
  };

  const outputPath = '/tmp/minimal_repro_results.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(reproResults, null, 2));
  
  console.log('');
  console.log('📋 REPRO SUMMARY:');
  console.log('================');
  console.log(`✅ Successfully generated CSR payload with ${responses.length} responses`);
  console.log(`🎯 Identified ${triggers.length} potential triggers`);
  console.log(`💾 Full results saved to: ${outputPath}`);
  console.log('');
  console.log('🧪 TO TEST WITH DRY_RUN:');
  console.log('========================');
  console.log('1. Set environment variable: export GOCANVAS_DRY_RUN=true');
  console.log('2. Submit a CSR form through the portal');
  console.log('3. Check logs for payload analysis and trigger detection');
  console.log('4. Look for payload files in /tmp/gocanvas_payload_*.json');
  console.log('');
  console.log('🔍 TO DEBUG GHOST PARTS ISSUES:');
  console.log('===============================');
  console.log('1. Check for "required field" errors in GoCanvas API responses');
  console.log('2. Look for FORCE STOP field (718414077) being triggered');
  console.log('3. Verify conditional logic isn\'t activating Parts Log fields');
  console.log('4. Ensure no multi_key parameters are being sent');

} catch (error) {
  console.error('❌ Error in repro script:', error.message);
  process.exit(1);
}