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
  getDrivers(): Promise<string[]>;
  getDriverDetails(): Promise<{ name: string; email: string }[]>;
  getLocations(): Promise<string[]>;
  getParts(): Promise<string[]>;
  getProcesses(): Promise<string[]>;
  getFilterPartNumbers(): Promise<string[]>;
}

class GoCanvasReferenceDataService implements ReferenceDataService {
  private shopData: any[] = [];
  private customerData: any[] = [];
  private driversData: any[] = [];
  private locationsData: any[] = [];
  private partsData: any[] = [];
  private processData: any[] = [];
  private filterPartNumbersData: any[] = [];
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
      
      // Load Drivers (ID: 343087)
      const driversResponse = await goCanvasService.getReferenceDataById('343087');
      this.driversData = driversResponse.rows || [];
      
      // Load ECS Locations - Drivers (ID: 947586)
      const locationsResponse = await goCanvasService.getReferenceDataById('947586');
      this.locationsData = locationsResponse.rows || [];
      
      // Load Parts (ID: 246465)
      const partsResponse = await goCanvasService.getReferenceDataById('246465');
      this.partsData = partsResponse.rows || [];
      
      // Load Process (ID: 176530)
      const processResponse = await goCanvasService.getReferenceDataById('176530');
      this.processData = processResponse.rows || [];
      
      // Load Emission_pn_w kits (ID: 452576)
      const filterPartNumbersResponse = await goCanvasService.getReferenceDataById('452576');
      this.filterPartNumbersData = filterPartNumbersResponse.rows || [];
      
      this.lastFetched = now;
      console.log(`Loaded ${this.shopData.length} shop records, ${this.customerData.length} customer records, ${this.driversData.length} driver records, ${this.locationsData.length} location records, ${this.partsData.length} parts records, ${this.processData.length} process records, and ${this.filterPartNumbersData.length} filter part number records`);
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

  async getAllShops(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Get all unique shop names from column 1 (Shop)
    const shops = Array.from(new Set(this.shopData.map(row => row[1]).filter(Boolean)));
    return shops.sort();
  }

  async getUsersForShop(shopName: string): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Find all users for the given shop name
    const users = this.shopData
      .filter(row => row[1] === shopName) // Shop name is column 1
      .map(row => row[0]) // User ID is column 0
      .filter(Boolean);
    
    return Array.from(new Set(users)).sort();
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
      'Corp Name',
      'Customer ID', 
      'Customer Name',
      'Ship2 Add1',
      'Ship2 City', 
      'Ship to Combined',
      'Ship2 ID',
      'Ship2 Contact',
      'Specific Instructions For This Customer?',
      'Default Service', 
      'Send Clamps/Gaskets?',
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

  async getCustomerRecord(customerName: string) {
    await this.ensureDataLoaded();
    
    // Find all records for this customer
    const customerRecords = this.customerData.filter(row => row[2] === customerName);
    
    if (customerRecords.length === 0) {
      return { error: `Customer "${customerName}" not found` };
    }
    
    const columnHeaders = [
      'Corp Name',
      'Customer ID', 
      'Customer Name',
      'Ship2 Add1',
      'Ship2 City', 
      'Ship to Combined',
      'Ship2 ID',
      'Ship2 Contact',
      'Specific Instructions For This Customer?',
      'Default Service', 
      'Send Clamps/Gaskets?',
      'Customer Notes'
    ];
    
    return {
      customerName,
      totalRecords: customerRecords.length,
      records: customerRecords.map((row, index) => ({
        recordIndex: index,
        data: row.map((value, colIndex) => ({
          column: colIndex,
          header: columnHeaders[colIndex] || `Column ${colIndex}`,
          value: value || '[EMPTY]',
          isEmpty: !value || value === '',
          isNA: value === '#N/A',
          isValid: this.isValidValue(value)
        }))
      }))
    };
  }

