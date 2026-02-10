/**
 * Single source of truth for all emissions service log form fields.
 *
 * Every field's canonical name, type, section membership, visibility rules,
 * and test-data hints are defined here. The Zod schema, form defaults, test
 * data generator, and section-visibility helpers all derive from this config.
 */

import { z } from "zod";

// ─── Types ─────────────────────────────────────

export type FieldType = "string" | "boolean";

export interface ConditionalRule {
  field: string;
  equals: string | boolean | string[];
}

export interface FieldDef {
  name: string;
  type: FieldType;
  /** UI-required indicator and test-data hint. Not enforced by schema
   *  (except passOrFail which is the one schema-required field). */
  required?: boolean | { when: ConditionalRule };
  /** Field is only rendered when this condition is met. */
  visibleWhen?: ConditionalRule;
  // ── Test-data hints (used by generator) ──
  /** Key into REFERENCE_DATA_MAP for dropdown values. */
  options?: string;
  /** For numeric-string fields: random int in [min, max]. */
  range?: [number, number];
  /** Template string; {i} is replaced with part index + 1. */
  template?: string;
}

export interface SectionVisibility {
  /** Section requires partType to be one of these. */
  partType?: string[];
  /** Section is hidden when process equals this value. */
  processNot?: string;
}

export interface SectionDef {
  id: string;
  title: string;
  visibleWhen?: SectionVisibility;
  fields: FieldDef[];
}

// ─── Constants ─────────────────────────────────

const ONE_BOX_PARTS = ["One Box", "DPF - DOC - SCR", "DPF - DOC"];

// ─── Field Config ──────────────────────────────

