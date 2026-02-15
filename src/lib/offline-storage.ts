/**
 * Offline Storage Engine using IndexedDB
 * Handles offline attendance records, sync queue, and local caching
 */

const DB_NAME = 'AttendanceHubDB';
const DB_VERSION = 1;

// Database stores
export const STORES = {
  ATTENDANCE_QUEUE: 'attendanceQueue',
  SYNC_QUEUE: 'syncQueue',
  CACHED_DATA: 'cachedData',
  DEVICE_INFO: 'deviceInfo',
  FACE_DATA: 'faceData',
} as const;

// IndexedDB connection
let db: IDBDatabase | null = null;

export interface QueuedAttendance {
  id: string;
  action: 'checkin' | 'checkout' | 'break_start' | 'break_end';
  employeeId: string;
  tenantId: string;
  branchId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  photo?: string;
  deviceId: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  createdAt: string;
}

export interface SyncQueueItem {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
}

// Initialize database
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Attendance queue store
      if (!database.objectStoreNames.contains(STORES.ATTENDANCE_QUEUE)) {
        const attendanceStore = database.createObjectStore(STORES.ATTENDANCE_QUEUE, {
          keyPath: 'id',
          autoIncrement: false,
        });
        attendanceStore.createIndex('employeeId', 'employeeId', { unique: false });
        attendanceStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        attendanceStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Sync queue store
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
          autoIncrement: false,
        });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Cached data store
      if (!database.objectStoreNames.contains(STORES.CACHED_DATA)) {
        const cacheStore = database.createObjectStore(STORES.CACHED_DATA, {
          keyPath: 'key',
        });
        cacheStore.createIndex('expiry', 'expiry', { unique: false });
      }

      // Device info store
      if (!database.objectStoreNames.contains(STORES.DEVICE_INFO)) {
        database.createObjectStore(STORES.DEVICE_INFO, {
          keyPath: 'id',
        });
      }

      // Face data store
      if (!database.objectStoreNames.contains(STORES.FACE_DATA)) {
        const faceStore = database.createObjectStore(STORES.FACE_DATA, {
          keyPath: 'employeeId',
        });
      }
    };
  });
}

// ==========================================
// ATTENDANCE QUEUE OPERATIONS
// ==========================================

export async function queueAttendance(
  data: Omit<QueuedAttendance, 'id' | 'syncStatus' | 'retryCount' | 'createdAt'>
): Promise<string> {
  const database = await initDB();
  
  const id = `${data.employeeId}_${Date.now()}`;
  const record: QueuedAttendance = {
    ...data,
    id,
    syncStatus: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.ATTENDANCE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.ATTENDANCE_QUEUE);
    const request = store.add(record);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

export async function getQueuedAttendance(employeeId?: string): Promise<QueuedAttendance[]> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.ATTENDANCE_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.ATTENDANCE_QUEUE);
    
    let request: IDBRequest;
    if (employeeId) {
      const index = store.index('employeeId');
      request = index.getAll(employeeId);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateAttendanceSyncStatus(
  id: string,
  status: QueuedAttendance['syncStatus']
): Promise<void> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.ATTENDANCE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.ATTENDANCE_QUEUE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (record) {
        record.syncStatus = status;
        record.retryCount += 1;
        store.put(record);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deleteQueuedAttendance(id: string): Promise<void> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.ATTENDANCE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.ATTENDANCE_QUEUE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingSyncCount(): Promise<number> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.ATTENDANCE_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.ATTENDANCE_QUEUE);
    const index = store.index('syncStatus');
    const request = index.count('pending');

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// SYNC QUEUE OPERATIONS
// ==========================================

export async function addToSyncQueue(
  url: string,
  method: string,
  body: any,
  headers: Record<string, string> = {}
): Promise<string> {
  const database = await initDB();
  
  const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const item: SyncQueueItem = {
    id,
    url,
    method,
    headers,
    body: JSON.stringify(body),
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.add(item);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// CACHED DATA OPERATIONS
// ==========================================

interface CachedDataItem {
  key: string;
  data: any;
  expiry: number;
}

export async function setCachedData(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
  const database = await initDB();
  
  const item: CachedDataItem = {
    key,
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.CACHED_DATA, 'readwrite');
    const store = transaction.objectStore(STORES.CACHED_DATA);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.CACHED_DATA, 'readonly');
    const store = transaction.objectStore(STORES.CACHED_DATA);
    const request = store.get(key);

    request.onsuccess = () => {
      const item = request.result as CachedDataItem | undefined;
      if (item && item.expiry > Date.now()) {
        resolve(item.data as T);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearExpiredCache(): Promise<void> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.CACHED_DATA, 'readwrite');
    const store = transaction.objectStore(STORES.CACHED_DATA);
    const index = store.index('expiry');
    const range = IDBKeyRange.upperBound(Date.now());
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// DEVICE INFO OPERATIONS
// ==========================================

export async function getDeviceId(): Promise<string> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.DEVICE_INFO, 'readonly');
    const store = transaction.objectStore(STORES.DEVICE_INFO);
    const request = store.get('device');

    request.onsuccess = () => {
      if (request.result?.deviceId) {
        resolve(request.result.deviceId);
      } else {
        // Generate new device ID
        const newDeviceId = generateDeviceId();
        saveDeviceInfo(newDeviceId).then(() => resolve(newDeviceId));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function saveDeviceInfo(deviceId: string): Promise<void> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.DEVICE_INFO, 'readwrite');
    const store = transaction.objectStore(STORES.DEVICE_INFO);
    const request = store.put({
      id: 'device',
      deviceId,
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export async function clearAllOfflineData(): Promise<void> {
  const database = await initDB();
  
  const stores = Object.values(STORES);
  
  for (const storeName of stores) {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export async function getStorageUsage(): Promise<{
  attendanceQueue: number;
  syncQueue: number;
  cachedData: number;
}> {
  const [attendanceQueue, syncQueue, cachedData] = await Promise.all([
    getQueuedAttendance(),
    getSyncQueue(),
    new Promise<any[]>((resolve) => {
      initDB().then(db => {
        const transaction = db.transaction(STORES.CACHED_DATA, 'readonly');
        const store = transaction.objectStore(STORES.CACHED_DATA);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
      });
    }),
  ]);

  return {
    attendanceQueue: attendanceQueue.length,
    syncQueue: syncQueue.length,
    cachedData: cachedData.length,
  };
}
