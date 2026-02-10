/**
 * Reference data constants for the emissions service log form.
 * Extracted from GoCanvas reference data tables — these are the actual
 * dropdown options used in the production GoCanvas form.
 */

// Ref 246465 — Part types
export const PART_TYPES = [
  "DPF",
  "DOC",
  "SCR",
  "DPF - DOC",
  "DPF - DOC - SCR",
  "One Box",
  "Emission Collector",
  "EGR",
] as const;

// Ref 176530 — Process types
export const PROCESS_TYPES = [
  "DPF RENU",
  "Thermal Process",
  "Blast Only",
  "REPAIR ONLY",
] as const;

// Ref 345186 — Inlet color & condition
export const INLET_COLORS = [
  "Black",
  "Damaged",
  "White",
  "Cream/Tan",
  "Pink",
  "Brown",
  "Other Color",
  "Oil Soaked",
  "Face Plugged",
  "Black - Silicon Carbide",
  "FAILED",
] as const;

// Ref 345188 — Outlet color & condition
export const OUTLET_COLORS = [
  "Cream / Tan",
  "Damaged",
  "Black",
  "Brown",
  "White",
  "Other Color",
  "Oil Soaked",
  "Face Plugged",
  "Clean Silicone Carbide",
  "Dirty Silicone Carbide",
  "FAILED",
] as const;

// Ref 345187 — Damage types (shared for inlet/outlet)
export const DAMAGE_TYPES = [
  "Chipped - Needs Repair",
  "Cracked - Needs Repair",
  "Melted",
  "Loose Pieces",
  "FAILED",
] as const;

// Ref 344946 — Light test results
export const LIGHT_TEST_OPTIONS = [
  "Passed - Light Test",
  "Failed - Light Test",
] as const;

// Ref 345181 — Drop rod test results
export const DROP_ROD_TEST_OPTIONS = [
  "Passed - Drop Rod Test",
  "Failed - Drop Rod Test",
] as const;

// Ref 344959 — Failed reasons
export const FAILED_REASONS = [
  "Bad Cells",
  "Light Test",
  "Melted Core",
  "Oil Soaked",
  "Core Shifted",
  "Damaged Housing",
  "Deteriorated Ceramic",
  "Damaged Sealing Ring",
  "Ceramic Loss during blast",
  "Customer Declined Sintered Ash Process",
  "Failed AFTER Sintered Ash Process",
  "Outer Core Seal",
] as const;

// Ref 345189 — Bung & fitting problems
export const BUNG_PROBLEMS = [
  "Threads Stripped - Can be tapped",
  "Threads Stripped - Replace with NEW",
  "Bung Cracked - Replace with NEW",
  "Sensor Seized - Replace with NEW",
  "Sensor Seized - Can be tapped",
  "Sensor Removed",
] as const;

// Ref 346457 — Collector condition
export const COLLECTOR_CONDITIONS = [
  "Dented/ Bent - Needs Repair",
  "Chipped- Needs Repair",
  "Cracked",
  "Passed",
  "Failed",
] as const;

// Ref 323192 — Submission status
export const SUBMISSION_STATUSES = [
  "Checked In - Work in Progress",
  "Waiting on Parts or Approval",
  "Completed",
] as const;

// Ref 452183 — One Box sensor options (PN + description)
export const ONE_BOX_SENSORS = [
  { pn: "ES-A6804912437", description: "DOC Inlet Back Pressure" },
  { pn: "ES-A6805402117", description: "DOC Outlet Temp" },
  { pn: "ES-A6804912537", description: "Back Pressure Sensor" },
  { pn: "ES-A6805401517", description: "DPF Outlet Temp" },
  { pn: "ES-A0101532228", description: "DPF inlet NOX" },
  { pn: "ES-A0101532328", description: "DPF Outlet NOX" },
  { pn: "ES-A6805401917", description: "SCR Inlet/Outlet Temp" },
  { pn: "ES-A6805402017", description: "DOC Inlet Temp" },
  { pn: "ES-A0101531928", description: "DPF Inlet NOX" },
  { pn: "ES-A0101538128", description: "DPF Outlet NOX" },
  { pn: "Soot Sensor", description: "PM Soot Sensor" },
] as const;

// Inline dropdown options (from form entry_values, not reference data)

export const CLEANING_PHASES = [
  "Pre-Thermal",
  "Post-Thermal",
  "FAILED",
] as const;

export const SMOKE_TEST_OPTIONS = [
  "No Visible Leaks",
  "Visible Leaks - Leaks are repairable",
  "Visible Leaks - Leaks are NOT repairable",
] as const;