  async getCustomerSpecificData(customerName: string, shipToAddress?: string) {
    await this.ensureDataLoaded();
    
    // Find the specific customer record that matches both name and ship-to address
    let customerRow;
    if (shipToAddress) {
      // Try to find exact match with ship-to address (column 5: "Ship to Combined")
      customerRow = this.customerData.find(row => 
        row[2] === customerName && row[5] && row[5].includes(shipToAddress.split(' (')[0])
      );
    }
    
    // Fallback to any record for the customer if no ship-to match found
    if (!customerRow) {
      customerRow = this.customerData.find(row => row[2] === customerName);
    }
    
    if (!customerRow) {
      return {
        preferredProcess: '',
        sendClampsGaskets: '',
        customerNotes: '',
        ship2Contact: ''
      };
    }
    
    return {
      preferredProcess: customerRow[9] || '',  // Column 9: Default Service
      sendClampsGaskets: customerRow[10] || '', // Column 10: Send Clamps/Gaskets?
      customerNotes: customerRow[11] || '',     // Column 11: Customer Notes
      ship2Contact: customerRow[7] || ''        // Column 7: Ship2 Contact
    };
  }

  private isValidValue(value: any): boolean {
    if (!value) return false;
    const str = String(value).trim().toUpperCase();
    return !['#N/A', 'N/A', 'NA', ''].includes(str);
  }

  async getCustomerSpecificInstructions(customerName: string, shipToAddress?: string): Promise<string> {
    await this.ensureDataLoaded();
    
    // Find the specific customer record that matches both name and ship-to address
    let customerRow;
    if (shipToAddress) {
      // Try to find exact match with ship-to address (column 5: "Ship to Combined")
      customerRow = this.customerData.find(row => 
        row[2] === customerName && row[5] && row[5].includes(shipToAddress.split(' (')[0])
      );
    }
    
    // Fallback to any record for the customer if no ship-to match found
    if (!customerRow) {
      customerRow = this.customerData.find(row => row[2] === customerName);
    }
    
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

  async getDrivers(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract driver names from column 0 of drivers reference data (ID: 343087)
    const drivers = Array.from(new Set(this.driversData
      .map(row => row[0])
      .filter(value => this.isValidValue(value))
    ));
    
    return drivers.sort();
  }

  async getDriverDetails(): Promise<{ name: string; email: string }[]> {
    await this.ensureDataLoaded();
    
    // Return driver name and email from columns 0 and 2 of drivers reference data (ID: 343087)
    // Structure: [Driver Name, Shop, Email]
    const driverDetails = this.driversData
      .map(row => ({
        name: row[0],
        email: row[2] || ''
      }))
      .filter(driver => this.isValidValue(driver.name));
    
    return driverDetails;
  }

  async getLocations(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract location names from column 0 of ECS Locations reference data (ID: 947586)
    const locations = Array.from(new Set(this.locationsData
      .map(row => row[0])
      .filter(value => this.isValidValue(value))
    ));
    
    return locations.sort();
  }

  async getParts(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract part names from column 0 of Parts reference data (ID: 246465)
    const parts = Array.from(new Set(this.partsData
      .map(row => row[0])
      .filter(value => this.isValidValue(value))
    ));
    
    return parts.sort();
  }

  async getProcesses(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract process names from column 0 of Process reference data (ID: 176530)
    const processes = Array.from(new Set(this.processData
      .map(row => row[0])
      .filter(value => this.isValidValue(value))
    ));
    
    return processes.sort();
  }

  async getFilterPartNumbers(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract OE PN from column 0 of Emission_pn_w kits reference data (ID: 452576)
    const filterPartNumbers = Array.from(new Set(this.filterPartNumbersData
      .map(row => row[0])
      .filter(value => this.isValidValue(value))
    ));
    
    return filterPartNumbers.sort();
  }
}

export const referenceDataService = new GoCanvasReferenceDataService();