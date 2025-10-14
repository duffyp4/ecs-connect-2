// GPS coordinate to timezone conversion service

interface TimezoneInfo {
  timezoneId: string;
  timezoneName: string;
  utcOffsetSeconds: number;
  dstOffsetSeconds: number;
}

interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export class TimezoneService {
  
  /**
   * Parse GPS coordinates from GoCanvas format
   * Format: "Lat:41.908566,Lon:-87.677826,Acc:6.550611,Alt:190.527401,Bear:-1.000000,Speed:-1.000000,Time:1756312898.246060"
   */
  parseGPSCoordinates(gpsString: string): GPSCoordinates | null {
    try {
      console.log(`🗺️ Parsing GPS string: "${gpsString}"`);
      
      // Extract values using regex patterns
      const latMatch = gpsString.match(/Lat:([-]?\d+\.?\d*)/);
      const lonMatch = gpsString.match(/Lon:([-]?\d+\.?\d*)/);
      const accMatch = gpsString.match(/Acc:([-]?\d+\.?\d*)/);
      const timeMatch = gpsString.match(/Time:([-]?\d+\.?\d*)/);
      
      if (!latMatch || !lonMatch) {
        console.error('❌ Could not extract latitude/longitude from GPS string');
        return null;
      }
      
      const coordinates: GPSCoordinates = {
        latitude: parseFloat(latMatch[1]),
        longitude: parseFloat(lonMatch[1]),
        accuracy: accMatch ? parseFloat(accMatch[1]) : 0,
        timestamp: timeMatch ? parseFloat(timeMatch[1]) : Date.now() / 1000
      };
      
      console.log(`✅ Parsed GPS coordinates:`, coordinates);
      return coordinates;
      
    } catch (error) {
      console.error('❌ Error parsing GPS coordinates:', error);
      return null;
    }
  }
  
  /**
   * Convert GPS coordinates to timezone information using TimeZone API
   * Using free TimeZoneDB API as fallback to Google's API
   */
  async getTimezoneFromCoordinates(coordinates: GPSCoordinates): Promise<TimezoneInfo | null> {
    try {
      console.log(`🌍 Getting timezone for coordinates: ${coordinates.latitude}, ${coordinates.longitude}`);
      
      // Try TimeZoneDB API (free, no API key required for basic usage)
      const url = `https://api.timezonedb.com/v2.1/get-time-zone?key=demo&format=json&by=position&lat=${coordinates.latitude}&lng=${coordinates.longitude}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`❌ TimeZone API request failed: ${response.status} ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      
      if (data.status !== 'OK') {
        console.error(`❌ TimeZone API error: ${data.message || 'Unknown error'}`);
        return null;
      }
      
      const timezoneInfo: TimezoneInfo = {
        timezoneId: data.zoneName || data.abbreviation || 'UTC',
        timezoneName: data.zoneName || data.abbreviation || 'UTC',
        utcOffsetSeconds: data.gmtOffset || 0,
        dstOffsetSeconds: 0 // TimeZoneDB includes DST in gmtOffset
      };
      
      console.log(`✅ Retrieved timezone info:`, timezoneInfo);
      return timezoneInfo;
      
    } catch (error) {
      console.error('❌ Error getting timezone from coordinates:', error);
      return null;
    }
  }
  
  /**
   * Convert local time to UTC using timezone information
   */
  convertLocalTimeToUTC(localDateTime: Date, timezoneInfo: TimezoneInfo): Date {
    try {
      // Get the total offset (UTC + DST)
      const totalOffsetSeconds = timezoneInfo.utcOffsetSeconds + timezoneInfo.dstOffsetSeconds;
      
      // Convert to UTC by subtracting the offset
      const utcTime = new Date(localDateTime.getTime() - (totalOffsetSeconds * 1000));
      
      console.log(`🕐 Time conversion:`);
      console.log(`  - Local time: ${localDateTime.toISOString()}`);
      console.log(`  - Timezone: ${timezoneInfo.timezoneId}`);
      console.log(`  - UTC offset: ${totalOffsetSeconds} seconds`);
      console.log(`  - Converted UTC: ${utcTime.toISOString()}`);
      
      return utcTime;
      
    } catch (error) {
      console.error('❌ Error converting local time to UTC:', error);
      return localDateTime; // Fallback to original time
    }
  }
  
  /**
   * Extract GPS timestamp (already in UTC) from GPS string
   * Format: "Lat:41.908566,Lon:-87.677826,Acc:6.550611,Alt:190.527401,Bear:-1.000000,Speed:-1.000000,Time:1756312898.246060"
   */
  extractGPSTimestamp(gpsString: string): Date | null {
    try {
      console.log(`⏰ Extracting GPS timestamp from: "${gpsString}"`);
      
      const timeMatch = gpsString.match(/Time:([-]?\d+\.?\d*)/);
      if (!timeMatch) {
        console.error('❌ Could not extract timestamp from GPS string');
        return null;
      }
      
      const unixTimestamp = parseFloat(timeMatch[1]);
      
      // Handle both seconds and milliseconds formats
      // If timestamp > 10000000000, it's in milliseconds (13 digits)
      // If timestamp < 10000000000, it's in seconds (10 digits)
      const timestampMs = unixTimestamp > 10000000000 ? unixTimestamp : unixTimestamp * 1000;
      const utcDate = new Date(timestampMs);
      
      // Validate timestamp is reasonable (between 2020-2100)
      if (isNaN(utcDate.getTime()) || 
          utcDate.getFullYear() < 2020 || 
          utcDate.getFullYear() > 2100) {
        console.error(`❌ Invalid GPS timestamp: "${timeMatch[1]}" → year ${utcDate.getFullYear()}`);
        return null;
      }
      
      console.log(`✅ Extracted GPS timestamp: ${unixTimestamp} → ${utcDate.toISOString()} (${unixTimestamp > 10000000000 ? 'ms' : 's'} format)`);
      return utcDate;
      
    } catch (error) {
      console.error('❌ Error extracting GPS timestamp:', error);
      return null;
    }
  }

  /**
   * Main function: Parse GPS and convert handoff time to UTC
   */
  async convertHandoffTimeWithGPS(gpsString: string, handoffDate: string, handoffTime: string): Promise<Date | null> {
    try {
      console.log(`🚀 Starting GPS-based timezone conversion...`);
      console.log(`  - GPS: ${gpsString}`);
      console.log(`  - Handoff Date: ${handoffDate}`);  
      console.log(`  - Handoff Time: ${handoffTime}`);
      
      // Parse GPS coordinates
      const coordinates = this.parseGPSCoordinates(gpsString);
      if (!coordinates) {
        console.error('❌ Could not parse GPS coordinates');
        return null;
      }
      
      // Get timezone information
      const timezoneInfo = await this.getTimezoneFromCoordinates(coordinates);
      if (!timezoneInfo) {
        console.error('❌ Could not get timezone information');
        return null;
      }
      
      // Parse handoff date and time
      const [month, day, year] = handoffDate.split('/').map(Number);
      const [time, ampm] = handoffTime.trim().split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      
      // Convert to 24-hour format
      let hour24 = hours;
      if (ampm?.toLowerCase() === 'pm' && hours !== 12) {
        hour24 += 12;
      } else if (ampm?.toLowerCase() === 'am' && hours === 12) {
        hour24 = 0;
      }
      
      // Create local datetime (assuming user's local time)
      const localDateTime = new Date(year, month - 1, day, hour24, minutes, 0);
      
      // Convert to UTC using timezone info
      const utcDateTime = this.convertLocalTimeToUTC(localDateTime, timezoneInfo);
      
      console.log(`✅ GPS-based conversion complete: ${utcDateTime.toISOString()}`);
      return utcDateTime;
      
    } catch (error) {
      console.error('❌ Error in GPS-based timezone conversion:', error);
      return null;
    }
  }
}

export const timezoneService = new TimezoneService();