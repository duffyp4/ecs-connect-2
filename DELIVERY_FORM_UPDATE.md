# Delivery Log Form Update

## Update Summary
**Date**: October 9, 2025  
**Old Form ID**: 5632656  
**New Form ID**: 5640686  

## Changes Made

### 1. Updated Form ID
- **File**: `server/services/gocanvas.ts`
- **Change**: Updated FORM_IDS.DELIVERY from '5632656' to '5640686'

### 2. Generated New Field Mapping
- **Script**: `scripts/buildFieldMap.js 5640686`
- **Output**: `gocanvas_field_map_5640686.json`
- **Total Fields**: 18 fields
- **Form Version**: 4

### 3. Updated Field Mapper
- **File**: `shared/fieldMapper.ts`
- **Changes**: Updated formIds array to load form 5640686

## Field IDs (New Mapping)

| Field Label | Field ID | Type | Required |
|------------|----------|------|----------|
| Job ID | 726436756 | Text | ✅ |
| Dispatch Date | 726436757 | Text | - |
| Dispatch Time | 726436758 | Text | - |
| Location | 726436759 | Single Choice | ✅ |
| Customer Name | 726436760 | Single Choice | ✅ |
| Customer Ship To | 726436761 | Single Choice | ✅ |
| Customer Acct Number | 726436762 | Text | - |
| Contact Name | 726436763 | Text | - |
| Contact Number | 726436764 | Text | - |
| Delivery Address | 726436765 | Text | - |
| Driver | 726436766 | Single Choice | ✅ |
| Delivery Signature | 726436767 | Signature | - |
| Signature First Name | 726436768 | Text | - |
| Signature Last Name | 726436769 | Text | - |
| Delivery Complete Date | 726436770 | Date/Time | - |
| GPS Coordinates | 726436771 | GPS Coordinates | - |
| Image of Delivery | 726436772 | Image | - |
| Comments | 726436773 | Text | - |

## Files Modified

1. ✅ `server/services/gocanvas.ts` - Form ID constant updated
2. ✅ `shared/fieldMapper.ts` - Field mapper updated to load new form
3. ✅ `gocanvas_field_map_5640686.json` - New field mapping created
4. ℹ️ `gocanvas_field_map_5632656.json` - Old mapping (can be removed)

## Verification

To verify the update is working:
1. Complete a job to "Ready for Delivery" state
2. Mark for delivery to dispatch delivery form
3. Check that the GoCanvas dispatch uses form ID 5640686
4. Verify all fields are mapped correctly in GoCanvas

## Notes

- Delivery form has 18 fields (same as previous version)
- All field mappings have been updated
- The system will automatically use the new form ID for all new delivery dispatches
