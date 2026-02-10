/**
 * Section visibility helpers for the emissions service log form.
 *
 * These thin wrappers delegate to isSectionVisible() from the config file,
 * keeping the same function signatures so consumers (parts-loop-section.tsx)
 * don't need changes.
 */

import { EMISSIONS_FIELD_CONFIG, isSectionVisible } from "./emissions-form-fields";

const getSection = (id: string) => EMISSIONS_FIELD_CONFIG.find((s) => s.id === id)!;

export function showCleaningPhase(process: string): boolean {
  return isSectionVisible(getSection("cleaning"), "", process);
}

export function showOneBoxDiagnostics(partType: string): boolean {
  return isSectionVisible(getSection("oneBoxDiagnostics"), partType, "");
}

export function showOneBoxInspection(partType: string, process: string): boolean {
  return isSectionVisible(getSection("oneBoxInspection"), partType, process);
}

export function showInletOutlet(_partType: string, process: string): boolean {
  return isSectionVisible(getSection("inletOutlet"), _partType, process);
}

export function showSealingCanister(_partType: string, process: string): boolean {
  return isSectionVisible(getSection("sealingCanister"), _partType, process);
}

export function showBungFitting(_partType: string, _process: string): boolean {
  return isSectionVisible(getSection("bungFitting"), _partType, _process);
}

export function showCollector(_partType: string, _process: string): boolean {
  return isSectionVisible(getSection("collector"), _partType, _process);
}

export function showGasketClamp(_partType: string, _process: string): boolean {
  return isSectionVisible(getSection("gasketClamp"), _partType, _process);
}

export function showMeasurements(_partType: string, process: string): boolean {
  return isSectionVisible(getSection("measurements"), _partType, process);
}

export function showRepairAssessment(_partType: string, _process: string): boolean {
  return isSectionVisible(getSection("repairAssessment"), _partType, _process);
}

export function showPassFail(_partType: string, _process: string): boolean {
  return isSectionVisible(getSection("passFail"), _partType, _process);
}
