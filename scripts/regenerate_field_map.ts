import { goCanvasService } from '../server/services/gocanvas';
import * as fs from 'fs';

const FORM_ID = '5718455'; // New Emissions form ID

async function regenerateFieldMap() {
  console.log(`Fetching form details for Emissions form ${FORM_ID}...`);
  
  const formDetails = await goCanvasService.getFormDetails(FORM_ID);
  
  if (!formDetails || !formDetails.entries) {
    console.error('No form entries found');
    return;
  }
  
  console.log(`Found ${formDetails.entries.length} form entries`);
  
  // Build field map structure
  const fieldMap = {
    form_id: FORM_ID,
    form_name: formDetails.name || 'Emissions Service Log',
    generated_at: new Date().toISOString(),
    entries: formDetails.entries
      .filter((e: any) => e.label && e.id)
      .map((e: any) => ({
        id: e.id,
        label: e.label,
        type: e.type || 'unknown',
        required: e.required || false,
        reference_data_id: e.reference_data_id || null,
        reference_data_column: e.reference_data_column || null,
      }))
  };
  
  const outputPath = './gocanvas_field_map_emissions.json';
  fs.writeFileSync(outputPath, JSON.stringify(fieldMap, null, 2));
  
  console.log(`\nField map saved to: ${outputPath}`);
  console.log(`Total fields mapped: ${fieldMap.entries.length}`);
}

regenerateFieldMap().catch(console.error);
