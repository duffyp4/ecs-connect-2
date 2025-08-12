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

  async createDispatch(jobData: any): Promise<string> {
    if (!this.username || !this.password || !this.formId) {
      console.log('GoCanvas not configured, skipping dispatch creation');
      return 'mock-dispatch-id';
    }

    try {
      // For now, create dispatch without pre-populated responses
      // The technician will fill out the form manually in GoCanvas
      const dispatchData = {
        dispatch_type: 'immediate_dispatch',
        form_id: parseInt(this.formId),
        name: `ECS Job: ${jobData.jobId}`,
        description: `Job for ${jobData.customerName} at ${jobData.storeName}. Contact: ${jobData.contactNumber}. Trailer: ${jobData.trailerId || 'N/A'}`,
        send_notification: true,
        // responses: [], // Omit responses for now - technician will fill manually
      };

      console.log('Creating dispatch with data:', dispatchData);
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
        throw new Error(`Failed to create dispatch: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Dispatch created successfully:', result.id);
      return result.id;
    } catch (error) {
      console.error('Failed to create GoCanvas dispatch:', error);
      throw error;
    }
  }

  async checkDispatchStatus(dispatchId: string): Promise<'pending' | 'completed' | 'in_progress'> {
    if (!this.username || !this.password) {
      console.log('GoCanvas not configured, returning mock status');
      return 'pending';
    }

    try {
      const response = await fetch(`${this.baseUrl}/dispatches/${dispatchId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to check dispatch status: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const dispatch = await response.json();
      
      // Map GoCanvas status to our internal status
      switch (dispatch.status) {
        case 'assigned':
        case 'unassigned':
          return 'pending';
        case 'received':
          return 'in_progress';
        case 'submitted':
          return 'completed';
        default:
          return 'pending';
      }
    } catch (error) {
      console.error('Failed to check dispatch status:', error);
      return 'pending';
    }
  }

  private mapJobDataToFormResponses(jobData: any): any[] {
    // Map key job data to form responses with generic entry IDs
    // These would need to be mapped to actual form entry IDs from the GoCanvas form structure
    const responses = [];
    
    if (jobData.jobId) {
      responses.push({
        entry_id: "job_id_field",
        value: jobData.jobId
      });
    }
    
    if (jobData.customerName) {
      responses.push({
        entry_id: "customer_name_field", 
        value: jobData.customerName
      });
    }
    
    if (jobData.storeName) {
      responses.push({
        entry_id: "store_name_field",
        value: jobData.storeName
      });
    }
    
    if (jobData.contactNumber) {
      responses.push({
        entry_id: "contact_number_field",
        value: jobData.contactNumber
      });
    }
    
    if (jobData.trailerId) {
      responses.push({
        entry_id: "trailer_id_field",
        value: jobData.trailerId
      });
    }
    
    // Always include at least one field to satisfy GoCanvas requirements
    if (responses.length === 0) {
      responses.push({
        entry_id: "notes_field",
        value: `ECS Job: ${jobData.jobId} - Auto-dispatched from ECS system`
      });
    }
    
    return responses;
  }
}

export const goCanvasService = new GoCanvasService();