// GoCanvas API integration service
export class GoCanvasService {
  private baseUrl = 'https://www.gocanvas.com/apiv2';
  private username: string;
  private password: string;
  private formId?: string;

  constructor() {
    this.username = process.env.GOCANVAS_USERNAME || '';
    this.password = process.env.GOCANVAS_PASSWORD || '';
    this.formId = process.env.GOCANVAS_FORM_ID;
    
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
      console.log('Fetching forms from GoCanvas API v2...');
      const response = await fetch(`${this.baseUrl}/forms.json`, {
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
      const response = await fetch(`${this.baseUrl}/forms/${formId}.json?format=flat`, {
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

  async getReferenceData(): Promise<any> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, cannot fetch reference data');
      return null;
    }

    try {
      console.log('Fetching reference data from GoCanvas API v2...');
      
      // Try different potential endpoints for reference data
      const endpoints = [
        '/reference_data.json',
        '/reference_sheets.json', 
        '/forms/reference_data.json',
        `/forms/${this.formId}/reference_data.json`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
              'Authorization': this.getAuthHeader(),
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`Reference data found at ${endpoint}:`, data);
            return data;
          } else {
            console.log(`Endpoint ${endpoint} returned ${response.status}`);
          }
        } catch (err) {
          console.log(`Endpoint ${endpoint} failed:`, err instanceof Error ? err.message : 'Unknown error');
        }
      }

      console.log('No reference data endpoints found');
      return null;
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
      return null;
    }
  }

  async createSubmission(jobData: any): Promise<string> {
    if (!this.username || !this.password || !this.formId) {
      console.log('GoCanvas not configured, skipping submission creation');
      return 'skip-no-config';
    }

    try {
      const responses = this.mapJobDataToFormResponses(jobData);
      const submissionData = {
        guid: jobData.jobId, // Use Job ID as correlation key
        form: { id: parseInt(this.formId) },
        responses: responses,
      };

      console.log('Creating GoCanvas submission:', { 
        jobId: jobData.jobId,
        formId: this.formId,
        responseCount: responses.length,
        responses: responses
      });

      const response = await fetch(`${this.baseUrl}/submissions.json`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create submission: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('GoCanvas submission created successfully:', result.id || result.guid);
      return result.id || result.guid || jobData.jobId;
    } catch (error) {
      console.error('Failed to create GoCanvas submission:', error);
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
      const response = await fetch(`${this.baseUrl}/submissions.json?guid=${jobId}&form_id=${this.formId}`, {
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
      const fs = require('fs');
      const path = require('path');
      const mapPath = path.join(process.cwd(), 'gocanvas_field_map.json');
      const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      fieldMap = mapData.labelToIdMap || {};
    } catch (error) {
      console.error('Failed to load field map, using fallback mapping:', error);
      return this.getFallbackResponses(jobData);
    }

    const responses = [];
    
    // Map common ECS fields to GoCanvas form fields based on discovered field map
    const mappings = [
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
            responses.push({
              entry_id: entryId,
              value: String(mapping.data)
            });
            break; // Use first matching field
          }
        }
      }
    }

    // Ensure we have at least one response
    if (responses.length === 0) {
      return this.getFallbackResponses(jobData);
    }

    return responses;
  }

  private getFallbackResponses(jobData: any): any[] {
    // Fallback using known field IDs from the discovered form structure
    const responses = [];
    
    // Use User ID field (required field from form) as fallback
    responses.push({
      entry_id: 708148223, // "User ID" field that is required
      value: `ECS-${jobData.jobId}`
    });

    return responses;
  }
}

export const goCanvasService = new GoCanvasService();