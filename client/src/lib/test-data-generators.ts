/**
 * Test data generators for dev-mode "Fill Test Data" buttons.
 * Each generator returns a flat object compatible with React Hook Form's setValue()/reset().
 *
 * The emissions generator is config-driven: it iterates EMISSIONS_FIELD_CONFIG
 * so field names, section visibility, and conditional logic stay in sync with the
 * form schema and components automatically.
 */

import {
  PART_TYPES,
  PROCESS_TYPES,
  TECHNICIANS,
  CLEANING_PHASES,
  INLET_COLORS,
  OUTLET_COLORS,
  DAMAGE_TYPES,
  SMOKE_TEST_OPTIONS,
  SEALING_RING_CONDITIONS,
  CANISTER_CONDITIONS,
  BUNG_CONDITIONS,
  BUNG_PROBLEMS,
  FITTING_PART_NUMBERS,
  FITTING_QUANTITIES,
  COLLECTOR_CONDITIONS,
  EC_EG_EK_QUANTITIES,
  LEAKING_CELLS_OPTIONS,
  LIGHT_TEST_OPTIONS,
  DROP_ROD_TEST_OPTIONS,
  SUBMISSION_STATUSES,
  PASS_FAIL,
  YES_NO,
  REPAIRS_PERFORMED_OPTIONS,
  SENSORS_REMOVED_OPTIONS,
  FAILED_REASONS,
} from "./emissions-reference-data";

import {
  EMISSIONS_FIELD_CONFIG,
  isSectionVisible,
  type FieldDef,
} from "./emissions-form-fields";

// ─── Helpers ────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function timestamp(): string {
  return new Date().toLocaleTimeString();
}

/** Maps config option keys to the actual reference-data arrays. */
const REFERENCE_DATA_MAP: Record<string, readonly string[]> = {
  YES_NO,
  PASS_FAIL,
  CLEANING_PHASES,
  SMOKE_TEST_OPTIONS,
  INLET_COLORS,
  OUTLET_COLORS,
  DAMAGE_TYPES,
  SEALING_RING_CONDITIONS,
  CANISTER_CONDITIONS,
  BUNG_CONDITIONS,
  BUNG_PROBLEMS,
  FITTING_QUANTITIES,
  EC_EG_EK_QUANTITIES,
  COLLECTOR_CONDITIONS,
  LEAKING_CELLS_OPTIONS,
  LIGHT_TEST_OPTIONS,
  DROP_ROD_TEST_OPTIONS,
  SUBMISSION_STATUSES,
  FAILED_REASONS,
  REPAIRS_PERFORMED_OPTIONS,
  SENSORS_REMOVED_OPTIONS,
};

/** Generate a test value for a single field based on its config hints. */
function generateFieldValue(field: FieldDef, index: number): string | boolean {
  if (field.type === "boolean") return false;

  if (field.options) {
    const arr = REFERENCE_DATA_MAP[field.options];
    if (arr) return pick(arr);
  }

  if (field.range) {
    return `${randInt(field.range[0], field.range[1])}`;
  }

  if (field.template) {
    return field.template.replace(/\{i\}/g, `${index + 1}`);
  }

  return "";
}

/** Check whether a field-level condition is satisfied. */
function matchesCondition(
  value: unknown,
  equals: string | boolean | string[],
): boolean {
  if (Array.isArray(equals)) {
    return equals.includes(value as string);
  }
  return value === equals;
}

// ─── Pickup ─────────────────────────────────────

export function generatePickupTestData() {
  return {
    itemCount: randInt(1, 5),
    driverNotes: `[TEST] Pickup notes - generated at ${timestamp()}`,
  };
}

// ─── Delivery ───────────────────────────────────

export function generateDeliveryTestData() {
  return {
    deliveredTo: "[TEST] John Smith - Receiving Dock",
    deliveryNotes: `[TEST] Delivery notes - generated at ${timestamp()}`,
  };
}

// ─── Emissions ──────────────────────────────────

function generatePartTestData(index: number) {
  const partType = pick(PART_TYPES);
  const process = pick(PROCESS_TYPES);
  const part: Record<string, string | boolean> = {};

  // 1. Initialise every field with its default (ensures hidden-section fields exist)
  for (const section of EMISSIONS_FIELD_CONFIG) {
    for (const field of section.fields) {
      part[field.name] = field.type === "boolean" ? false : "";
    }
  }

  // 2. Generate values for all fields in visible sections
  for (const section of EMISSIONS_FIELD_CONFIG) {
    if (!isSectionVisible(section, partType, process)) continue;
    for (const field of section.fields) {
      part[field.name] = generateFieldValue(field, index);
    }
  }

  // 3. Clear conditionally-hidden fields (second pass, in config order so
  //    cascaded dependencies resolve correctly)
  for (const section of EMISSIONS_FIELD_CONFIG) {
    if (!isSectionVisible(section, partType, process)) continue;
    for (const field of section.fields) {
      if (
        field.visibleWhen &&
        !matchesCondition(part[field.visibleWhen.field], field.visibleWhen.equals)
      ) {
        part[field.name] = field.type === "boolean" ? false : "";
      }
    }
  }

  // 4. Custom overrides for fields that need non-generic logic

  // Part identification — random serial/part numbers
  part.ecsSerial = `[TEST] ECS-${1000 + index}`;
  part.ecsPartNumber = `PN-${randInt(10000, 99999)}`;
  part.partDescription = `[TEST] ${partType} unit - ${process}`;
  part.oeSerialNumber = `OE-${randInt(100000, 999999)}`;

  // Bung fitting — pick a fitting object for linked PN + description
  const fitting = pick(FITTING_PART_NUMBERS);
  if (part.firstFittingQuantity) {
    part.firstFittingPartNumber = fitting.pn;
    part.firstFittingDescription = fitting.description;
  }

  // Sensors — leave as empty string (component manages as array internally)
  part.sensorsRemoved = "";
  part.oneBoxSensorsNeeded = "";

  return part;
}

export function generateEmissionsTestData(partsCount: number) {
  const tech = pick(TECHNICIANS);
  const now = new Date();

  return {
    parts: Array.from({ length: Math.max(1, partsCount) }, (_, i) =>
      generatePartTestData(i)
    ),
    additionalComments: `[TEST] Additional comments - generated at ${timestamp()}`,
    technicianName: tech.name,
    signOffDate: now.toISOString().split("T")[0],
    signOffTime: now.toTimeString().slice(0, 5),
  };
}
