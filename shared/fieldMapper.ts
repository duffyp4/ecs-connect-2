// GoCanvas Field Mapping Utility
// Dynamically reads field mappings from JSON file to eliminate hardcoded values
// Uses form TYPE (emissions, pickup, delivery) instead of form ID for stable file names

import { readFileSync } from 'fs';
import { join } from 'path';

interface FieldEntry {
  id: number;
  label: string;
  required: boolean;
  type: string;
}

interface FieldMap {
  form_id: string;
  form_type?: string;
  version: number;
  updated_at: string;
  total_fields: number;
  entries: FieldEntry[];
}

// Valid form types
export type FormType = 'emissions' | 'pickup' | 'delivery';

export class FieldMapper {
  private static instance: FieldMapper;
  private fieldMapsByType: Map<FormType, FieldMap> = new Map();
  private fieldMapsById: Map<string, FieldMap> = new Map();

  private constructor() {
    this.initializeFieldMaps();
  }

  static getInstance(): FieldMapper {
    if (!FieldMapper.instance) {
      FieldMapper.instance = new FieldMapper();
    }
    return FieldMapper.instance;
  }

  private initializeFieldMaps(): void {
    // Load all form type mappings
    const formTypes: FormType[] = ['emissions', 'pickup', 'delivery'];

    formTypes.forEach(formType => {
      try {
        this.loadFieldMapByType(formType);
      } catch (error) {
        // Silent fail - maps will be loaded on demand
      }
    });
  }

  private getMapPathByType(formType: FormType): string {
    return join(process.cwd(), `gocanvas_field_map_${formType}.json`);
  }

  private loadFieldMapByType(formType: FormType): FieldMap {
    // Check cache first
    if (this.fieldMapsByType.has(formType)) {
      return this.fieldMapsByType.get(formType)!;
    }

    try {
      const mapPath = this.getMapPathByType(formType);
      const mapData = readFileSync(mapPath, 'utf8');
      const fieldMap: FieldMap = JSON.parse(mapData);
      
      if (!fieldMap || !fieldMap.form_id) {
        throw new Error('Invalid field map structure');
      }
      
      // Cache by type and by ID
      this.fieldMapsByType.set(formType, fieldMap);
      this.fieldMapsById.set(fieldMap.form_id, fieldMap);
      
      return fieldMap;
    } catch (error) {
      throw new Error(
        `Field mapping file not found for form type "${formType}". ` +
        `Run: node scripts/buildFieldMap.js ${formType} <form_id>`
      );
    }
  }

  /**
   * Load field map by form ID (for backward compatibility)
   * First checks if already cached, then searches loaded type maps
   */
  private loadFieldMapForForm(formId: string): FieldMap {
    // Check ID cache first
    if (this.fieldMapsById.has(formId)) {
      return this.fieldMapsById.get(formId)!;
    }

    // Try to find in type-loaded maps
    for (const [type, map] of this.fieldMapsByType.entries()) {
      if (map.form_id === formId) {
        this.fieldMapsById.set(formId, map);
        return map;
      }
    }

    // Load all types and try again
    const formTypes: FormType[] = ['emissions', 'pickup', 'delivery'];
    for (const formType of formTypes) {
      try {
        const map = this.loadFieldMapByType(formType);
        if (map.form_id === formId) {
          return map;
        }
      } catch {
        // Continue to next type
      }
    }

    throw new Error(
      `Field mapping not found for form ID ${formId}. ` +
      `Ensure the form type JSON file contains this form ID.`
    );
  }

  /**
   * Get the emissions form field map (default)
   */
  private loadFieldMap(): FieldMap {
    return this.loadFieldMapByType('emissions');
  }

  /**
   * Get the current GoCanvas form ID for emissions form (backward compatible)
   */
  getFormId(): string {
    const map = this.loadFieldMap();
    return map.form_id;
  }

  /**
   * Get form ID by type
   */
  getFormIdByType(formType: FormType): string {
    const map = this.loadFieldMapByType(formType);
    return map.form_id;
  }

