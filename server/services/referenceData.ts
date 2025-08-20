// Reference Data service for processing GoCanvas reference sheets
import { goCanvasService } from './gocanvas';

export interface ReferenceDataService {
  getShopUsers(): Promise<string[]>;
  getShopsForUser(userId: string): Promise<string[]>;
  getPermissionForUser(userId: string): Promise<string>;
  getCustomerNames(): Promise<string[]>;
  getShipToForCustomer(customerName: string): Promise<string[]>;
  getP21ShipToIdForCustomer(customerName: string, shipTo: string): Promise<string>;
  getCustomerInstructions(customerName: string): Promise<string>;
  getTechComments(): Promise<string[]>;
}

class GoCanvasReferenceDataService implements ReferenceDataService {
  private shopData: any[] = [];
  private customerData: any[] = [];
  private lastFetched: number = 0;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  private async ensureDataLoaded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastFetched < this.cacheExpiry && this.shopData.length > 0) {
      return; // Data still fresh
    }

    try {
      console.log('Loading reference data from GoCanvas...');
      
      // Load Workflow Shops (ID: 608300)
      const shopsResponse = await goCanvasService.getReferenceDataById('608300');
      this.shopData = shopsResponse.rows || [];
      
      // Load Workflow Customer Name (ID: 608480)
      const customersResponse = await goCanvasService.getReferenceDataById('608480');
      this.customerData = customersResponse.rows || [];
      
      this.lastFetched = now;
      console.log(`Loaded ${this.shopData.length} shop records and ${this.customerData.length} customer records`);
    } catch (error) {
      console.error('Failed to load reference data:', error);
      throw error;
    }
  }

  async getShopUsers(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract unique Shop User IDs (column 0)
    const userIds = Array.from(new Set(this.shopData.map(row => row[0]).filter(Boolean)));
    return userIds.sort();
  }

  async getShopsForUser(userId: string): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Find all shops for the given user ID
    const shops = this.shopData
      .filter(row => row[0] === userId)
      .map(row => row[1]) // Shop name is column 1
      .filter(Boolean);
    
    return Array.from(new Set(shops)).sort();
  }

  async getPermissionForUser(userId: string): Promise<string> {
    await this.ensureDataLoaded();
    
    // Find permission for user (column 3: "Permission to Start")
    const shopRow = this.shopData.find(row => row[0] === userId);
    return shopRow ? shopRow[3] || '' : '';
  }

  async getCustomerNames(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract unique Customer Names (column 2)
    const customerNames = Array.from(new Set(this.customerData.map(row => row[2]).filter(Boolean)));
    return customerNames.sort();
  }

  async getShipToForCustomer(customerName: string): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Find all Ship To options for the customer (column 5: "Ship to Combined")
    const shipToOptions = this.customerData
      .filter(row => row[2] === customerName)
      .map(row => row[5]) // "Ship to Combined" column
      .filter(Boolean);
    
    return Array.from(new Set(shipToOptions)).sort();
  }

  async getP21ShipToIdForCustomer(customerName: string, shipTo: string): Promise<string> {
    await this.ensureDataLoaded();
    
    // Find P21 Ship to ID for specific customer and ship to (column 6: "Ship2 ID")
    const customerRow = this.customerData.find(row => 
      row[2] === customerName && row[5] === shipTo
    );
    
    return customerRow ? customerRow[6] || '' : '';
  }

  async getShip2IdsForCustomerShipTo(customerName: string, shipTo: string): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Find all Ship2 IDs for specific customer and ship to (column 6: "Ship2 ID")
    const ship2Ids = this.customerData
      .filter(row => row[2] === customerName && row[5] === shipTo)
      .map(row => row[6]) // "Ship2 ID" column
      .filter(Boolean);
    
    return Array.from(new Set(ship2Ids)).sort();
  }

  async getCustomerInstructions(customerName: string): Promise<string> {
    await this.ensureDataLoaded();
    
    // Find specific instructions for customer (column 8: "Specific Instructions For This Customer?")
    const customerRow = this.customerData.find(row => row[2] === customerName);
    return customerRow ? customerRow[8] || '' : '';
  }

  async getTechComments(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract unique values from Customer Notes (column 11)
    const comments = Array.from(new Set(this.customerData
      .map(row => row[11])
      .filter(Boolean)
      .filter(comment => comment !== '#N/A' && comment.trim() !== '')
    ));
    
    return comments.sort();
  }

  async getSendClampsGaskets(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract unique values from Send Clamps/Gaskets column (column 7)
    const options = Array.from(new Set(this.customerData
      .map(row => row[7])
      .filter(Boolean)
      .filter(option => option !== '#N/A' && option.trim() !== '')
    ));
    
    return options.sort();
  }

  async getPreferredProcesses(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract unique values from Default Service column (column 9)
    const processes = Array.from(new Set(this.customerData
      .map(row => row[9])
      .filter(Boolean)
      .filter(process => process !== '#N/A' && process.trim() !== '')
    ));
    
    return processes.sort();
  }
}

export const referenceDataService = new GoCanvasReferenceDataService();