export const EMISSIONS_FIELD_CONFIG: SectionDef[] = [
  // 1. Part Identification — always visible
  {
    id: "partIdentification",
    title: "Part Identification",
    fields: [
      { name: "ecsSerial", type: "string" },
      { name: "ecsPartNumber", type: "string" },
      { name: "partDescription", type: "string" },
      { name: "oeSerialNumber", type: "string" },
    ],
  },

  // 2. Cleaning Phase — hidden for REPAIR ONLY
  {
    id: "cleaning",
    title: "Cleaning Phase",
    visibleWhen: { processNot: "REPAIR ONLY" },
    fields: [
      { name: "cleaningPhase", type: "string", required: true, options: "CLEANING_PHASES" },
    ],
  },

  // 3. One Box Diagnostics — One Box / DPF-DOC / DPF-DOC-SCR
  {
    id: "oneBoxDiagnostics",
    title: "One Box Diagnostics",
    visibleWhen: { partType: ONE_BOX_PARTS },
    fields: [
      { name: "noxConversionPercent", type: "string", required: true, range: [50, 99] },
      { name: "docInletTemp", type: "string", range: [200, 600] },
      { name: "docOutletTemp", type: "string", range: [200, 600] },
      { name: "dpfOutletTemp", type: "string", range: [200, 600] },
      { name: "hasPhysicalDamage", type: "string", required: true, options: "YES_NO" },
      { name: "wereSensorsRemoved", type: "string", required: true, options: "YES_NO" },
      { name: "sensorsRemoved", type: "string",
        visibleWhen: { field: "wereSensorsRemoved", equals: "Yes" } },
      { name: "repairDescriptionOneBox", type: "string",
        template: "[TEST] One box repair for part {i}" },
      { name: "hasCrystallization", type: "string", required: true, options: "YES_NO" },
      { name: "crystallizationDescription", type: "string",
        visibleWhen: { field: "hasCrystallization", equals: "Yes" },
        template: "[TEST] Crystallization found on part {i}" },
    ],
  },

  // 4. One Box Inspection — One Box parts, not REPAIR ONLY
  {
    id: "oneBoxInspection",
    title: "One Box Inspection",
    visibleWhen: { partType: ONE_BOX_PARTS, processNot: "REPAIR ONLY" },
    fields: [
      { name: "preCleaningScrSmokeTest", type: "string", required: true, options: "SMOKE_TEST_OPTIONS" },
      { name: "preCleaningDocSmokeTest", type: "string", required: true, options: "SMOKE_TEST_OPTIONS" },
      { name: "postCleaningScrSmokeTest", type: "string", required: true, options: "SMOKE_TEST_OPTIONS" },
      { name: "postCleaningDocSmokeTest", type: "string", required: true, options: "SMOKE_TEST_OPTIONS" },
      { name: "oneBoxNeedsSensors", type: "string", options: "YES_NO" },
      { name: "oneBoxSensorsNeeded", type: "string",
        visibleWhen: { field: "oneBoxNeedsSensors", equals: "Yes" } },
    ],
  },

  // 5. Inlet & Outlet — hidden for REPAIR ONLY
  {
    id: "inletOutlet",
    title: "Inlet & Outlet",
    visibleWhen: { processNot: "REPAIR ONLY" },
    fields: [
      { name: "inletColor", type: "string", required: true, options: "INLET_COLORS" },
      { name: "inletOtherColor", type: "string",
        visibleWhen: { field: "inletColor", equals: "Other Color" } },
      { name: "inletDamage", type: "string", options: "DAMAGE_TYPES" },
      { name: "inletComment", type: "string", template: "[TEST] Inlet comment for part {i}" },
      { name: "outletColor", type: "string", required: true, options: "OUTLET_COLORS" },
      { name: "outletOtherColor", type: "string",
        visibleWhen: { field: "outletColor", equals: "Other Color" } },
      { name: "outletDamage", type: "string", options: "DAMAGE_TYPES" },
      { name: "outletLeakingCells", type: "string", options: "LEAKING_CELLS_OPTIONS" },
      { name: "outletComment", type: "string", template: "[TEST] Outlet comment for part {i}" },
    ],
  },

  // 6. Sealing & Canister — hidden for REPAIR ONLY
  {
    id: "sealingCanister",
    title: "Sealing & Canister",
    visibleWhen: { processNot: "REPAIR ONLY" },
    fields: [
      { name: "sealingRingCondition", type: "string", required: true, options: "SEALING_RING_CONDITIONS" },
      { name: "canisterCondition", type: "string", required: true, options: "CANISTER_CONDITIONS" },
    ],
  },

  // 7. Bung & Fitting — always visible
  {
    id: "bungFitting",
    title: "Bung & Fitting",
    fields: [
      { name: "bungCondition", type: "string", required: true, options: "BUNG_CONDITIONS" },
      { name: "showRecommendedBungs", type: "string" },
      { name: "bungProblem", type: "string", options: "BUNG_PROBLEMS" },
      { name: "firstFittingQuantity", type: "string", options: "FITTING_QUANTITIES" },
      { name: "firstFittingPartNumber", type: "string" },
      { name: "firstFittingDescription", type: "string" },
      { name: "additionalFitting2", type: "string", options: "YES_NO" },
      { name: "secondFittingQuantity", type: "string",
        visibleWhen: { field: "additionalFitting2", equals: "Yes" },
        options: "FITTING_QUANTITIES" },
      { name: "secondFittingPartNumber", type: "string",
        visibleWhen: { field: "additionalFitting2", equals: "Yes" } },
      { name: "secondFittingDescription", type: "string",
        visibleWhen: { field: "additionalFitting2", equals: "Yes" } },
      { name: "additionalFitting3", type: "string",
        visibleWhen: { field: "additionalFitting2", equals: "Yes" },
        options: "YES_NO" },
      { name: "thirdFittingQuantity", type: "string",
        visibleWhen: { field: "additionalFitting3", equals: "Yes" },
        options: "FITTING_QUANTITIES" },
      { name: "thirdFittingPartNumber", type: "string",
        visibleWhen: { field: "additionalFitting3", equals: "Yes" } },
      { name: "thirdFittingDescription", type: "string",
        visibleWhen: { field: "additionalFitting3", equals: "Yes" } },
      { name: "bungComment", type: "string", template: "[TEST] Bung fitting comment for part {i}" },
    ],
  },

  // 8. Collector — always visible
  {
    id: "collector",
    title: "Collector",
    fields: [
      { name: "collectorCondition", type: "string", required: true, options: "COLLECTOR_CONDITIONS" },
      { name: "collectorComment", type: "string" },
    ],
  },

  // 9. Gasket & Clamps — always visible
  {
    id: "gasketClamp",
    title: "Gasket & Clamps",
    fields: [
      { name: "gasketOrClamps", type: "string", required: true, options: "YES_NO" },
      { name: "showRecommendedGaskets", type: "string", options: "YES_NO" },
      // EC
      { name: "ecReplacement", type: "boolean",
        visibleWhen: { field: "gasketOrClamps", equals: "Yes" } },
      { name: "ecQuantity", type: "string",
        visibleWhen: { field: "ecReplacement", equals: true },
        options: "EC_EG_EK_QUANTITIES" },
      { name: "ecPartNumber1", type: "string",
        visibleWhen: { field: "ecReplacement", equals: true } },
      { name: "ecPartDescription1", type: "string",
        visibleWhen: { field: "ecReplacement", equals: true } },
      { name: "ecPartNumber2", type: "string",
        visibleWhen: { field: "ecReplacement", equals: true } },
      { name: "ecPartDescription2", type: "string",
        visibleWhen: { field: "ecReplacement", equals: true } },
      { name: "ecPartNumber3", type: "string",
        visibleWhen: { field: "ecReplacement", equals: true } },
      { name: "ecPartDescription3", type: "string",
        visibleWhen: { field: "ecReplacement", equals: true } },
      // EG
      { name: "egReplacement", type: "boolean",
        visibleWhen: { field: "gasketOrClamps", equals: "Yes" } },
      { name: "egQuantity", type: "string",
        visibleWhen: { field: "egReplacement", equals: true },
        options: "EC_EG_EK_QUANTITIES" },
      { name: "egPartNumber1", type: "string",
        visibleWhen: { field: "egReplacement", equals: true } },
      { name: "egPartDescription1", type: "string",
        visibleWhen: { field: "egReplacement", equals: true } },
      { name: "egPartNumber2", type: "string",
        visibleWhen: { field: "egReplacement", equals: true } },
      { name: "egPartDescription2", type: "string",
        visibleWhen: { field: "egReplacement", equals: true } },
      { name: "egPartNumber3", type: "string",
        visibleWhen: { field: "egReplacement", equals: true } },
      { name: "egPartDescription3", type: "string",
        visibleWhen: { field: "egReplacement", equals: true } },
      // EK
      { name: "ekReplacement", type: "boolean",
        visibleWhen: { field: "gasketOrClamps", equals: "Yes" } },
      { name: "ekQuantity", type: "string",
        visibleWhen: { field: "ekReplacement", equals: true },
        options: "EC_EG_EK_QUANTITIES" },
      { name: "ekPartNumber1", type: "string",
        visibleWhen: { field: "ekReplacement", equals: true } },
      { name: "ekPartDescription1", type: "string",
        visibleWhen: { field: "ekReplacement", equals: true } },
      { name: "ekPartNumber2", type: "string",
        visibleWhen: { field: "ekReplacement", equals: true } },
      { name: "ekPartDescription2", type: "string",
        visibleWhen: { field: "ekReplacement", equals: true } },
      { name: "ekPartNumber3", type: "string",
        visibleWhen: { field: "ekReplacement", equals: true } },
      { name: "ekPartDescription3", type: "string",
        visibleWhen: { field: "ekReplacement", equals: true } },
    ],
  },

  // 10. Measurements — hidden for REPAIR ONLY
  {
    id: "measurements",
    title: "Measurements",
    visibleWhen: { processNot: "REPAIR ONLY" },
    fields: [
      { name: "weightPreKg", type: "string", required: true, range: [5, 25] },
      { name: "flowRatePre", type: "string", required: true, range: [100, 500] },
      { name: "weightPostKg", type: "string", required: true, range: [3, 20] },
      { name: "flowRatePost", type: "string", required: true, range: [150, 550] },
      { name: "weightSinteredKg", type: "string", required: true, range: [2, 15] },
      { name: "flowRateSintered", type: "string", required: true, range: [200, 600] },
      { name: "lightTest", type: "string", required: true, options: "LIGHT_TEST_OPTIONS" },
      { name: "dropRodTest", type: "string", required: true, options: "DROP_ROD_TEST_OPTIONS" },
      { name: "sinteredAshProcess", type: "string", required: true, options: "YES_NO" },
    ],
  },

  // 11. Repair Assessment — always visible
  {
    id: "repairAssessment",
    title: "Repair Assessment",
    fields: [
      { name: "requireRepairs", type: "string", required: true, options: "YES_NO" },
      { name: "repairsPerformed", type: "string",
        visibleWhen: { field: "requireRepairs", equals: "Yes" },
        options: "REPAIRS_PERFORMED_OPTIONS" },
      { name: "repairDescription", type: "string",
        visibleWhen: { field: "requireRepairs", equals: "Yes" },
        template: "[TEST] Repair notes for part {i}" },
    ],
  },

  // 12. Pass / Fail — always visible
  {
    id: "passFail",
    title: "Pass / Fail",
    fields: [
      { name: "passOrFail", type: "string", required: true, options: "PASS_FAIL" },
      { name: "failedReason", type: "string",
        required: { when: { field: "passOrFail", equals: "Fail" } },
        visibleWhen: { field: "passOrFail", equals: "Fail" },
        options: "FAILED_REASONS" },
      { name: "failureNotes", type: "string",
        visibleWhen: { field: "passOrFail", equals: "Fail" },
        template: "[TEST] Failure notes for part {i}" },
      { name: "submissionStatus", type: "string", required: true, options: "SUBMISSION_STATUSES" },
      { name: "hasAdditionalComments", type: "string", options: "YES_NO" },
      { name: "additionalPartComments", type: "string",
        visibleWhen: { field: "hasAdditionalComments", equals: "Yes" },
        template: "[TEST] Additional comments for part {i}" },
    ],
  },
];

