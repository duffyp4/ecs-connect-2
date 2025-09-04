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
  private fieldMap: FieldMap | null = null;
  private readonly mapPath: string;

  private constructor() {
    this.mapPath = join(process.cwd(), 'gocanvas_field_map.json');
  }

  static getInstance(): FieldMapper {
    if (!FieldMapper.instance) {
      FieldMapper.instance = new FieldMapper();
    }
    return FieldMapper.instance;
  }

  private loadFieldMap(): FieldMap {
    if (this.fieldMap) {
      return this.fieldMap;
    }

    try {
      const mapData = readFileSync(this.mapPath, 'utf8');
      this.fieldMap = JSON.parse(mapData);
      
      if (!this.fieldMap || !this.fieldMap.form_id) {
        throw new Error('Invalid field map structure');
      }
      
      return this.fieldMap;
    } catch (error) {
      const envFormId = process.env.GOCANVAS_FORM_ID;
      const errorMsg = `
❌ Field mapping file not found or invalid!

To fix this issue:
1. Set GOCANVAS_FORM_ID environment variable: ${envFormId || 'NOT_SET'}
2. Run: npm run update-field-mapping
3. Restart your application

Error details: ${error.message}
      `.trim();
      
      throw new Error(errorMsg);
    }
  }

  /**
   * Get the current GoCanvas form ID from the field mapping
   */
  getFormId(): string {
    const map = this.loadFieldMap();
    return map.form_id;
  }

  /**
   * Get field ID by exact label match
   */
  getFieldId(label: string): number | null {
    const map = this.loadFieldMap();
    const field = map.entries.find(entry => entry.label === label);
    return field ? field.id : null;
  }

  /**
   * Get field ID by partial label match (case-insensitive)
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
   * Get multiple field IDs by labels (returns map of label -> field ID)
   */
  getFieldIds(labels: string[]): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    labels.forEach(label => {
      result[label] = this.getFieldId(label);
    });
    return result;
  }

  /**
   * Get all required field IDs and labels
   */
  getRequiredFields(): FieldEntry[] {
    const map = this.loadFieldMap();
    return map.entries.filter(entry => entry.required);
  }

  /**
   * Get all field entries for debugging/inspection
   */
  getAllFields(): FieldEntry[] {
    const map = this.loadFieldMap();
    return map.entries;
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
        message: error.message
      };
    }
  }

  /**
   * Clear cached mapping (useful for testing or after updates)
   */
  clearCache(): void {
    this.fieldMap = null;
  }
}

// Export singleton instance
export const fieldMapper = FieldMapper.getInstance();