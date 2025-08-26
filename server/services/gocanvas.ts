// GoCanvas API integration service
export class GoCanvasService {
  private baseUrl = 'https://api.gocanvas.com/api/v3';
  private username: string;
  private password: string;
  private formId?: string;

  constructor() {
    this.username = process.env.GOCANVAS_USERNAME || '';
    this.password = process.env.GOCANVAS_PASSWORD || '';
    this.formId = '5577421'; // Testing Copy form with Job ID field
    
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

  async getUserId(email: string): Promise<number | null> {
    if (!this.username || !this.password) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/users`, {
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
        form_version: 'latest', // Use latest version of the form
        name: `ECS Job: ${jobData.jobId}`,
        description: `Job for ${jobData.customerName} - ${jobData.shopName}`,
        responses: responses,
        send_notification: true // Send notification so technician sees the dispatch
      };

      // Add assignee if found
      if (assigneeId) {
        dispatchData.assignee_id = assigneeId;
      }

      console.log('Creating GoCanvas dispatch:', { 
        jobId: jobData.jobId,
        formId: this.formId,
        responseCount: responses.length,
        dispatchType: 'immediate_dispatch',
        assigneeId: assigneeId,
        assignedTo: assigneeId ? jobData.shopHandoff : 'unassigned'
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

  async getSubmissionById(submissionId: string): Promise<any> {
    try {
      console.log(`=== FETCHING GOCANVAS SUBMISSION: ${submissionId} ===`);
      
      // Get detailed submission data by ID
      const detailResponse = await fetch(`${this.baseUrl}/submissions/${submissionId}`, {
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

  async getMostRecentSubmission(): Promise<any> {
    try {
      console.log('=== FETCHING MOST RECENT GOCANVAS SUBMISSION ===');
      console.log('Form ID:', this.formId);
      console.log('Username configured:', !!this.username);
      
      // First, get list of submissions for the form
      const listResponse = await fetch(`${this.baseUrl}/submissions?form_id=${this.formId}`, {
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
      const detailResponse = await fetch(`${this.baseUrl}/submissions/${mostRecent.id}`, {
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
      
      // Look for workflow-related data
      const workflowFields = ['workflow_states', 'workflow_history', 'handoffs', 'transitions', 'workflow', 'states', 'workflow_data'];
      workflowFields.forEach(field => {
        if (detailData[field]) {
          console.log(`Found ${field}:`, JSON.stringify(detailData[field], null, 2));
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

  async checkSubmissionStatus(jobId: string): Promise<{status: 'pending' | 'completed' | 'in_progress', submittedAt?: string}> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, returning mock status');
      return {status: 'pending'};
    }

    try {

      // Fallback: Query ALL submissions for the form
      console.log(`Searching for job ${jobId} in all form submissions...`);
      const response = await fetch(`${this.baseUrl}/submissions?form_id=${this.formId}`, {
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

      console.log(`Found ${submissions.length} submissions`);
      
      // Search for submission containing our Job ID
      let targetSubmission = null;
      
      for (const submission of submissions) {
        if (submission.status === 'completed') {
          // Get detailed submission data to check for Job ID match
          try {
            const detailResponse = await fetch(`${this.baseUrl}/submissions/${submission.id}`, {
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
                  (field.label?.toLowerCase().includes('job') || field.entry_id === 712668557)
                );
                
                if (jobIdField) {
                  console.log(`🎯 Found submission with matching Job ID: ${jobId}`);
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
        console.log(`✅ Target submission is COMPLETED! Submission time: ${targetSubmission.created_at}`);
        return {status: 'completed', submittedAt: targetSubmission.created_at};
      }

      console.log(`Target submission not found in ${submissions.length} submissions`);
      return {status: 'pending'};
      
    } catch (error) {
      console.error('Error checking submission status:', error);
      return {status: 'pending'};
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
      { id: 714287494, data: jobData.jobId, default: "ECS-UNKNOWN", label: "Job ID" },
      { id: 714287495, data: jobData.userId, default: "system@ecspart.com", label: "User ID" },
      { id: 714287497, data: jobData.permissionDeniedStop, default: "No", label: "Permission Denied Stop" },
      { id: 714287498, data: jobData.shopName, default: "Unknown", label: "Shop Name" },
      { id: 714287499, data: jobData.customerName, default: "Unknown Customer", label: "Customer Name" },
      { id: 714287501, data: jobData.customerShipTo, default: "N/A", label: "Customer Ship To" },
      { id: 714287519, data: "New Submission", default: "New Submission", label: "Submission Status" }
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

    // Ensure we have at least one response
    if (responses.length === 0) {
      console.warn('No responses mapped, adding minimum required fields');
      // Add minimum required fields for form 5577421
      responses.push({
        entry_id: 714287494,
        value: jobData.jobId || "ECS-UNKNOWN"
      });
      responses.push({
        entry_id: 714287519,
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


  private getHardCodedFieldMap(): any {
    // Hard-coded field mapping based on form 5577421 field IDs
    return {
      'P21 Order Number (Enter after invoicing)': 714287493,
      'Job ID': 714287494, // ✅ Job ID field for form 5577421
      'User ID': 714287495,
      'Permission to Start': 714287496,
      'Permission Denied Stop': 714287497,
      'Shop Name': 714287498,
      'Customer Name': 714287499,
      'Customer Ship To': 714287501,
      'P21 Ship to ID': 714287502,
      'Customer Specific Instructions?': 714287503,
      'Send Clamps & Gaskets?': 714287504,
      'Preferred Process?': 714287505,
      'Any Other Specific Instructions?': 714287506,
      'Any comments for the tech about this submission?': 714287507,
      'Note to Tech about Customer or service:': 714287508,
      'Contact Name': 714287509,
      'Contact Number': 714287510,
      'PO Number': 714287532,
      'Serial Number(s)': 714287512,
      'Tech Customer Question Inquiry': 714287513,
      'Shop Handoff': 714287517,
      'Handoff Email workflow': 714287518,
      'Submission Status': 714287519,
      // Alternative Job ID labels
      'ECS Job ID': 714287494,
      'Job Number': 714287494
    };
  }
}

export const goCanvasService = new GoCanvasService();