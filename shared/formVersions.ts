/**
 * GoCanvas Form Version Management
 * 
 * ARCHITECTURE DECISION (December 2024):
 * Form IDs live in this file, NOT in environment variables.
 * 
 * Reasons:
 * 1. Form IDs aren't secrets - no security reason to hide them
 * 2. They're the same in dev and production
 * 3. They're tightly coupled to field mappings (gocanvas_field_map_*.json)
 * 4. We need version history for webhooks to catch submissions from older form versions
 * 5. Git tracks changes to this file (env var changes are invisible)
 * 
 * HISTORY MANAGEMENT:
 * - Each form keeps a rolling window of the last 20 historical form IDs
 * - When adding a new form ID, the current ID moves to the front of history
 * - If history exceeds 20 entries, the oldest (last) entry is removed
 * - This ensures we catch submissions from recent form versions without unbounded growth
 * 
 * UPDATE WORKFLOW:
 * When updating a GoCanvas form, tell the agent:
 * "Remap the [EMISSIONS/PICKUP/DELIVERY] form to new ID [new_id]"
 * 
 * The agent will:
 * 1. Move the current ID to the FRONT of the history array
 * 2. If history has more than 20 entries, remove the oldest (last) entry
 * 3. Set the new ID as current
 * 4. Call GoCanvas API to get new field mappings
 * 5. Update the corresponding gocanvas_field_map_*.json file
 */

export const MAX_FORM_HISTORY = 20;

export const FORM_VERSIONS = {
  EMISSIONS: {
    current: '5716092',
    history: ['5695685'] as string[],
  },
  PICKUP: {
    current: '5657148',
    history: ['5640587'] as string[],
  },
  DELIVERY: {
    current: '5714828',
    history: ['5657146'] as string[],
  },
} as const;

export type FormType = keyof typeof FORM_VERSIONS;

/**
 * Get the current form ID for a given form type
 */
export function getCurrentFormId(formType: FormType): string {
  return FORM_VERSIONS[formType].current;
}

/**
 * Get all known form IDs (current + history) for a given form type
 * Used by webhooks to catch submissions from any version
 */
export function getAllFormIds(formType: FormType): string[] {
  return [FORM_VERSIONS[formType].current, ...FORM_VERSIONS[formType].history];
}

/**
 * Get all known form IDs across all form types
 * Used by webhooks for initial filtering
 */
export function getAllKnownFormIds(): string[] {
  return Object.values(FORM_VERSIONS).flatMap(v => [v.current, ...v.history]);
}

/**
 * Determine the form type from a form ID (current or historical)
 * Returns undefined if the form ID is not recognized
 */
export function getFormTypeFromId(formId: string): FormType | undefined {
  for (const [formType, versions] of Object.entries(FORM_VERSIONS)) {
    if (versions.current === formId || versions.history.includes(formId)) {
      return formType as FormType;
    }
  }
  return undefined;
}