// ─── Pickup / Delivery required fields (documentation) ──

export const PICKUP_REQUIRED_FIELDS = ["itemCount"] as const;
export const DELIVERY_REQUIRED_FIELDS = ["deliveredTo"] as const;

// ─── Utility Functions ─────────────────────────

/** Evaluate whether a section should be visible for a given part type + process. */
export function isSectionVisible(
  section: SectionDef,
  partType: string,
  process: string,
): boolean {
  if (!section.visibleWhen) return true;
  const v = section.visibleWhen;
  if (v.partType && !v.partType.includes(partType)) return false;
  if (v.processNot && process === v.processNot) return false;
  return true;
}

/**
 * Build the Zod schema for a single part from the config.
 *
 * All fields are optional except passOrFail (always-visible, always required).
 * Conditional requirements (e.g. failedReason when passOrFail="Fail") are
 * handled in superRefine so hidden sections don't cause spurious errors.
 */
export function buildPartSchema() {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const section of EMISSIONS_FIELD_CONFIG) {
    for (const field of section.fields) {
      if (field.type === "boolean") {
        shape[field.name] = z.boolean().optional();
      } else {
        shape[field.name] = z.string().optional();
      }
    }
  }

  // passOrFail is the one unconditionally required field
  shape.passOrFail = z.string().min(1, "Pass or Fail is required");

  return z.object(shape).superRefine((data: Record<string, unknown>, ctx) => {
    if (data.passOrFail === "Fail" && !data.failedReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Failed reason is required when part fails",
        path: ["failedReason"],
      });
    }
  });
}

/**
 * Build default values for a single part, with all fields initialised to
 * empty string / false. Merges the prefilled ecsSerial if provided.
 */
export function getPartDefaults(prefill?: { ecsSerial?: string }): Record<string, string | boolean> {
  const defaults: Record<string, string | boolean> = {};

  for (const section of EMISSIONS_FIELD_CONFIG) {
    for (const field of section.fields) {
      defaults[field.name] = field.type === "boolean" ? false : "";
    }
  }

  if (prefill?.ecsSerial) {
    defaults.ecsSerial = prefill.ecsSerial;
  }

  return defaults;
}
