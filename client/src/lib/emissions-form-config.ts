/**
 * Centralized section visibility rules for the emissions service log form.
 * Each rule is a pure function: (partType, process) => boolean.
 *
 * Part types that trigger One Box sections:
 *   "One Box", "DPF - DOC - SCR", "DPF - DOC"
 *
 * Parts that show crystallization:
 *   "SCR", "One Box", "DPF - DOC - SCR"
 *
 * "REPAIR ONLY" process hides cleaning, measurements, and inspection sections.
 */

/** Parts where "One Box" diagnostic/inspection sections appear */
const ONE_BOX_PARTS = new Set(["One Box", "DPF - DOC - SCR", "DPF - DOC"]);

/** Parts where crystallization question appears */
const CRYSTALLIZATION_PARTS = new Set(["SCR", "One Box", "DPF - DOC - SCR"]);

export function showCleaningPhase(process: string): boolean {
  return process !== "REPAIR ONLY";
}

export function showOneBoxDiagnostics(partType: string): boolean {
  return ONE_BOX_PARTS.has(partType);
}

export function showOneBoxInspection(partType: string, process: string): boolean {
  return ONE_BOX_PARTS.has(partType) && process !== "REPAIR ONLY";
}

export function showCrystallization(partType: string): boolean {
  return CRYSTALLIZATION_PARTS.has(partType);
}

export function showInletOutlet(_partType: string, process: string): boolean {
  return process !== "REPAIR ONLY";
}

export function showSealingCanister(_partType: string, process: string): boolean {
  return process !== "REPAIR ONLY";
}

export function showBungFitting(_partType: string, _process: string): boolean {
  return true; // Always visible
}

export function showCollector(_partType: string, _process: string): boolean {
  return true; // Always visible
}

export function showGasketClamp(_partType: string, _process: string): boolean {
  return true; // Always visible
}

export function showMeasurements(_partType: string, process: string): boolean {
  return process !== "REPAIR ONLY";
}

export function showRepairAssessment(_partType: string, _process: string): boolean {
  return true; // Always visible
}

export function showPassFail(_partType: string, _process: string): boolean {
  return true; // Always visible
}
