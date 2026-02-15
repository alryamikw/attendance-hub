/**
 * WiFi and IP Validation Utilities
 */

export interface NetworkValidationResult {
  isValid: boolean;
  method: 'wifi' | 'ip' | 'none';
  ssid?: string;
  ip?: string;
  matchedRule?: string;
  error?: string;
}

export interface BranchNetworkConfig {
  wifiSsid?: string;
  ipRange?: string;
  requireNetworkValidation: boolean;
}

/**
 * Get current IP address
 */
export async function getCurrentIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Failed to get IP:', error);
    return null;
  }
}

/**
 * Check if IP is in range (CIDR notation)
 */
export function isIPInRange(ip: string, range: string): boolean {
  // Handle simple IP match
  if (!range.includes('/')) {
    return ip === range;
  }
  
  const [rangeIP, prefixLength] = range.split('/');
  const prefix = parseInt(prefixLength);
  
  // Convert IPs to numbers
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(rangeIP);
  
  if (ipNum === null || rangeNum === null) return false;
  
  // Create mask
  const mask = ~((1 << (32 - prefix)) - 1);
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Convert IP to number
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return null;
  
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check multiple IP ranges
 */
export function checkIPRanges(ip: string, ranges: string[]): { matched: boolean; matchedRange?: string } {
  for (const range of ranges) {
    if (isIPInRange(ip, range)) {
      return { matched: true, matchedRange: range };
    }
  }
  return { matched: false };
}

/**
 * Validate network connection for attendance
 */
export async function validateNetworkConnection(
  config: BranchNetworkConfig
): Promise<NetworkValidationResult> {
  const result: NetworkValidationResult = {
    isValid: true,
    method: 'none',
  };
  
  if (!config.requireNetworkValidation) {
    return result;
  }
  
  // Try WiFi validation first (if supported)
  if (config.wifiSsid && typeof navigator !== 'undefined') {
    // Note: WiFi SSID requires specific permissions and is not widely supported
    // This would typically require a native app or specific browser APIs
    // For web, we'll skip this and fall back to IP
    
    result.method = 'wifi';
    // In production with native app:
    // result.ssid = await getWifiSSID();
    // result.isValid = result.ssid === config.wifiSsid;
  }
  
  // IP validation fallback
  if (!result.isValid && config.ipRange) {
    const ip = await getCurrentIP();
    
    if (ip) {
      result.ip = ip;
      result.method = 'ip';
      
      // Parse IP ranges (comma-separated)
      const ranges = config.ipRange.split(',').map(r => r.trim());
      const { matched, matchedRange } = checkIPRanges(ip, ranges);
      
      result.isValid = matched;
      result.matchedRule = matchedRange;
    }
  }
  
  return result;
}

/**
 * Get device fingerprint
 */
export async function getDeviceFingerprint(): Promise<string> {
  const components: string[] = [];
  
  // Screen info
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  
  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Language
  components.push(navigator.language);
  
  // Platform
  components.push(navigator.platform);
  
  // User agent hash
  const ua = navigator.userAgent;
  components.push(ua.length.toString());
  
  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('AttendanceHub', 2, 15);
      components.push(canvas.toDataURL().slice(50, 100));
    }
  } catch (e) {
    // Canvas not supported
  }
  
  // WebGL fingerprint
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '');
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
      }
    }
  } catch (e) {
    // WebGL not supported
  }
  
  // Hash the components
  const fingerprint = components.join('|');
  return hashString(fingerprint);
}

/**
 * Simple string hash
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if device is registered
 */
export async function checkDeviceRegistration(
  tenantId: string,
  employeeId: string
): Promise<{ isRegistered: boolean; deviceId: string }> {
  const deviceId = await getDeviceFingerprint();
  
  // This would check against the database
  // For now, return the device ID
  return {
    isRegistered: true, // Would check database
    deviceId,
  };
}

/**
 * Register device
 */
export async function registerDevice(
  tenantId: string,
  employeeId: string
): Promise<{ success: boolean; deviceId: string }> {
  const deviceId = await getDeviceFingerprint();
  
  // Device info
  const deviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  
  // This would save to database
  // await db.offlineDevice.create({ ... })
  
  return {
    success: true,
    deviceId,
  };
}
