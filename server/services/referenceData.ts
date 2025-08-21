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
      .filter(value => this.isValidValue(value))
    ));
    
    return comments.sort();
  }

  async getDebugColumnData() {
    await this.ensureDataLoaded();
    
    // Find rows with actual data (not all #N/A)
    const sampleRows = this.customerData
      .filter(row => row.some(cell => cell && cell !== '#N/A'))
      .slice(0, 5);
    
    return {
      sampleRows,
      columns: {
        col7: Array.from(new Set(this.customerData.map(row => row[7]).filter(v => this.isValidValue(v)))),
        col8: Array.from(new Set(this.customerData.map(row => row[8]).filter(v => this.isValidValue(v)))),
        col9: Array.from(new Set(this.customerData.map(row => row[9]).filter(v => this.isValidValue(v)))),
        col10: Array.from(new Set(this.customerData.map(row => row[10]).filter(v => this.isValidValue(v)))),
        col11: Array.from(new Set(this.customerData.map(row => row[11]).filter(v => this.isValidValue(v))))
      }
    };
  }

  async getColumn11Data() {
    await this.ensureDataLoaded();
    
    // Get all unique values from column 11 with their frequency
    const col11Values = this.customerData.map(row => row[11]);
    const validValues = col11Values.filter(v => this.isValidValue(v));
    const uniqueValues = Array.from(new Set(validValues));
    
    // Count occurrences of each value
    const valueCounts = uniqueValues.map(value => ({
      value,
      count: validValues.filter(v => v === value).length
    })).sort((a, b) => b.count - a.count);
    
    return {
      totalRows: col11Values.length,
      validValues: validValues.length,
      uniqueValues: uniqueValues.length,
      values: uniqueValues.slice(0, 20), // First 20 unique values
      valueCounts: valueCounts.slice(0, 10), // Top 10 most frequent values
      sampleData: this.customerData
        .filter(row => this.isValidValue(row[11]))
        .slice(0, 5)
        .map(row => ({
          customerName: row[2],
          column11Value: row[11]
        }))
    };
  }

  async getRow1Data() {
    await this.ensureDataLoaded();
    
    // Get the first row (index 0)
    const firstRow = this.customerData[0];
    
    if (!firstRow) {
      return { error: "No data found" };
    }
    
    const columnHeaders = [
      'Workflow Shop',
      'Shop ID', 
      'Customer Name',
      'Ship To Address',
      'Ship To City', 
      'Ship To Full Address',
      'Ship2 ID',
      'Column 7',
      'Send Clamps & Gaskets',
      'Preferred Process', 
      'Column 10',
      'Customer Notes'
    ];
    
    return {
      rowIndex: 0,
      totalColumns: firstRow.length,
      columns: firstRow.map((value, index) => ({
        columnIndex: index,
        columnName: columnHeaders[index] || `Column ${index}`,
        value: value || '[EMPTY]',
        isEmpty: !value || value === '',
        isNA: value === '#N/A'
      }))
    };
  }

  private isValidValue(value: any): boolean {
    if (!value) return false;
    const str = String(value).trim().toUpperCase();
    return !['#N/A', 'N/A', 'NA', ''].includes(str);
  }

  async getCustomerSpecificInstructions(customerName: string): Promise<string> {
    await this.ensureDataLoaded();
    
    // Find specific instructions for customer (column 8: "Specific Instructions For This Customer?")
    const customerRow = this.customerData.find(row => row[2] === customerName);
    const instructions = customerRow ? customerRow[8] || '' : '';
    return this.isValidValue(instructions) ? instructions : '';
  }

  async getSendClampsGaskets(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // CONFIRMED: Column 10 is "Send Clamps/Gaskets?" per your screenshot
    // Values: Test clamp gaskets, Yes (plus blanks and #N/A that get filtered out)
    const options = Array.from(new Set(this.customerData
      .map(row => row[10])
      .filter(value => this.isValidValue(value))
    ));
    
    return options.sort();
  }

  async getPreferredProcesses(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // CORRECTED: Column 9 contains "Default Service" values per screenshot  
    const processes = Array.from(new Set(this.customerData
      .map(row => row[9])
      .filter(value => this.isValidValue(value))
    ));
    
    return processes.sort();
  }

  async getCustomerNotes(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Customer Notes should be from column 11 based on field mapping
    const notes = Array.from(new Set(this.customerData
      .map(row => row[11])
      .filter(value => this.isValidValue(value))
    ));
    
    return notes.sort();
  }
}

export const referenceDataService = new GoCanvasReferenceDataService();