'use client';
/**
 * React Hooks for Offline/Online Support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initDB,
  queueAttendance,
  getQueuedAttendance,
  getPendingSyncCount,
  getDeviceId,
  setCachedData,
  getCachedData,
  QueuedAttendance,
} from './offline-storage';
import {
  initSyncEngine,
  cleanupSyncEngine,
  syncAll,
  subscribeToSyncStatus,
  offlineCheckIn,
  offlineCheckOut,
  offlineBreakStart,
  offlineBreakEnd,
  getSyncStatus,
  SyncStatus,
  isDuplicateAction,
} from './sync-engine';

// Check if running in browser
const isBrowser = typeof window !== 'undefined';

// ==========================================
// USE ONLINE STATUS HOOK
// ==========================================

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}

// ==========================================
// USE GEOLOCATION HOOK
// ==========================================

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  error: string | null;
}

export function useGeolocation(options: PositionOptions = {}): {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => void;
} {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          error: null,
        });
        setLoading(false);
      },
      (err) => {
        setError(getLocationErrorMessage(err));
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      }
    );
  }, [options]);
  
  // Watch position for continuous updates
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          error: null,
        });
      },
      (err) => {
        setError(getLocationErrorMessage(err));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      }
    );
    
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [options]);
  
  return { location, loading, error, requestLocation };
}

function getLocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access.';
    case error.POSITION_UNAVAILABLE:
      return 'Location information is unavailable.';
    case error.TIMEOUT:
      return 'Location request timed out.';
    default:
      return 'An unknown error occurred.';
  }
}

// ==========================================
// USE SYNC STATUS HOOK
// ==========================================

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSyncAt: null,
    isSyncing: false,
  });
  
  useEffect(() => {
    // Initialize sync engine
    initSyncEngine();
    
    // Subscribe to status changes
    const unsubscribe = subscribeToSyncStatus(setStatus);
    
    // Get initial status
    getSyncStatus().then(setStatus);
    
    return () => {
      unsubscribe();
      cleanupSyncEngine();
    };
  }, []);
  
  return status;
}

// ==========================================
// USE OFFLINE ATTENDANCE HOOK
// ==========================================

export interface UseOfflineAttendanceResult {
  checkIn: (data: {
    employeeId: string;
    tenantId: string;
    branchId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    photo?: string;
  }) => Promise<{ success: boolean; offline: boolean; id?: string; error?: string }>;
  
  checkOut: (data: {
    employeeId: string;
    tenantId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    photo?: string;
  }) => Promise<{ success: boolean; offline: boolean; id?: string; error?: string }>;
  
  startBreak: (data: {
    employeeId: string;
    tenantId: string;
  }) => Promise<{ success: boolean; offline: boolean }>;
  
  endBreak: (data: {
    employeeId: string;
    tenantId: string;
  }) => Promise<{ success: boolean; offline: boolean }>;
  
  pendingRecords: QueuedAttendance[];
  syncStatus: SyncStatus;
  forceSync: () => Promise<void>;
}

export function useOfflineAttendance(): UseOfflineAttendanceResult {
  const [pendingRecords, setPendingRecords] = useState<QueuedAttendance[]>([]);
  const syncStatus = useSyncStatus();
  const isOnline = useOnlineStatus();
  
  // Load pending records
  useEffect(() => {
    initDB().then(() => {
      getQueuedAttendance().then(setPendingRecords);
    });
  }, [syncStatus.pendingCount]);
  
  const checkIn = useCallback(async (data: Parameters<typeof offlineCheckIn>[0]) => {
    // Check for duplicate
    if (isDuplicateAction(data.employeeId, 'checkin')) {
      return { success: false, offline: false, error: 'Duplicate action' };
    }
    
    // Try online first
    if (isOnline) {
      try {
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'checkin', ...data }),
        });
        
        if (response.ok) {
          return { success: true, offline: false };
        }
      } catch (error) {
        console.error('Online check-in failed, falling back to offline');
      }
    }
    
    // Offline mode
    const result = await offlineCheckIn(data);
    setPendingRecords(await getQueuedAttendance());
    return { success: result.success, offline: result.offline, id: result.id };
  }, [isOnline]);
  
  const checkOut = useCallback(async (data: Parameters<typeof offlineCheckOut>[0]) => {
    if (isDuplicateAction(data.employeeId, 'checkout')) {
      return { success: false, offline: false, error: 'Duplicate action' };
    }
    
    if (isOnline) {
      try {
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'checkout', ...data }),
        });
        
        if (response.ok) {
          return { success: true, offline: false };
        }
      } catch (error) {
        console.error('Online check-out failed, falling back to offline');
      }
    }
    
    const result = await offlineCheckOut(data);
    setPendingRecords(await getQueuedAttendance());
    return { success: result.success, offline: result.offline, id: result.id };
  }, [isOnline]);
  
  const startBreak = useCallback(async (data: Parameters<typeof offlineBreakStart>[0]) => {
    if (isOnline) {
      try {
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'startBreak', ...data }),
        });
        
        if (response.ok) {
          return { success: true, offline: false };
        }
      } catch (error) {
        console.error('Online break start failed');
      }
    }
    
    const result = await offlineBreakStart(data);
    return { success: result.success, offline: result.offline };
  }, [isOnline]);
  
  const endBreak = useCallback(async (data: Parameters<typeof offlineBreakEnd>[0]) => {
    if (isOnline) {
      try {
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'endBreak', ...data }),
        });
        
        if (response.ok) {
          return { success: true, offline: false };
        }
      } catch (error) {
        console.error('Online break end failed');
      }
    }
    
    const result = await offlineBreakEnd(data);
    return { success: result.success, offline: result.offline };
  }, [isOnline]);
  
  const forceSync = useCallback(async () => {
    if (isOnline) {
      await syncAll();
      setPendingRecords(await getQueuedAttendance());
    }
  }, [isOnline]);
  
  return {
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    pendingRecords,
    syncStatus,
    forceSync,
  };
}

// ==========================================
// USE CAMERA HOOK (for selfies)
// ==========================================

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  photo: string | null;
  takePhoto: () => void;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  error: string | null;
  isReady: boolean;
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch (err) {
      setError('Failed to access camera. Please grant camera permission.');
      console.error('Camera error:', err);
    }
  }, []);
  
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  }, []);
  
  const takePhoto = useCallback(() => {
    if (!videoRef.current || !isReady) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Mirror the image for selfie effect
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPhoto(dataUrl);
    }
  }, [isReady]);
  
  return {
    videoRef,
    photo,
    takePhoto,
    startCamera,
    stopCamera,
    error,
    isReady,
  };
}

// ==========================================
// USE PWA INSTALL HOOK
// ==========================================

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall(): {
  canInstall: boolean;
  install: () => Promise<boolean>;
  isInstalled: boolean;
} {
  // Initialize with the correct value to avoid setState in effect
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches;
    }
    return false;
  });
  const [canInstall, setCanInstall] = useState(false);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);
  
  const install = useCallback(async (): Promise<boolean> => {
    if (!installPromptRef.current) return false;
    
    try {
      await installPromptRef.current.prompt();
      const { outcome } = await installPromptRef.current.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Install failed:', error);
      return false;
    }
  }, []);
  
  return { canInstall, install, isInstalled };
}

// ==========================================
// USE CACHED DATA HOOK
// ==========================================

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isOnline = useOnlineStatus();
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try cache first
      const cached = await getCachedData<T>(key);
      if (cached) {
        setData(cached);
        setLoading(false);
      }
      
      // If online, fetch fresh data
      if (isOnline) {
        const fresh = await fetcher();
        setData(fresh);
        await setCachedData(key, fresh, ttlSeconds);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttlSeconds, isOnline]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return { data, loading, error, refetch: fetchData };
}