  /**
   * Get field ID by exact label match (backward compatible - uses emissions form)
   */
  getFieldId(label: string): number | null {
    const map = this.loadFieldMap();
    const field = map.entries.find(entry => entry.label === label);
    return field ? field.id : null;
  }

  /**
   * Get field ID by exact label match for specific form type
   */
  getFieldIdByType(formType: FormType, label: string): number | null {
    const map = this.loadFieldMapByType(formType);
    const field = map.entries.find(entry => entry.label === label);
    return field ? field.id : null;
  }

  /**
   * Get field ID by exact label match for specific form ID (backward compatible)
   */
  getFieldIdForForm(formId: string, label: string): number | null {
    const map = this.loadFieldMapForForm(formId);
    const field = map.entries.find(entry => entry.label === label);
    return field ? field.id : null;
  }

  /**
   * Get field ID by partial label match (case-insensitive) for specific form type
   */
  getFieldIdByPartialLabelForType(formType: FormType, partialLabel: string): number | null {
    const map = this.loadFieldMapByType(formType);
    const normalizedSearch = partialLabel.toLowerCase();
    const field = map.entries.find(entry => 
      entry.label.toLowerCase().includes(normalizedSearch)
    );
    return field ? field.id : null;
  }

  /**
   * Get field ID by partial label match (case-insensitive) for specific form ID
   */
  getFieldIdByPartialLabelForForm(formId: string, partialLabel: string): number | null {
    const map = this.loadFieldMapForForm(formId);
    const normalizedSearch = partialLabel.toLowerCase();
    const field = map.entries.find(entry => 
      entry.label.toLowerCase().includes(normalizedSearch)
    );
    return field ? field.id : null;
  }

  /**
   * Get field ID by partial label match (case-insensitive) - backward compatible
   */
  getFieldIdByPartialLabel(partialLabel: string): number | null {
    const map = this.loadFieldMap();
    const normalizedSearch = partialLabel.toLowerCase();
    const field = map.entries.find(entry => 
      entry.label.toLowerCase().includes(normalizedSearch)
    );
    return field ? field.id : null;
  }

