// Shop name to shop code mapping
// Shop code format: 2-digit code used in ECS Serial Numbers (XX.MMDDYYYY.ZZ)
export const SHOP_CODE_MAP: Record<string, string> = {
  "ECS Memphis": "00",
  "ECS Nashville": "01",
  "ECS Atlanta": "02",
  "ECS Dallas": "03",
  "ECS Chicago": "04",
  "ECS Corporate": "99",
};

export const SHOP_NAMES = Object.keys(SHOP_CODE_MAP) as Array<keyof typeof SHOP_CODE_MAP>;

// Get shop code from shop name
export function getShopCode(shopName: string): string {
  const code = SHOP_CODE_MAP[shopName];
  if (!code) {
    // Default to "01" if shop not found
    console.warn(`Unknown shop name "${shopName}", using default code "01"`);
    return "01";
  }
  return code;
}

// Format today's date as MMDDYYYY
export function getTodayDateCode(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  return `${month}${day}${year}`;
}

// Generate a unique Job ID with shop code
// Format: ECS-YYYYMMDDHHMMSS-XX (where XX is the 2-digit shop code)
export function generateJobId(shopName: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
  const shopCode = getShopCode(shopName);
  return `ECS-${timestamp}-${shopCode}`;
}
