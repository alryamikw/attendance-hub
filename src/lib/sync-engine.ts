/**
 * Offline Sync Engine
 * Handles synchronization of offline attendance records when online
 */

import {
  initDB,
  queueAttendance,
  getQueuedAttendance,
  updateAttendanceSyncStatus,
  deleteQueuedAttendance,
  getPendingSyncCount,
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
  setCachedData,
  getCachedData,
  getDeviceId,
  QueuedAttendance,
} from './offline-storage';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  isSyncing: boolean;
}

type SyncStatusCallback = (status: SyncStatus) => void;

// Sync state
let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;
let lastSyncAt: string | null = null;
const statusCallbacks: SyncStatusCallback[] = [];

// Exponential backoff settings
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 1 minute
const MAX_RETRIES = 5;

/**
 * Initialize the sync engine
 */
export async function initSyncEngine(): Promise<void> {
  await initDB();
  
  // Listen for online/offline events
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Start periodic sync
  startPeriodicSync();
  
  // Initial sync if online
  if (navigator.onLine) {
    await syncAll();
  }
}

/**
 * Cleanup sync engine
 */
export function cleanupSyncEngine(): void {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Start periodic sync
 */
export function startPeriodicSync(intervalMs: number = 30000): void {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  syncInterval = setInterval(async () => {
    if (navigator.onLine && !isSyncing) {
      await syncAll();
    }
  }, intervalMs);
}

/**
 * Handle online event
 */
async function handleOnline(): Promise<void> {
  notifyStatusChange({
    isOnline: true,
    pendingCount: await getPendingSyncCount(),
    lastSyncAt,
    isSyncing,
  });
  
  // Trigger sync
  await syncAll();
}

/**
 * Handle offline event
 */
function handleOffline(): void {
  notifyStatusChange({
    isOnline: false,
    pendingCount: 0,
    lastSyncAt,
    isSyncing: false,
  });
}

/**
 * Subscribe to sync status changes
 */
export function subscribeToSyncStatus(callback: SyncStatusCallback): () => void {
  statusCallbacks.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = statusCallbacks.indexOf(callback);
    if (index > -1) {
      statusCallbacks.splice(index, 1);
    }
  };
}

/**
 * Notify all subscribers of status change
 */
async function notifyStatusChange(status: SyncStatus): Promise<void> {
  for (const callback of statusCallbacks) {
    callback(status);
  }
}

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  return {
    isOnline: navigator.onLine,
    pendingCount: await getPendingSyncCount(),
    lastSyncAt,
    isSyncing,
  };
}

/**
 * Sync all pending records
 */
export async function syncAll(): Promise<SyncResult> {
  if (isSyncing || !navigator.onLine) {
    return { success: false, synced: 0, failed: 0, errors: ['Sync in progress or offline'] };
  }
  
  isSyncing = true;
  notifyStatusChange({
    isOnline: true,
    pendingCount: await getPendingSyncCount(),
    lastSyncAt,
    isSyncing: true,
  });
  
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };
  
  try {
    // Sync attendance queue
    const attendanceResult = await syncAttendanceQueue();
    result.synced += attendanceResult.synced;
    result.failed += attendanceResult.failed;
    result.errors.push(...attendanceResult.errors);
    
    // Sync general queue
    const queueResult = await syncGeneralQueue();
    result.synced += queueResult.synced;
    result.failed += queueResult.failed;
    result.errors.push(...queueResult.errors);
    
    lastSyncAt = new Date().toISOString();
    result.success = result.failed === 0;
  } catch (error) {
    result.success = false;
    result.errors.push(`Sync error: ${error}`);
  } finally {
    isSyncing = false;
    notifyStatusChange({
      isOnline: true,
      pendingCount: await getPendingSyncCount(),
      lastSyncAt,
      isSyncing: false,
    });
  }
  
  return result;
}

/**
 * Sync attendance queue records
 */
async function syncAttendanceQueue(): Promise<SyncResult> {
  const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };
  
  const pendingRecords = await getQueuedAttendance();
  const pending = pendingRecords.filter(r => r.syncStatus === 'pending');
  
  for (const record of pending) {
    if (record.retryCount >= MAX_RETRIES) {
      await updateAttendanceSyncStatus(record.id, 'failed');
      result.failed++;
      result.errors.push(`Max retries exceeded for ${record.id}`);
      continue;
    }
    
    try {
      await updateAttendanceSyncStatus(record.id, 'syncing');
      
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: record.action,
          employeeId: record.employeeId,
          tenantId: record.tenantId,
          branchId: record.branchId,
          latitude: record.latitude,
          longitude: record.longitude,
          accuracy: record.accuracy,
          photo: record.photo,
          deviceId: record.deviceId,
          method: 'offline',
          syncId: record.id,
        }),
      });
      
      if (response.ok) {
        await deleteQueuedAttendance(record.id);
        result.synced++;
      } else {
        const error = await response.json();
        await updateAttendanceSyncStatus(record.id, 'pending');
        result.failed++;
        result.errors.push(`Failed to sync ${record.id}: ${error.error}`);
      }
    } catch (error) {
      await updateAttendanceSyncStatus(record.id, 'pending');
      result.failed++;
      result.errors.push(`Network error for ${record.id}`);
    }
  }
  
  return result;
}

