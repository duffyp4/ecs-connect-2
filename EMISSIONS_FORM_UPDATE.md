# Emissions Service Log Form Update

## Update Summary
**Date**: October 9, 2025  
**Old Form ID**: 5628226  
**New Form ID**: 5640674  

## Changes Made

### 1. Updated Form ID
- **File**: `server/services/gocanvas.ts`
- **Change**: Updated FORM_IDS.EMISSIONS from '5628226' to '5640674'

### 2. Generated New Field Mapping
- **Script**: `scripts/buildFieldMap.js 5640674`
- **Output**: `gocanvas_field_map_5640674.json`
- **Total Fields**: 164 fields (same as before)
- **Form Version**: 6

### 3. Updated Field Mapper
- **File**: `shared/fieldMapper.ts`
- **Changes**:
  - Updated formIds array to load form 5640674
  - Updated default form ID from 5628226 to 5640674

## Sample Field IDs (New Mapping)

| Field Label | Old ID (5628226) | New ID (5640674) |
|------------|------------------|------------------|
| P21 Order Number | 723961887 | 726434771 |
| Job ID | 723961888 | 726434772 |
| User ID | 723961889 | 726434773 |
| Permission to Start | 723961890 | 726434774 |
| Permission Denied Stop | 723961891 | 726434775 |
| Shop Name | 723961892 | 726434776 |
| Customer Name | 723961893 | 726434777 |
| Customer Ship To | 723961895 | 726434779 |
| P21 Ship to ID | 723961896 | 726434780 |
| Contact Name | 723961903 | 726434787 |
| Contact Number | 723961904 | 726434788 |
| PO Number (Check In) | 723961905 | 726434789 |
| Serial Number(s) | 723961906 | 726434790 |

## Files Modified

1. ✅ `server/services/gocanvas.ts` - Form ID constant updated
2. ✅ `shared/fieldMapper.ts` - Field mapper updated to load new form
3. ✅ `gocanvas_field_map_5640674.json` - New field mapping created
4. ℹ️ `gocanvas_field_map_5628226.json` - Old mapping (can be removed)

## Verification

To verify the update is working:
1. Create a new job via direct check-in
2. Check that the GoCanvas dispatch uses form ID 5640674
3. Verify all fields are mapped correctly in GoCanvas

## Notes

- All 164 fields from the previous form are present in the new form
- Field order and types remain consistent
- The system will automatically use the new form ID for all new dispatches
