// GoCanvas API integration service
import { readFileSync } from 'fs';
import { join } from 'path';
import { fieldMapper } from '@shared/fieldMapper';

// GoCanvas Form IDs
export const FORM_IDS = {
  EMISSIONS: '5654184',      // Emissions Service Log (updated 2025-10-20)
  PICKUP: '5640587',         // Pickup Log (updated with Contact Name, Contact Number, PO Number)
  DELIVERY: '5657146',       // Delivery Log (updated 2025-10-30 - changed Invoice to Order Number)
} as const;

export type FormType = keyof typeof FORM_IDS;

// In-memory GoCanvas API metrics (reset on server restart)
// This is observe-only and should never break the integration
export const goCanvasMetrics = {
  totalCalls: 0,
  byStatus: {} as Record<string, number>,
  rateLimitHits: 0,
  lastRateLimitAt: null as string | null,
  lastRateLimitReset: null as string | null,
  lastRateLimitLimit: null as string | null,
  lastRateLimitRemaining: null as string | null,
};

/**
 * Low-level wrapper for all GoCanvas API HTTP requests
 * Captures metrics (best-effort, never throws) without changing behavior
 */
async function rawGoCanvasRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `https://api.gocanvas.com/api/v3${path}`;
  
  const res = await fetch(url, options);

  // ---- BEGIN metrics (observe-only, never throws) ----
  try {
    const status = res.status.toString();
    const limit = res.headers.get("ratelimit-limit");
    const remaining = res.headers.get("ratelimit-remaining");
    const reset = res.headers.get("ratelimit-reset");

    goCanvasMetrics.totalCalls += 1;
    goCanvasMetrics.byStatus[status] = (goCanvasMetrics.byStatus[status] || 0) + 1;

    // Capture rate limit info (always, not just on 429)
    if (limit) goCanvasMetrics.lastRateLimitLimit = limit;
    if (remaining) goCanvasMetrics.lastRateLimitRemaining = remaining;
    if (reset) goCanvasMetrics.lastRateLimitReset = reset;

    if (status === "429") {
      goCanvasMetrics.rateLimitHits += 1;
      goCanvasMetrics.lastRateLimitAt = new Date().toISOString();
    }

    // Optional: log occasionally for debugging (comment out if too noisy)
    // console.log(`[GoCanvas] ${path} → ${status} (limit: ${limit}, remaining: ${remaining})`);
  } catch (err) {
    console.error("Error recording GoCanvas metrics (non-fatal):", err);
  }
  // ---- END metrics ----

  return res;
}

export class GoCanvasService {
  private baseUrl = 'https://api.gocanvas.com/api/v3';
  private username: string;
  private password: string;
  private formId?: string; // Default form ID (emissions) - kept for backward compatibility
  private dryRun: boolean;

  constructor() {
    this.username = process.env.GOCANVAS_USERNAME || '';
    this.password = process.env.GOCANVAS_PASSWORD || '';
    this.dryRun = process.env.GOCANVAS_DRY_RUN === 'true';
    
    // Validate field mapping and get default form ID (emissions)
    const validation = fieldMapper.validateMapping();
    if (!validation.valid) {
      console.error('❌ GoCanvas Field Mapping Error:', validation.message);
      throw new Error(validation.message);
    }
    
    this.formId = fieldMapper.getFormId();
    console.log('✅ GoCanvas initialized:', validation.message);
    
    // Log available forms
    const loadedForms = fieldMapper.getLoadedFormIds();
    if (loadedForms.length > 0) {
      console.log(`📋 Loaded field maps for ${loadedForms.length} forms:`, loadedForms.join(', '));
    }
    
    if (this.dryRun) {
      console.log('🧪 DRY_RUN MODE ENABLED - No actual API calls will be made');
    }
    
    if (!this.username || !this.password) {
      console.warn('GoCanvas credentials not configured. Using mock mode.');
    }
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Comprehensive payload logging for debugging ghost parts issues
   */
  private logPayloadAnalysis(dispatchData: any, jobData: any): void {
    console.log('\n🔍 ===== COMPREHENSIVE PAYLOAD ANALYSIS =====');
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log('👤 Job ID:', jobData.jobId);
    console.log('🏢 Customer:', jobData.customerName);
    console.log('🔧 Shop:', jobData.shopName);
    console.log('');
    
    console.log('📦 DISPATCH STRUCTURE:');
    console.log('===================');
    console.log(`   dispatch_type: "${dispatchData.dispatch_type}"`);
    console.log(`   form_id: ${dispatchData.form_id}`);
    console.log(`   name: "${dispatchData.name}"`);
    console.log(`   description: "${dispatchData.description}"`);
    console.log(`   send_notification: ${dispatchData.send_notification}`);
    if (dispatchData.assignee_id) {
      console.log(`   assignee_id: ${dispatchData.assignee_id}`);
    }
    console.log('');
    
    console.log('📋 RESPONSES ARRAY ANALYSIS:');
    console.log('==========================');
    console.log(`   Total responses: ${dispatchData.responses.length}`);
    console.log('');
    
    dispatchData.responses.forEach((response: any, index: number) => {
      console.log(`   Response ${index + 1}:`);
      console.log(`      entry_id: ${response.entry_id}`);
      console.log(`      value: "${response.value}"`);
      console.log(`      value_type: ${typeof response.value}`);
      console.log(`      value_length: ${response.value?.length || 0}`);
      
      // Check for multi_key (should be absent for CSR)
      if (response.multi_key) {
        console.log(`      🚨 multi_key: "${response.multi_key}" (THIS CREATES LOOP ROWS!)`);
      } else {
        console.log(`      ✅ multi_key: none (safe)`);
      }
      
      // Identify field category
      const fieldAnalysis = this.analyzeFieldCategory(response.entry_id);
      console.log(`      field_category: ${fieldAnalysis.category}`);
      if (fieldAnalysis.risk) {
        console.log(`      ⚠️  risk: ${fieldAnalysis.risk}`);
      }
      console.log('');
    });
    
    console.log('🎯 POTENTIAL GHOST PARTS TRIGGERS:');
    console.log('================================');
    const triggers = this.identifyPotentialTriggers(dispatchData.responses);
    if (triggers.length === 0) {
      console.log('   ✅ No obvious triggers detected');
    } else {
      triggers.forEach((trigger, index) => {
        console.log(`   ${index + 1}. ${trigger.description}`);
        console.log(`      entry_id: ${trigger.entry_id}`);
        console.log(`      value: "${trigger.value}"`);
        console.log(`      risk_level: ${trigger.risk_level}`);
      });
    }
    console.log('');
    
    console.log('💾 FULL PAYLOAD (JSON):');
    console.log('=====================');
    console.log(JSON.stringify(dispatchData, null, 2));
    console.log('\n🔍 ===== END PAYLOAD ANALYSIS =====\n');
    
    // Write to file for inspection
    this.writePayloadToFile(dispatchData, jobData);
  }

  /**
   * Analyze field category and risk level
   */
  private analyzeFieldCategory(entry_id: number): {category: string, risk?: string} {
    // Load field analysis data
    try {
      const fs = require('fs');
      const fieldAnalysis = JSON.parse(fs.readFileSync('/tmp/field_mapping_analysis.json', 'utf8'));
      
      const checkInField = fieldAnalysis.checkInFields.find((f: any) => f.id === entry_id);
      if (checkInField) {
        return {category: 'Check-In'};
      }
      
      const partsLogField = fieldAnalysis.partsLogFields.find((f: any) => f.id === entry_id);
      if (partsLogField) {
        return {
          category: 'Parts Log', 
          risk: partsLogField.required ? 'CRITICAL - Required field' : 'WARNING - Parts Log field'
        };
      }
      
      return {category: 'Unknown'};
    } catch (e) {
      return {category: 'Unknown'};
    }
  }

  /**
   * Identify potential triggers for ghost parts issues
   */
  private identifyPotentialTriggers(responses: any[]): any[] {
    const triggers = [];
    
    for (const response of responses) {
      const value = response.value.toLowerCase();
      
      // Check for trigger patterns
      if (value === 'new submission') {
        triggers.push({
          entry_id: response.entry_id,
          value: response.value,
          description: 'Submission Status = "New Submission" might activate conditional logic',
          risk_level: 'MEDIUM'
        });
      }
      
      if (value === 'yes' || value === 'true') {
        triggers.push({
          entry_id: response.entry_id,
          value: response.value,
          description: 'Yes/True value might enable conditional sections',
          risk_level: 'LOW'
        });
      }
      
      // Check for specific field IDs known to cause issues
      if (response.entry_id === 718414077) { // FORCE STOP field
        triggers.push({
          entry_id: response.entry_id,
          value: response.value,
          description: 'FORCE STOP field detected - CRITICAL trigger risk',
          risk_level: 'CRITICAL'
        });
      }
    }
    
    return triggers;
  }

  /**
   * Write payload to file for inspection
   */
  private writePayloadToFile(dispatchData: any, jobData: any): void {
    try {
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `/tmp/gocanvas_payload_${jobData.jobId}_${timestamp}.json`;
      
      const payloadLog = {
        timestamp: new Date().toISOString(),
        jobId: jobData.jobId,
        dryRun: this.dryRun,
        dispatchData,
        originalJobData: jobData,
        analysis: {
          totalResponses: dispatchData.responses.length,
          potentialTriggers: this.identifyPotentialTriggers(dispatchData.responses),
          fieldCategories: dispatchData.responses.map((r: any) => ({
            entry_id: r.entry_id,
            category: this.analyzeFieldCategory(r.entry_id)
          }))
        }
      };
      
      fs.writeFileSync(filename, JSON.stringify(payloadLog, null, 2));
      console.log(`💾 Payload saved to: ${filename}`);
    } catch (error) {
      console.error('Failed to write payload file:', error.message);
    }
  }

  async listForms(): Promise<any[]> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, returning empty forms list');
      return [];
    }

