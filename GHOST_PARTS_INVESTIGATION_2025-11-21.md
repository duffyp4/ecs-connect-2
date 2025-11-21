# Ghost Parts Issue Investigation Report
**Date:** November 21, 2025  
**Status:** Active Investigation  
**Impact:** Ghost parts appearing in GoCanvas emissions form that technicians cannot edit

---

## Executive Summary

The ECS Connect system is experiencing a recurring "ghost parts" issue where invalid or unexpected part entries appear in the GoCanvas emissions form (Form ID: 5692359) that technicians cannot edit. This is similar to a historical issue that was previously resolved.

---

## Background: Original Ghost Parts Issue (Resolved)

### What Happened
Previously, the system was dispatching an invalid value to the **"Submission Status"** dropdown field (field ID 736433785 in the old form).

### Root Cause
- The "Submission Status" field is a dropdown with specific valid options
- We were sending a value that wasn't one of the available dropdown options
- This invalid value triggered GoCanvas's Parts Log conditional logic
- Result: Created a "ghost part" that technicians couldn't edit

### Solution Implemented
- **Removed "Submission Status" from all dispatch mappings**
- Currently dispatching 23 main form fields for emissions, and "Submission Status" is NOT included
- This fix was documented in `replit.md` to prevent regression

---

## Current Issue: Ghost Parts Recurring (November 2025)

### Symptoms
Ghost parts are appearing again in GoCanvas submissions, suggesting we're triggering conditional logic through another field type mismatch or invalid value.

### Investigation Timeline

#### Step 1: Field Prefill Investigation
**Finding:** ECS Part Number field (736433791) was being incorrectly prefilled
- Originally sent ECS Serial Number value to BOTH fields:
  - ECS Serial Number (736433795) ✅ Correct - CSR-filled field
  - ECS Part Number (736433791) ❌ Incorrect - Should be technician-only
- **Fixed:** Removed dispatch to ECS Part Number field
- This field should remain blank for technicians to fill

#### Step 2: Comprehensive Field Type Analysis
Analyzed all 23 fields we dispatch to GoCanvas to identify potential type mismatches.

**Fields Dispatched (Main Form):**
1. Job ID (736433757) - Text
2. Customer Name (736433763) - Single Choice
3. Shop Name (736433762) - Single Choice
4. Customer Ship To (736433765) - Single Choice
5. P21 Ship to ID (736433766) - Single Choice
6. P21 Order Number (736433757) - Text
7. User ID (736433759) - Text
8. Permission to Start (736433760) - Text
9. Permission Denied Stop (736433761) - Text
10. Customer Specific Instructions (736433767) - Text
11. Send Clamps & Gaskets (736433768) - Text
12. Preferred Process (736433769) - Text
13. Any Other Specific Instructions (736433770) - Long Text
14. Any comments for tech (736433771) - Single Choice
15. Note to Tech (736433772) - Long Text
16. Contact Name (736433773) - Text
17. Contact Number (736433774) - Text
18. PO Number (736433775) - Text
19. Serial Numbers (736433776) - Text
20. Tech Customer Question Inquiry (736433777) - Text
21. Shop Handoff (736433782) - Single Choice
22. Handoff Email workflow (736433783) - Text

**Fields Dispatched (Parts - per part via loop screen):**
1. Part (736433802) - Single Choice (title field, no multi_key)
2. Process (736433789) - Single Choice
3. Filter PN (736433790) - Single Choice
4. ECS Serial (736433795) - Text
5. Gasket/Clamps (736433853) - Single Choice
6. PO Number (736433797) - Text
7. Mileage (736433798) - Text
8. Unit/VIN (736433799) - Text
9. EC (736433863) - Checkbox
10. EG (736433864) - Checkbox
11. EK (736433865) - Checkbox

#### Step 3: Identified Potential Issues

##### Issue A: Single Choice Fields with Reference Data
**6 fields are "Single Choice" (dropdown-like) that we send text values to:**
- Shop Name (736433762)
- Customer Name (736433763)
- Customer Ship To (736433765)
- P21 Ship to ID (736433766)
- Any comments for tech (736433771)
- Shop Handoff (736433782)

**Analysis:**
- These fields require values matching their GoCanvas reference data
- We pull data from GoCanvas API, so values should match exactly
- **User confirmed:** Reference data shouldn't be the issue since we're using exact API values
- **Status:** Ruled out as primary cause

##### Issue B: Checkbox Fields (EC, EG, EK)
**Initial concern:** These are checkbox type fields but we store/send text values

**Investigation:**
- Database stores: `"Yes"` (text) or empty/null
- We dispatch: `String(part.ec)` which sends `"Yes"`
- GoCanvas expects: Checkbox format (true/false or checked/unchecked)

**Testing:**
- User tested by checking all 3 boxes (EC, EG, EK)
- **Result:** All checkboxes appeared correctly checked in GoCanvas
- GoCanvas is accepting `"Yes"` as valid checkbox input
- **Status:** Ruled out - checkbox format is working correctly

---

## Current Status: Unknown Trigger

