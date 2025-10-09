# GoCanvas Pickup Form Field Mapping

## Form Details
- **Form ID**: 5640587
- **Form Name**: Pickup Log (Updated)
- **Version**: 4
- **Total Fields**: 15
- **Updated**: 2025-10-09

## Field Mapping Summary

| Field Label | Field ID | Type | Required | Mapped From |
|------------|----------|------|----------|-------------|
| Job ID | 726424691 | Text | ✅ Yes | jobData.jobId |
| Dispatch Date | 726424692 | Text | ❌ No | Auto-generated (current date) |
| Dispatch Time | 726424693 | Text | ❌ No | Auto-generated (current time) |
| Location | 726424694 | Single Choice | ✅ Yes | jobData.shopName |
| Customer Name | 726424695 | Single Choice | ✅ Yes | jobData.customerName |
| Customer Ship-To | 726424696 | Single Choice | ✅ Yes | jobData.customerShipTo |
| **Contact Name** | 726424697 | Text | ❌ No | jobData.contactName |
| **Contact Number** | 726424698 | Text | ❌ No | jobData.contactNumber |
| **PO Number (Check In)** | 726424699 | Text | ❌ No | jobData.poNumber |
| Notes to Driver | 726424700 | Text | ❌ No | jobData.pickupNotes |
| Pick-Up Date | 726424701 | Date | ✅ Yes | Driver fills in |
| Pick-Up Time | 726424702 | Time | ✅ Yes | Driver fills in |
| Pick-Up Photo | 726424703 | Photo | ✅ Yes | Driver captures |
| GPS | 726424704 | GPS | ❌ No | Driver location |
| Driver Notes | 726424705 | Long Text | ❌ No | Driver fills in |

## New Fields Added ✨

The following three fields were added to capture additional customer information during pickup dispatch:

1. **Contact Name** (ID: 726424697)
   - Type: Text field
   - Required: No
   - Purpose: Name of contact person at pickup location
   - Mapped from: Frontend pickup form

2. **Contact Number** (ID: 726424698)
   - Type: Text field (formatted as phone number)
   - Required: No
   - Purpose: Phone number for pickup contact
   - Mapped from: Frontend pickup form (auto-formatted)

3. **PO Number (Check In)** (ID: 726424699)
   - Type: Text field
   - Required: No
   - Purpose: Purchase order number for the job
   - Mapped from: Frontend pickup form

## Implementation Status

✅ **Completed**:
- Form ID updated in FORM_IDS constant (5640587)
- Field mapping generated using buildFieldMap.js
- Mapping saved to `gocanvas_field_map_5640587.json`
- FieldMapper updated to load new form mapping
- GoCanvas service updated to map new fields
- Frontend form updated with Contact Name, Contact Number, and PO Number inputs

## Files Modified

1. `server/services/gocanvas.ts` - Updated FORM_IDS and field mappings
2. `shared/fieldMapper.ts` - Updated to load form 5640587
3. `gocanvas_field_map_5640587.json` - New field mapping file
4. `client/src/components/csr-form-new.tsx` - Added UI fields and data handling

## Testing Checklist

- [ ] Create a new pickup dispatch job
- [ ] Verify Contact Name, Contact Number, and PO Number appear in GoCanvas form
- [ ] Confirm optional fields don't block dispatch creation when empty
- [ ] Verify data flows correctly from frontend → backend → GoCanvas