    try {
      console.log('Fetching forms from GoCanvas...');
      const response = await rawGoCanvasRequest('/forms', {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list forms: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Available GoCanvas forms:', data);
      return data;
    } catch (error) {
      console.error('Failed to list GoCanvas forms:', error);
      throw error;
    }
  }

  async getFormDetails(formId: string): Promise<any> {
    if (!this.username || !this.password) {
      throw new Error('GoCanvas credentials not configured');
    }

    try {
      console.log(`Fetching form details for form ID: ${formId}`);
      const response = await rawGoCanvasRequest(`/forms/${formId}?format=flat`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get form details: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const formData = await response.json();
      console.log('Form details:', formData);
      return formData;
    } catch (error) {
      console.error('Failed to get form details:', error);
      throw error;
    }
  }

  async getReferenceData(): Promise<any[]> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, cannot fetch reference data');
      return [];
    }

    try {
      console.log('Fetching reference data from GoCanvas...');
      const response = await rawGoCanvasRequest('/reference_data', {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get reference data: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Reference data retrieved:', data);
      return data.reference_data || data.data || data || [];
    } catch (error) {
      console.error('Failed to get reference data:', error);
      throw error;
    }
  }

  async getReferenceDataById(id: string): Promise<any> {
    if (!this.username || !this.password) {
      throw new Error('GoCanvas credentials not configured');
    }

    try {
      console.log(`Fetching reference data for ID: ${id}`);
      const response = await rawGoCanvasRequest(`/reference_data/${id}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get reference data: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`Reference data ${id}:`, data);
      return data;
    } catch (error) {
      console.error(`Failed to get reference data ${id}:`, error);
      throw error;
    }
  }

  async getUserId(email: string): Promise<number | null> {
    if (!this.username || !this.password) {
      return null;
    }

    try {
      const response = await rawGoCanvasRequest('/users', {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch users: ${response.status}`);
        return null;
      }

      const users = await response.json();
      const user = users.find((u: any) => u.login === email);
      return user ? user.id : null;
    } catch (error) {
      console.error('Error fetching user ID:', error);
      return null;
    }
  }

  async createSubmission(jobData: any, storage: any): Promise<string> {
    console.log('=== GOCANVAS createDispatch called ===');
    console.log('Raw jobData keys:', Object.keys(jobData));
    console.log('shopName value:', jobData.shopName);
    console.log('customerShipTo value:', jobData.customerShipTo);
    console.log('=======================================');
    
    if (!this.username || !this.password || !this.formId) {
      console.log('GoCanvas not configured, skipping dispatch creation');
      return 'skip-no-config';
    }

    // STEP 0: Validate parts if any exist
    // Parts are optional, but if added, all required fields must be filled
    const parts = await storage.getJobParts(jobData.jobId);
    
    if (parts && parts.length > 0) {
      console.log(`🔍 Validating ${parts.length} parts for job ${jobData.jobId}...`);
      
      // Check each part for required fields: part, process, ecs_serial, gasket_clamps
      const incompleteParts = parts.filter((part: any) => {
        return !part.part || !part.process || !part.ecsSerial || !part.gasketClamps;
      });
      
      if (incompleteParts.length > 0) {
        const errorMsg = `Cannot dispatch emissions service log: ${incompleteParts.length} part(s) have incomplete required fields. Required: Part, Process Being Performed, ECS Serial Number, and Gasket or Clamps.`;
        console.error('🚨 PARTS VALIDATION FAILED:', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`✅ All ${parts.length} parts validated successfully`);
    }

    try {
      const responses = this.mapJobDataToFormResponses(jobData);
      
      // STEP 1.5: Add parts as loop screen responses if they exist
      if (parts && parts.length > 0) {
        const partsResponses = await this.mapPartsToLoopScreenResponses(parts);
        responses.push(...partsResponses);
        console.log(`📦 Added ${partsResponses.length} loop screen responses for ${parts.length} parts`);
      }
      
      // Look up technician user ID for assignment
      let assigneeId = null;
      if (jobData.shopHandoff) {
        assigneeId = await this.getUserId(jobData.shopHandoff);
        if (assigneeId) {
          console.log(`Found GoCanvas user ID ${assigneeId} for ${jobData.shopHandoff}`);
        } else {
          console.warn(`Could not find GoCanvas user for ${jobData.shopHandoff}, dispatch will be unassigned`);
        }
      }
      
      // Create dispatch instead of direct submission (more reliable approach)
      const dispatchData: any = {
        dispatch_type: 'immediate_dispatch',
        form_id: parseInt(this.formId),
        // Removed form_version to use default (form_version: 'latest' may not work with new forms)
        name: `ECS Job: ${jobData.jobId}`,
        description: `Job for ${jobData.customerName} - ${jobData.shopName}`,
        responses: responses,
        send_notification: true // Send notification so technician sees the dispatch
      };

      // Add assignee if found
      if (assigneeId) {
        dispatchData.assignee_id = assigneeId;
      }

      // COMPREHENSIVE PAYLOAD LOGGING (always enabled for debugging)
      this.logPayloadAnalysis(dispatchData, jobData);

      console.log('Creating GoCanvas dispatch:', { 
        jobId: jobData.jobId,
        formId: this.formId,
        responseCount: responses.length,
        dispatchType: 'immediate_dispatch',
        assigneeId: assigneeId,
        assignedTo: assigneeId ? jobData.shopHandoff : 'unassigned',
        dryRun: this.dryRun
      });
      
      // Log if Job ID mapping was found
      const jobIdMapping = responses.find(response => response.value === jobData.jobId);
      if (jobIdMapping) {
        console.log(`✅ Job ID ${jobData.jobId} mapped to GoCanvas field entry_id: ${jobIdMapping.entry_id}`);
      } else {
        console.log(`⚠️ Job ID ${jobData.jobId} not yet mapped to GoCanvas field - field may need to be added to GoCanvas form`);
      }

      // DRY RUN MODE - Skip actual API call
      if (this.dryRun) {
        console.log('🧪 DRY_RUN: Skipping actual GoCanvas API call');
        console.log('🧪 Would have called:', `${this.baseUrl}/dispatches`);
        console.log('🧪 Would have sent payload:', JSON.stringify(dispatchData, null, 2));
        return `dryrun-${jobData.jobId}-${Date.now()}`;
      }

      const response = await rawGoCanvasRequest('/dispatches', {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dispatchData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🚨 GoCanvas API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText,
          dispatchData: JSON.stringify(dispatchData, null, 2)
        });
        
        // Enhanced error logging for ghost parts debugging
        console.error('🚨 POTENTIAL GHOST PARTS ERROR ANALYSIS:');
        console.error('========================================');
        
        if (errorText.toLowerCase().includes('required field') || 
            errorText.toLowerCase().includes('input is required')) {
          console.error('🎯 DETECTED: Required field error - likely ghost parts issue!');
          console.error('💡 Check for:');
          console.error('   - Conditional logic activating Parts Log fields');
          console.error('   - FORCE STOP field (718414077) being triggered');
          console.error('   - Loop/table rows being accidentally created');
        }
        
        if (errorText.toLowerCase().includes('validation error')) {
          console.error('🎯 DETECTED: Validation error - check field values and types');
        }
        
        throw new Error(`Failed to create dispatch: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ GoCanvas dispatch created successfully:', result.id || result.guid);
      console.log('📊 Response details:', {
        id: result.id,
        guid: result.guid,
        status: result.status,
        created_at: result.created_at
      });
      
      return result.id || result.guid || jobData.jobId;
    } catch (error) {
      console.error('❌ Failed to create GoCanvas dispatch:', error);
      
      // Enhanced error analysis
      if (error.message && typeof error.message === 'string') {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('required field') || errorMsg.includes('ghost') || errorMsg.includes('parts')) {
          console.error('🚨 GHOST PARTS ERROR DETECTED - See payload analysis above');
        }
      }
      
      throw error;
    }
  }

  /**
   * Create a dispatch for a specific form type (pickup, delivery, or emissions)
   */
  async createDispatchForForm(
    formType: FormType,
    jobData: any,
    assigneeEmail?: string
  ): Promise<string> {
    const formId = FORM_IDS[formType];
    console.log(`=== GOCANVAS createDispatchForForm called for ${formType} (Form ID: ${formId}) ===`);
    console.log('Job ID:', jobData.jobId);
    console.log('Assignee:', assigneeEmail || 'unassigned');
    
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, skipping dispatch creation');
      return 'skip-no-config';
    }

    try {
      // Map job data to form responses for the specific form
      const responses = this.mapJobDataToFormResponsesForForm(formId, jobData, formType);
      
      // Look up assignee user ID if provided
      let assigneeId = null;
      if (assigneeEmail) {
        assigneeId = await this.getUserId(assigneeEmail);
        if (assigneeId) {
          console.log(`Found GoCanvas user ID ${assigneeId} for ${assigneeEmail}`);
        } else {
          console.warn(`Could not find GoCanvas user for ${assigneeEmail}, dispatch will be unassigned`);
        }
      }
      
      // Create dispatch data
      const dispatchData: any = {
        dispatch_type: 'immediate_dispatch',
        form_id: parseInt(formId),
        name: `ECS ${formType} Job: ${jobData.jobId}`,
        description: this.getDispatchDescription(formType, jobData),
        responses: responses,
        send_notification: true
      };

      // Add assignee if found
      if (assigneeId) {
        dispatchData.assignee_id = assigneeId;
      }

      console.log('Creating GoCanvas dispatch:', { 
        jobId: jobData.jobId,
        formType,
        formId,
        responseCount: responses.length,
        assigneeId: assigneeId,
        dryRun: this.dryRun
      });

      // DRY RUN MODE - Skip actual API call
      if (this.dryRun) {
        console.log('🧪 DRY_RUN: Skipping actual GoCanvas API call');
        console.log('🧪 Would have called:', `${this.baseUrl}/dispatches`);
        console.log('🧪 Would have sent payload:', JSON.stringify(dispatchData, null, 2));
        return `dryrun-${formType}-${jobData.jobId}-${Date.now()}`;
      }

      const response = await rawGoCanvasRequest('/dispatches', {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dispatchData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🚨 GoCanvas API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          formType,
          formId
        });
        throw new Error(`Failed to create ${formType} dispatch: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ GoCanvas ${formType} dispatch created successfully:`, result.id || result.guid);
      
      return result.id || result.guid || jobData.jobId;
    } catch (error) {
      console.error(`❌ Failed to create GoCanvas ${formType} dispatch:`, error);
      throw error;
    }
  }

  /**
   * Get dispatch description based on form type
   */
  private getDispatchDescription(formType: FormType, jobData: any): string {
    switch (formType) {
      case 'PICKUP':
        return `Pickup for ${jobData.customerName} - ${jobData.shopName || 'Shop'}`;
      case 'DELIVERY':
        return `Delivery for ${jobData.customerName} - ${jobData.shopName || 'Shop'}`;
      case 'EMISSIONS':
        return `Job for ${jobData.customerName} - ${jobData.shopName}`;
      default:
        return `Job ${jobData.jobId}`;
    }
  }

  /**
   * Map job data to form responses for a specific form
   */
  private mapJobDataToFormResponsesForForm(formId: string, jobData: any, formType: FormType): any[] {
    console.log(`🔍 Starting field mapping for ${formType} form (${formId})...`);
    
    // Get all fields for this specific form
    const allFields = fieldMapper.getAllFieldsForForm(formId);
    console.log(`Loaded ${allFields.length} fields from FieldMapper for form ${formId}`);
    
    // Create label-to-ID mapping
    const fieldMap: any = {};
    allFields.forEach(field => {
      fieldMap[field.label] = field.id;
    });

    const responses = [];
    
    // Get form-specific mappings
    const mappings = this.getFormSpecificMappings(formType, jobData);

    // Map fields
    for (const mapping of mappings) {
      if (mapping.data !== undefined && mapping.data !== null) {
        for (const label of mapping.labels) {
          const entryId = fieldMap[label];
          if (entryId) {
            const value = mapping.data || "N/A";
            console.log(`Mapping found: ${label} -> ${entryId} = "${value}"`);
            responses.push({
              entry_id: entryId,
              value: String(value)
            });
            break; // Use first matching field
          }
        }
      }
    }
    
    console.log(`Created ${responses.length} form responses for ${formType}`);
    return responses;
  }

  /**
   * Get form-specific field mappings
   */
  private getFormSpecificMappings(formType: FormType, jobData: any): any[] {
    const commonMappings = [
      { data: jobData.jobId, labels: ['Job ID', 'ECS Job ID', 'Job Id', 'Job Number'] },
      { data: jobData.customerName, labels: ['Customer Name'] },
      { data: jobData.shopName, labels: ['Shop Name'] },
      { data: jobData.contactName, labels: ['Contact Name'] },
      { data: jobData.contactNumber, labels: ['Contact Number'] },
    ];

    switch (formType) {
      case 'PICKUP':
        // Generate dispatch date/time
        const now = new Date();
        const dispatchDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const dispatchTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        
        return [
          { data: jobData.jobId, labels: ['Job ID'] },
          { data: dispatchDate, labels: ['Dispatch Date'] },
          { data: dispatchTime, labels: ['Dispatch Time'] },
          { data: jobData.shopName, labels: ['Location'] }, // Connected to reference_data_id=947586
          { data: jobData.customerName, labels: ['Customer Name'] }, // Connected to Workflow Customer Name table
          { data: jobData.customerShipTo, labels: ['Customer Ship-To'] }, // Connected to same table, "ship to combined" field
          { data: jobData.contactName, labels: ['Contact Name'] },
          { data: jobData.contactNumber, labels: ['Contact Number'] },
          { data: jobData.poNumber, labels: ['PO Number (Check In)'] },
          { data: jobData.pickupNotes, labels: ['Notes to Driver'] },
        ];
      
      case 'DELIVERY':
        // Generate dispatch date/time for delivery
        const deliveryDispatchNow = new Date();
        const deliveryDispatchDate = deliveryDispatchNow.toISOString().split('T')[0]; // YYYY-MM-DD
        const deliveryDispatchTime = deliveryDispatchNow.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        
        return [
          { data: jobData.jobId, labels: ['Job ID'] },
          { data: deliveryDispatchDate, labels: ['Dispatch Date'] },
          { data: deliveryDispatchTime, labels: ['Dispatch Time'] },
          { data: jobData.shopName, labels: ['Location'] },
          { data: jobData.customerName, labels: ['Customer Name'] },
          { data: jobData.customerShipTo, labels: ['Customer Ship-To'] },
          { data: jobData.orderNumber, labels: ['Order Number'] },
          { data: jobData.orderNumber2, labels: ['Order Number - #2'] },
          { data: jobData.orderNumber3, labels: ['Order Number - #3'] },
          { data: jobData.orderNumber4, labels: ['Order Number - #4'] },
          { data: jobData.orderNumber5, labels: ['Order Number - #5'] },
          { data: jobData.deliveryNotes, labels: ['Notes to Driver'] },
        ];
      
      case 'EMISSIONS':
      default:
        // Full emissions form mappings
        return [
          ...commonMappings,
          { data: jobData.p21OrderNumber, labels: ['P21 Order Number (Enter after invoicing)'] },
          { data: jobData.userId, labels: ['User ID'] },
          { data: jobData.permissionToStart, labels: ['Permission to Start'] },
          { data: jobData.permissionDeniedStop, labels: ['Permission Denied Stop'] },
          { data: jobData.customerShipTo, labels: ['Customer Ship To'] },
          { data: jobData.p21ShipToId, labels: ['P21 Ship to ID'] },
          { data: jobData.customerSpecificInstructions, labels: ['Customer Specific Instructions?'] },
          { data: jobData.sendClampsGaskets, labels: ['Send Clamps & Gaskets?'] },
          { data: jobData.preferredProcess, labels: ['Preferred Process?'] },
          { data: jobData.anyOtherSpecificInstructions, labels: ['Any Other Specific Instructions?'] },
          { data: jobData.anyCommentsForTech, labels: ['Any comments for the tech about this submission?'] },
          { data: jobData.noteToTechAboutCustomer, labels: ['Note to Tech about Customer or service:'] },
          { data: jobData.poNumber, labels: ['PO Number (Check In)', 'PO Number'] },
          { data: jobData.serialNumbers, labels: ['Serial Number(s)'] },
          { data: jobData.techCustomerQuestionInquiry, labels: ['Tech Customer Question Inquiry'] },
          { data: jobData.shopHandoff, labels: ['Shop Handoff'] },
          { data: jobData.handoffEmailWorkflow, labels: ['Handoff Email workflow'] },
        ];
    }
  }

  async getSubmissionById(submissionId: string): Promise<any> {
    try {
      console.log(`=== FETCHING GOCANVAS SUBMISSION: ${submissionId} ===`);
      
      // Get detailed submission data by ID
      const detailResponse = await rawGoCanvasRequest(`/submissions/${submissionId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      console.log('Detail response status:', detailResponse.status);

      if (!detailResponse.ok) {
        const errorText = await detailResponse.text();
        console.error('Failed to fetch submission details:', errorText);
        return { error: `Failed to fetch submission details: ${detailResponse.status}`, details: errorText };
      }

      const detailData = await detailResponse.json();
      console.log('=== TIMING INFORMATION ===');
      console.log('ID:', detailData.id);
      console.log('Created:', detailData.created_at);
      console.log('Updated:', detailData.updated_at);
      console.log('Submitted:', detailData.submitted_at);
      console.log('🔍 TIMEZONE ANALYSIS:');
      console.log('  - Created format:', typeof detailData.created_at, detailData.created_at);
      console.log('  - Updated format:', typeof detailData.updated_at, detailData.updated_at);
      console.log('  - Submitted format:', typeof detailData.submitted_at, detailData.submitted_at);
      
      return {
        id: detailData.id,
        created_at: detailData.created_at,
        updated_at: detailData.updated_at,
        submitted_at: detailData.submitted_at,
        status: detailData.status,
        rawData: detailData
      };
      
    } catch (error) {
      console.error('Error in getSubmissionById:', error);
      return { error: 'Exception occurred', details: error.message };
    }
  }

  async getDispatchById(dispatchId: string): Promise<any> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, returning mock dispatch status');
      return { status: 'pending', error: 'Not configured' };
    }

    try {
      console.log(`📋 Fetching dispatch ${dispatchId} from GoCanvas...`);
      const response = await rawGoCanvasRequest(`/dispatches/${dispatchId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch dispatch: ${response.status}`);
        return { status: 'error', error: `HTTP ${response.status}` };
      }

      const dispatch = await response.json();
      console.log(`✅ Dispatch ${dispatchId} status: ${dispatch.status}`);
      console.log(`   Submission ID: ${dispatch.submission_id || 'none'}`);
      
      return {
        id: dispatch.id,
        status: dispatch.status,
        submission_id: dispatch.submission_id,
        created_at: dispatch.created_at,
        updated_at: dispatch.updated_at,
        rawData: dispatch
      };
    } catch (error) {
      console.error(`Error fetching dispatch ${dispatchId}:`, error);
      return { status: 'error', error: error.message };
    }
  }

  async getMostRecentSubmission(): Promise<any> {
    try {
      console.log('=== FETCHING MOST RECENT GOCANVAS SUBMISSION ===');
      console.log('Form ID:', this.formId);
      console.log('Username configured:', !!this.username);
      
      // First, get list of submissions for the form
      const listResponse = await rawGoCanvasRequest(`/submissions?form_id=${this.formId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      console.log('List submissions response status:', listResponse.status);
      
      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error('Failed to fetch submissions list:', errorText);
        return { error: `Failed to fetch submissions: ${listResponse.status}`, details: errorText };
      }

      const listData = await listResponse.json();
      console.log('Submissions list response keys:', Object.keys(listData));
      
      const submissions = Array.isArray(listData) ? listData : (listData.submissions || listData.data || []);
      console.log('Found submissions count:', submissions.length);
      
      if (submissions.length === 0) {
        return { message: 'No submissions found for form', formId: this.formId };
      }

      // Get the most recent submission (first one, assuming they're sorted by date)
      const mostRecent = submissions[0];
      console.log('Most recent submission ID:', mostRecent.id);
      console.log('Most recent submission keys:', Object.keys(mostRecent));

      // Get detailed submission data
      console.log('=== FETCHING DETAILED SUBMISSION DATA ===');
      const detailResponse = await rawGoCanvasRequest(`/submissions/${mostRecent.id}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      console.log('Detail response status:', detailResponse.status);

      if (!detailResponse.ok) {
        const errorText = await detailResponse.text();
        console.error('Failed to fetch submission details:', errorText);
        return { error: `Failed to fetch submission details: ${detailResponse.status}`, details: errorText, basicData: mostRecent };
      }

      const detailData = await detailResponse.json();
      console.log('=== DETAILED SUBMISSION ANALYSIS ===');
      console.log('All top-level keys:', Object.keys(detailData));
      
      // NEW: Log the COMPLETE submission object to find hidden workflow fields
      console.log('🔍🔍🔍 COMPLETE SUBMISSION OBJECT (looking for workflow history):');
      console.log(JSON.stringify(detailData, null, 2));
      
      // Return the analysis in the response for easier examination
      const analysis = {
        submissionId: detailData.id,
        status: detailData.status,
        created_at: detailData.created_at,
        updated_at: detailData.updated_at,
        submitted_at: detailData.submitted_at,
        allKeys: Object.keys(detailData),
        workflowFields: {},
        submissionCheckInFields: [],
        rawData: detailData
      };
      
      // Basic submission info
      console.log('ID:', detailData.id);
      console.log('Status:', detailData.status);
      console.log('Created:', detailData.created_at);
      console.log('Updated:', detailData.updated_at);
      console.log('Submitted:', detailData.submitted_at);
      
      // Look for workflow-related data - EXPANDED SEARCH
      const workflowFields = [
        'workflow_states', 'workflow_history', 'handoffs', 'transitions', 'workflow', 'states', 'workflow_data',
        'history', 'workflow_log', 'transition_log', 'handoff_history', 'state_history', 'workflow_events',
        'revisions', 'revision_history', 'changes', 'activity', 'activity_log', 'events', 'log'
      ];
      workflowFields.forEach(field => {
        if (detailData[field]) {
          console.log(`🎯 Found ${field}:`, JSON.stringify(detailData[field], null, 2));
          analysis.workflowFields[field] = detailData[field];
        }
      });
      
      // Look for any field containing "workflow" or "handoff"
      Object.keys(detailData).forEach(key => {
        if (key.toLowerCase().includes('workflow') || key.toLowerCase().includes('handoff') || key.toLowerCase().includes('state')) {
          console.log(`Found workflow-related field '${key}':`, JSON.stringify(detailData[key], null, 2));
          analysis.workflowFields[key] = detailData[key];
        }
      });
      
      // Specifically look for "Submission Check in" in any field
      Object.entries(detailData).forEach(([key, value]) => {
        if (typeof value === 'string' && value.toLowerCase().includes('submission check in')) {
          console.log(`Found "Submission Check in" in field '${key}':`, value);
          analysis.submissionCheckInFields.push({ field: key, value, type: 'string' });
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'string' && item.toLowerCase().includes('submission check in')) {
              console.log(`Found "Submission Check in" in array field '${key}[${index}]':`, item);
              analysis.submissionCheckInFields.push({ field: `${key}[${index}]`, value: item, type: 'array_string' });
            } else if (typeof item === 'object' && item) {
              Object.entries(item).forEach(([subKey, subValue]) => {
                if (typeof subValue === 'string' && subValue.toLowerCase().includes('submission check in')) {
                  console.log(`Found "Submission Check in" in '${key}[${index}].${subKey}':`, subValue);
                  analysis.submissionCheckInFields.push({ field: `${key}[${index}].${subKey}`, value: subValue, type: 'nested_object' });
                }
              });
            }
          });
        } else if (typeof value === 'object' && value) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            if (typeof subValue === 'string' && subValue.toLowerCase().includes('submission check in')) {
              console.log(`Found "Submission Check in" in '${key}.${subKey}':`, subValue);
              analysis.submissionCheckInFields.push({ field: `${key}.${subKey}`, value: subValue, type: 'object' });
            }
          });
        }
      });
      
      // Look for any timestamp fields that might be related to workflow states
      if (detailData.responses && Array.isArray(detailData.responses)) {
        detailData.responses.forEach((response, index) => {
          if (response.type === 'Time' || response.type === 'Date' || response.type === 'DateTime') {
            console.log(`Found timestamp field: ${response.label} = ${response.value} (entry_id: ${response.entry_id})`);
          }
          if (response.label && response.label.toLowerCase().includes('check in')) {
            console.log(`Found check-in related field: ${response.label} = ${response.value} (entry_id: ${response.entry_id})`);
            analysis.submissionCheckInFields.push({ 
              field: `responses[${index}]`, 
              value: response, 
              type: 'form_response',
              label: response.label,
              entry_id: response.entry_id 
            });
          }
        });
      }
      
      console.log('=== WORKFLOW ANALYSIS COMPLETE ===');
      console.log(`Found ${Object.keys(analysis.workflowFields).length} workflow-related fields`);
      console.log(`Found ${analysis.submissionCheckInFields.length} submission check-in related fields`);
      
      return analysis;
      
    } catch (error) {
      console.error('Error in getMostRecentSubmission:', error);
      return { error: 'Exception occurred', details: error.message };
    }
  }

  async getHandoffTimeData(jobId: string): Promise<any> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, cannot fetch handoff data');
      return null;
    }

    try {
      console.log(`\n=== FETCHING HANDOFF TIME DATA FOR JOB: ${jobId} ===`);
      
      // Get all submissions for the form
      const response = await rawGoCanvasRequest(`/submissions?form_id=${this.formId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch submissions: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const submissions = Array.isArray(data) ? data : (data.submissions || data.data || []);
      
      console.log(`Found ${submissions.length} submissions to search through`);
      
      // Find the submission with matching job ID
      let targetSubmission = null;
      
      for (const submission of submissions) {
        try {
          const detailResponse = await rawGoCanvasRequest(`/submissions/${submission.id}`, {
            headers: {
              'Authorization': this.getAuthHeader(),
              'Content-Type': 'application/json',
            },
          });
          
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            
            // Search through form fields for our Job ID
            if (detailData.responses) {
              const jobIdField = detailData.responses.find((field: any) => 
                field.value === jobId && 
                field.label?.toLowerCase().includes('job')
              );
              
              if (jobIdField) {
                console.log(`🎯 Found target submission for job ${jobId}!`);
                targetSubmission = detailData;
                break;
              }
            }
          }
        } catch (err) {
          console.log(`Error checking submission ${submission.id}:`, err);
        }
      }
      
      if (!targetSubmission) {
        console.log(`❌ No submission found for job ${jobId}`);
        return null;
      }

      console.log('\n=== ANALYZING SUBMISSION FOR HANDOFF TIME DATA ===');
      
      // Look for handoff-related fields
      const handoffData = {
        submissionId: targetSubmission.id,
        jobId: jobId,
        status: targetSubmission.status,
        created_at: targetSubmission.created_at,
        updated_at: targetSubmission.updated_at,
        submitted_at: targetSubmission.submitted_at,
        handoffFields: [],
        timeFields: [],
        workflowFields: [],
        responses: targetSubmission.responses || [], // Fixed: jobTracker expects 'responses', not 'allResponses'
        allResponses: targetSubmission.responses || []
      };

      // Log ALL form responses to find the exact fields we're looking for
      console.log(`\n📋 SCANNING ALL ${targetSubmission.responses?.length || 0} FORM RESPONSES:`);
      console.log(`🔍 Looking specifically for "Handoff Date" and "Handoff Time" fields...`);
      console.log(`🔍 Also searching for values "08/26/2025" and "02:50 PM"...`);
      
      // Search through all responses for handoff and time-related fields
      if (targetSubmission.responses && Array.isArray(targetSubmission.responses)) {
        targetSubmission.responses.forEach((response: any, index: number) => {
          // Check for exact field label matches first
          if (response.label === 'Handoff Date' || response.label === 'Handoff Time') {
            console.log(`🎯🎯🎯 FOUND EXACT TARGET FIELD: ${response.label} = "${response.value}" (entry_id: ${response.entry_id}) 🎯🎯🎯`);
          }
          
          // Check for specific values from the screenshot
          if (response.value === '08/26/2025' || response.value === '02:50 PM') {
            console.log(`🎯 FOUND TARGET VALUE: "${response.label}" = "${response.value}" (entry_id: ${response.entry_id})`);
          }
          
          // Log only handoff-related or date/time fields to reduce noise
          if (response.label && (
            response.label.toLowerCase().includes('handoff') ||
            response.label.toLowerCase().includes('date') ||
            response.label.toLowerCase().includes('time') ||
            response.type === 'Date' ||
            response.type === 'Time'
          )) {
            console.log(`📋 Field ${index}: "${response.label}" = "${response.value}" (type: ${response.type}, entry_id: ${response.entry_id})`);
          }
          // Look for handoff-related fields (including exact matches for "Handoff Date" and "Handoff Time")
          if (response.label && (
            response.label.toLowerCase().includes('handoff') ||
            response.label.toLowerCase().includes('hand off') ||
            response.label.toLowerCase().includes('hand-off')
          )) {
            console.log(`📋 Found handoff field: "${response.label}" = "${response.value}" (entry_id: ${response.entry_id}, type: ${response.type})`);
            
            // Special logging for exact matches
            if (response.label === 'Handoff Date' || response.label === 'Handoff Time') {
              console.log(`🎯 EXACT MATCH - ${response.label}: "${response.value}" (entry_id: ${response.entry_id})`);
            }
            
            handoffData.handoffFields.push({
              label: response.label,
              value: response.value,
              entry_id: response.entry_id,
              type: response.type,
              index: index
            });
          }
          
          // Look for time/date fields
          if (response.type === 'Time' || response.type === 'Date' || response.type === 'DateTime' || 
              (response.label && (response.label.toLowerCase().includes('time') || 
                                 response.label.toLowerCase().includes('date')))) {
            console.log(`⏰ Found time field: "${response.label}" = "${response.value}" (type: ${response.type}, entry_id: ${response.entry_id})`);
            handoffData.timeFields.push({
              label: response.label,
              value: response.value,
              entry_id: response.entry_id,
              type: response.type,
              index: index
            });
          }
          
          // Look for workflow-related fields
          if (response.label && (
            response.label.toLowerCase().includes('workflow') ||
            response.label.toLowerCase().includes('state') ||
            response.label.toLowerCase().includes('status') ||
            response.label.toLowerCase().includes('check in') ||
            response.label.toLowerCase().includes('checkin')
          )) {
            console.log(`🔄 Found workflow field: "${response.label}" = "${response.value}" (entry_id: ${response.entry_id})`);
            handoffData.workflowFields.push({
              label: response.label,
              value: response.value,
              entry_id: response.entry_id,
              type: response.type,
              index: index
            });
          }
        });
      }

      // Look for workflow-related data in top-level fields
      const workflowTopLevelFields = ['workflow_states', 'workflow_history', 'handoffs', 'transitions', 'workflow', 'states', 'workflow_data'];
      workflowTopLevelFields.forEach(field => {
        if (targetSubmission[field]) {
          console.log(`🔄 Found top-level workflow field '${field}':`, JSON.stringify(targetSubmission[field], null, 2));
          handoffData.workflowFields.push({
            label: field,
            value: targetSubmission[field],
            entry_id: null,
            type: 'top_level',
            index: null
          });
        }
      });

      console.log('\n=== SEARCHING FOR EXACT FIELD NAMES ===');
      
      // Search for exact field matches
      const exactHandoffDate = targetSubmission.responses?.find((r: any) => r.label === 'Handoff Date');
      const exactHandoffTime = targetSubmission.responses?.find((r: any) => r.label === 'Handoff Time');
      
      if (exactHandoffDate) {
        console.log(`🎯 FOUND EXACT "Handoff Date": "${exactHandoffDate.value}" (entry_id: ${exactHandoffDate.entry_id})`);
        handoffData.handoffFields.push({
          label: exactHandoffDate.label,
          value: exactHandoffDate.value,
          entry_id: exactHandoffDate.entry_id,
          type: exactHandoffDate.type,
          index: 'exact_match'
        });
      } else {
        console.log('❌ "Handoff Date" field not found');
      }
      
      if (exactHandoffTime) {
        console.log(`🎯 FOUND EXACT "Handoff Time": "${exactHandoffTime.value}" (entry_id: ${exactHandoffTime.entry_id})`);
        handoffData.handoffFields.push({
          label: exactHandoffTime.label,
          value: exactHandoffTime.value,
          entry_id: exactHandoffTime.entry_id,
          type: exactHandoffTime.type,
          index: 'exact_match'
        });
      } else {
        console.log('❌ "Handoff Time" field not found');
      }
      
      // Search for GPS field and add to handoffFields
      const exactGpsField = targetSubmission.responses?.find((r: any) => r.label === 'New GPS');
      
      if (exactGpsField) {
        console.log(`📍 FOUND GPS FIELD: "${exactGpsField.label}" = "${exactGpsField.value}" (type: ${exactGpsField.type}, entry_id: ${exactGpsField.entry_id})`);
        handoffData.handoffFields.push({
          label: exactGpsField.label,
          value: exactGpsField.value,
          entry_id: exactGpsField.entry_id,
          type: exactGpsField.type,
          index: 'exact_match'
        });
      } else {
        console.log('📍 "New GPS" field not found - checking by entry_id...');
        const gpsById = targetSubmission.responses?.find((r: any) => r.entry_id === 714491454);
        if (gpsById) {
          console.log(`📍 FOUND GPS BY ID: "${gpsById.label}" = "${gpsById.value}" (type: ${gpsById.type}, entry_id: ${gpsById.entry_id})`);
          handoffData.handoffFields.push({
            label: gpsById.label,
            value: gpsById.value,
            entry_id: gpsById.entry_id,
            type: gpsById.type,
            index: 'by_entry_id'
          });
        } else {
          console.log('❌ GPS field not found by label or entry_id');
        }
      }
      
      // Log first 50 field labels to see what's available
      console.log('\n=== FIRST 50 FIELD LABELS ===');
      if (targetSubmission.responses && Array.isArray(targetSubmission.responses)) {
        targetSubmission.responses.slice(0, 50).forEach((response: any, index: number) => {
          console.log(`${index}: "${response.label}"`);
        });
        
        // Also return all field labels in the response for easier inspection
        handoffData.allFieldLabels = targetSubmission.responses.map((r: any) => r.label);
      }
      
      console.log('\n=== HANDOFF DATA SUMMARY ===');
      console.log(`Found ${handoffData.handoffFields.length} handoff-related fields`);
      console.log(`Found ${handoffData.timeFields.length} time-related fields`);
      console.log(`Found ${handoffData.workflowFields.length} workflow-related fields`);
      console.log(`Total responses examined: ${targetSubmission.responses?.length || 0}`);
      
      return handoffData;
      
    } catch (error) {
      console.error('Error fetching handoff time data:', error);
      return null;
    }
  }

  async checkSubmissionStatus(jobId: string): Promise<{status: 'pending' | 'completed' | 'in_progress', submittedAt?: string, submissionId?: string}> {
    return this.checkSubmissionStatusForForm(jobId, this.formId!);
  }

  /**
   * Check submission status for a specific form
   */
  async checkSubmissionStatusForForm(jobId: string, formId: string): Promise<{status: 'pending' | 'completed' | 'in_progress', submittedAt?: string, submissionId?: string}> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, returning mock status');
      return {status: 'pending'};
    }

    try {
      // Query ALL submissions for the specific form
      console.log(`Searching for job ${jobId} in form ${formId} submissions...`);
      const response = await rawGoCanvasRequest(`/submissions?form_id=${formId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to check submission status: ${response.status}`);
        return {status: 'pending'};
      }

      const data = await response.json();
      console.log(`API returned ${JSON.stringify(data).length} characters of JSON data`);
      
      const submissions = Array.isArray(data) ? data : (data.submissions || data.data || []);
      
      if (submissions.length === 0) {
        console.log('No submissions found for form');
        return {status: 'pending'};
      }

      console.log(`Found ${submissions.length} submissions for form ${formId}`);
      
      // Search for submission containing our Job ID
      let targetSubmission = null;
      
      for (const submission of submissions) {
        if (submission.status === 'completed') {
          // Get detailed submission data to check for Job ID match
          try {
            const detailResponse = await rawGoCanvasRequest(`/submissions/${submission.id}`, {
              headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json',
              },
            });
            
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              
              // Search through form fields for our Job ID
              if (detailData.responses) {
                const jobIdField = detailData.responses.find((field: any) => 
                  field.value === jobId && 
                  field.label?.toLowerCase().includes('job')
                );
                
                if (jobIdField) {
                  console.log(`🎯 Found submission with matching Job ID: ${jobId} in form ${formId}`);
                  targetSubmission = submission;
                  break;
                }
              }
            }
          } catch (err) {
            console.log(`Error checking submission ${submission.id}:`, err);
          }
        }
      }
      
      if (targetSubmission) {
        console.log(`🎯 Found target submission! Status: ${targetSubmission.status}, Keys: ${Object.keys(targetSubmission).join(', ')}`);
        
        // Use GoCanvas created_at as the submission timestamp
        console.log(`✅ Target submission is COMPLETED! Submission ID: ${targetSubmission.id}, Submission time: ${targetSubmission.created_at}`);
        return {status: 'completed', submittedAt: targetSubmission.created_at, submissionId: targetSubmission.id};
      }

      console.log(`Target submission not found in ${submissions.length} submissions`);
      return {status: 'pending'};
      
    } catch (error) {
      console.error('Error checking submission status:', error);
      return {status: 'pending'};
    }
  }

  private mapJobDataToFormResponses(jobData: any): any[] {
    console.log('🔍 Starting field mapping process using FieldMapper...');
    
    // Use the FieldMapper to get all fields
    const allFields = fieldMapper.getAllFields();
    console.log('Loaded', allFields.length, 'fields from FieldMapper');
    
    // Create label-to-ID mapping
    const fieldMap: any = {};
    allFields.forEach(field => {
      fieldMap[field.label] = field.id;
    });
    
    // Log if any Job ID-related field exists
    const jobIdFields = allFields.filter(field => 
      field.label.toLowerCase().includes('job') || 
      (field.label.toLowerCase().includes('id') && !field.label.toLowerCase().includes('user id'))
    );
    if (jobIdFields.length > 0) {
      console.log('Found potential ID fields:', jobIdFields.map(f => f.label));
    }

    const responses = [];
    
    console.log('Debug: Received job data for mapping:');
    console.log(`  - shopName: "${jobData.shopName}"`);  
    console.log(`  - customerShipTo: "${jobData.customerShipTo}"`);
    console.log(`  - permissionDeniedStop: "${jobData.permissionDeniedStop}"`);
    
    // Map common ECS fields to GoCanvas form fields based on discovered field map
    const mappings = [
      // Job ID - This is the generated ECS job ID we want to pass to GoCanvas
      { data: jobData.jobId, labels: ['Job ID', 'ECS Job ID', 'Job Id', 'Job Number'] },
      // Exact field mappings based on GoCanvas form structure
      { data: jobData.p21OrderNumber, labels: ['P21 Order Number (Enter after invoicing)'] },
      { data: jobData.userId, labels: ['User ID'] },
      { data: jobData.permissionToStart, labels: ['Permission to Start'] },
      { data: jobData.permissionDeniedStop, labels: ['Permission Denied Stop'] },
      { data: jobData.shopName, labels: ['Shop Name'] },
      { data: jobData.customerName, labels: ['Customer Name'] },
      { data: jobData.customerShipTo, labels: ['Customer Ship To'] },
      { data: jobData.p21ShipToId, labels: ['P21 Ship to ID'] },
      { data: jobData.customerSpecificInstructions, labels: ['Customer Specific Instructions?'] },
      { data: jobData.sendClampsGaskets, labels: ['Send Clamps & Gaskets?'] },
      { data: jobData.preferredProcess, labels: ['Preferred Process?'] },
      { data: jobData.anyOtherSpecificInstructions, labels: ['Any Other Specific Instructions?'] },
      { data: jobData.anyCommentsForTech, labels: ['Any comments for the tech about this submission?'] },
      { data: jobData.noteToTechAboutCustomer, labels: ['Note to Tech about Customer or service:'] },
      { data: jobData.contactName, labels: ['Contact Name'] },
      { data: jobData.contactNumber, labels: ['Contact Number'] },
      { data: jobData.poNumber, labels: ['PO Number (Check In)', 'PO Number'] },
      { data: jobData.serialNumbers, labels: ['Serial Number(s)'] },
      { data: jobData.techCustomerQuestionInquiry, labels: ['Tech Customer Question Inquiry'] },
      { data: jobData.shopHandoff, labels: ['Shop Handoff'] },
      { data: jobData.handoffEmailWorkflow, labels: ['Handoff Email workflow'] },
    ];

    for (const mapping of mappings) {
      if (mapping.data !== undefined && mapping.data !== null) {
        for (const label of mapping.labels) {
          const entryId = fieldMap[label];
          if (entryId) {
            const value = mapping.data || "N/A"; // Use "N/A" for empty strings
            console.log(`Mapping found: ${label} -> ${entryId} = "${value}"`);
            responses.push({
              entry_id: entryId,
              value: String(value)
            });
            break; // Use first matching field
          }
        }
      }
    }
    
    console.log(`Initial mapping created ${responses.length} responses`);

    // Ensure we have at least one response with valid field IDs from the current form
    if (responses.length === 0) {
      console.warn('No responses mapped, adding minimum required field from current form');
      // Add Job ID as minimum required field using current form's field map
      const jobIdFieldId = fieldMap['Job ID'];
      if (jobIdFieldId) {
        responses.push({
          entry_id: jobIdFieldId,
          value: jobData.jobId || "ECS-UNKNOWN"
        });
      }
    }

    console.log(`Created ${responses.length} form responses with required fields`);
    console.log('Final response summary:');
    responses.forEach(r => {
      const fieldName = Object.entries(fieldMap).find(([label, id]) => id === r.entry_id)?.[0] || `Field ${r.entry_id}`;
      console.log(`  - ${fieldName}: "${r.value}"`);
      
      // Special logging for PO Number
      if (r.entry_id === 714302736) {
        console.log(`🔍 PO NUMBER DEBUGGING:`);
        console.log(`   Field ID: ${r.entry_id}`);
        console.log(`   Value: "${r.value}"`);
        console.log(`   Value type: ${typeof r.value}`);
        console.log(`   Value length: ${r.value?.length || 0}`);
      }
    });
    return responses;
  }

  private async mapPartsToLoopScreenResponses(parts: any[]): Promise<any[]> {
    console.log(`🔧 Mapping ${parts.length} parts to loop screen responses...`);
    
    // Loop screen field IDs - matching actual Parts Log loop screen fields
    const PARTS_FIELD_IDS = {
      part: '728953416',           // Part (sets row title)
      process: '728953403',        // Process Being Performed
      ecsPartNumber: '728953405',  // ECS Part Number (visible in loop)
      filterPn: '728953404',       // Filter Part Number
      partDescription: '728953406', // Part Description
    };
    
    const loopResponses: any[] = [];
    
    // Each part gets its own multi_key (e.g., "part_0", "part_1", "part_2")
    parts.forEach((part, index) => {
      const multiKey = `part_${index}`;
      
      // Add each field for this part with the same multi_key
      // Only include fields that are actually in the Parts Log loop screen
      if (part.part) {
        loopResponses.push({
          entry_id: PARTS_FIELD_IDS.part,
          value: String(part.part),
          multi_key: multiKey,
        });
      }
      
      if (part.process) {
        loopResponses.push({
          entry_id: PARTS_FIELD_IDS.process,
          value: String(part.process),
          multi_key: multiKey,
        });
      }
      
      if (part.ecsSerial) {
        loopResponses.push({
          entry_id: PARTS_FIELD_IDS.ecsPartNumber,
          value: String(part.ecsSerial),
          multi_key: multiKey,
        });
      }
      
      if (part.filterPn) {
        loopResponses.push({
          entry_id: PARTS_FIELD_IDS.filterPn,
          value: String(part.filterPn),
          multi_key: multiKey,
        });
      }
      
      // Part Description - combine multiple fields if available
      const description = [
        part.partDescription,
        part.poNumber && `PO: ${part.poNumber}`,
        part.mileage && `Mileage: ${part.mileage}`,
        part.unitVin && `VIN: ${part.unitVin}`,
      ].filter(Boolean).join(' | ');
      
      if (description) {
        loopResponses.push({
          entry_id: PARTS_FIELD_IDS.partDescription,
          value: description,
          multi_key: multiKey,
        });
      }
      
      console.log(`  Part ${index + 1}: Added ${loopResponses.filter(r => r.multi_key === multiKey).length} fields with multi_key="${multiKey}"`);
    });
    
    console.log(`✅ Generated ${loopResponses.length} loop screen responses for ${parts.length} parts`);
    return loopResponses;
  }


  // Note: loadDynamicFieldMap() function removed - now using FieldMapper singleton

  // NEW: Get revision history to find workflow timestamps
  async getSubmissionRevisions(submissionId: string): Promise<any> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, skipping revision history');
      return null;
    }

    try {
      console.log(`\n🕒 FETCHING REVISION HISTORY FOR SUBMISSION: ${submissionId}`);
      
      const response = await rawGoCanvasRequest(`/submissions/${submissionId}/revisions`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`❌ Revision history failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const revisions = await response.json();
      console.log(`✅ Found ${revisions.length || 0} revisions`);
      console.log('📋 REVISION HISTORY:', JSON.stringify(revisions, null, 2));

      // Look for workflow-related revisions
      const workflowRevisions = revisions?.filter((rev: any) => {
        return rev.entry_id && (
          rev.value?.toLowerCase().includes('handoff') ||
          rev.value?.toLowerCase().includes('hand off') ||
          rev.value?.toLowerCase().includes('workflow') ||
          rev.value?.toLowerCase().includes('check') ||
          rev.value?.toLowerCase().includes('submission')
        );
      }) || [];

      console.log(`🔄 Found ${workflowRevisions.length} potential workflow revisions:`, workflowRevisions);

      return {
        total_revisions: revisions?.length || 0,
        all_revisions: revisions,
        workflow_revisions: workflowRevisions
      };

    } catch (error) {
      console.error('Exception getting revision history:', error.message);
      return null;
    }
  }

}

export const goCanvasService = new GoCanvasService();