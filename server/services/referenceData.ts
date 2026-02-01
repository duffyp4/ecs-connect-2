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
  private technicianData: any[] = [];
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
      
      // Load ECS Team CSRs (ID: 1017141) - for Shop Name dropdown
      // Columns: [Name(0), Location(1), Dispatch Email(2), Handoff Email(3), Permission to Start(4)]
      const shopsResponse = await goCanvasService.getReferenceDataById('1017141');
      this.shopData = shopsResponse.rows || [];
      
      // Load ECS Team Technicians (ID: 1017142) - for Shop Handoff dropdown
      // Columns: [Name(0), Location(1), Dispatch Email(2), Handoff Email(3), Permission to Start(4)]
      const techniciansResponse = await goCanvasService.getReferenceDataById('1017142');
      this.technicianData = techniciansResponse.rows || [];
      
      // Load Customer List (ID: 1017125) - for Customer Name, Ship To, etc.
      // Columns: [User Group(0), Corp Name(1), Customer ID(2), Customer Name(3), Ship2 Add1(4), 
      //           Ship2 City(5), Ship2 ID(6), Ship to Combined(7), Ship2 Contact(8),
      //           Specific Instructions(9), Default Service(10), Send Clamps/Gaskets(11), Customer Notes(12)]
      const customersResponse = await goCanvasService.getReferenceDataById('1017125');
      this.customerData = customersResponse.rows || [];
      
      // Load Drivers (ID: 343087)
      const driversResponse = await goCanvasService.getReferenceDataById('343087');
      this.driversData = driversResponse.rows || [];
      
      // Load ECS Locations (ID: 1017140) - for Pickup/Delivery Shop Name and Driver dropdowns
      // Columns: [Name(0), Location(1), Dispatch Email(2), ...]
      const locationsResponse = await goCanvasService.getReferenceDataById('1017140');
      this.locationsData = locationsResponse.rows || [];
      
      // Load Parts (ID: 246465)
      const partsResponse = await goCanvasService.getReferenceDataById('246465');
      this.partsData = partsResponse.rows || [];
      
      // Load Process (ID: 176530)
      const processResponse = await goCanvasService.getReferenceDataById('176530');
      this.processData = processResponse.rows || [];
      
      // Load ECS PN Cross Reference w/ Clamps & Gaskets (ID: 1031258) - replaces old 452576
      const filterPartNumbersResponse = await goCanvasService.getReferenceDataById('1031258');
      this.filterPartNumbersData = filterPartNumbersResponse.rows || [];
      
      this.lastFetched = now;
      console.log(`Loaded ${this.shopData.length} shop records, ${this.technicianData.length} technician records, ${this.customerData.length} customer records, ${this.driversData.length} driver records, ${this.locationsData.length} location records, ${this.partsData.length} parts records, ${this.processData.length} process records, and ${this.filterPartNumbersData.length} filter part number records`);
    } catch (error) {
      console.error('Failed to load reference data:', error);
      throw error;
    }
  }

  async getShopUsers(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // User ID uses CSR dispatch emails from 1017141 (column 2: Dispatch Email)
    const emails = Array.from(new Set(this.shopData.map(row => row[2]).filter(Boolean)));
    return emails.sort();
  }

  async getTechnicianEmails(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Shop Handoff uses technician dispatch emails from 1017142 (column 2: Dispatch Email)
    const emails = Array.from(new Set(this.technicianData.map(row => row[2]).filter(Boolean)));
    return emails.sort();
  }

  async getShopsForUser(userId: string): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Find all shops/locations for the given user by Dispatch Email (column 2: Dispatch Email, column 1: Location)
    const shops = this.shopData
      .filter(row => row[2] === userId) // Dispatch Email is column 2
      .map(row => row[1]) // Location is column 1
      .filter(Boolean);
    
    return Array.from(new Set(shops)).sort();
  }

  async getAllShops(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Get all unique shop names from column 1 (Location) from 1017141
    const shops = Array.from(new Set(this.shopData.map(row => row[1]).filter(Boolean)));
    return shops.sort();
  }

  async getUsersForShop(shopName: string): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Shop Handoff: Find all technician dispatch emails for the given shop (column 1: Location, column 2: Dispatch Email) from 1017142
    const users = this.technicianData
      .filter(row => row[1] === shopName) // Location is column 1
      .map(row => row[2]) // Dispatch Email is column 2
      .filter(Boolean);
    
    return Array.from(new Set(users)).sort();
  }

  async getPermissionForUser(userId: string): Promise<string> {
    await this.ensureDataLoaded();
    
    // Find permission for user by Dispatch Email (column 2), return column 4: "Permission to Start" from 1017141
    const shopRow = this.shopData.find(row => row[2] === userId);
    return shopRow ? shopRow[4] || '' : '';
  }

  async getCustomerNames(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract unique Customer Names (column 1: Corp Name) from 1017125
    const customerNames = Array.from(new Set(this.customerData.map(row => row[1]).filter(Boolean)));
    return customerNames.sort();
  }

  async getShipToForCustomer(customerName: string): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Find all Ship To options for the customer (column 7: "Ship to Combined") from 1017125
    const shipToOptions = this.customerData
      .filter(row => row[1] === customerName) // Corp Name is column 1
      .map(row => row[7]) // "Ship to Combined" is column 7
      .filter(Boolean);
    
    return Array.from(new Set(shipToOptions)).sort();
  }

  async getP21ShipToIdForCustomer(customerName: string, shipTo: string): Promise<string> {
    await this.ensureDataLoaded();
    
    // Find P21 Ship to ID for specific customer and ship to (column 6: "Ship2 ID") from 1017125
    const customerRow = this.customerData.find(row => 
      row[1] === customerName && row[7] === shipTo // Corp Name is col 1, Ship to Combined is col 7
    );
    
    return customerRow ? customerRow[6] || '' : '';
  }

  async getShip2IdsForCustomerShipTo(customerName: string, shipTo: string): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Find all Ship2 IDs for specific customer and ship to (column 6: "Ship2 ID") from 1017125
    const ship2Ids = this.customerData
      .filter(row => row[1] === customerName && row[7] === shipTo) // Corp Name col 1, Ship to Combined col 7
      .map(row => row[6]) // "Ship2 ID" is column 6
      .filter(Boolean);
    
    return Array.from(new Set(ship2Ids)).sort();
  }

  async getCustomerInstructions(customerName: string): Promise<string> {
    await this.ensureDataLoaded();
    
    // Find specific instructions for customer (column 9: "Specific Instructions For This Customer?") from 1017125
    const customerRow = this.customerData.find(row => row[1] === customerName); // Corp Name is column 1
    return customerRow ? customerRow[9] || '' : '';
  }

  async getTechComments(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract unique values from Customer Notes (column 12) from 1017125
    const comments = Array.from(new Set(this.customerData
      .map(row => row[12])
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
        col9: Array.from(new Set(this.customerData.map(row => row[9]).filter(v => this.isValidValue(v)))),
        col10: Array.from(new Set(this.customerData.map(row => row[10]).filter(v => this.isValidValue(v)))),
        col11: Array.from(new Set(this.customerData.map(row => row[11]).filter(v => this.isValidValue(v)))),
        col12: Array.from(new Set(this.customerData.map(row => row[12]).filter(v => this.isValidValue(v))))
      }
    };
  }

  async getColumn12Data() {
    await this.ensureDataLoaded();
    
    // Get all unique values from column 12 (Customer Notes) with their frequency
    const col12Values = this.customerData.map(row => row[12]);
    const validValues = col12Values.filter(v => this.isValidValue(v));
    const uniqueValues = Array.from(new Set(validValues));
    
    // Count occurrences of each value
    const valueCounts = uniqueValues.map(value => ({
      value,
      count: validValues.filter(v => v === value).length
    })).sort((a, b) => b.count - a.count);
    
    return {
      totalRows: col12Values.length,
      validValues: validValues.length,
      uniqueValues: uniqueValues.length,
      values: uniqueValues.slice(0, 20), // First 20 unique values
      valueCounts: valueCounts.slice(0, 10), // Top 10 most frequent values
      sampleData: this.customerData
        .filter(row => this.isValidValue(row[12]))
        .slice(0, 5)
        .map(row => ({
          customerName: row[1], // Corp Name is column 1
          column12Value: row[12]
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
    
    // Updated column headers for 1017125
    const columnHeaders = [
      'User Group',
      'Corp Name',
      'Customer ID', 
      'Customer Name',
      'Ship2 Add1',
      'Ship2 City', 
      'Ship2 ID',
      'Ship to Combined',
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
    
    // Find all records for this customer (column 1: Corp Name)
    const customerRecords = this.customerData.filter(row => row[1] === customerName);
    
    if (customerRecords.length === 0) {
      return { error: `Customer "${customerName}" not found` };
    }
    
    // Updated column headers for 1017125
    const columnHeaders = [
      'User Group',
      'Corp Name',
      'Customer ID', 
      'Customer Name',
      'Ship2 Add1',
      'Ship2 City', 
      'Ship2 ID',
      'Ship to Combined',
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
      // Try to find exact match with ship-to address (column 7: "Ship to Combined")
      customerRow = this.customerData.find(row => 
        row[1] === customerName && row[7] && row[7].includes(shipToAddress.split(' (')[0])
      );
    }
    
    // Fallback to any record for the customer if no ship-to match found
    if (!customerRow) {
      customerRow = this.customerData.find(row => row[1] === customerName);
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
      preferredProcess: customerRow[10] || '',  // Column 10: Default Service
      sendClampsGaskets: customerRow[11] || '', // Column 11: Send Clamps/Gaskets?
      customerNotes: customerRow[12] || '',     // Column 12: Customer Notes
      ship2Contact: customerRow[8] || ''        // Column 8: Ship2 Contact
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
      // Try to find exact match with ship-to address (column 7: "Ship to Combined")
      customerRow = this.customerData.find(row => 
        row[1] === customerName && row[7] && row[7].includes(shipToAddress.split(' (')[0])
      );
    }
    
    // Fallback to any record for the customer if no ship-to match found
    if (!customerRow) {
      customerRow = this.customerData.find(row => row[1] === customerName);
    }
    
    const instructions = customerRow ? customerRow[9] || '' : ''; // Column 9: Specific Instructions
    return this.isValidValue(instructions) ? instructions : '';
  }

  async getSendClampsGaskets(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Column 11 is "Send Clamps/Gaskets?" in 1017125
    const options = Array.from(new Set(this.customerData
      .map(row => row[11])
      .filter(value => this.isValidValue(value))
    ));
    
    return options.sort();
  }

  async getPreferredProcesses(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Column 10 is "Default Service" in 1017125
    const processes = Array.from(new Set(this.customerData
      .map(row => row[10])
      .filter(value => this.isValidValue(value))
    ));
    
    return processes.sort();
  }

  async getCustomerNotes(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Column 12 is "Customer Notes" in 1017125
    const notes = Array.from(new Set(this.customerData
      .map(row => row[12])
      .filter(value => this.isValidValue(value))
    ));
    
    return notes.sort();
  }

  async getDrivers(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract driver names from column 0 (Name) of reference data (ID: 1017140)
    const drivers = Array.from(new Set(this.locationsData
      .map(row => row[0])
      .filter(value => this.isValidValue(value))
    ));
    
    return drivers.sort();
  }

  async getDriverDetails(): Promise<{ name: string; email: string }[]> {
    await this.ensureDataLoaded();
    
    // Return driver name and email from reference data (ID: 1017140)
    // Column 0: Name, Column 2: Dispatch Email
    const driverDetails = this.locationsData
      .map(row => ({
        name: row[0],
        email: row[2] || ''
      }))
      .filter(driver => this.isValidValue(driver.name));
    
    return driverDetails;
  }

  async getDriversForShop(shopName: string): Promise<{ name: string; email: string }[]> {
    await this.ensureDataLoaded();
    
    // Return drivers filtered by shop name from reference data (ID: 1017140)
    // Column 0: Name, Column 1: Location (shop), Column 2: Dispatch Email
    const driverDetails = this.locationsData
      .filter(row => row[1] === shopName) // Filter by Location (column 1)
      .map(row => ({
        name: row[0],
        email: row[2] || ''
      }))
      .filter(driver => this.isValidValue(driver.name));
    
    return driverDetails;
  }

  async getLocations(): Promise<string[]> {
    await this.ensureDataLoaded();
    
    // Extract location names from column 1 (Location) of ECS Locations reference data (ID: 1017140)
    const locations = Array.from(new Set(this.locationsData
      .map(row => row[1])
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
    
    // Extract Other MFG Part # from column 1 of ECS PN Cross Reference (ID: 1031258)
    // Column 0 = ECS Part #, Column 1 = Other MFG Part # (used for Filter Part Number lookup)
    const filterPartNumbers = Array.from(new Set(this.filterPartNumbersData
      .map(row => row[1])
      .filter(value => this.isValidValue(value))
    ));
    
    return filterPartNumbers.sort();
  }
}

export const referenceDataService = new GoCanvasReferenceDataService();