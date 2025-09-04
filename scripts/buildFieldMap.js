#!/usr/bin/env node

// Script to build GoCanvas field mapping from form definition
// Usage: node scripts/buildFieldMap.js

import { writeFileSync } from 'fs';

const BASE_URL = "https://api.gocanvas.com/api/v3";
const FORM_ID = process.argv[2] || process.env.GOCANVAS_FORM_ID;
const USERNAME = process.env.GOCANVAS_USERNAME;
const PASSWORD = process.env.GOCANVAS_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('❌ Missing required GoCanvas credentials:');
  console.error('- GOCANVAS_USERNAME'); 
  console.error('- GOCANVAS_PASSWORD');
  console.error('Please set these environment variables and try again.');
  process.exit(1);
}

if (!FORM_ID) {
  console.error('❌ Missing GOCANVAS_FORM_ID environment variable');
  console.error('Please set GOCANVAS_FORM_ID and try again.');
  console.error('Example: export GOCANVAS_FORM_ID=5584204');
  process.exit(1);
}

console.log('🚀 Starting GoCanvas field mapping update...');
console.log(`📋 Form ID: ${FORM_ID}`);
console.log(`👤 Username: ${USERNAME}`);

function getAuthHeader() {
  const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

async function fetchFormDefinition() {
  console.log(`🔍 Fetching form definition for form ID: ${FORM_ID}`);
  
  try {
    // Try the flat format first
    const flatResponse = await fetch(`${BASE_URL}/forms/${FORM_ID}?format=flat`, {
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (flatResponse.ok) {
      const flatData = await flatResponse.json();
      console.log('Successfully retrieved flat format');
      return { data: flatData, format: 'flat' };
    }

    console.log('Flat format failed, trying nested format...');
    
    // Try nested format as fallback
    const nestedResponse = await fetch(`${BASE_URL}/forms/${FORM_ID}?format=nested`, {
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (nestedResponse.ok) {
      const nestedData = await nestedResponse.json();
      console.log('Successfully retrieved nested format');
      return { data: nestedData, format: 'nested' };
    }

    // Try without format parameter
    console.log('Nested format failed, trying default format...');
    const defaultResponse = await fetch(`${BASE_URL}/forms/${FORM_ID}`, {
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!defaultResponse.ok) {
      throw new Error(`Failed to fetch form: ${defaultResponse.status} ${defaultResponse.statusText}`);
    }

    const defaultData = await defaultResponse.json();
    console.log('Successfully retrieved default format');
    return { data: defaultData, format: 'default' };

  } catch (error) {
    console.error('Error fetching form definition:', error);
    throw error;
  }
}

function extractFieldsFromResponse(data, format) {
  console.log(`Extracting fields from ${format} format response`);
  
  let fields = [];
  
  try {
    // Handle different response formats
    if (format === 'flat' && data.entries) {
      fields = data.entries;
    } else if (format === 'flat' && data.fields) {
      fields = data.fields;
    } else if (format === 'nested' && data.sections) {
      // Traverse nested structure: sections -> sheets -> entries
      for (const section of data.sections) {
        if (section.sheets) {
          for (const sheet of section.sheets) {
            if (sheet.entries) {
              fields.push(...sheet.entries);
            }
          }
        }
      }
    } else if (data.form && data.form.sections) {
      // Alternative nested structure
      for (const section of data.form.sections) {
        if (section.sheets) {
          for (const sheet of section.sheets) {
            if (sheet.entries) {
              fields.push(...sheet.entries);
            }
          }
        }
      }
    } else {
      // Try to find fields in any common location
      const possibleFields = data.entries || data.fields || data.elements || [];
      fields = possibleFields;
    }

    console.log(`Found ${fields.length} fields in form`);
    console.log('Sample field structure:', fields[0]);
    
    return fields;
  } catch (error) {
    console.error('Error extracting fields:', error);
    console.log('Full response structure:', JSON.stringify(data, null, 2));
    throw error;
  }
}

function buildFieldMap(fields, formData) {
  const entries = fields.map(field => {
    // Handle different field property naming conventions
    const id = field.id || field.entry_id || field.entryId || field.name;
    const label = field.label || field.name || field.display_name || field.title || `field_${id}`;
    const required = Boolean(field.required || field.is_required);
    const type = field.type || field.field_type || 'unknown';

    return {
      id,
      label,
      required,
      type
    };
  }).filter(entry => entry.id); // Only include fields with valid IDs

  const labelToIdMap = {};
  for (const entry of entries) {
    labelToIdMap[entry.label] = entry.id;
  }

  const fieldMap = {
    form_id: FORM_ID,
    version: formData.version || formData.form_version || 'unknown',
    updated_at: new Date().toISOString(),
    total_fields: entries.length,
    entries,
    labelToIdMap
  };

  return fieldMap;
}

async function main() {
  try {
    console.log('Starting GoCanvas field mapping process...');
    
    const { data, format } = await fetchFormDefinition();
    const fields = extractFieldsFromResponse(data, format);
    const fieldMap = buildFieldMap(fields, data);

    // Save the field map
    const outputPath = './gocanvas_field_map.json';
    writeFileSync(outputPath, JSON.stringify(fieldMap, null, 2));
    
    console.log(`✅ Success! Saved field map to ${outputPath}`);
    console.log(`📊 Found ${fieldMap.total_fields} fields`);
    console.log(`📋 Form version: ${fieldMap.version}`);
    
    // Display some sample mappings
    console.log('\n🔍 Sample field mappings:');
    fieldMap.entries.slice(0, 5).forEach(entry => {
      console.log(`  "${entry.label}" → ${entry.id} (${entry.type}${entry.required ? ', required' : ''})`);
    });
    
    if (fieldMap.entries.length > 5) {
      console.log(`  ... and ${fieldMap.entries.length - 5} more fields`);
    }

  } catch (error) {
    console.error('❌ Failed to build field map:', error.message);
    process.exit(1);
  }
}

main();