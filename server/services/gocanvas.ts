// GoCanvas API integration service
export class GoCanvasService {
  private baseUrl = 'https://api.gocanvas.com/api/v3';
  private username: string;
  private password: string;
  private formId?: string;

  constructor() {
    this.username = process.env.GOCANVAS_USERNAME || '';
    this.password = process.env.GOCANVAS_PASSWORD || '';
    this.formId = '5568544'; // Testing Copy form with Job ID field
    
    if (!this.username || !this.password) {
      console.warn('GoCanvas credentials not configured. Using mock mode.');
    }
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async listForms(): Promise<any[]> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, returning empty forms list');
      return [];
    }

    try {
      console.log('Fetching forms from GoCanvas...');
      const response = await fetch(`${this.baseUrl}/forms`, {
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
      const response = await fetch(`${this.baseUrl}/forms/${formId}?format=flat`, {
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
      const response = await fetch(`${this.baseUrl}/reference_data`, {
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
      const response = await fetch(`${this.baseUrl}/reference_data/${id}`, {
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



  async createSubmission(jobData: any): Promise<string> {
    console.log('=== GOCANVAS createDispatch called ===');
    console.log('Raw jobData keys:', Object.keys(jobData));
    console.log('shopName value:', jobData.shopName);
    console.log('customerShipTo value:', jobData.customerShipTo);
    console.log('=======================================');
    
    if (!this.username || !this.password || !this.formId) {
      console.log('GoCanvas not configured, skipping dispatch creation');
      return 'skip-no-config';
    }

    try {
      const responses = this.mapJobDataToFormResponses(jobData);
      
      // Create dispatch instead of direct submission (more reliable approach)
      const dispatchData = {
        dispatch_type: 'immediate_dispatch',
        form_id: parseInt(this.formId),
        name: `ECS Job: ${jobData.jobId}`,
        description: `Job for ${jobData.customerName} - ${jobData.shopName}`,
        responses: responses,
        send_notification: false // Don't send notification for automated dispatches
      };

      console.log('Creating GoCanvas dispatch:', { 
        jobId: jobData.jobId,
        formId: this.formId,
        responseCount: responses.length,
        dispatchType: 'immediate_dispatch'
      });
      
      // Log if Job ID mapping was found
      const jobIdMapping = responses.find(response => response.value === jobData.jobId);
      if (jobIdMapping) {
        console.log(`✅ Job ID ${jobData.jobId} mapped to GoCanvas field entry_id: ${jobIdMapping.entry_id}`);
      } else {
        console.log(`⚠️ Job ID ${jobData.jobId} not yet mapped to GoCanvas field - field may need to be added to GoCanvas form`);
      }

      const response = await fetch(`${this.baseUrl}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dispatchData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GoCanvas API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText,
          dispatchData: JSON.stringify(dispatchData, null, 2)
        });
        throw new Error(`Failed to create dispatch: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('GoCanvas dispatch created successfully:', result.id || result.guid);
      return result.id || result.guid || jobData.jobId;
    } catch (error) {
      console.error('Failed to create GoCanvas dispatch:', error);
      throw error;
    }
  }

  async checkSubmissionStatus(jobId: string): Promise<'pending' | 'completed' | 'in_progress'> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, returning mock status');
      return 'pending';
    }

    try {
      // Query submissions by guid (our job ID) and form_id
      const response = await fetch(`${this.baseUrl}/submissions?guid=${jobId}&form_id=${this.formId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to check submission status: ${response.status}`);
        return 'pending';
      }

      const data = await response.json();
      const submissions = data.submissions || data.data || [];
      
      if (submissions.length === 0) {
        return 'pending';
      }

      const submission = submissions[0];
      
      // Map GoCanvas submission status to our status
      if (submission.status === 'completed' || submission.completed_at) {
        return 'completed';
      } else if (submission.status === 'in_progress' || submission.started_at) {
        return 'in_progress';
      } else {
        return 'pending';
      }
    } catch (error) {
      console.error('Error checking submission status:', error);
      return 'pending';
    }
  }

  private mapJobDataToFormResponses(jobData: any): any[] {
    // Load field mappings from the generated field map
    let fieldMap: any = {};
    try {
      // Skip dynamic loading for now and use hard-coded field map approach
      console.log('Loading field mappings...');
      fieldMap = this.getHardCodedFieldMap();
      console.log('Created field map with', Object.keys(fieldMap).length, 'entries');
      
      // Log if any Job ID-related field exists
      const jobIdFields = Object.keys(fieldMap).filter(label => 
        label.toLowerCase().includes('job') || 
        (label.toLowerCase().includes('id') && !label.toLowerCase().includes('user id'))
      );
      if (jobIdFields.length > 0) {
        console.log('Found potential ID fields:', jobIdFields);
      }
    } catch (error) {
      console.error('Failed to load field map, using fallback mapping:', error);
      return this.getFallbackResponses(jobData);
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
      { data: jobData.poNumber, labels: ['PO Number'] },
      { data: jobData.serialNumbers, labels: ['Serial Number(s)'] },
      { data: jobData.techCustomerQuestionInquiry, labels: ['Tech Customer Question Inquiry'] },
      { data: jobData.checkInDate, labels: ['Check In Date'] },
      { data: jobData.checkInTime, labels: ['Check In Time'] },
      { data: jobData.shopHandoff, labels: ['Shop Handoff'] },
      { data: jobData.handoffEmailWorkflow, labels: ['Handoff Email workflow'] },
    ];

    for (const mapping of mappings) {
      if (mapping.data) {
        for (const label of mapping.labels) {
          const entryId = fieldMap[label];
          if (entryId) {
            console.log(`Mapping found: ${label} -> ${entryId} = "${mapping.data}"`);
            responses.push({
              entry_id: entryId,
              value: String(mapping.data)
            });
            break; // Use first matching field
          }
        }
      }
    }
    
    console.log(`Initial mapping created ${responses.length} responses`);
    
    // Add essential fields that might be missing from main mapping
    const essentialFields = [
      { id: 712668557, data: jobData.jobId, default: "ECS-UNKNOWN", label: "Job ID" },
      { id: 712668558, data: jobData.userId, default: "system@ecspart.com", label: "User ID" },
      { id: 712668560, data: jobData.permissionDeniedStop, default: "No", label: "Permission Denied Stop" },
      { id: 712668561, data: jobData.shopName, default: "Unknown", label: "Shop Name" },
      { id: 712668562, data: jobData.customerName, default: "Unknown Customer", label: "Customer Name" },
      { id: 712668564, data: jobData.customerShipTo, default: "N/A", label: "Customer Ship To" },
      { id: 712668582, data: "New Submission", default: "New Submission", label: "Submission Status" }
    ];

    // Add missing essential fields
    for (const essential of essentialFields) {
      const existing = responses.find(r => r.entry_id === essential.id);
      if (!existing && essential.data) {
        console.log(`Adding essential field ${essential.label}: "${essential.data}"`);
        responses.push({
          entry_id: essential.id,
          value: essential.data
        });
      }
    }

    // Ensure we have at least one response - never use fallback as it contains old form IDs
    if (responses.length === 0) {
      console.warn('No responses mapped, but avoiding fallback to prevent form ID conflicts');
      // Add minimum required fields for Testing Copy form
      responses.push({
        entry_id: 712668557,
        value: jobData.jobId || "ECS-UNKNOWN"
      });
      responses.push({
        entry_id: 712668582,
        value: "New Submission"
      });
    }

    console.log(`Created ${responses.length} form responses with required fields`);
    console.log('Final response summary:');
    responses.forEach(r => {
      const fieldName = Object.entries(this.getHardCodedFieldMap()).find(([label, id]) => id === r.entry_id)?.[0] || `Unknown field ${r.entry_id}`;
      console.log(`  - ${fieldName}: "${r.value}"`);
    });
    return responses;
  }

  private getFallbackResponses(jobData: any): any[] {
    // Enhanced fallback using known field IDs with actual form data
    const responses = [];
    
    console.log('Using enhanced fallback with actual form data:');
    console.log(`  - shopName: "${jobData.shopName}"`);
    console.log(`  - customerShipTo: "${jobData.customerShipTo}"`);
    
    // Add Job ID if available (will use once the field appears in GoCanvas)
    if (jobData.jobId) {
      console.log(`Job ID ${jobData.jobId} available for GoCanvas but field mapping not yet found`);
    }
    
    // Add ALL required fields with ACTUAL form data - no generic defaults
    
    // Job ID (NEW - required) - USE ACTUAL ECS JOB ID
    responses.push({
      entry_id: 712668557,
      value: jobData.jobId || "ECS-UNKNOWN"
    });
    
    // User ID (required)
    responses.push({
      entry_id: 712668558,
      value: jobData.userId || "system@ecspart.com"
    });
    
    // Permission Denied Stop (required)
    responses.push({
      entry_id: 712668560,
      value: jobData.permissionDeniedStop || "No"
    });
    
    // Shop Name (required) - USE ACTUAL DATA
    responses.push({
      entry_id: 712668561,
      value: jobData.shopName || "Unknown"
    });
    
    // Customer Name (required) - USE ACTUAL DATA
    responses.push({
      entry_id: 712668562,
      value: jobData.customerName || "Unknown Customer"
    });
    
    // Customer Ship To (required) - USE ACTUAL DATA
    responses.push({
      entry_id: 712668564,
      value: jobData.customerShipTo || "N/A"
    });
    
    // Contact Name (required) - USE ACTUAL DATA
    responses.push({
      entry_id: 712668572,
      value: jobData.contactName || "Unknown Contact"
    });
    
    // Contact Number (required) - USE ACTUAL DATA
    responses.push({
      entry_id: 712668573,
      value: jobData.contactNumber || "000-000-0000"
    });
    
    // PO Number (required) - USE ACTUAL DATA
    responses.push({
      entry_id: 712668574,
      value: jobData.poNumber || "N/A"
    });
    
    // Serial Numbers (required) - USE ACTUAL DATA
    responses.push({
      entry_id: 712668575,
      value: jobData.serialNumbers || "N/A"
    });
    
    // Check In Date (often required) - USE ACTUAL DATA
    if (jobData.checkInDate) {
      responses.push({
        entry_id: 712668577,
        value: jobData.checkInDate
      });
    }
    
    // Check In Time (often required) - USE ACTUAL DATA
    if (jobData.checkInTime) {
      responses.push({
        entry_id: 712668578,
        value: jobData.checkInTime
      });
    }
    
    // Shop Handoff (required) - USE ACTUAL DATA
    responses.push({
      entry_id: 712668580,
      value: jobData.shopHandoff || "system@ecspart.com"
    });
    
    // Submission Status (required)
    responses.push({
      entry_id: 712668582,
      value: "New Submission"
    });
    
    console.log(`Created ${responses.length} enhanced fallback responses for required fields`);
    console.log('Enhanced fallback field summary:');
    responses.forEach(r => {
      const fieldName = Object.entries(this.getHardCodedFieldMap()).find(([label, id]) => id === r.entry_id)?.[0] || `Unknown field ${r.entry_id}`;
      console.log(`  - ${fieldName}: "${r.value}"`);
    });
    
    return responses;
  }

  private getHardCodedFieldMap(): any {
    // Hard-coded field mapping based on Testing Copy form (5568544) field IDs
    return {
      'P21 Order Number (Enter after invoicing)': 712668556,
      'Job ID': 712668557, // ✅ NEW: Job ID field now available!
      'User ID': 712668558,
      'Permission to Start': 712668559,
      'Permission Denied Stop': 712668560,
      'Shop Name': 712668561,
      'Customer Name': 712668562,
      'Customer Ship To': 712668564,
      'P21 Ship to ID': 712668565,
      'Customer Specific Instructions?': 712668566,
      'Send Clamps & Gaskets?': 712668567,
      'Preferred Process?': 712668568,
      'Any Other Specific Instructions?': 712668569,
      'Any comments for the tech about this submission?': 712668570,
      'Note to Tech about Customer or service:': 712668571,
      'Contact Name': 712668572,
      'Contact Number': 712668573,
      'PO Number': 712668574,
      'Serial Number(s)': 712668575,
      'Tech Customer Question Inquiry': 712668576,
      'Check In Date': 712668577,
      'Check In Time': 712668578,
      'Shop Handoff': 712668580,
      'Handoff Email workflow': 712668581,
      'Submission Status': 712668582,
      // Alternative Job ID labels
      'ECS Job ID': 712668557,
      'Job Number': 712668557
    };
  }
}

export const goCanvasService = new GoCanvasService();