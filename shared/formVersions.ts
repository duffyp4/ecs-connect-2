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
 * UPDATE WORKFLOW:
 * When updating a GoCanvas form, tell the agent:
 * "Remap the [EMISSIONS/PICKUP/DELIVERY] form to new ID [new_id]"
 * 
 * The agent will:
 * 1. Move the current ID to the history array
 * 2. Set the new ID as current
 * 3. Call GoCanvas API to get new field mappings
 * 4. Update the corresponding gocanvas_field_map_*.json file
 */

export const FORM_VERSIONS = {
  EMISSIONS: {
    current: '5695685',
    history: [] as string[],
  },
  PICKUP: {
    current: '5640587',
    history: [] as string[],
  },
  DELIVERY: {
    current: '5657146',
    history: [] as string[],
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
