// GoCanvas API integration service
export class GoCanvasService {
  private baseUrl = 'https://api.gocanvas.com/api/v3';
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

      const response = await fetch(`${this.baseUrl}/submissions`, {
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
      const fs = eval('require')('fs');
      const path = eval('require')('path');
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
      { data: jobData.jobId, labels: ['Job ID', 'Job Number', 'ECS Job ID', 'Job Reference'] },
      { data: jobData.customerName, labels: ['Customer Name', 'Customer', 'Client Name', 'Account Name'] },
      { data: jobData.storeName, labels: ['Store Name', 'Shop Name', 'Location', 'Store Location'] },
      { data: jobData.contactNumber, labels: ['Contact Number', 'Phone Number', 'Phone', 'Contact Phone'] },
      { data: jobData.contactName, labels: ['Contact Name', 'Contact Person', 'Primary Contact'] },
      { data: jobData.trailerId, labels: ['Trailer ID', 'Trailer Number', 'Trailer #', 'Unit ID'] },
      { data: jobData.checkInDate, labels: ['Check In Date', 'Date', 'Service Date', 'Scheduled Date'] },
      { data: jobData.checkInTime, labels: ['Check In Time', 'Time', 'Service Time', 'Scheduled Time'] },
      // Shop handoff field - include central technician email for workflow handoff
      { data: jobData.shopHandoff, labels: ['Technician', 'Tech', 'Assigned Tech', 'Shop Handoff', 'Technician Email'] },
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