### What We Know
✅ **Fixed:**
- ECS Part Number no longer prefilled (was causing duplicate data)
- Submission Status not dispatched (original ghost parts fix)

✅ **Verified Working:**
- EC/EG/EK checkbox format accepted by GoCanvas
- Reference data fields using exact API values

❓ **Still Unknown:**
- What field/value is currently triggering ghost parts
- Whether issue occurs during dispatch or during technician completion
- Whether issue happens with parts added vs no parts

### Critical Questions Needed
1. **When does the ghost part appear?**
   - During initial emissions dispatch from ECS Connect?
   - When technician tries to complete the form in GoCanvas?

2. **What jobs are affected?**
   - Jobs with parts added by CSR?
   - Jobs with NO parts (blank parts section)?

3. **What is the exact behavior?**
   - Technician sees a part they didn't create?
   - Technician cannot edit/delete a part?
   - Form shows validation errors about parts?

4. **Error messages?**
   - Any specific error text from GoCanvas?
   - Required field errors?
   - Conditional logic messages?

---

## Technical Architecture Context

### Current Form Structure
- **Form ID:** 5692359 (Emissions Service Log)
- **Version:** 9 (migrated November 21, 2025)
- **Total Fields:** 167
- **Parts Implementation:** Loop screen with multi_key grouping

### Parts Dispatch Logic
```javascript
// Title field (NO multi_key)
{ entry_id: 736433802, value: "DPF" }

// Child fields (WITH multi_key)
{ entry_id: 736433789, value: "Blast Only", multi_key: "DPF" }
{ entry_id: 736433795, value: "12345", multi_key: "DPF" }
// ... etc
```

### Conditional Logic Risk Areas
Fields that could trigger Parts Log conditional logic:
1. Any dropdown field receiving invalid values
2. Required fields left empty
3. Checkbox fields with wrong format (ruled out)
4. Loop screen fields with incorrect multi_key structure
5. Fields that activate "show if" rules in GoCanvas form designer

---

## Potential Solutions (Not Yet Tested)

### Solution 1: Add Comprehensive Dispatch Logging
Create detailed logs of every field/value pair sent to GoCanvas:
- Log exact values and types
- Flag any empty/null required fields
- Detect potential dropdown mismatches
- Track which parts create which loop rows

### Solution 2: Validate Before Dispatch
Pre-validate all values against GoCanvas field definitions:
- Check Single Choice fields have valid reference data values
- Verify required fields are populated
- Validate checkbox format (already working)
- Ensure loop screen structure is correct

### Solution 3: GoCanvas Form Analysis
Review form conditional logic in GoCanvas designer:
- Identify what triggers Parts Log activation
- Check "show if" rules on parts fields
- Verify which fields make parts required
- Document any auto-population rules

### Solution 4: Staged Testing
Test with controlled scenarios:
1. Dispatch with NO parts → Check for ghost parts
2. Dispatch with 1 part → Verify single part appears
3. Dispatch with 3 parts → Verify all 3 appear correctly
4. Test with different part types (DPF, DOC, etc.)

---

## Next Steps

### Immediate Actions
1. **Gather specific details** about when/how ghost parts appear
2. **Review recent dispatch logs** for pattern detection
3. **Enable enhanced logging** for next test submission
4. **Document exact GoCanvas behavior** when ghost part appears

### Investigation Tasks
1. Check if ghost parts appear immediately after dispatch or during tech completion
2. Verify if issue is specific to certain part types or configurations
3. Review GoCanvas form conditional logic for Parts Log triggers
4. Test with DRY_RUN mode to analyze payload without API call

### Documentation Tasks
1. Update `replit.md` with findings once root cause identified
2. Add field type validation documentation
3. Create diagnostic playbook for future ghost parts issues

---

## Files for Reference

### Code Files
- `server/services/gocanvas.ts` - Dispatch logic and parts mapping
- `shared/schema.ts` - Database schema for job_parts
- `gocanvas_field_map_5692359.json` - Complete field definitions

### Documentation
- `replit.md` - System architecture and historical ghost parts fix
- `GHOST_PARTS_DIAGNOSTIC_REPORT.md` - Original investigation (September 2025)

### Diagnostic Scripts
- `scripts/analyze_field_mapping.js` - Field categorization
- `scripts/verify_csr_payload.js` - Payload validation
- `scripts/minimal_repro.js` - Standalone testing

---

## Historical Pattern: The Ghost Parts Signature

Both the original issue and current issue share characteristics:
1. ✅ CSR dispatch appears successful
2. ✅ GoCanvas accepts the dispatch without immediate error
3. ❌ Unexpected part behavior appears (either immediately or during tech work)
4. ❌ Technician cannot edit/remove the ghost part
5. 🔍 Root cause: Invalid value sent to a field triggers conditional logic

**Key Insight:** GoCanvas may accept invalid values without error, but they trigger hidden conditional logic that activates unwanted form sections.

---

**Report Generated:** November 21, 2025  
**Author:** ECS Connect Development Team  
**Status:** Investigation in progress - awaiting additional details about ghost part manifestation
