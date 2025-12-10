# Ghost Parts Investigation History

**Purpose:** Consolidated documentation of all "ghost parts" investigations for ECS Connect GoCanvas integration.

---

## Quick Reference: What Are "Ghost Parts"?

"Ghost parts" is a term used to describe anomalous part entries in GoCanvas that:
- Appear unexpectedly in the emissions form
- Cannot be edited or deleted by technicians
- Block form completion due to validation errors
- May show as "open" when they should be complete

**Important:** Not all issues that look like ghost parts have the same root cause. This document tracks each investigation to help identify patterns.

---

## Investigation Timeline

| Date | Form ID | Symptom | Root Cause | Category |
|------|---------|---------|------------|----------|
| Sep 2025 | 5594156 | Required field errors on submission | Conditional logic triggers | Code/Mapping |
| Nov 2025 | 5692359 | Parts showing as open/incomplete | Internal team added "Cleaning Phase" validation | Process/Communication |
| Dec 2025 | 5702557 | Part data mismatch, uneditable fields | Serial number manually edited in GoCanvas | User Error |

---

## Investigation #1: September 2025

**Date:** September 18, 2025  
**Form ID:** 5594156  
**Status:** Resolved

### Symptoms
- Intermittent "Required field error: The following field requires an entry to be made" during technician submission
- Errors appeared on Parts Log screen
- Techs could not complete submissions

### Investigation
Comprehensive codebase audit and payload analysis was performed. Key findings:

1. **CSR Payload was Clean:** No Parts Log entry IDs were accidentally included in CSR submissions
2. **No Loop/Table Issues:** No multi_key parameters or table pre-population detected
3. **Conditional Logic Discovery:** Certain CSR field values were triggering GoCanvas conditional logic that activated Parts Log requirements

### Root Cause
The "Submission Status" field value and "Send Clamps & Gaskets?" = "Yes" were triggering GoCanvas form conditional logic that:
1. Activated the Parts Log workflow screen
2. Made the "FORCE STOP (Parts Log Not Complete)" field required
3. Required Parts Log completion before final submission

### Resolution
Modified dispatch values to avoid triggering conditional logic. Removed "Submission Status" from dispatch mappings.

### Diagnostic Tools Created
- `scripts/analyze_field_mapping.js`
- `scripts/verify_csr_payload.js`
- `scripts/check_loop_table_handling.js`
- `scripts/check_conditional_toggles.js`
- `scripts/minimal_repro.js`

---

## Investigation #2: November 2025

**Date:** November 21, 2025  
**Form ID:** 5692359  
**Status:** Resolved

### Symptoms
- Parts appearing as "open" or incomplete in GoCanvas
- Similar appearance to ghost parts issue
- Technicians reported parts they couldn't close out

### Investigation
Initial investigation focused on:
- Field type mismatches
- Checkbox format issues (EC, EG, EK)
- Reference data validation
- Parts loop multi_key structure

All dispatch mappings were verified as correct. Checkbox format was confirmed working. No code issues were found.

### Root Cause
**Internal process issue, not a code bug.**

A team member added a new validation requirement to the GoCanvas form without communicating the change. The "Cleaning Phase" field had to be in a specific state for a part to be considered closed/complete.

Since ECS Connect was not aware of this new requirement, parts dispatched from the system appeared "open" in GoCanvas even though the dispatch was technically successful.

### Resolution
Updated understanding of form requirements. This was a process/communication gap, not a technical ghost parts issue.

### Key Learning
Not all "ghost part" symptoms are caused by dispatch issues. Form validation rules can change without notice. When investigating ghost parts, also check:
- Recent changes to GoCanvas form design
- New field requirements added by the team
- Validation rule changes in form conditional logic

---

## Investigation #3: December 2025

**Date:** December 10, 2025  
**Form ID:** 5702557 (Emissions Service Log - ECS Connect)  
**Status:** Pending resolution - awaiting user confirmation of manual edit

### Symptoms
For job `ECS-20251208211933-3192`:
- Part data in GoCanvas did not match database
- Parts loop fields appeared empty or with wrong values
- Technician saw a part with serial number `1.120825.21` that they could not fully edit

### Detailed Comparison

**Database Records:**

Job (`jobs` table):
```
job_id: ECS-20251208211933-3192
po_number: 495441
serial_numbers: null
```

Part (`job_parts` table):
```
ecs_serial: 01.12092025.01
part: DPF
process: DPF RENU
po_number: 495441
mileage: 912,137
unit_vin: 76983
gasket_clamps: Yes
ek: Yes
```

**GoCanvas Submission (after check-in):**

Job-level fields (correct):
```
PO Number (Check In): 495441 ✓
Customer Name: Estes ✓
Shop Name: Nashville DPF ✓
```

