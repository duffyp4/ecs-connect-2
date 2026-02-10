#!/usr/bin/env node

/**
 * Dump comprehensive GoCanvas form definitions as structured JSON reference files.
 *
 * For each form this script:
 *   1. Fetches the flat format  (field types, entry_type_ids, reference_data_ids)
 *   2. Fetches the nested format (sections, conditions, operations, entry_values)
 *   3. Fetches every referenced reference-data table
 *   4. Merges flat field metadata into the nested structure
 *   5. Writes a single comprehensive JSON file to docs/
 *
 * Usage:
 *   node scripts/dumpGoCanvasForm.js emissions
 *   node scripts/dumpGoCanvasForm.js pickup
 *   node scripts/dumpGoCanvasForm.js delivery
 *   node scripts/dumpGoCanvasForm.js all
 */

import { writeFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api.gocanvas.com/api/v3';

const FORMS = {
  emissions: { id: '5718455', name: 'Emissions Service Log' },
  pickup:    { id: '5657148', name: 'Pickup' },
  delivery:  { id: '5714828', name: 'Delivery' },
};

const USERNAME = process.env.GOCANVAS_USERNAME;
const PASSWORD = process.env.GOCANVAS_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('Missing GOCANVAS_USERNAME / GOCANVAS_PASSWORD env vars.');
  process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GoCanvas API ${res.status} for ${path}: ${body}`);
  }
  return res.json();
}

/**
 * Build a lookup: entry id -> flat field metadata (type name, entry_type_id,
 * reference_data_id, required flag, etc.)
 */
function buildFlatLookup(flatData) {
  const entries = flatData.entries || flatData.fields || [];
  const lookup = {};
  for (const e of entries) {
    const id = e.id || e.entry_id;
    if (id != null) {
      lookup[id] = {
        type_name: e.type || e.field_type || null,
        entry_type_id: e.entry_type_id ?? null,
        required: Boolean(e.required || e.is_required),
        reference_data_id: e.reference_data_id ?? null,
      };
    }
  }
  return lookup;
}

/**
 * Walk nested sections -> sheets -> entries and:
 *   - merge flat field metadata onto each entry
 *   - collect all unique reference_data_ids
 *   - count conditions (per-entry + per-sheet) and operations (per-entry)
 */
function enrichNested(nestedData, flatLookup) {
  const refDataIds = new Set();
  const sections = nestedData.sections || (nestedData.form && nestedData.form.sections) || [];
  let conditionCount = 0;
  let operationCount = 0;

  for (const section of sections) {
    for (const sheet of section.sheets || []) {
      // Sheet-level conditions
      if (sheet.conditions && sheet.conditions.length) {
        conditionCount += sheet.conditions.length;
      }
      for (const entry of sheet.entries || []) {
        const flat = flatLookup[entry.id] || {};
        // Merge flat metadata onto the nested entry
        entry.type_name = flat.type_name || null;
        entry.entry_type_id = flat.entry_type_id ?? entry.entry_type_id ?? null;
        entry.required = flat.required ?? Boolean(entry.required);
        entry.reference_data_id = flat.reference_data_id ?? entry.reference_data_id ?? null;

        if (entry.reference_data_id) {
          refDataIds.add(String(entry.reference_data_id));
        }
        // Entry-level conditions and operations
        if (entry.conditions && entry.conditions.length) {
          conditionCount += entry.conditions.length;
        }
        if (entry.operations && entry.operations.length) {
          operationCount += entry.operations.length;
        }
      }
    }
  }

  return { sections, refDataIds, conditionCount, operationCount };
}

/**
 * Fetch a single reference-data table, returning a simplified object.
 */
async function fetchRefData(id) {
  try {
    const data = await api(`/reference_data/${id}`);
    // The API may wrap the result differently; normalise.
    const table = data.reference_data || data;
    return {
      id,
      name: table.name || table.title || `ref_${id}`,
      headers: table.columns || table.headers || [],
      rows: table.data || table.rows || [],
    };
  } catch (err) {
    console.warn(`  Warning: could not fetch reference_data/${id}: ${err.message}`);
    return { id, name: `ref_${id}`, headers: [], rows: [], error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main dump logic for one form
// ---------------------------------------------------------------------------

async function dumpForm(type) {
  const { id, name } = FORMS[type];
  console.log(`\n--- ${name} (${id}) ---`);

  // 1. Fetch both formats in parallel
  console.log('  Fetching flat + nested formats...');
  const [flatData, nestedData] = await Promise.all([
    api(`/forms/${id}?format=flat`),
    api(`/forms/${id}?format=nested`),
  ]);

  const flatLookup = buildFlatLookup(flatData);
  const flatCount = Object.keys(flatLookup).length;
  console.log(`  Flat fields: ${flatCount}`);

  // 2. Merge flat metadata into nested structure; count conditions & operations
  const { sections, refDataIds, conditionCount, operationCount } = enrichNested(nestedData, flatLookup);
  const sectionCount = sections.length;
  const entryCount = sections.reduce(
    (n, s) => n + (s.sheets || []).reduce((m, sh) => m + (sh.entries || []).length, 0),
    0,
  );
  console.log(`  Nested sections: ${sectionCount}, entries: ${entryCount}`);
  console.log(`  Conditions: ${conditionCount}, Operations: ${operationCount}`);

  // 4. Fetch reference data tables
  console.log(`  Reference data tables to fetch: ${refDataIds.size}`);
  const referenceData = {};
  if (refDataIds.size > 0) {
    const results = await Promise.all([...refDataIds].map(fetchRefData));
    for (const rd of results) {
      referenceData[rd.id] = rd;
    }
  }

  // 5. Build a field_type_map from the flat entries (entry_type_id -> type_name)
  const fieldTypeMap = {};
  for (const flat of Object.values(flatLookup)) {
    if (flat.entry_type_id != null && flat.type_name) {
      fieldTypeMap[String(flat.entry_type_id)] = flat.type_name;
    }
  }

  // 6. Assemble the output
  //    Conditions and operations are stored inline on each entry/sheet
  //    (entry.conditions, entry.operations, sheet.conditions) — not duplicated
  //    at the top level. The stats block provides aggregate counts.
  const output = {
    form_id: id,
    form_name: name,
    form_type: type,
    generated_at: new Date().toISOString(),
    stats: {
      sections: sectionCount,
      entries: entryCount,
      conditions: conditionCount,
      operations: operationCount,
      reference_data_tables: Object.keys(referenceData).length,
    },
    sections,
    reference_data: referenceData,
    field_type_map: fieldTypeMap,
  };

  // 7. Write to docs/
  const outPath = `docs/gocanvas-${type}-full.json`;
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`  Saved -> ${outPath}`);

  return output;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const arg = process.argv[2];
const validArgs = [...Object.keys(FORMS), 'all'];

if (!arg || !validArgs.includes(arg)) {
  console.error('Usage: node scripts/dumpGoCanvasForm.js <emissions|pickup|delivery|all>');
  process.exit(1);
}

const types = arg === 'all' ? Object.keys(FORMS) : [arg];

console.log('GoCanvas Form Dump');
console.log(`Forms: ${types.join(', ')}`);

(async () => {
  try {
    for (const type of types) {
      await dumpForm(type);
    }
    console.log('\nDone.');
  } catch (err) {
    console.error('\nFailed:', err.message);
    process.exit(1);
  }
})();