export const SEALING_RING_CONDITIONS = [
  "No Damage",
  "Minor Damage",
  "Major Damage",
] as const;

export const CANISTER_CONDITIONS = [
  "No Damage",
  "Minor Damage",
  "Major Damage",
] as const;

export const BUNG_CONDITIONS = [
  "Passed",
  "FAILED",
] as const;

export const FITTING_QUANTITIES = ["1", "2", "3", "4", "5"] as const;

export const EC_EG_EK_QUANTITIES = ["1", "2", "3"] as const;

export const LEAKING_CELLS_OPTIONS = [
  "0",
  "5",
  "10",
  "25",
  "50",
  "100",
  "Too many to count",
] as const;

export const SENSORS_REMOVED_OPTIONS = [
  "EGT",
  "NOx",
  "SPM",
  "Pressure Tube",
] as const;

export const REPAIRS_PERFORMED_OPTIONS = [
  "Bung Repair",
  "Ceramic Repair",
  "Core Shift Repair",
  "Housing Damage Repair",
  "Sintered Ash",
] as const;

export const YES_NO = ["Yes", "No"] as const;
export const PASS_FAIL = ["Pass", "Fail"] as const;

// Ref 176531 — Fitting part numbers (representative set)
export const FITTING_PART_NUMBERS = [
  { pn: "EF01BP", description: "M16 x 1.0 Detroit Onebox Pressure Tube Bung" },
  { pn: "EF01CD", description: "M16 x 1.5 Cummins DPF Inlet Pressure Tube Bung" },
  { pn: "EF01CS", description: "M16 x 1.5 Cummins DPF Inlet Pressure Tube Bung" },
  { pn: "EF01FD", description: "M14 x 1.5 Cummins and Detroit EGT Bung" },
  { pn: "EF01VS", description: "M16 x 1.5 Volvo Pressure Tube Bung" },
  { pn: "EF02CS", description: "M14 x 1.5 Cummins DPF Outlet Pressure Tube Bung" },
  { pn: "EF02VS", description: "M16 x 1.5 Cummins Mixer EGT Bung" },
  { pn: "EF03CS", description: "M12 x 1.25 Cummins DPF EGT Sensor Bung" },
  { pn: "EF04VS", description: "M16 x 1.5 Volvo DOC Pressure Tube Bung" },
  { pn: "EF05VS", description: "M18 x 1.5 Volvo Onebox SPM Sensor Bung" },
  { pn: "EF06VS", description: "M12 x 1.5 Volvo Onebox Cap Pressure Tube Bung" },
  { pn: "EF10DD", description: "M14 x 1.5 Detroit Onebox DOC Inlet EGT Sensor Bung" },
  { pn: "EF20DS", description: "M12 x 1.25 Detroit Onebox DPF Outlet EGT Sensor Bung" },
  { pn: "EF30DDOS", description: "M16 x 1.0 Detroit Onebox Pressure Tube Bung" },
  { pn: "EF30DNOX", description: "M20 x 1.5 Cummins and Detroit NoX Sensor Bung" },
  { pn: "EF30NB", description: "M12 x 1.25 Universal EGT Bung" },
  { pn: "EF40PM", description: "M22 x 1.5 Cummins and Detroit SPM Sensor Bung" },
  { pn: "EF50200127", description: "M6 x 1.0 Cummins Wire Harness Mounting Stud" },
] as const;

// Ref 1017142 — Technician names (grouped by shop)
export const TECHNICIANS = [
  { name: "Carrie Campbell", shop: "ECS - Nashville" },
  { name: "Kyle Roberts", shop: "ECS - Nashville" },
  { name: "Jody Johnson", shop: "ECS - Nashville" },
  { name: "Jeremy Rogers", shop: "ECS - Memphis" },
  { name: "Jarve Campbell", shop: "ECS - Memphis" },
  { name: "Tim Forrest", shop: "ECS - Memphis" },
  { name: "Zach Rennie", shop: "ECS - Dallas" },
  { name: "Nick Stiles", shop: "ECS - Dallas" },
  { name: "Jason Harper", shop: "ECS - Dallas" },
  { name: "Blake Ford", shop: "ECS - Atlanta" },
  { name: "Raymond Crider", shop: "ECS - Atlanta" },
  { name: "Ken Irozuru", shop: "ECS - Atlanta" },
  { name: "Chicago GM", shop: "ECS - Chicago" },
  { name: "Chicago Tech", shop: "ECS - Chicago" },
  { name: "Troy Beebe", shop: "ECS - Corporate" },
  { name: "Tom Stanley", shop: "ECS - Corporate" },
  { name: "Bryant Millikan", shop: "ECS - Corporate" },
] as const;
