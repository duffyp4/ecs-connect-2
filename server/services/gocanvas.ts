interface GoCanvasConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

interface GoCanvasToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface GoCanvasSubmission {
  id: string;
  form_id: string;
  status: string;
  created_at: string;
  responses: Array<{
    entry_id: string;
    value: string;
  }>;
}

export class GoCanvasService {
  private config: GoCanvasConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      clientId: process.env.GOCANVAS_CLIENT_ID || process.env.GOCANVAS_CLIENT_ID_ENV_VAR || "default_client_id",
      clientSecret: process.env.GOCANVAS_CLIENT_SECRET || process.env.GOCANVAS_CLIENT_SECRET_ENV_VAR || "default_client_secret",
      baseUrl: "https://api.gocanvas.com/api/v3",
    };
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`GoCanvas authentication failed: ${response.statusText}`);
      }

      const tokenData: GoCanvasToken = await response.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 minute buffer

      return this.accessToken;
    } catch (error) {
      console.error('GoCanvas authentication error:', error);
      throw new Error('Failed to authenticate with GoCanvas API');
    }
  }

  async createSubmission(formId: string, jobData: any): Promise<string> {
    const token = await this.authenticate();
    
    const submissionData = {
      guid: jobData.jobId,
      form: { id: formId },
      responses: this.mapJobDataToResponses(jobData),
      department_id: process.env.GOCANVAS_DEPARTMENT_ID,
      user_id: await this.getTechnicianUserId(jobData.shopHandoff),
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/submissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GoCanvas submission failed: ${response.statusText} - ${errorText}`);
      }

      const submission = await response.json();
      return submission.id;
    } catch (error) {
      console.error('GoCanvas submission error:', error);
      throw new Error('Failed to create GoCanvas submission');
    }
  }

  async getSubmission(submissionId: string): Promise<GoCanvasSubmission | null> {
    const token = await this.authenticate();

    try {
      const response = await fetch(`${this.config.baseUrl}/submissions/${submissionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get submission: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('GoCanvas get submission error:', error);
      return null;
    }
  }

  async checkSubmissionStatus(submissionId: string): Promise<string | null> {
    const submission = await this.getSubmission(submissionId);
    return submission?.status || null;
  }

  private mapJobDataToResponses(jobData: any): Array<{ entry_id: string; value: string }> {
    // Map job data fields to GoCanvas form entry IDs
    // These would need to be configured based on the actual GoCanvas form structure
    const fieldMapping = {
      jobId: "job_id_entry",
      trailerId: "trailer_id_entry",
      storeName: "store_name_entry",
      customerName: "customer_name_entry",
      contactName: "contact_name_entry",
      contactNumber: "contact_number_entry",
      shopHandoff: "technician_entry",
      // Add more mappings as needed
    };

    const responses: Array<{ entry_id: string; value: string }> = [];

    for (const [field, entryId] of Object.entries(fieldMapping)) {
      if (jobData[field]) {
        responses.push({
          entry_id: entryId,
          value: jobData[field].toString(),
        });
      }
    }

    return responses;
  }

  private async getTechnicianUserId(email: string): Promise<string | undefined> {
    // In a real implementation, this would lookup the GoCanvas user ID for the technician email
    // For now, return undefined to assign to default department
    return undefined;
  }
}

export const goCanvasService = new GoCanvasService();