  /**
   * Get multiple field IDs by labels (returns map of label -> field ID) - backward compatible
   */
  getFieldIds(labels: string[]): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    labels.forEach(label => {
      result[label] = this.getFieldId(label);
    });
    return result;
  }

  /**
   * Get multiple field IDs by labels for specific form type
   */
  getFieldIdsByType(formType: FormType, labels: string[]): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    labels.forEach(label => {
      result[label] = this.getFieldIdByType(formType, label);
    });
    return result;
  }

  /**
   * Get multiple field IDs by labels for specific form ID (backward compatible)
   */
  getFieldIdsForForm(formId: string, labels: string[]): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    labels.forEach(label => {
      result[label] = this.getFieldIdForForm(formId, label);
    });
    return result;
  }

  /**
   * Get all required field IDs and labels - backward compatible
   */
  getRequiredFields(): FieldEntry[] {
    const map = this.loadFieldMap();
    return map.entries.filter(entry => entry.required);
  }

  /**
   * Get all required fields for specific form type
   */
  getRequiredFieldsByType(formType: FormType): FieldEntry[] {
    const map = this.loadFieldMapByType(formType);
    return map.entries.filter(entry => entry.required);
  }

  /**
   * Get all required fields for specific form ID
   */
  getRequiredFieldsForForm(formId: string): FieldEntry[] {
    const map = this.loadFieldMapForForm(formId);
    return map.entries.filter(entry => entry.required);
  }

  /**
   * Get all field entries for debugging/inspection - backward compatible
   */
  getAllFields(): FieldEntry[] {
    const map = this.loadFieldMap();
    return map.entries;
  }

  /**
   * Get all field entries for specific form type
   */
  getAllFieldsByType(formType: FormType): FieldEntry[] {
    const map = this.loadFieldMapByType(formType);
    return map.entries;
  }

  /**
   * Get all field entries for specific form ID
   */
  getAllFieldsForForm(formId: string): FieldEntry[] {
    const map = this.loadFieldMapForForm(formId);
    return map.entries;
  }

  /**
   * Get all loaded form IDs
   */
  getLoadedFormIds(): string[] {
    return Array.from(this.fieldMapsById.keys());
  }

  /**
   * Get all loaded form types
   */
  getLoadedFormTypes(): FormType[] {
    return Array.from(this.fieldMapsByType.keys());
  }

  /**
   * Validate that emissions field mapping is loaded and current
   */
  validateMapping(): { valid: boolean; message: string } {
    try {
      const map = this.loadFieldMap();
      
      // Check if mapping is older than 30 days
      const mapDate = new Date(map.updated_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      if (mapDate < thirtyDaysAgo) {
        return {
          valid: true,
          message: `Field mapping is ${Math.ceil((Date.now() - mapDate.getTime()) / (24 * 60 * 60 * 1000))} days old. Consider updating.`
        };
      }
      
      return {
        valid: true,
        message: `Field mapping is current (Form: ${map.form_id}, ${map.total_fields} fields)`
      };
      
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear cached mapping for specific form type
   */
  clearCacheForType(formType: FormType): void {
    const map = this.fieldMapsByType.get(formType);
    if (map) {
      this.fieldMapsById.delete(map.form_id);
    }
    this.fieldMapsByType.delete(formType);
  }

  /**
   * Clear cached mapping for specific form ID
   */
  clearCacheForForm(formId: string): void {
    this.fieldMapsById.delete(formId);
    // Also clear from type cache if it matches
    for (const [type, map] of this.fieldMapsByType.entries()) {
      if (map.form_id === formId) {
        this.fieldMapsByType.delete(type);
        break;
      }
    }
  }

  /**
   * Clear all cached mappings (useful for testing or after updates)
   */
  clearCache(): void {
    this.fieldMapsByType.clear();
    this.fieldMapsById.clear();
  }

  /**
   * Get all parts-related field IDs for the emissions form
   * This eliminates the need to hard-code field IDs in parts extraction logic
   * @param formType - The form type (defaults to 'emissions')
   * @returns Object containing all parts field IDs mapped by their logical names
   * @throws Error if any required field is not found in the field map
   */
  getPartsFieldIds(formType: FormType = 'emissions'): {
    part: number;
    process: number;
    filterPn: number;
    ecsSerial: number;
    poNumber: number;
    mileage: number;
    unitVin: number;
    gasketClamps: number;
    ec: number;
    eg: number;
    ek: number;
    ecsPartNumber: number;
    passOrFail: number;
    requireRepairs: number;
    failedReason: number;
    repairsPerformed: number;
  } {
    // Define the exact field labels to look up
    const fieldLabels = {
      part: 'Part',
      process: 'Process Being Performed',
      filterPn: 'Filter Part Number',
      ecsSerial: 'ECS Serial Number',
      poNumber: 'PO Number',
      mileage: 'Mileage',
      unitVin: 'Unit / Vin Number',
      gasketClamps: 'Gasket or Clamps',
      ec: 'EC',
      eg: 'EG',
      ek: 'EK',
      ecsPartNumber: 'ECS Part Number',
      passOrFail: 'Did the Part Pass or Fail?',
      requireRepairs: 'Did the Part Require Repairs?',
      failedReason: 'Failed Reason',
      repairsPerformed: 'Which Repairs Were Performed',
    };

    const result: any = {};
    const missingFields: string[] = [];

    // Look up each field ID by its label
    for (const [key, label] of Object.entries(fieldLabels)) {
      const fieldId = this.getFieldIdByType(formType, label);
      if (fieldId === null) {
        missingFields.push(label);
      } else {
        result[key] = fieldId;
      }
    }

    if (missingFields.length > 0) {
      throw new Error(
        `Parts field mapping incomplete for form type "${formType}". Missing fields: ${missingFields.join(', ')}. ` +
        `Run: node scripts/buildFieldMap.js ${formType} <form_id>`
      );
    }

    return result;
  }
}

// Export singleton instance
export const fieldMapper = FieldMapper.getInstance();
