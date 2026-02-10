/**
 * Test data generators for dev-mode "Fill Test Data" buttons.
 * Each generator returns a flat object compatible with React Hook Form's setValue()/reset().
 * Uses actual reference data arrays so dropdown values are valid.
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
} from "./emissions-reference-data";

import {
  showCleaningPhase,
  showOneBoxDiagnostics,
  showCrystallization,
  showInletOutlet,
  showSealingCanister,
  showMeasurements,
} from "./emissions-form-config";

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
  const fitting = pick(FITTING_PART_NUMBERS);

  const part: Record<string, string | boolean> = {
    // Identification — leave ecsSerial alone (prefilled from job data)
    ecsSerial: `[TEST] ECS-${1000 + index}`,
    ecsPartNumber: `PN-${randInt(10000, 99999)}`,
    partDescription: `[TEST] ${partType} unit - ${process}`,
    oeSerialNumber: `OE-${randInt(100000, 999999)}`,

    // Always-visible sections
    // Bung & Fitting
    bungCondition: pick(BUNG_CONDITIONS),
    showRecommendedBungs: "",
    bungProblem: pick(BUNG_PROBLEMS),
    firstFittingQty: pick(FITTING_QUANTITIES),
    firstFittingPn: fitting.pn,
    firstFittingDesc: fitting.description,
    additionalFittingNeeded: "No",
    secondFittingQty: "",
    secondFittingPn: "",
    secondFittingDesc: "",
    thirdFittingNeeded: "",
    thirdFittingQty: "",
    thirdFittingPn: "",
    thirdFittingDesc: "",
    bungFittingComment: `[TEST] Bung fitting comment for part ${index + 1}`,

    // Collector
    collectorCondition: pick(COLLECTOR_CONDITIONS),
    collectorComment: "",

    // Gasket & Clamps
    gasketOrClamps: pick(YES_NO),
    showRecommendedGaskets: "",
    ecChecked: false,
    egChecked: false,
    ekChecked: false,
    ecQuantity: "",
    egQuantity: "",
    ekQuantity: "",
    ecPn1: "", ecDesc1: "", ecPn2: "", ecDesc2: "", ecPn3: "", ecDesc3: "",
    egPn1: "", egDesc1: "", egPn2: "", egDesc2: "", egPn3: "", egDesc3: "",
    ekPn1: "", ekDesc1: "", ekPn2: "", ekDesc2: "", ekPn3: "", ekDesc3: "",

    // Repair Assessment
    requireRepairs: pick(YES_NO),
    repairsPerformed: pick(REPAIRS_PERFORMED_OPTIONS),
    repairDescription: `[TEST] Repair notes for part ${index + 1}`,

    // Pass/Fail
    passOrFail: pick(PASS_FAIL),
    failedReason: "",
    failureNotes: "",
    submissionStatus: pick(SUBMISSION_STATUSES),
    additionalPartComments: `[TEST] Additional comments for part ${index + 1}`,
    showAdditionalComments: "",

    // One Box fields — default empty
    noxConversion: "",
    docInletTemp: "",
    docOutletTemp: "",
    dpfOutletTemp: "",
    physicalDamage: "",
    sensorsRemoved: "",
    sensorsRemovedList: "",
    repairDescriptionOneBox: "",
    crystallization: "",
    crystallizationDescription: "",

    // Smoke tests — default empty
    preScrSmokeTest: "",
    preDocSmokeTest: "",
    postScrSmokeTest: "",
    postDocSmokeTest: "",
    needsSensors: "",
    selectedSensors: "",

    // Inlet/Outlet — default empty
    inletColor: "",
    inletOtherColor: "",
    inletDamage: "",
    inletComment: "",
    outletColor: "",
    outletOtherColor: "",
    outletDamage: "",
    outletLeakingCells: "",
    outletComment: "",

    // Sealing & Canister — default empty
    sealingRing: "",
    canisterInspection: "",

    // Cleaning — default empty
    cleaningPhase: "",

    // Measurements — default empty
    weightPreKg: "",
    flowRatePre: "",
    weightPostKg: "",
    flowRatePost: "",
    weightSinteredKg: "",
    flowRateSintered: "",
    lightTest: "",
    dropRodTest: "",
    sinteredAshProcess: "",
  };

  // ── Conditionally fill sections based on part type + process ──

  if (showCleaningPhase(process)) {
    part.cleaningPhase = pick(CLEANING_PHASES);
  }

  if (showOneBoxDiagnostics(partType)) {
    part.noxConversion = `${randInt(50, 99)}`;
    part.docInletTemp = `${randInt(200, 600)}`;
    part.docOutletTemp = `${randInt(200, 600)}`;
    part.dpfOutletTemp = `${randInt(200, 600)}`;
    part.physicalDamage = pick(YES_NO);
    part.sensorsRemoved = pick(SENSORS_REMOVED_OPTIONS);
    part.sensorsRemovedList = "";
    part.repairDescriptionOneBox = `[TEST] One box repair for part ${index + 1}`;

    // Smoke tests are part of one-box inspection
    part.preScrSmokeTest = pick(SMOKE_TEST_OPTIONS);
    part.preDocSmokeTest = pick(SMOKE_TEST_OPTIONS);
    part.postScrSmokeTest = pick(SMOKE_TEST_OPTIONS);
    part.postDocSmokeTest = pick(SMOKE_TEST_OPTIONS);
    part.needsSensors = pick(YES_NO);
    part.selectedSensors = "";
  }

  if (showCrystallization(partType)) {
    part.crystallization = pick(YES_NO);
    part.crystallizationDescription = part.crystallization === "Yes"
      ? `[TEST] Crystallization found on part ${index + 1}`
      : "";
  }

  if (showInletOutlet(partType, process)) {
    part.inletColor = pick(INLET_COLORS);
    part.inletDamage = pick(DAMAGE_TYPES);
    part.inletComment = `[TEST] Inlet comment for part ${index + 1}`;
    part.outletColor = pick(OUTLET_COLORS);
    part.outletDamage = pick(DAMAGE_TYPES);
    part.outletLeakingCells = pick(LEAKING_CELLS_OPTIONS);
    part.outletComment = `[TEST] Outlet comment for part ${index + 1}`;
  }

  if (showSealingCanister(partType, process)) {
    part.sealingRing = pick(SEALING_RING_CONDITIONS);
    part.canisterInspection = pick(CANISTER_CONDITIONS);
  }

  if (showMeasurements(partType, process)) {
    part.weightPreKg = `${randInt(5, 25)}`;
    part.flowRatePre = `${randInt(100, 500)}`;
    part.weightPostKg = `${randInt(3, 20)}`;
    part.flowRatePost = `${randInt(150, 550)}`;
    part.weightSinteredKg = `${randInt(2, 15)}`;
    part.flowRateSintered = `${randInt(200, 600)}`;
    part.lightTest = pick(LIGHT_TEST_OPTIONS);
    part.dropRodTest = pick(DROP_ROD_TEST_OPTIONS);
    part.sinteredAshProcess = pick(YES_NO);
  }

  // If passOrFail is "Fail", add a reason
  if (part.passOrFail === "Fail") {
    // Pick from failed reasons — imported at top but used as string literal
    part.failedReason = pick([
      "Bad Cells", "Light Test", "Melted Core", "Oil Soaked",
      "Core Shifted", "Damaged Housing", "Deteriorated Ceramic",
    ]);
    part.failureNotes = `[TEST] Failure notes for part ${index + 1}`;
  }

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
