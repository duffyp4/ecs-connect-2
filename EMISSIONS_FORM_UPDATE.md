# Emissions Service Log Form Update

## Update Summary
**Date**: October 16, 2025  
**Old Form ID**: 5640674  
**New Form ID**: 5651956  

## Changes Made

### 1. Updated Form ID
- **File**: `server/services/gocanvas.ts`
- **Change**: Updated FORM_IDS.EMISSIONS from '5640674' to '5651956'

### 2. Generated New Field Mapping
- **Script**: `scripts/buildFieldMap.js 5651956`
- **Output**: `gocanvas_field_map_5651956.json`
- **Total Fields**: 165 fields
- **Form Version**: 7

### 3. Updated Field Mapper
- **File**: `shared/fieldMapper.ts`
- **Changes**:
  - Updated formIds array to load form 5651956
  - Updated default form ID from 5640674 to 5651956

## Sample Field IDs (New Mapping)

| Field Label | Old ID (5640674) | New ID (5651956) |
|------------|------------------|------------------|
| P21 Order Number | 726434771 | 728558873 |
| Job ID | 726434772 | 728558874 |
| User ID | 726434773 | 728558875 |
| Permission to Start | 726434774 | 728558876 |
| Permission Denied Stop | 726434775 | 728558877 |
| Shop Name | 726434776 | 728558878 |
| Customer Name | 726434777 | 728558879 |
| Contact Name | 726434787 | 728558889 |
| Contact Number | 726434788 | 728558890 |
| PO Number (Check In) | 726434789 | 728558891 |

## Files Modified

1. ✅ `server/services/gocanvas.ts` - Form ID constant updated
2. ✅ `shared/fieldMapper.ts` - Field mapper updated to load new form
3. ✅ `gocanvas_field_map_5651956.json` - New field mapping created (165 fields)
4. ✅ `gocanvas_field_map_5640674.json` - Old mapping removed

## Verification

To verify the update is working:
1. Create a new job via direct check-in
2. Check that the GoCanvas dispatch uses form ID 5651956
3. Verify all fields are mapped correctly in GoCanvas

## Notes

- Form now has 165 fields (increased by 1 from previous version)
- Form version updated from 6 to 7
- Field order and types remain consistent
- The system will automatically use the new form ID for all new dispatches
