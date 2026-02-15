/**
 * Geofencing & Location Utilities
 * Handles location validation, distance calculation, and geofence checks
 */

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface GeofenceResult {
  isWithinGeofence: boolean;
  distance: number;
  branchId?: string;
  branchName?: string;
  accuracyWarning?: boolean;
  spoofingWarning?: boolean;
}

export interface BranchGeofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isGeofenceEnabled: boolean;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance);
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a location is within a geofence
 */
export function isWithinGeofence(
  location: GeoLocation,
  geofence: { latitude: number; longitude: number; radius: number }
): { isWithin: boolean; distance: number } {
  const distance = calculateDistance(
    location.latitude,
    location.longitude,
    geofence.latitude,
    geofence.longitude
  );
  
  return {
    isWithin: distance <= geofence.radius,
    distance,
  };
}

/**
 * Find the nearest branch within geofence
 */
export function findNearestBranch(
  location: GeoLocation,
  branches: BranchGeofence[]
): GeofenceResult | null {
  let nearestBranch: BranchGeofence | null = null;
  let minDistance = Infinity;
  
  for (const branch of branches) {
    if (!branch.isGeofenceEnabled) continue;
    
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      branch.latitude,
      branch.longitude
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestBranch = branch;
    }
  }
  
  if (!nearestBranch) {
    return null;
  }
  
  const isWithinGeofence = minDistance <= nearestBranch.radius;
  const accuracyWarning = location.accuracy ? location.accuracy > 100 : false;
  
  return {
    isWithinGeofence,
    distance: minDistance,
    branchId: nearestBranch.id,
    branchName: nearestBranch.name,
    accuracyWarning,
  };
}

/**
 * Validate location accuracy
 */
export function validateLocationAccuracy(accuracy: number | undefined): {
  isValid: boolean;
  warning: string | null;
} {
  if (!accuracy) {
    return { isValid: true, warning: 'Accuracy not available' };
  }
  
  if (accuracy > 200) {
    return { isValid: false, warning: 'Location accuracy is too low. Please try again in an open area.' };
  }
  
  if (accuracy > 100) {
    return { isValid: true, warning: 'Location accuracy is low. Results may be less accurate.' };
  }
  
  return { isValid: true, warning: null };
}

/**
 * Detect potential GPS spoofing
 */
export function detectSpoofing(
  currentLocation: GeoLocation,
  previousLocation?: GeoLocation,
  deviceId?: string
): { isSuspicious: boolean; flags: string[] } {
  const flags: string[] = [];
  
  // Check for impossible travel speed
  if (previousLocation && previousLocation.timestamp && currentLocation.timestamp) {
    const timeDiff = (currentLocation.timestamp - previousLocation.timestamp) / 1000; // seconds
    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      previousLocation.latitude,
      previousLocation.longitude
    );
    
    // Speed in km/h
    const speed = (distance / 1000) / (timeDiff / 3600);
    
    // If speed > 300 km/h, it's suspicious
    if (speed > 300) {
      flags.push('Impossible travel detected');
    }
  }
  
  // Check for perfect accuracy (too good to be true)
  if (currentLocation.accuracy === 0) {
    flags.push('Perfect accuracy (potential mock location)');
  }
  
  // Check for altitude anomalies
  // Note: This would require altitude data from the device
  
  return {
    isSuspicious: flags.length > 0,
    flags,
  };
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  
  const latStr = `${Math.abs(latitude).toFixed(6)}° ${latDir}`;
  const lonStr = `${Math.abs(longitude).toFixed(6)}° ${lonDir}`;
  
  return `${latStr}, ${lonStr}`;
}

/**
 * Calculate bounding box for geofence
 */
export function calculateGeofenceBounds(
  latitude: number,
  longitude: number,
  radiusMeters: number
): { north: number; south: number; east: number; west: number } {
  // Approximate conversion (valid for small distances)
  const metersPerDegreeLat = 111319.9;
  const metersPerDegreeLon = 111319.9 * Math.cos(latitude * Math.PI / 180);
  
  const latOffset = radiusMeters / metersPerDegreeLat;
  const lonOffset = radiusMeters / metersPerDegreeLon;
  
  return {
    north: latitude + latOffset,
    south: latitude - latOffset,
    east: longitude + lonOffset,
    west: longitude - lonOffset,
  };
}

/**
 * Get distance label
 */
export function getDistanceLabel(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

/**
 * Attendance location validation
 */
export interface AttendanceLocationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  branch?: {
    id: string;
    name: string;
    distance: number;
  };
}

export async function validateAttendanceLocation(
  employeeLocation: GeoLocation,
  employeeBranchId: string,
  tenantBranches: BranchGeofence[],
  requireGeofence: boolean = true
): Promise<AttendanceLocationValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate accuracy
  const accuracyCheck = validateLocationAccuracy(employeeLocation.accuracy);
  if (!accuracyCheck.isValid) {
    errors.push(accuracyCheck.warning!);
  } else if (accuracyCheck.warning) {
    warnings.push(accuracyCheck.warning);
  }
  
  // Find employee's assigned branch
  const assignedBranch = tenantBranches.find(b => b.id === employeeBranchId);
  
  if (!assignedBranch) {
    errors.push('Assigned branch not found');
    return { isValid: false, errors, warnings };
  }
  
  // Check if within assigned branch geofence
  const { isWithin, distance } = isWithinGeofence(employeeLocation, {
    latitude: assignedBranch.latitude,
    longitude: assignedBranch.longitude,
    radius: assignedBranch.radius,
  });
  
  if (requireGeofence && assignedBranch.isGeofenceEnabled && !isWithin) {
    errors.push(
      `You are outside the allowed area. Distance: ${getDistanceLabel(distance)} from ${assignedBranch.name}`
    );
  } else if (!isWithin) {
    warnings.push(
      `Location outside branch area (${getDistanceLabel(distance)} away)`
    );
  }
  
  // Check for spoofing
  const spoofingCheck = detectSpoofing(employeeLocation);
  if (spoofingCheck.isSuspicious) {
    warnings.push(...spoofingCheck.flags);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    branch: {
      id: assignedBranch.id,
      name: assignedBranch.name,
      distance,
    },
  };
}
