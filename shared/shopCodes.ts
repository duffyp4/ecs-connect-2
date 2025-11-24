// Shop name to shop code mapping
// Shop code format: 2-digit code used in ECS Serial Numbers (XX.MMDDYYYY.ZZ)
export const SHOP_CODE_MAP: Record<string, string> = {
  "Nashville": "01",
  "Birmingham": "02",
  "Charlotte": "03",
  "Knoxville": "04",
  "Chattanooga": "05",
  // Add more shop codes as needed
};

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
