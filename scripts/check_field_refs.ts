import { goCanvasService } from '../server/services/gocanvas';

const fieldsToCheck = [
  'Filter Part Number',
  'ECS Part Number', 
  'Part Description',
  'Inlet Clamp PN (Recommended)',
  'Inlet Gasket PN (Recommended)',
  'Outlet Clamp PN (Recommended)',
  'Outlet Gasket PN (Recommended)',
  'Kit #1 (Recommended)',
  'Kit#2 (Recommended)',
  'EC Part Number - 1',
  'EC Part Description - 1',
  'EC Part Number - 2',
  'EC Part Description - 2',
  'EC Part Number - 3',
  'EC Part Description - 3',
  'EG Part Number - 1',
  'EG Part Description - 1',
  'EG Part Number - 2',
  'EG Part Description - 2',
  'EG Part Number - 3',
  'EG Part Description - 3',
  'EK Part Number - 1',
  'EK Part Description - 1',
  'EK Part Number - 2',
  'EK Part Description - 2',
  'EK Part Number - 3',
  'EK Part Description - 3',
];

async function checkFieldRefs() {
  try {
    const formId = '5718455'; // NEW Emissions form ID
    console.log(`Fetching Emissions Service Log form (${formId})...\n`);
    
    const formDetails = await goCanvasService.getFormDetails(formId);
    
    if (!formDetails || !formDetails.entries) {
      console.log('No entries found');
      return;
    }
    
    console.log('╔══════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    FIELD REFERENCE DATA CONNECTIONS                              ║');
    console.log('║                    Form ID: 5718455 (NEW)                                        ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════════╣');
    console.log('║ Field Name                          │ Ref Data ID  │ Column                      ║');
    console.log('╠─────────────────────────────────────┼──────────────┼─────────────────────────────╣');
    
    for (const fieldName of fieldsToCheck) {
      const field = formDetails.entries.find((e: any) => e.label === fieldName);
      
      if (field) {
        const refId = field.reference_data_id || 'None';
        const refCol = field.reference_data_column || '-';
        const fieldPadded = fieldName.padEnd(35);
        const refIdPadded = String(refId).padEnd(12);
        const refColPadded = refCol.toString().padEnd(27);
        console.log(`║ ${fieldPadded} │ ${refIdPadded} │ ${refColPadded} ║`);
      } else {
        const fieldPadded = fieldName.padEnd(35);
        console.log(`║ ${fieldPadded} │ NOT FOUND    │ -                           ║`);
      }
    }
    
    console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFieldRefs();
