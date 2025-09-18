#!/usr/bin/env node

// Script to verify we're not accidentally creating loop/table rows in CSR submissions
// This addresses the "ghost parts" issue where partial loop population can cause required field errors

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 Checking Loop/Table Handling in CSR Submissions');
console.log('=================================================');

try {
  // Read the actual dispatch creation code
  const gocanvasServicePath = join(process.cwd(), 'server/services/gocanvas.ts');
  const serviceCode = readFileSync(gocanvasServicePath, 'utf8');
  
  console.log('📋 Analyzing GoCanvas Service Code for Loop/Table Patterns...');
  console.log('');

  // Check for multi_key usage
  const multiKeyMatches = serviceCode.match(/multi_key/gi) || [];
  console.log(`🔍 multi_key References Found: ${multiKeyMatches.length}`);
  if (multiKeyMatches.length > 0) {
    console.log('🚨 WARNING: multi_key found in service code - this could create loop iterations');
  } else {
    console.log('✅ No multi_key usage found - good, we\'re not creating loop iterations');
  }
  console.log('');

  // Check the createSubmission method specifically
  const createSubmissionMatch = serviceCode.match(/async createSubmission[\s\S]*?}[\s\S]*?catch[\s\S]*?}/);
  if (createSubmissionMatch) {
    const createSubmissionCode = createSubmissionMatch[0];
    
    console.log('📊 Analyzing createSubmission Method:');
    console.log('===================================');
    
    // Check for dispatch structure
    const dispatchDataMatch = createSubmissionCode.match(/const dispatchData[\s\S]*?};/);
    if (dispatchDataMatch) {
      console.log('📦 Dispatch Payload Structure Found:');
      console.log(dispatchDataMatch[0]);
      console.log('');
      
      // Verify no multi_key in dispatch data
      const hasMultiKey = dispatchDataMatch[0].includes('multi_key');
      if (hasMultiKey) {
        console.log('🚨 CRITICAL: multi_key found in dispatch payload - THIS CREATES LOOP ROWS');
      } else {
        console.log('✅ No multi_key in dispatch payload - safe from loop creation');
      }
    }
    
    // Check responses array construction
    const responsesCall = createSubmissionCode.match(/responses:\s*responses/);
    if (responsesCall) {
      console.log('📋 Response array is built via mapJobDataToFormResponses');
      
      // Analyze the mapping method
      const mappingMatch = serviceCode.match(/private mapJobDataToFormResponses[\s\S]*?return responses;[\s\S]*?}/);
      if (mappingMatch) {
        const mappingCode = mappingMatch[0];
        
        console.log('🔍 Analyzing Response Mapping Logic:');
        console.log('==================================');
        
        // Check if any responses include multi_key
        const responseCreation = mappingCode.match(/responses\.push\({[\s\S]*?}\)/g) || [];
        console.log(`📊 Response Creation Patterns: ${responseCreation.length}`);
        
        let hasMultiKeyInResponses = false;
        responseCreation.forEach((pattern, index) => {
          console.log(`   ${index + 1}. ${pattern.replace(/\s+/g, ' ').trim()}`);
          if (pattern.includes('multi_key')) {
            hasMultiKeyInResponses = true;
            console.log(`      🚨 WARNING: multi_key detected in response pattern ${index + 1}`);
          }
        });
        
        if (!hasMultiKeyInResponses) {
          console.log('✅ No multi_key found in any response patterns - safe implementation');
        }
      }
    }
  }
  console.log('');

  // Check for any table/loop related field labels that might accidentally trigger loops
  const fieldMapPath = join(process.cwd(), 'gocanvas_field_map.json');
  const fieldMap = JSON.parse(readFileSync(fieldMapPath, 'utf8'));
  
  console.log('🔍 Checking Field Labels for Loop/Table Indicators:');
  console.log('=================================================');
  
  const suspiciousLabels = fieldMap.entries.filter(field => {
    const label = field.label.toLowerCase();
    return label.includes('table') || 
           label.includes('loop') || 
           label.includes('grid') ||
           label.includes('repeat') ||
           label.includes('multiple') ||
           label.includes('iteration');
  });
  
  console.log(`📊 Suspicious Loop/Table Field Labels: ${suspiciousLabels.length}`);
  if (suspiciousLabels.length > 0) {
    suspiciousLabels.forEach(field => {
      console.log(`   ⚠️  ${field.id}: "${field.label}" [${field.type}] ${field.required ? '(REQUIRED)' : ''}`);
    });
  } else {
    console.log('✅ No obvious loop/table field labels found');
  }
  console.log('');

  // Load our CSR payload analysis to double-check
  const payloadAnalysisPath = '/tmp/csr_payload_analysis.json';
  let payloadAnalysis = null;
  try {
    payloadAnalysis = JSON.parse(readFileSync(payloadAnalysisPath, 'utf8'));
  } catch (e) {
    console.log('⚠️  CSR payload analysis not found - run verify_csr_payload.js first');
  }

  if (payloadAnalysis) {
    console.log('📊 Cross-referencing with CSR Payload Analysis:');
    console.log('==============================================');
    
    // Check if any responses have multi_key (they shouldn't)
    const responsesWithMultiKey = payloadAnalysis.responses.filter(r => r.hasOwnProperty('multi_key'));
    console.log(`🔍 Responses with multi_key: ${responsesWithMultiKey.length}`);
    
    if (responsesWithMultiKey.length > 0) {
      console.log('🚨 CRITICAL: CSR payload contains multi_key fields:');
      responsesWithMultiKey.forEach(response => {
        console.log(`   - Entry ID ${response.entry_id}: multi_key = "${response.multi_key}"`);
      });
    } else {
      console.log('✅ No multi_key in CSR payload responses - confirmed safe');
    }
  }

  console.log('');
  console.log('📋 LOOP/TABLE HANDLING ANALYSIS SUMMARY:');
  console.log('=======================================');
  
  const issues = [];
  if (multiKeyMatches.length > 0) issues.push('multi_key usage detected');
  if (suspiciousLabels.length > 0) issues.push('suspicious loop/table field labels found');
  
  if (issues.length === 0) {
    console.log('✅ SAFE: No loop/table handling issues detected');
    console.log('✅ CSR submissions will NOT create ghost loop rows');
    console.log('✅ This implementation should NOT cause Parts Log required field errors');
  } else {
    console.log('🚨 POTENTIAL ISSUES DETECTED:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('⚠️  These issues could potentially create ghost loop rows');
  }

  // Create analysis results
  const analysis = {
    multiKeyUsage: multiKeyMatches.length,
    suspiciousFieldLabels: suspiciousLabels,
    hasMultiKeyInCode: multiKeyMatches.length > 0,
    hasSuspiciousLabels: suspiciousLabels.length > 0,
    isLoopSafe: multiKeyMatches.length === 0 && suspiciousLabels.length === 0,
    summary: {
      safe: issues.length === 0,
      issues: issues
    }
  };

  // Save analysis
  const outputPath = '/tmp/loop_table_analysis.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
  console.log('');
  console.log(`💾 Loop/table analysis saved to: ${outputPath}`);

} catch (error) {
  console.error('❌ Error checking loop/table handling:', error.message);
  process.exit(1);
}