Parts loop fields (incorrect):
```
ECS Serial Number: 1.120825.21 ✗ (should be 01.12092025.01)
PO Number (parts): empty ✗ (should be 495441)
Mileage: empty ✗ (should be 912,137)
Unit / VIN Number: empty ✗ (should be 76983)
Gasket or Clamps: empty ✗ (should be Yes)
EK: False ✗ (should be Yes)
```

### Analysis

**The Critical Mismatch:** The serial number in GoCanvas (`1.120825.21`) does not match the database (`01.12092025.01`).

Since parts loop fields use `multi_key` (the serial number) to identify which row they belong to, all the correct part data was sent to GoCanvas attached to serial `01.12092025.01`. But GoCanvas displays a row with serial `1.120825.21`.

This means:
1. The correct data exists in GoCanvas but is attached to a "hidden" multi_key
2. A visible row exists with the wrong serial number but no associated data
3. The technician sees an incomplete part they cannot edit because the data is orphaned

### Verification with Second Job

To confirm our dispatch logic is correct, we compared job `ECS-20251210183122-3582` (Krebs Kubota):

**Database:** 4 parts with serials 01.12102025.08, 01.12102025.09, 01.12102025.10, 01.12102025.11

**GoCanvas:** All 4 parts appeared correctly with matching:
- Serial numbers ✓
- Part names ✓
- Process types ✓
- Gasket/Clamps values ✓
- EK values ✓

**Conclusion:** When serial numbers are not manually modified, the dispatch works correctly.

### Probable Root Cause

The serial number `1.120825.21` was likely entered or modified manually in GoCanvas before check-in. The format `1.120825.21` is invalid (should be `XX.MMDDYYYY.ZZ` with leading zeros), suggesting manual entry rather than system generation.

When the job was checked in at the shop, ECS Connect sent correct part data using the database serial `01.12092025.01` as the multi_key. But GoCanvas already had a row with serial `1.120825.21`, creating a mismatch.

### Pending
Awaiting confirmation from user about what was manually edited in GoCanvas.

### Related Finding: PO Number Dual-Mapping

During investigation, discovered that job-level PO Number is being sent to two field labels:
```typescript
{ data: jobData.poNumber, labels: ['PO Number (Check In)', 'PO Number'] }
```

- `PO Number (Check In)` (738697461) - Check-in section (correct)
- `PO Number` (738697508) - Parts loop field (incorrect)

The parts loop field requires a `multi_key` to associate with a specific part row. Sending a value without `multi_key` appears to be silently ignored by GoCanvas (no visible effect), but this is still a mapping bug that should be cleaned up.

**Lines affected:** 820 and 1514 in `server/services/gocanvas.ts`

---

## Diagnostic Playbook

When investigating "ghost parts" issues:

### Step 1: Gather Data
- Get the job ID from ECS Connect
- Export job data from database (`jobs` and `job_parts` tables)
- Export current GoCanvas submission data

### Step 2: Compare Serial Numbers
Check if serial numbers match between database and GoCanvas:
- Database: `job_parts.ecs_serial`
- GoCanvas: "ECS Serial Number" field values

If they don't match → likely manual edit in GoCanvas (December 2025 pattern)

### Step 3: Check Parts Loop Data
Compare each part field:
- Part name
- Process
- Gasket/Clamps
- EC/EG/EK checkboxes
- PO Number (part-level)
- Mileage
- Unit/VIN

### Step 4: Review Form Changes
Ask the team:
- Were any new field requirements added recently?
- Were validation rules changed?
- Were conditional logic rules modified?

If yes → likely process issue (November 2025 pattern)

### Step 5: Check Dispatch Logs
Review server logs around the time of dispatch:
- Look for payload logging
- Check for any API errors
- Verify field IDs being sent

### Step 6: Test with Fresh Job
Create a new test job and verify:
- All parts appear correctly
- All field values match
- No orphaned data

---

## Key Learnings

1. **Serial numbers are critical:** The `multi_key` system relies on exact serial number matches. Any manual modification breaks the association.

2. **Ghost parts have multiple causes:** Don't assume the root cause. Each investigation revealed a different pattern.

3. **Form changes may not be communicated:** Always ask about recent form modifications when investigating.

4. **Validation works when data is consistent:** Multiple tests confirmed that dispatch logic works correctly when serial numbers are not manually altered.

5. **GoCanvas silently ignores invalid loop data:** Sending parts loop fields without proper `multi_key` doesn't error - the data just disappears.

---

## Files Reference

### Code Files
- `server/services/gocanvas.ts` - Dispatch logic and parts mapping
- `shared/schema.ts` - Database schema for job_parts
- `shared/fieldMapper.ts` - Dynamic field ID lookups
- `gocanvas_field_map_emissions.json` - Field definitions for emissions form

### Diagnostic Scripts
- `scripts/analyze_field_mapping.js`
- `scripts/verify_csr_payload.js`
- `scripts/check_loop_table_handling.js`
- `scripts/check_conditional_toggles.js`
- `scripts/minimal_repro.js`

---

**Last Updated:** December 10, 2025
