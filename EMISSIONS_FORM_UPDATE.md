# Emissions Service Log Form Update

## Update Summary
**Date**: October 20, 2025  
**Old Form ID**: 5651956  
**New Form ID**: 5654184  

## Changes Made

### 1. Updated Form ID
- **File**: `server/services/gocanvas.ts`
- **Change**: Updated FORM_IDS.EMISSIONS from '5651956' to '5654184'

### 2. Generated New Field Mapping
- **Script**: `scripts/buildFieldMap.js 5654184`
- **Output**: `gocanvas_field_map_5654184.json`
- **Total Fields**: 167 fields
- **Form Version**: 8

### 3. Updated Field Mapper
- **File**: `shared/fieldMapper.ts`
- **Changes**:
  - Updated formIds array to load form 5654184
  - Updated default form ID from 5651956 to 5654184

## Sample Field IDs (New Mapping)

| Field Label | Old ID (5651956) | New ID (5654184) |
|------------|------------------|------------------|
| P21 Order Number | 728558873 | 728953371 |
| Job ID | 728558874 | 728953372 |
| User ID | 728558875 | 728953373 |
| Permission to Start | 728558876 | 728953374 |
| Permission Denied Stop | 728558877 | 728953375 |
| Shop Name | 728558878 | 728953376 |
| Customer Name | 728558879 | 728953377 |
| Contact Name | 728558889 | 728953387 |
| Contact Number | 728558890 | 728953388 |
| PO Number (Check In) | 728558891 | 728953389 |

## Files Modified

1. ✅ `server/services/gocanvas.ts` - Form ID constant updated
2. ✅ `shared/fieldMapper.ts` - Field mapper updated to load new form
3. ✅ `gocanvas_field_map_5654184.json` - New field mapping created (167 fields)
4. ✅ `gocanvas_field_map_5651956.json` - Old mapping removed

## Verification

To verify the update is working:
1. Create a new job via direct check-in
2. Check that the GoCanvas dispatch uses form ID 5654184
3. Verify all fields are mapped correctly in GoCanvas

## Notes

- Form now has 167 fields (increased by 2 from previous version)
- Form version updated from 7 to 8
- Field order and types remain consistent
- The system will automatically use the new form ID for all new dispatches
