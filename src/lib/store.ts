import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  tenantId?: string;
  employeeId?: string;
  permissions: string[];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  timezone: string;
  currency: string;
  employeeLimit: number;
  branchLimit: number;
}

export interface Branch {
  id: string;
  name: string;
  code?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadius: number;
  isGeofenceEnabled: boolean;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  branchId: string;
  branch?: Branch;
  position?: string;
  status: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  branchId: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave: boolean;
  earlyLeaveMinutes: number;
  totalHours: number;
  overtimeHours: number;
  status: string;
  employee?: Employee;
  branch?: Branch;
}

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  
  // Tenant
  tenant: Tenant | null;
  setTenant: (tenant: Tenant | null) => void;
  
  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  
  // Location
  currentLocation: { latitude: number; longitude: number; accuracy: number } | null;
  setCurrentLocation: (location: { latitude: number; longitude: number; accuracy: number } | null) => void;
  
  // Offline State
  isOnline: boolean;
  setOnline: (status: boolean) => void;
  pendingSync: number;
  setPendingSync: (count: number) => void;
  
  // Today's attendance
  todayAttendance: AttendanceRecord | null;
  setTodayAttendance: (record: AttendanceRecord | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false, tenant: null }),
      
      // Tenant
      tenant: null,
      setTenant: (tenant) => set({ tenant }),
      
      // UI
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      // Location
      currentLocation: null,
      setCurrentLocation: (location) => set({ currentLocation: location }),
      
      // Offline
      isOnline: true,
      setOnline: (status) => set({ isOnline: status }),
      pendingSync: 0,
      setPendingSync: (count) => set({ pendingSync: count }),
      
      // Today
      todayAttendance: null,
      setTodayAttendance: (record) => set({ todayAttendance: record }),
    }),
    {
      name: 'attendance-app-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        tenant: state.tenant,
      }),
    }
  )
);

// Demo data store for the application
interface DemoState {
  employees: Employee[];
  branches: Branch[];
  attendance: AttendanceRecord[];
  setEmployees: (employees: Employee[]) => void;
  setBranches: (branches: Branch[]) => void;
  setAttendance: (records: AttendanceRecord[]) => void;
  addAttendance: (record: AttendanceRecord) => void;
  updateAttendance: (id: string, data: Partial<AttendanceRecord>) => void;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      employees: [],
      branches: [],
      attendance: [],
      setEmployees: (employees) => set({ employees }),
      setBranches: (branches) => set({ branches }),
      setAttendance: (attendance) => set({ attendance }),
      addAttendance: (record) => set((state) => ({ 
        attendance: [...state.attendance, record] 
      })),
      updateAttendance: (id, data) => set((state) => ({
        attendance: state.attendance.map((r) => 
          r.id === id ? { ...r, ...data } : r
        ),
      })),
    }),
    {
      name: 'attendance-demo-data',
    }
  )
);
