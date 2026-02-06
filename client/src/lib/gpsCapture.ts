/**
 * GPS capture utility using the browser's Geolocation API.
 * Provides lat/lon/accuracy for form submissions.
 */

export interface GpsData {
  latitude: string;
  longitude: string;
  accuracy: string;
  timestamp: number;
}

/**
 * Capture the current GPS position.
 * Returns null if geolocation is not available or permission denied.
 * Forms are still submittable without GPS data.
 */
export function captureGps(timeoutMs = 10000): Promise<GpsData | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("[GPS] Geolocation not available");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          accuracy: position.coords.accuracy.toFixed(1),
          timestamp: position.timestamp,
        });
      },
      (error) => {
        console.warn("[GPS] Failed to get position:", error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 60000, // Accept cached position up to 1 minute old
      },
    );
  });
}

/**
 * Get device info for form submission metadata.
 */
export function getDeviceInfo(): Record<string, unknown> {
  return {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    language: navigator.language,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
    },
    online: navigator.onLine,
    standalone: (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true),
  };
}