/**
 * Sync general API queue
 */
async function syncGeneralQueue(): Promise<SyncResult> {
  const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };
  
  const queue = await getSyncQueue();
  
  for (const item of queue) {
    if (item.retryCount >= MAX_RETRIES) {
      await removeFromSyncQueue(item.id);
      result.failed++;
      result.errors.push(`Max retries exceeded for ${item.id}`);
      continue;
    }
    
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      
      if (response.ok) {
        await removeFromSyncQueue(item.id);
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`Failed to sync ${item.id}`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Network error for ${item.id}`);
    }
  }
  
  return result;
}

// ==========================================
// OFFLINE ATTENDANCE OPERATIONS
// ==========================================

/**
 * Offline check-in
 */
export async function offlineCheckIn(data: {
  employeeId: string;
  tenantId: string;
  branchId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  photo?: string;
}): Promise<{ success: boolean; id: string; offline: boolean }> {
  const deviceId = await getDeviceId();
  
  const id = await queueAttendance({
    ...data,
    action: 'checkin',
    timestamp: new Date().toISOString(),
    deviceId,
  });
  
  // Trigger sync if online
  if (navigator.onLine) {
    syncAll();
  }
  
  return { success: true, id, offline: true };
}

/**
 * Offline check-out
 */
export async function offlineCheckOut(data: {
  employeeId: string;
  tenantId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  photo?: string;
}): Promise<{ success: boolean; id: string; offline: boolean }> {
  const deviceId = await getDeviceId();
  
  const id = await queueAttendance({
    ...data,
    branchId: '', // Will be filled from check-in
    action: 'checkout',
    timestamp: new Date().toISOString(),
    deviceId,
  });
  
  if (navigator.onLine) {
    syncAll();
  }
  
  return { success: true, id, offline: true };
}

/**
 * Offline break start
 */
export async function offlineBreakStart(data: {
  employeeId: string;
  tenantId: string;
}): Promise<{ success: boolean; id: string; offline: boolean }> {
  const deviceId = await getDeviceId();
  
  const id = await queueAttendance({
    ...data,
    branchId: '',
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    action: 'break_start',
    timestamp: new Date().toISOString(),
    deviceId,
  });
  
  return { success: true, id, offline: true };
}

/**
 * Offline break end
 */
export async function offlineBreakEnd(data: {
  employeeId: string;
  tenantId: string;
}): Promise<{ success: boolean; id: string; offline: boolean }> {
  const deviceId = await getDeviceId();
  
  const id = await queueAttendance({
    ...data,
    branchId: '',
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    action: 'break_end',
    timestamp: new Date().toISOString(),
    deviceId,
  });
  
  return { success: true, id, offline: true };
}

// ==========================================
// CONFLICT RESOLUTION
// ==========================================

export interface ConflictResolution {
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  resolvedData?: any;
}

export function resolveSyncConflict(
  clientRecord: QueuedAttendance,
  serverRecord: any
): ConflictResolution {
  // Default: server wins for attendance to maintain data integrity
  // But preserve offline timestamp for audit trail
  
  const clientTime = new Date(clientRecord.timestamp).getTime();
  const serverTime = new Date(serverRecord.createdAt).getTime();
  
  // If client record is newer and server doesn't have a check-in/out for this action
  if (clientTime > serverTime) {
    if (clientRecord.action === 'checkin' && !serverRecord.checkInTime) {
      return { strategy: 'client_wins' };
    }
    if (clientRecord.action === 'checkout' && !serverRecord.checkOutTime) {
      return { strategy: 'client_wins' };
    }
  }
  
  // Default: server wins
  return { strategy: 'server_wins' };
}

// ==========================================
// DUPLICATE PREVENTION
// ==========================================

const recentActions = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 5000; // 5 seconds

export function isDuplicateAction(employeeId: string, action: string): boolean {
  const key = `${employeeId}_${action}`;
  const lastTime = recentActions.get(key);
  const now = Date.now();
  
  if (lastTime && now - lastTime < DUPLICATE_WINDOW_MS) {
    return true;
  }
  
  recentActions.set(key, now);
  return false;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of recentActions.entries()) {
    if (now - time > DUPLICATE_WINDOW_MS * 2) {
      recentActions.delete(key);
    }
  }
}, 10000);
