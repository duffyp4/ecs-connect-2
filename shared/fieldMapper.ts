// GoCanvas Field Mapping Utility
// Dynamically reads field mappings from JSON file to eliminate hardcoded values

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
  version: number;
  updated_at: string;
  total_fields: number;
  entries: FieldEntry[];
}

export class FieldMapper {
  private static instance: FieldMapper;
  private fieldMaps: Map<string, FieldMap> = new Map();

  private constructor() {
    // Initialize with known form IDs
    this.initializeFieldMaps();
  }

  static getInstance(): FieldMapper {
    if (!FieldMapper.instance) {
      FieldMapper.instance = new FieldMapper();
    }
    return FieldMapper.instance;
  }

  private initializeFieldMaps(): void {
    // Try to load all known field maps
    const formIds = [
      '5594156', // Emissions Service Log
      '5628229', // Pickup Log
      '5604777', // Delivery Log
    ];

    formIds.forEach(formId => {
      try {
        this.loadFieldMapForForm(formId);
      } catch (error) {
        // Silent fail - maps will be loaded on demand
      }
    });
  }

  private getMapPath(formId: string): string {
    return join(process.cwd(), `gocanvas_field_map_${formId}.json`);
  }

  private loadFieldMapForForm(formId: string): FieldMap {
    // Check cache first
    if (this.fieldMaps.has(formId)) {
      return this.fieldMaps.get(formId)!;
    }

    try {
      const mapPath = this.getMapPath(formId);
      const mapData = readFileSync(mapPath, 'utf8');
      const fieldMap: FieldMap = JSON.parse(mapData);
      
      if (!fieldMap || !fieldMap.form_id) {
        throw new Error('Invalid field map structure');
      }
      
      // Cache the map
      this.fieldMaps.set(formId, fieldMap);
      return fieldMap;
    } catch (error) {
      throw new Error(`Field mapping file not found for form ${formId}. Run field mapping update script for this form.`);
    }
  }

  private loadFieldMap(): FieldMap {
    // For backward compatibility - load default emissions form
    const defaultFormId = process.env.GOCANVAS_FORM_ID || '5594156';
    return this.loadFieldMapForForm(defaultFormId);
  }

  /**
   * Get the current GoCanvas form ID from the field mapping (backward compatible)
   */
  getFormId(): string {
    const map = this.loadFieldMap();
    return map.form_id;
  }

  /**
   * Get field ID by exact label match (backward compatible - uses default form)
   */
  getFieldId(label: string): number | null {
    const map = this.loadFieldMap();
    const field = map.entries.find(entry => entry.label === label);
    return field ? field.id : null;
  }

  /**
   * Get field ID by exact label match for specific form
   */
  getFieldIdForForm(formId: string, label: string): number | null {
    const map = this.loadFieldMapForForm(formId);
    const field = map.entries.find(entry => entry.label === label);
    return field ? field.id : null;
  }

  /**
   * Get field ID by partial label match (case-insensitive) for specific form
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
   * Get multiple field IDs by labels for specific form
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
   * Get all required fields for specific form
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
   * Get all field entries for specific form
   */
  getAllFieldsForForm(formId: string): FieldEntry[] {
    const map = this.loadFieldMapForForm(formId);
    return map.entries;
  }

  /**
   * Get all loaded form IDs
   */
  getLoadedFormIds(): string[] {
    return Array.from(this.fieldMaps.keys());
  }

  /**
   * Validate that field mapping is up to date with environment
   */
  validateMapping(): { valid: boolean; message: string } {
    try {
      const map = this.loadFieldMap();
      const envFormId = process.env.GOCANVAS_FORM_ID;
      
      if (!envFormId) {
        return {
          valid: false,
          message: 'GOCANVAS_FORM_ID environment variable not set'
        };
      }
      
      if (map.form_id !== envFormId) {
        return {
          valid: false,
          message: `Field mapping (${map.form_id}) doesn't match environment (${envFormId}). Run: npm run update-field-mapping`
        };
      }
      
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
   * Clear cached mapping for specific form
   */
  clearCacheForForm(formId: string): void {
    this.fieldMaps.delete(formId);
  }

  /**
   * Clear all cached mappings (useful for testing or after updates)
   */
  clearCache(): void {
    this.fieldMaps.clear();
  }
}

// Export singleton instance
export const fieldMapper = FieldMapper.getInstance();