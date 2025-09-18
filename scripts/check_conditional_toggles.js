#!/usr/bin/env node

// Script to check if CSR field values might activate conditional logic that makes Parts Log fields required
// This addresses potential "ghost parts" errors caused by conditional field activation

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 Checking Conditional Toggles in CSR Field Values');
console.log('==================================================');

try {
  // Load the field analysis and payload analysis
  const fieldAnalysisPath = '/tmp/field_mapping_analysis.json';
  const payloadAnalysisPath = '/tmp/csr_payload_analysis.json';
  
  const fieldAnalysis = JSON.parse(readFileSync(fieldAnalysisPath, 'utf8'));
  const payloadAnalysis = JSON.parse(readFileSync(payloadAnalysisPath, 'utf8'));
  
  console.log('📊 Loaded Analysis Data:');
  console.log(`   - Total fields: ${fieldAnalysis.summary.totalFields}`);
  console.log(`   - CSR responses: ${payloadAnalysis.responses.length}`);
  console.log('');

  // Analyze potential conditional trigger fields
  console.log('🎯 ANALYZING POTENTIAL CONDITIONAL TRIGGERS:');
  console.log('==========================================');
  
  // Common conditional trigger patterns in GoCanvas forms
  const conditionalPatterns = [
    {
      pattern: 'Yes/No fields that might enable other sections',
      checkFields: ['Permission Denied Stop', 'Any comments for the tech about this submission?'],
      riskLevel: 'HIGH',
      description: 'Yes/No fields often control visibility of other form sections'
    },
    {
      pattern: 'Status fields that might control workflow',
      checkFields: ['Submission Status'],
      riskLevel: 'MEDIUM', 
      description: 'Status changes can activate different form screens'
    },
    {
      pattern: 'Process or method selection fields',
      checkFields: ['Preferred Process?', 'Send Clamps & Gaskets?'],
      riskLevel: 'MEDIUM',
      description: 'Process selections might enable related Parts Log fields'
    },
    {
      pattern: 'Customer-specific toggles',
      checkFields: ['Customer Specific Instructions?', 'Any Other Specific Instructions?'],
      riskLevel: 'LOW',
      description: 'Customer fields less likely to affect Parts Log but worth checking'
    }
  ];

  let potentialTriggers = [];

  conditionalPatterns.forEach(pattern => {
    console.log(`\n🔍 ${pattern.pattern} [${pattern.riskLevel} RISK]:`);
    console.log(`   ${pattern.description}`);
    
    pattern.checkFields.forEach(fieldLabel => {
      const response = payloadAnalysis.responses.find(r => {
        // Find the field by checking against known labels
        const fieldData = fieldAnalysis.checkInFields.find(f => f.label === fieldLabel || f.label.includes(fieldLabel));
        return fieldData && r.entry_id === fieldData.id;
      });
      
      if (response) {
        console.log(`   ✅ ${fieldLabel} -> ${response.entry_id} = "${response.value}"`);
        
        // Analyze the value for potential triggers
        const value = response.value.toLowerCase();
        
        // Check for trigger values
        const triggerValues = ['yes', 'true', 'enabled', 'active', 'new submission', 'completed'];
        const hasTriggerValue = triggerValues.some(trigger => value.includes(trigger));
        
        if (hasTriggerValue) {
          potentialTriggers.push({
            fieldLabel,
            entryId: response.entry_id,
            value: response.value,
            riskLevel: pattern.riskLevel,
            reason: `Value "${response.value}" might activate conditional logic`
          });
          console.log(`   ⚠️  POTENTIAL TRIGGER: "${response.value}" might activate conditional logic`);
        }
      } else {
        console.log(`   ❌ ${fieldLabel} -> NOT FOUND in CSR payload`);
      }
    });
  });

  console.log('\n🚨 POTENTIAL CONDITIONAL TRIGGERS SUMMARY:');
  console.log('========================================');
  
  if (potentialTriggers.length === 0) {
    console.log('✅ No obvious conditional triggers detected in CSR payload');
    console.log('✅ CSR field values appear safe from activating Parts Log requirements');
  } else {
    console.log(`⚠️  Found ${potentialTriggers.length} potential conditional triggers:`);
    potentialTriggers.forEach((trigger, index) => {
      console.log(`   ${index + 1}. ${trigger.fieldLabel} (${trigger.riskLevel} RISK)`);
      console.log(`      Entry ID: ${trigger.entryId}`);
      console.log(`      Value: "${trigger.value}"`);
      console.log(`      Reason: ${trigger.reason}`);
      console.log('');
    });
  }

  // Analyze specific high-risk combinations
  console.log('\n🎯 ANALYZING HIGH-RISK FIELD COMBINATIONS:');
  console.log('========================================');
  
  // Check for specific combinations that are known to cause issues
  const riskyCombinations = [
    {
      name: 'Permission Denied + Submission Status',
      check: () => {
        const permissionDenied = payloadAnalysis.responses.find(r => {
          const field = fieldAnalysis.checkInFields.find(f => f.label.includes('Permission Denied'));
          return field && r.entry_id === field.id && r.value.toLowerCase() === 'yes';
        });
        const submissionStatus = payloadAnalysis.responses.find(r => {
          const field = fieldAnalysis.checkInFields.find(f => f.label === 'Submission Status');
          return field && r.entry_id === field.id && r.value === 'New Submission';
        });
        return permissionDenied && submissionStatus;
      },
      risk: 'This combination might trigger Parts Log validation'
    },
    {
      name: 'Comments for Tech = Yes',
      check: () => {
        const commentsField = payloadAnalysis.responses.find(r => {
          const field = fieldAnalysis.checkInFields.find(f => f.label.includes('comments for the tech'));
          return field && r.entry_id === field.id && r.value.toLowerCase() === 'yes';
        });
        return commentsField;
      },
      risk: 'This might enable additional tech comment sections in Parts Log'
    }
  ];

  let detectedRiskyCombo = false;
  riskyCombinations.forEach(combo => {
    if (combo.check()) {
      detectedRiskyCombo = true;
      console.log(`⚠️  RISKY COMBINATION DETECTED: ${combo.name}`);
      console.log(`   Risk: ${combo.risk}`);
    }
  });

  if (!detectedRiskyCombo) {
    console.log('✅ No high-risk field combinations detected');
  }

  // Look for any required Parts Log fields that might be accidentally activated
  console.log('\n📋 CROSS-REFERENCE WITH REQUIRED PARTS LOG FIELDS:');
  console.log('=================================================');
  
  const requiredPartsLogFields = fieldAnalysis.requiredPartsLogFields;
  console.log(`Total required Parts Log fields: ${requiredPartsLogFields.length}`);
  
  // Look for fields that might be conditionally activated by CSR values
  const suspiciousRequiredFields = requiredPartsLogFields.filter(field => {
    const label = field.label.toLowerCase();
    return label.includes('photo') || 
           label.includes('required') || 
           label.includes('must') ||
           label.includes('force') ||
           label.includes('stop');
  });
  
  console.log(`Suspicious required fields (likely conditional): ${suspiciousRequiredFields.length}`);
  suspiciousRequiredFields.forEach(field => {
    console.log(`   ⚠️  ${field.id}: "${field.label}" [${field.type}]`);
  });

  // Look for the "FORCE STOP" field specifically mentioned in the prompt
  const forceStopField = requiredPartsLogFields.find(f => f.label.includes('FORCE STOP'));
  if (forceStopField) {
    console.log(`\n🚨 CRITICAL: Found "FORCE STOP" field:`);
    console.log(`   ID: ${forceStopField.id}`);
    console.log(`   Label: "${forceStopField.label}"`);
    console.log(`   This field is REQUIRED and might be causing submission errors!`);
  }

  // Create comprehensive analysis
  const analysis = {
    potentialTriggers,
    detectedRiskyCombo,
    suspiciousRequiredFields,
    forceStopField,
    assessment: {
      triggerRisk: potentialTriggers.length > 0 ? 'MEDIUM' : 'LOW',
      combinationRisk: detectedRiskyCombo ? 'HIGH' : 'LOW',
      overallRisk: (potentialTriggers.length > 0 || detectedRiskyCombo) ? 'MEDIUM' : 'LOW',
      recommendations: []
    }
  };

  // Generate recommendations
  if (potentialTriggers.length > 0) {
    analysis.assessment.recommendations.push('Review conditional logic for trigger fields');
  }
  if (detectedRiskyCombo) {
    analysis.assessment.recommendations.push('Test specific field combinations that might activate Parts Log');
  }
  if (forceStopField) {
    analysis.assessment.recommendations.push('Investigate FORCE STOP field and its trigger conditions');
  }

  console.log('\n📋 CONDITIONAL TOGGLES ASSESSMENT:');
  console.log('================================');
  console.log(`Overall Risk Level: ${analysis.assessment.overallRisk}`);
  console.log(`Trigger Risk: ${analysis.assessment.triggerRisk}`);
  console.log(`Combination Risk: ${analysis.assessment.combinationRisk}`);
  
  if (analysis.assessment.recommendations.length > 0) {
    console.log('\nRecommendations:');
    analysis.assessment.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }

  // Save analysis
  const outputPath = '/tmp/conditional_toggles_analysis.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
  console.log(`\n💾 Conditional toggles analysis saved to: ${outputPath}`);

} catch (error) {
  console.error('❌ Error checking conditional toggles:', error.message);
  process.exit(1);
}