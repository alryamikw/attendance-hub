/**
 * Device Validation Utilities
 * WiFi SSID, IP Range, and Device Binding validation
 */

export interface DeviceInfo {
  deviceId: string;
  userAgent: string;
  platform: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  deviceInfo?: DeviceInfo;
}

/**
 * Generate a unique device fingerprint
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];
  
  // User Agent
  components.push(navigator.userAgent);
  
  // Screen resolution
  components.push(`${screen.width}x${screen.height}`);
  components.push(`${screen.colorDepth}`);
  
  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Language
  components.push(navigator.language);
  
  // Platform
  components.push(navigator.platform);
  
  // Hardware concurrency
  if (navigator.hardwareConcurrency) {
    components.push(navigator.hardwareConcurrency.toString());
  }
  
  // Device memory (if available)
  const nav = navigator as any;
  if (nav.deviceMemory) {
    components.push(nav.deviceMemory.toString());
  }
  
  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
      components.push(canvas.toDataURL().slice(0, 100));
    }
  } catch (e) {
    // Canvas not available
  }
  
  // WebGL fingerprint
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch (e) {
    // WebGL not available
  }
  
  // Create hash
  const fingerprint = components.join('|||');
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get current device information
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = await generateDeviceFingerprint();
  
  return {
    deviceId,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === '1',
  };
}

/**
 * Check if device is allowed
 */
export function isDeviceAllowed(deviceId: string, allowedDevices: string[]): boolean {
  return allowedDevices.includes(deviceId);
}

/**
 * Validate IP address range
 */
export function isIpInRange(ip: string, range: string): boolean {
  // Parse range (e.g., "192.168.1.0/24" or "10.0.0.1-10.0.0.255")
  if (range.includes('/')) {
    // CIDR notation
    return isInCidrRange(ip, range);
  } else if (range.includes('-')) {
    // Range notation
    return isInIpRange(ip, range);
  } else {
    // Single IP
    return ip === range;
  }
}

function isInCidrRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);
  
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  const maskNum = ~((1 << (32 - mask)) - 1);
  
  return (ipNum & maskNum) === (rangeNum & maskNum);
}

function isInIpRange(ip: string, range: string): boolean {
  const [start, end] = range.split('-');
  const ipNum = ipToNumber(ip);
  return ipNum >= ipToNumber(start) && ipNum <= ipToNumber(end);
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * WiFi SSID Detection (limited in browsers)
 * Note: Browsers cannot directly access WiFi SSID for security reasons
 * This is a placeholder that could work with native apps
 */
export async function checkWifiSsid(expectedSsid: string): Promise<{ 
  canCheck: boolean; 
  matches: boolean; 
  ssid?: string 
}> {
  // In a web browser, we cannot access WiFi SSID directly
  // This would require:
  // 1. A native app integration
  // 2. A browser extension
  // 3. A corporate network solution
  
  return {
    canCheck: false,
    matches: false,
  };
}

/**
 * Comprehensive device validation
 */
export async function validateDevice(options: {
  allowedDevices?: string[];
  ipRange?: string;
  wifiSsid?: string;
  currentIp?: string;
}): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Get device info
  const deviceInfo = await getDeviceInfo();
  
  // Check device binding
  if (options.allowedDevices && options.allowedDevices.length > 0) {
    if (!isDeviceAllowed(deviceInfo.deviceId, options.allowedDevices)) {
      errors.push('This device is not authorized for attendance');
    }
  }
  
  // Check IP range
  if (options.ipRange && options.currentIp) {
    if (!isIpInRange(options.currentIp, options.ipRange)) {
      warnings.push('Your IP address is outside the allowed range');
    }
  }
  
  // Check WiFi SSID (limited support)
  if (options.wifiSsid) {
    const wifiCheck = await checkWifiSsid(options.wifiSsid);
    if (!wifiCheck.canCheck) {
      warnings.push('WiFi verification is not available in this browser');
    } else if (!wifiCheck.matches) {
      warnings.push('You are not connected to the required WiFi network');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    deviceInfo,
  };
}

/**
 * Store device binding in localStorage
 */
export function storeDeviceBinding(employeeId: string, deviceId: string): void {
  const bindings = JSON.parse(localStorage.getItem('deviceBindings') || '{}');
  bindings[employeeId] = {
    deviceId,
    boundAt: new Date().toISOString(),
  };
  localStorage.setItem('deviceBindings', JSON.stringify(bindings));
}

/**
 * Check if device is bound to employee
 */
export function isDeviceBound(employeeId: string): { 
  isBound: boolean; 
  deviceId?: string;
  boundAt?: string;
} {
  const bindings = JSON.parse(localStorage.getItem('deviceBindings') || '{}');
  const binding = bindings[employeeId];
  
  if (binding) {
    return {
      isBound: true,
      deviceId: binding.deviceId,
      boundAt: binding.boundAt,
    };
  }
  
  return { isBound: false };
}

/**
 * Detect VPN or Proxy
 */
export async function detectVpnOrProxy(): Promise<{
  detected: boolean;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
}> {
  const reasons: string[] = [];
  let confidence: 'low' | 'medium' | 'high' = 'low';
  
  // Check for common VPN indicators
  const nav = navigator as any;
  
  // Check connection info (if available)
  if (nav.connection) {
    const connection = nav.connection;
    
    // VPNs often have unusual RTT patterns
    if (connection.rtt && connection.rtt > 100) {
      reasons.push('High round-trip time detected');
      confidence = 'low';
    }
  }
  
  // Check for WebRTC leaks (simplified)
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Wait for ICE candidates
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (pc.localDescription) {
      const sdp = pc.localDescription.sdp;
      // Check for private IP in SDP
      if (sdp.includes('192.168.') || sdp.includes('10.') || sdp.includes('172.')) {
        // Local IP found - likely not behind VPN for WebRTC
      } else {
        reasons.push('No local IP detected in WebRTC');
        confidence = 'medium';
      }
    }
    
    pc.close();
  } catch (e) {
    // WebRTC not available
  }
  
  return {
    detected: reasons.length > 0,
    confidence,
    reasons,
  };
}

/**
 * React Hook for device validation
 */
export function useDeviceValidation() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  useEffect(() => {
    getDeviceInfo().then(info => {
      setDeviceInfo(info);
      setIsLoading(false);
    });
  }, []);
  
  const validate = async (options: Parameters<typeof validateDevice>[0]) => {
    const result = await validateDevice(options);
    setValidationResult(result);
    return result;
  };
  
  return {
    deviceInfo,
    isLoading,
    validationResult,
    validate,
    generateDeviceFingerprint,
  };
}

// Import useState and useEffect for the hook
import { useState, useEffect } from 'react';
