'use client';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { FaceCapture, FaceAttendanceWidget, FaceRegistrationWidget } from '@/components/face-capture';
import { 
  Clock, MapPin, Users, Building2, Calendar, TrendingUp, CheckCircle2, 
  XCircle, AlertTriangle, LogIn, LogOut, Coffee, BarChart3, Settings, 
  Bell, Menu, Home, DollarSign, Shield, Wifi, WifiOff, Download, 
  Plus, Send, Plane, Camera, RefreshCw, Check, ChevronRight, 
  ChevronLeft, Rocket, User, Globe, Lock, Smartphone, Zap,
  Activity, Timer, UserCheck, UserX, FileText, FileSpreadsheet, Scan
} from 'lucide-react';
import { useAppStore, useDemoStore } from '@/lib/store';
import { useOnlineStatus, useGeolocation, usePWAInstall } from '@/lib/hooks';
import { format } from 'date-fns';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import { io, Socket } from 'socket.io-client';

// ============================================
// TYPES
// ============================================
interface RealtimeData {
  onlineUsers: number;
  recentActivity: any[];
}

interface SetupData {
  company: { name: string; slug: string; timezone: string; currency: string } | null;
  admin: { name: string; email: string; password: string } | null;
  branch: { name: string; code: string; address: string; enableGeofence: boolean } | null;
  settings: { workingDays: number[]; startTime: string; endTime: string; graceMinutes: number } | null;
}

// ============================================
// DEMO DATA
// ============================================
const demoTenant = { id: 'demo-tenant', name: 'TechCorp Solutions', slug: 'techcorp', timezone: 'UTC', currency: 'USD' };
const demoBranches = [
  { id: 'br1', name: 'Headquarters', code: 'HQ', address: '123 Main St', latitude: 40.7128, longitude: -74.0060, geofenceRadius: 100, isGeofenceEnabled: true },
  { id: 'br2', name: 'Downtown Office', code: 'DT', address: '456 Oak Ave', latitude: 40.7580, longitude: -73.9855, geofenceRadius: 150, isGeofenceEnabled: true },
];
const demoEmployees = [
  { id: 'emp1', employeeCode: 'EMP001', firstName: 'John', lastName: 'Doe', email: 'john@techcorp.com', branchId: 'br1', position: 'Software Engineer', status: 'active' },
  { id: 'emp2', employeeCode: 'EMP002', firstName: 'Jane', lastName: 'Smith', email: 'jane@techcorp.com', branchId: 'br1', position: 'Product Manager', status: 'active' },
  { id: 'emp3', employeeCode: 'EMP003', firstName: 'Mike', lastName: 'Johnson', email: 'mike@techcorp.com', branchId: 'br2', position: 'Designer', status: 'active' },
  { id: 'emp4', employeeCode: 'EMP004', firstName: 'Sarah', lastName: 'Williams', email: 'sarah@techcorp.com', branchId: 'br1', position: 'HR Manager', status: 'active' },
  { id: 'emp5', employeeCode: 'EMP005', firstName: 'David', lastName: 'Brown', email: 'david@techcorp.com', branchId: 'br2', position: 'DevOps Engineer', status: 'active' },
];
const demoAttendance = [
  { id: 'att1', employeeId: 'emp1', branchId: 'br1', date: new Date().toISOString(), checkInTime: new Date().toISOString(), checkOutTime: null, isLate: false, lateMinutes: 0, totalHours: 4.5, status: 'present' },
  { id: 'att2', employeeId: 'emp2', branchId: 'br1', date: new Date().toISOString(), checkInTime: new Date(Date.now() - 3600000).toISOString(), checkOutTime: null, isLate: true, lateMinutes: 15, totalHours: 5, status: 'late' },
  { id: 'att3', employeeId: 'emp3', branchId: 'br2', date: new Date().toISOString(), checkInTime: new Date(Date.now() - 7200000).toISOString(), checkOutTime: new Date().toISOString(), isLate: false, lateMinutes: 0, totalHours: 6, status: 'early_leave' },
];
const demoLeaveTypes = [
  { id: 'lt1', name: 'Annual Leave', code: 'annual', daysAllowed: 21, color: '#10b981', isPaid: true },
  { id: 'lt2', name: 'Sick Leave', code: 'sick', daysAllowed: 10, color: '#f59e0b', isPaid: true },
  { id: 'lt3', name: 'Personal Leave', code: 'personal', daysAllowed: 5, color: '#6366f1', isPaid: false },
];
const demoLeaveBalances = [
  { leaveTypeId: 'lt1', totalDays: 21, usedDays: 5, pendingDays: 2 },
  { leaveTypeId: 'lt2', totalDays: 10, usedDays: 2, pendingDays: 0 },
  { leaveTypeId: 'lt3', totalDays: 5, usedDays: 1, pendingDays: 0 },
];
const weeklyData = [
  { day: 'Mon', present: 45, late: 5, absent: 2, hours: 380 },
  { day: 'Tue', present: 48, late: 3, absent: 1, hours: 395 },
  { day: 'Wed', present: 44, late: 6, absent: 2, hours: 370 },
  { day: 'Thu', present: 46, late: 4, absent: 2, hours: 385 },
  { day: 'Fri', present: 42, late: 7, absent: 3, hours: 355 },
];
const statusPieData = [
  { name: 'Present', value: 42, color: '#10b981' },
  { name: 'Late', value: 5, color: '#f59e0b' },
  { name: 'On Leave', value: 3, color: '#6366f1' },
  { name: 'Absent', value: 2, color: '#ef4444' },
];
const monthlyTrend = [
  { month: 'Jan', attendance: 92, hours: 7200 },
  { month: 'Feb', attendance: 94, hours: 7500 },
  { month: 'Mar', attendance: 91, hours: 7100 },
  { month: 'Apr', attendance: 95, hours: 7800 },
  { month: 'May', attendance: 93, hours: 7400 },
  { month: 'Jun', attendance: 96, hours: 7900 },
];
const COLORS = ['#10b981', '#f59e0b', '#6366f1', '#ef4444'];

// Sidebar Nav Component (outside main component)
const adminNavItems = [
  { id: 'dashboard', icon: Home, label: 'Dashboard' },
  { id: 'attendance', icon: Clock, label: 'Attendance' },
  { id: 'timeoff', icon: Plane, label: 'Time Off' },
  { id: 'employees', icon: Users, label: 'Employees' },
  { id: 'reports', icon: BarChart3, label: 'Reports' },
  { id: 'payroll', icon: DollarSign, label: 'Payroll' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

const employeeNavItems = [
  { id: 'my-dashboard', icon: Home, label: 'My Dashboard' },
  { id: 'check-in', icon: Clock, label: 'Check In/Out' },
  { id: 'face-id', icon: Scan, label: 'Face ID' },
  { id: 'my-attendance', icon: Calendar, label: 'My History' },
  { id: 'my-timeoff', icon: Plane, label: 'Leave Requests' },
  { id: 'my-profile', icon: User, label: 'My Profile' },
  { id: 'help', icon: Bell, label: 'Help & Support' },
];

// ============================================
// SETUP WIZARD COMPONENT
// ============================================
function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SetupData>({
    company: { name: '', slug: '', timezone: 'UTC', currency: 'USD' },
    admin: { name: '', email: '', password: '' },
    branch: { name: 'Main Branch', code: 'HQ', address: '', enableGeofence: false },
    settings: { workingDays: [1,2,3,4,5], startTime: '09:00', endTime: '18:00', graceMinutes: 15 },
  });
  
  const steps = [
    { title: 'Welcome', icon: Rocket },
    { title: 'Company', icon: Building2 },
    { title: 'Admin', icon: User },
    { title: 'Branch', icon: MapPin },
    { title: 'Complete', icon: CheckCircle2 },
  ];
  
  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: data.company?.name,
          companySlug: data.company?.slug,
          adminName: data.admin?.name,
          adminEmail: data.admin?.email,
          adminPassword: data.admin?.password,
          timezone: data.company?.timezone,
          currency: data.company?.currency,
        }),
      });
      
      if (response.ok) {
        setStep(4);
        setTimeout(onComplete, 1500);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center gap-1 mb-4">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${i <= step ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className={`w-6 h-0.5 ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
          <CardTitle>{steps[step].title}</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold">Welcome to AttendanceHub</h2>
              <p className="text-muted-foreground text-sm">Let's set up your attendance system. This takes about 2 minutes.</p>
              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { icon: Zap, title: 'Quick Setup', desc: 'Ready in minutes' },
                  { icon: Globe, title: 'GPS Tracking', desc: 'Location-based' },
                  { icon: Smartphone, title: 'Mobile Ready', desc: 'All devices' },
                  { icon: Lock, title: 'Secure', desc: 'Enterprise grade' },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <item.icon className="w-5 h-5 text-emerald-500 mb-1" />
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input placeholder="Acme Corporation" value={data.company?.name} onChange={(e) => setData({ ...data, company: { ...data.company!, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') } })} />
              </div>
              <div className="space-y-2">
                <Label>Company Slug *</Label>
                <Input placeholder="acme-corporation" value={data.company?.slug} onChange={(e) => setData({ ...data, company: { ...data.company!, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') } })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={data.company?.timezone} onValueChange={(v) => setData({ ...data, company: { ...data.company!, timezone: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Asia/Dubai">Dubai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={data.company?.currency} onValueChange={(v) => setData({ ...data, company: { ...data.company!, currency: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          
          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Administrator Name *</Label>
                <Input placeholder="John Smith" value={data.admin?.name} onChange={(e) => setData({ ...data, admin: { ...data.admin!, name: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" placeholder="admin@company.com" value={data.admin?.email} onChange={(e) => setData({ ...data, admin: { ...data.admin!, email: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input type="password" placeholder="Min 8 characters" value={data.admin?.password} onChange={(e) => setData({ ...data, admin: { ...data.admin!, password: e.target.value } })} />
              </div>
            </div>
          )}
          
          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Branch Name</Label>
                <Input value={data.branch?.name} onChange={(e) => setData({ ...data, branch: { ...data.branch!, name: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>Branch Code</Label>
                <Input value={data.branch?.code} maxLength={4} onChange={(e) => setData({ ...data, branch: { ...data.branch!, code: e.target.value.toUpperCase() } })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Geofencing</Label>
                  <p className="text-xs text-muted-foreground">Require location for attendance</p>
                </div>
                <Switch checked={data.branch?.enableGeofence} onCheckedChange={(v) => setData({ ...data, branch: { ...data.branch!, enableGeofence: v } })} />
              </div>
            </div>
          )}
          
          {step === 4 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Setup Complete!</h3>
              <p className="text-muted-foreground">Redirecting to dashboard...</p>
            </div>
          )}
        </CardContent>
        
        {step < 4 && (
          <div className="flex justify-between p-4 pt-0">
            <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {step === 3 ? (
              <Button onClick={handleComplete} disabled={loading} className="bg-emerald-500 hover:bg-emerald-600">
                {loading ? 'Setting up...' : 'Complete Setup'} <CheckCircle2 className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => setStep(step + 1)} className="bg-emerald-500 hover:bg-emerald-600">
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================
// MAIN APP COMPONENT
// ============================================
export default function AttendanceApp() {
  const { user, isAuthenticated, setUser, tenant, setTenant } = useAppStore();
  const { employees, branches, attendance, setEmployees, setBranches, setAttendance, addAttendance, updateAttendance } = useDemoStore();
  
  const [showSetup, setShowSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [activeTab, setActiveTab] = useState('my-dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkingIn, setCheckingIn] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [realtimeData, setRealtimeData] = useState<RealtimeData>({ onlineUsers: 0, recentActivity: [] });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Welcome!', message: 'Welcome to AttendanceHub. Check in to start your day.', time: 'Just now', read: false },
    { id: 2, title: 'Leave Approved', message: 'Your leave request for next week has been approved.', time: '2h ago', read: false },
    { id: 3, title: 'Monthly Report', message: 'Your monthly attendance report is ready.', time: '1d ago', read: true },
  ]);
  
  // Determine if user is employee or admin
  const isEmployee = user?.role === 'employee';
  const navItems = isEmployee ? employeeNavItems : adminNavItems;
  const defaultTab = isEmployee ? 'my-dashboard' : 'dashboard';
  
  const socketRef = useRef<Socket | null>(null);
  const isOnline = useOnlineStatus();
  const { location, requestLocation } = useGeolocation();
  const { canInstall, install, isInstalled } = usePWAInstall();
  
  // Check setup status on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch('/api/setup');
        const data = await response.json();
        if (data.needsSetup) {
          setShowSetup(true);
        } else {
          // Auto-login with demo
          setUser({ id: 'user1', email: 'john@techcorp.com', name: 'John Doe', role: 'company_admin', tenantId: 'demo-tenant', employeeId: 'emp1', permissions: ['*:*:*'] });
          setTenant(demoTenant);
        }
      } catch {
        // Demo mode fallback
        setUser({ id: 'user1', email: 'john@techcorp.com', name: 'John Doe', role: 'company_admin', tenantId: 'demo-tenant', employeeId: 'emp1', permissions: ['*:*:*'] });
        setTenant(demoTenant);
      }
      setCheckingSetup(false);
    };
    checkSetup();
  }, []);
  
  // Initialize demo data
  useEffect(() => {
    if (employees.length === 0) setEmployees(demoEmployees);
    if (branches.length === 0) setBranches(demoBranches);
    if (attendance.length === 0) setAttendance(demoAttendance);
  }, []);
  
  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // WebSocket connection
  useEffect(() => {
    if (isAuthenticated && user) {
      const socket = io('/?XTransformPort=3003', {
        auth: { userId: user.id, tenantId: user.tenantId, role: user.role },
        transports: ['websocket'],
      });
      
      socket.on('connect', () => console.log('WebSocket connected'));
      socket.on('stats:live', (data) => setRealtimeData(prev => ({ ...prev, onlineUsers: data.online })));
      socket.on('attendance:checked_in', (data) => setRealtimeData(prev => ({ ...prev, recentActivity: [data, ...prev.recentActivity].slice(0, 10) })));
      
      socketRef.current = socket;
      return () => { socket.disconnect(); };
    }
  }, [isAuthenticated, user]);
  
  const myAttendance = attendance.find(a => a.employeeId === user?.employeeId && a.date.split('T')[0] === new Date().toISOString().split('T')[0]);
  
  const handleCheckIn = async () => {
    setCheckingIn(true);
    await new Promise(r => setTimeout(r, 800));
    const newRecord = {
      id: `att${Date.now()}`, employeeId: user?.employeeId || '', branchId: 'br1', date: new Date().toISOString(),
      checkInTime: new Date().toISOString(), checkOutTime: null, isLate: currentTime.getHours() >= 9 && currentTime.getMinutes() > 15,
      lateMinutes: currentTime.getHours() >= 9 ? (currentTime.getHours() - 9) * 60 + currentTime.getMinutes() - 15 : 0,
      isEarlyLeave: false, earlyLeaveMinutes: 0, totalHours: 0, overtimeHours: 0,
      status: currentTime.getHours() >= 9 && currentTime.getMinutes() > 15 ? 'late' : 'present',
    };
    addAttendance(newRecord);
    if (socketRef.current) socketRef.current.emit('attendance:checkin', newRecord);
    setCheckingIn(false);
  };
  
  const handleCheckOut = async () => {
    if (!myAttendance) return;
    setCheckingIn(true);
    await new Promise(r => setTimeout(r, 800));
    const checkOutTime = new Date();
    const checkInTime = new Date(myAttendance.checkInTime!);
    const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    updateAttendance(myAttendance.id, { checkOutTime: checkOutTime.toISOString(), totalHours, overtimeHours: Math.max(0, totalHours - 8) });
    setCheckingIn(false);
  };
  
  const todayStats = {
    present: attendance.filter(a => a.date.split('T')[0] === new Date().toISOString().split('T')[0] && ['present', 'late'].includes(a.status)).length,
    late: attendance.filter(a => a.date.split('T')[0] === new Date().toISOString().split('T')[0] && a.status === 'late').length,
    absent: employees.length - attendance.filter(a => a.date.split('T')[0] === new Date().toISOString().split('T')[0]).length,
    totalHours: attendance.filter(a => a.date.split('T')[0] === new Date().toISOString().split('T')[0]).reduce((s, a) => s + (a.totalHours || 0), 0),
  };
  
  // Loading state
  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading AttendanceHub...</p>
        </div>
      </div>
    );
  }
  
  // Setup wizard
  if (showSetup) {
    return <SetupWizard onComplete={() => setShowSetup(false)} />;
  }
  
  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">AttendanceHub</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600" onClick={() => { setUser({ id: 'user1', email: 'john@techcorp.com', name: 'John Doe', role: 'company_admin', tenantId: 'demo-tenant', employeeId: 'emp1', permissions: ['*:*:*'] }); setTenant(demoTenant); setActiveTab('dashboard'); }}>
              <Shield className="w-4 h-4 mr-2" /> Sign In as Admin
            </Button>
            <Button className="w-full" variant="outline" onClick={() => { setUser({ id: 'user2', email: 'jane@techcorp.com', name: 'Jane Smith', role: 'employee', tenantId: 'demo-tenant', employeeId: 'emp2', permissions: ['attendance:read:own', 'attendance:create:own', 'timeoff:read:own', 'timeoff:create:own'] }); setTenant(demoTenant); setActiveTab('my-dashboard'); }}>
              <User className="w-4 h-4 mr-2" /> Sign In as Employee
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-slate-800 border-r">
        <div className="flex flex-col h-full w-full">
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold truncate">{tenant?.name || 'AttendanceHub'}</h1>
                <p className="text-xs text-muted-foreground">SaaS Platform</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-2">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${activeTab === item.id ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                <item.icon className="w-5 h-5" /> <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10"><AvatarFallback className="bg-emerald-500 text-white">{user?.name?.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold truncate">{tenant?.name || 'AttendanceHub'}</h1>
                  <p className="text-xs text-muted-foreground">SaaS Platform</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-2">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${activeTab === item.id ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                  <item.icon className="w-5 h-5" /> <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-4 border-t">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10"><AvatarFallback className="bg-emerald-500 text-white">{user?.name?.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="bg-white dark:bg-slate-800 border-b px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 lg:gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)}><Menu className="w-5 h-5" /></Button>
              <div>
                <h2 className="text-lg lg:text-xl font-semibold capitalize">{activeTab}</h2>
                <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">{format(currentTime, 'EEEE, MMMM d, yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-4">
              <Badge variant="outline" className={isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                {isOnline ? <><Wifi className="w-3 h-3 mr-1" /> Online</> : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
              </Badge>
              <p className="text-lg lg:text-2xl font-mono font-bold">{format(currentTime, 'HH:mm:ss')}</p>
              <Button variant="ghost" size="icon" className="relative"><Bell className="w-5 h-5" /><span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">3</span></Button>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 lg:space-y-6">
              {/* Quick Actions */}
              <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{myAttendance?.checkInTime ? (myAttendance.checkOutTime ? 'Goodbye!' : onBreak ? 'On Break' : 'Working') : 'Ready to start?'}</h3>
                      <p className="text-emerald-100 text-sm">{myAttendance?.checkInTime ? `Checked in at ${format(new Date(myAttendance.checkInTime), 'hh:mm a')}` : 'Check in to start tracking'}</p>
                    </div>
                    <div className="flex gap-2">
                      {!myAttendance?.checkInTime ? (
                        <Button size="lg" variant="secondary" className="bg-white text-emerald-600" onClick={handleCheckIn} disabled={checkingIn}><LogIn className="w-5 h-5 mr-2" /> Check In</Button>
                      ) : !myAttendance?.checkOutTime ? (
                        <>
                          <Button size="lg" variant="secondary" className="bg-white/20 text-white" onClick={() => setOnBreak(!onBreak)}><Coffee className="w-5 h-5 mr-2" />{onBreak ? 'End Break' : 'Break'}</Button>
                          <Button size="lg" variant="secondary" className="bg-white text-red-600" onClick={handleCheckOut} disabled={checkingIn}><LogOut className="w-5 h-5 mr-2" /> Check Out</Button>
                        </>
                      ) : (
                        <div className="text-right"><p className="text-2xl font-bold">{myAttendance.totalHours?.toFixed(1)}h</p><p className="text-sm text-emerald-100">Total today</p></div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                {[
                  { label: 'Present', value: todayStats.present, icon: UserCheck, color: 'emerald' },
                  { label: 'Late', value: todayStats.late, icon: AlertTriangle, color: 'amber' },
                  { label: 'Absent', value: todayStats.absent, icon: UserX, color: 'red' },
                  { label: 'Hours', value: `${todayStats.totalHours.toFixed(1)}h`, icon: Timer, color: 'blue' },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="p-3 lg:p-4">
                      <div className="flex items-center justify-between">
                        <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl lg:text-2xl font-bold">{s.value}</p></div>
                        <div className={`w-10 h-10 bg-${s.color}-100 rounded-xl flex items-center justify-center`}><s.icon className={`w-5 h-5 text-${s.color}-600`} /></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Weekly Attendance</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-48 lg:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="present" fill="#10b981" name="Present" />
                          <Bar dataKey="late" fill="#f59e0b" name="Late" />
                          <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Today's Status</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-48 lg:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                            {statusPieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                          </Pie>
                          <Tooltip /><Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Monthly Trend */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Trend</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-48 lg:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="attendance" stroke="#10b981" fill="#10b98133" name="Attendance %" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              {/* Live Activity */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Activity className="w-5 h-5" /> Live Activity {realtimeData.onlineUsers > 0 && <Badge variant="outline" className="text-xs">{realtimeData.onlineUsers} online</Badge>}</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {attendance.slice(0, 8).map(r => {
                        const emp = employees.find(e => e.id === r.employeeId);
                        const br = branches.find(b => b.id === r.branchId);
                        return (
                          <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                            <Avatar className="w-8 h-8"><AvatarFallback className="text-xs">{emp?.firstName?.[0]}{emp?.lastName?.[0]}</AvatarFallback></Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{emp?.firstName} {emp?.lastName}</p>
                              <p className="text-xs text-muted-foreground">{br?.name}</p>
                            </div>
                            <Badge className={r.status === 'present' ? 'bg-emerald-500' : r.status === 'late' ? 'bg-amber-500' : 'bg-slate-500'}>{r.status}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Attendance Records</h3>
                <div className="flex gap-2">
                  <Input type="date" className="w-40" defaultValue={new Date().toISOString().split('T')[0]} />
                  <Button variant="outline" onClick={() => setShowExportDialog(true)}><Download className="w-4 h-4 mr-2" /> Export</Button>
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[500px]">
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">Employee</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Branch</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">In</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Out</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Hours</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attendance.map(r => {
                          const emp = employees.find(e => e.id === r.employeeId);
                          const br = branches.find(b => b.id === r.branchId);
                          return (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-8 h-8"><AvatarFallback className="text-xs">{emp?.firstName?.[0]}{emp?.lastName?.[0]}</AvatarFallback></Avatar>
                                  <div><p className="font-medium text-sm">{emp?.firstName} {emp?.lastName}</p><p className="text-xs text-muted-foreground">{emp?.employeeCode}</p></div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">{br?.name}</td>
                              <td className="px-4 py-3 text-sm">{r.checkInTime ? format(new Date(r.checkInTime), 'hh:mm a') : '-'}</td>
                              <td className="px-4 py-3 text-sm">{r.checkOutTime ? format(new Date(r.checkOutTime), 'hh:mm a') : '-'}</td>
                              <td className="px-4 py-3 text-sm">{r.totalHours?.toFixed(1)}h</td>
                              <td className="px-4 py-3"><Badge className={`${r.status === 'present' ? 'bg-emerald-500' : r.status === 'late' ? 'bg-amber-500' : 'bg-slate-500'}`}>{r.status}</Badge></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Time Off Tab */}
          {activeTab === 'timeoff' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Time Off</h3>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowLeaveDialog(true)}><Plus className="w-4 h-4 mr-2" /> Request Leave</Button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {demoLeaveTypes.map(lt => {
                  const balance = demoLeaveBalances.find(b => b.leaveTypeId === lt.id);
                  const remaining = (balance?.totalDays || 0) - (balance?.usedDays || 0) - (balance?.pendingDays || 0);
                  return (
                    <Card key={lt.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lt.color }} />
                          <span className="font-medium text-sm">{lt.name}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Remaining</span>
                          <span className="font-medium">{remaining} / {balance?.totalDays || 0}</span>
                        </div>
                        <Progress value={(remaining / (balance?.totalDays || 1)) * 100} className="h-2" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Employees</h3>
                <Button className="bg-emerald-500 hover:bg-emerald-600"><Users className="w-4 h-4 mr-2" /> Add</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees.map(emp => {
                  const br = branches.find(b => b.id === emp.branchId);
                  return (
                    <Card key={emp.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-12 h-12"><AvatarFallback className="bg-emerald-500 text-white">{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback></Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{emp.firstName} {emp.lastName}</p>
                            <p className="text-sm text-muted-foreground truncate">{emp.position}</p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">{emp.employeeCode}</Badge>
                              <Badge className={emp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-500'}>{emp.status}</Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Reports</h3>
                <Button variant="outline" onClick={() => setShowExportDialog(true)}><Download className="w-4 h-4 mr-2" /> Export</Button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { title: 'Daily Report', icon: Calendar, desc: 'Daily summary' },
                  { title: 'Late Report', icon: AlertTriangle, desc: 'Late analysis' },
                  { title: 'Hours Report', icon: Timer, desc: 'Hours breakdown' },
                  { title: 'Compliance', icon: CheckCircle2, desc: 'Policy compliance' },
                ].map(r => (
                  <Card key={r.title} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><r.icon className="w-5 h-5 text-emerald-600" /></div>
                        <div><p className="font-medium text-sm">{r.title}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Attendance Trend</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip /><Legend />
                        <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Payroll Tab */}
          {activeTab === 'payroll' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Payroll</h3>
                <Button className="bg-emerald-500 hover:bg-emerald-600">Generate Payroll</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: 'Total Payroll', value: '$45,250', icon: DollarSign, color: 'emerald' },
                  { title: 'Overtime', value: '$2,340', icon: TrendingUp, color: 'blue' },
                  { title: 'Deductions', value: '$450', icon: AlertTriangle, color: 'amber' },
                ].map(s => (
                  <Card key={s.title}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 bg-${s.color}-100 rounded-xl flex items-center justify-center`}><s.icon className={`w-6 h-6 text-${s.color}-600`} /></div>
                        <div><p className="text-sm text-muted-foreground">{s.title}</p><p className="text-2xl font-bold">{s.value}</p></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Settings</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Company</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2"><Label className="text-sm">Name</Label><Input defaultValue={tenant?.name} /></div>
                    <div className="space-y-2"><Label className="text-sm">Timezone</Label><Input defaultValue={tenant?.timezone} /></div>
                    <Button>Save</Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Attendance Rules</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2"><Label className="text-sm">Grace Minutes</Label><Input type="number" defaultValue={15} /></div>
                    <div className="flex gap-2"><Input defaultValue="09:00" /><Input defaultValue="18:00" /></div>
                    <Button>Save</Button>
                  </CardContent>
                </Card>
              </div>
              {canInstall && !isInstalled && (
                <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div><h3 className="font-semibold">Install AttendanceHub</h3><p className="text-blue-100 text-sm">Get quick access and offline support</p></div>
                    <Button variant="secondary" onClick={install}><Download className="w-4 h-4 mr-2" /> Install</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          {/* ============================================ */}
          {/* EMPLOYEE VIEWS */}
          {/* ============================================ */}
          
          {/* Employee Dashboard */}
          {activeTab === 'my-dashboard' && (
            <div className="space-y-4 lg:space-y-6">
              {/* Welcome Card */}
              <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">Hello, {user?.name?.split(' ')[0]}! 👋</h3>
                      <p className="text-emerald-100">{format(currentTime, 'EEEE, MMMM d, yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-mono font-bold">{format(currentTime, 'HH:mm:ss')}</p>
                      <Badge variant="outline" className="bg-white/20 text-white border-white/30 mt-1">
                        {isOnline ? <><Wifi className="w-3 h-3 mr-1" /> Online</> : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Quick Check-in Card */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-5 h-5 text-emerald-500" /> Today's Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                      {myAttendance?.checkInTime ? (
                        myAttendance.checkOutTime ? (
                          <div>
                            <Badge className="bg-slate-500 mb-2">Completed</Badge>
                            <p className="text-2xl font-bold">{myAttendance.totalHours?.toFixed(1)}h</p>
                            <p className="text-sm text-muted-foreground">Total working hours today</p>
                          </div>
                        ) : (
                          <div>
                            <Badge className="bg-emerald-500 mb-2 animate-pulse">Working</Badge>
                            <p className="text-2xl font-bold">{((currentTime.getTime() - new Date(myAttendance.checkInTime).getTime()) / (1000 * 60 * 60)).toFixed(1)}h</p>
                            <p className="text-sm text-muted-foreground">Checked in at {format(new Date(myAttendance.checkInTime), 'hh:mm a')}</p>
                          </div>
                        )
                      ) : (
                        <div>
                          <Badge variant="outline" className="mb-2">Not Checked In</Badge>
                          <p className="text-lg font-medium">Ready to start your day?</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {!myAttendance?.checkInTime ? (
                        <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 w-40" onClick={handleCheckIn} disabled={checkingIn}>
                          {checkingIn ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <LogIn className="w-5 h-5 mr-2" />} Check In
                        </Button>
                      ) : !myAttendance?.checkOutTime ? (
                        <>
                          <Button size="lg" className="bg-red-500 hover:bg-red-600 w-40" onClick={handleCheckOut} disabled={checkingIn}>
                            <LogOut className="w-5 h-5 mr-2" /> Check Out
                          </Button>
                          <Button size="lg" variant="outline" className="w-40" onClick={() => setOnBreak(!onBreak)}>
                            <Coffee className="w-5 h-5 mr-2" /> {onBreak ? 'End Break' : 'Break'}
                          </Button>
                        </>
                      ) : (
                        <div className="text-center p-4 bg-slate-50 rounded-lg">
                          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                          <p className="font-medium">Day Complete!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* My Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'This Week', value: '32.5h', icon: Timer, color: 'emerald' },
                  { label: 'This Month', value: '142h', icon: Calendar, color: 'blue' },
                  { label: 'Leave Balance', value: '16 days', icon: Plane, color: 'amber' },
                  { label: 'On Time', value: '95%', icon: CheckCircle2, color: 'green' },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="p-3 lg:p-4">
                      <div className="flex items-center justify-between">
                        <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
                        <div className={`w-10 h-10 bg-${s.color}-100 rounded-xl flex items-center justify-center`}><s.icon className={`w-5 h-5 text-${s.color}-600`} /></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* My Leave Balances */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plane className="w-5 h-5 text-emerald-500" /> My Leave Balances</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {demoLeaveTypes.map(lt => {
                      const balance = demoLeaveBalances.find(b => b.leaveTypeId === lt.id);
                      const remaining = (balance?.totalDays || 0) - (balance?.usedDays || 0) - (balance?.pendingDays || 0);
                      return (
                        <div key={lt.id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lt.color }} />
                            <span className="font-medium text-sm">{lt.name}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Remaining</span>
                            <span className="font-bold">{remaining} / {balance?.totalDays || 0}</span>
                          </div>
                          <Progress value={(remaining / (balance?.totalDays || 1)) * 100} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Employee Check In/Out */}
          {activeTab === 'check-in' && (
            <div className="space-y-4 max-w-lg mx-auto">
              <Card className="border-2 border-emerald-200">
                <CardContent className="p-6 text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-12 h-12 text-white" />
                  </div>
                  <p className="text-4xl font-mono font-bold mb-2">{format(currentTime, 'HH:mm:ss')}</p>
                  <p className="text-muted-foreground mb-6">{format(currentTime, 'EEEE, MMMM d, yyyy')}</p>
                  
                  {!myAttendance?.checkInTime ? (
                    <Button size="lg" className="w-full bg-emerald-500 hover:bg-emerald-600 h-14 text-lg" onClick={handleCheckIn} disabled={checkingIn}>
                      {checkingIn ? <RefreshCw className="w-6 h-6 mr-2 animate-spin" /> : <LogIn className="w-6 h-6 mr-2" />} Check In
                    </Button>
                  ) : !myAttendance.checkOutTime ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-emerald-50 rounded-lg mb-4">
                        <p className="text-sm text-muted-foreground">Checked in at</p>
                        <p className="text-2xl font-bold text-emerald-600">{format(new Date(myAttendance.checkInTime), 'hh:mm a')}</p>
                        <p className="text-sm mt-2">Working for {((currentTime.getTime() - new Date(myAttendance.checkInTime).getTime()) / (1000 * 60 * 60)).toFixed(1)} hours</p>
                      </div>
                      <Button size="lg" variant="outline" className="w-full h-12" onClick={() => setOnBreak(!onBreak)}>
                        <Coffee className="w-5 h-5 mr-2" /> {onBreak ? 'End Break' : 'Start Break'}
                      </Button>
                      <Button size="lg" className="w-full bg-red-500 hover:bg-red-600 h-14 text-lg" onClick={handleCheckOut} disabled={checkingIn}>
                        <LogOut className="w-6 h-6 mr-2" /> Check Out
                      </Button>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-lg">
                      <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                      <p className="text-xl font-semibold mb-2">Day Complete!</p>
                      <p className="text-3xl font-bold text-emerald-600">{myAttendance.totalHours?.toFixed(1)}h</p>
                      <p className="text-muted-foreground">Total working hours</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Location Status */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${location ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                      <MapPin className={`w-5 h-5 ${location ? 'text-emerald-600' : 'text-amber-600'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{location ? 'Location Detected' : 'Location Required'}</p>
                      <p className="text-sm text-muted-foreground">
                        {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Enable location for attendance'}
                      </p>
                    </div>
                    {!location && (
                      <Button variant="outline" size="sm" onClick={requestLocation}>
                        Enable
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Face ID Tab */}
          {activeTab === 'face-id' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              {/* Face Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scan className="w-5 h-5 text-emerald-500" />
                    Face Recognition
                  </CardTitle>
                  <CardDescription>
                    Use your face for quick and secure attendance check-in
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Shield className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Face ID Status</p>
                      <p className="text-sm text-muted-foreground">Secure facial recognition enabled</p>
                    </div>
                    <Badge className="bg-emerald-500">Active</Badge>
                  </div>
                  
                  {/* Face Registration */}
                  <FaceRegistrationWidget
                    employeeId={user?.employeeId || ''}
                    employeeName={user?.name || ''}
                    isRegistered={false}
                  />
                </CardContent>
              </Card>
              
              {/* Quick Face Attendance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Check-In with Face</CardTitle>
                  <CardDescription>
                    Skip manual check-in - use your face instead
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FaceAttendanceWidget
                    employeeId={user?.employeeId || ''}
                    employeeName={user?.name || ''}
                    isCheckedIn={!!myAttendance?.checkInTime && !myAttendance?.checkOutTime}
                  />
                </CardContent>
              </Card>
              
              {/* How it works */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">How Face ID Works</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { step: 1, title: 'Register Your Face', desc: 'Take a clear photo to enroll your face' },
                      { step: 2, title: 'Quick Check-In', desc: 'Simply look at the camera to check in' },
                      { step: 3, title: 'Secure Verification', desc: 'AI verifies your identity in seconds' },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-emerald-600">{item.step}</span>
                        </div>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Privacy Notice */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">Your Privacy Matters</p>
                    <p className="text-sm text-blue-600 mt-1">
                      Face data is encrypted and stored securely. It's only used for attendance verification 
                      and never shared with third parties.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* My Attendance History */}
          {activeTab === 'my-attendance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">My Attendance History</h3>
                <Input type="month" className="w-40" defaultValue={format(new Date(), 'yyyy-MM')} />
              </div>
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[500px]">
                    <table className="w-full">
                      <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Check In</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Check Out</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Hours</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attendance.filter(a => a.employeeId === user?.employeeId).concat([
                          { id: 'h1', date: new Date(Date.now() - 86400000).toISOString(), checkInTime: new Date(Date.now() - 86400000 + 9*3600000).toISOString(), checkOutTime: new Date(Date.now() - 86400000 + 18*3600000).toISOString(), totalHours: 9, status: 'present' },
                          { id: 'h2', date: new Date(Date.now() - 2*86400000).toISOString(), checkInTime: new Date(Date.now() - 2*86400000 + 9.25*3600000).toISOString(), checkOutTime: new Date(Date.now() - 2*86400000 + 18*3600000).toISOString(), totalHours: 8.75, status: 'late', lateMinutes: 15 },
                          { id: 'h3', date: new Date(Date.now() - 3*86400000).toISOString(), checkInTime: new Date(Date.now() - 3*86400000 + 9*3600000).toISOString(), checkOutTime: new Date(Date.now() - 3*86400000 + 17*3600000).toISOString(), totalHours: 8, status: 'early_leave' },
                        ]).map(r => (
                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 text-sm">{format(new Date(r.date), 'EEE, MMM d')}</td>
                            <td className="px-4 py-3 text-sm">{r.checkInTime ? format(new Date(r.checkInTime), 'hh:mm a') : '-'}</td>
                            <td className="px-4 py-3 text-sm">{r.checkOutTime ? format(new Date(r.checkOutTime), 'hh:mm a') : '-'}</td>
                            <td className="px-4 py-3 text-sm">{r.totalHours?.toFixed(1)}h</td>
                            <td className="px-4 py-3">
                              <Badge className={`${r.status === 'present' ? 'bg-emerald-500' : r.status === 'late' ? 'bg-amber-500' : 'bg-slate-500'}`}>
                                {r.status === 'present' ? 'On Time' : r.status === 'late' ? `Late (${r.lateMinutes}m)` : 'Early Leave'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* My Time Off */}
          {activeTab === 'my-timeoff' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">My Leave Requests</h3>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowLeaveDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Request Leave
                </Button>
              </div>
              
              {/* Leave Balances */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {demoLeaveTypes.map(lt => {
                  const balance = demoLeaveBalances.find(b => b.leaveTypeId === lt.id);
                  const remaining = (balance?.totalDays || 0) - (balance?.usedDays || 0) - (balance?.pendingDays || 0);
                  return (
                    <Card key={lt.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lt.color }} />
                          <span className="font-medium text-sm">{lt.name}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Remaining</span>
                          <span className="font-medium">{remaining} / {balance?.totalDays || 0}</span>
                        </div>
                        <Progress value={(remaining / (balance?.totalDays || 1)) * 100} className="h-2" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              
              {/* Leave Requests */}
              <Card>
                <CardHeader><CardTitle className="text-base">Recent Requests</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { type: 'Annual Leave', from: 'Dec 25', to: 'Dec 28', days: 4, status: 'approved' },
                      { type: 'Sick Leave', from: 'Dec 10', to: 'Dec 10', days: 1, status: 'approved' },
                      { type: 'Personal Leave', from: 'Nov 15', to: 'Nov 15', days: 1, status: 'pending' },
                    ].map((req, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium">{req.type}</p>
                          <p className="text-sm text-muted-foreground">{req.from} - {req.to} ({req.days} day{req.days > 1 ? 's' : ''})</p>
                        </div>
                        <Badge className={`${req.status === 'approved' ? 'bg-emerald-500' : req.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`}>
                          {req.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* My Profile */}
          {activeTab === 'my-profile' && (
            <div className="space-y-4 max-w-2xl">
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <Avatar className="w-24 h-24">
                      <AvatarFallback className="bg-emerald-500 text-white text-2xl">
                        {user?.name?.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center sm:text-left">
                      <h2 className="text-2xl font-bold">{user?.name}</h2>
                      <p className="text-muted-foreground">{user?.email}</p>
                      <Badge className="mt-2">{user?.role === 'employee' ? 'Employee' : 'Administrator'}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input defaultValue={user?.name?.split(' ')[0]} />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input defaultValue={user?.name?.split(' ')[1]} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input defaultValue={user?.email} type="email" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input placeholder="+1 234 567 8900" />
                    </div>
                  </div>
                  <Button className="bg-emerald-500 hover:bg-emerald-600">Save Changes</Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader><CardTitle className="text-base">Work Information</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Employee ID</p><p className="font-medium">{user?.employeeId}</p></div>
                    <div><p className="text-muted-foreground">Position</p><p className="font-medium">Product Manager</p></div>
                    <div><p className="text-muted-foreground">Department</p><p className="font-medium">Engineering</p></div>
                    <div><p className="text-muted-foreground">Branch</p><p className="font-medium">Headquarters</p></div>
                    <div><p className="text-muted-foreground">Hire Date</p><p className="font-medium">Jan 15, 2023</p></div>
                    <div><p className="text-muted-foreground">Manager</p><p className="font-medium">John Doe</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Help & Support */}
          {activeTab === 'help' && (
            <div className="space-y-4 max-w-2xl">
              <Card>
                <CardHeader><CardTitle className="text-base">Quick Guide</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { icon: LogIn, title: 'How to Check In', desc: 'Click the "Check In" button on your dashboard when you arrive at work. Make sure location services are enabled.' },
                      { icon: LogOut, title: 'How to Check Out', desc: 'Click "Check Out" when leaving work. Your total hours will be calculated automatically.' },
                      { icon: Plane, title: 'Request Leave', desc: 'Go to "Leave Requests" tab and click "Request Leave". Select dates and type, then submit for approval.' },
                      { icon: Calendar, title: 'View History', desc: 'Check "My History" to see all your past attendance records and working hours.' },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-4 p-3 bg-slate-50 rounded-lg">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                          <item.icon className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader><CardTitle className="text-base">Need Help?</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start"><Bell className="w-4 h-4 mr-3" /> Contact HR</Button>
                  <Button variant="outline" className="w-full justify-start"><FileText className="w-4 h-4 mr-3" /> FAQ</Button>
                  <Button variant="outline" className="w-full justify-start"><Shield className="w-4 h-4 mr-3" /> Privacy Policy</Button>
                </CardContent>
              </Card>
              
              {canInstall && !isInstalled && (
                <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Install AttendanceHub</h3>
                      <p className="text-blue-100 text-sm">Get quick access and offline support</p>
                    </div>
                    <Button variant="secondary" onClick={install}>
                      <Download className="w-4 h-4 mr-2" /> Install
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <footer className="bg-white dark:bg-slate-800 border-t px-4 py-3 mt-auto">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>© 2024 AttendanceHub</p>
            <div className="flex items-center gap-4"><span>v1.0.0</span><Badge variant="outline" className="text-xs"><Shield className="w-3 h-3 mr-1" /> Secure</Badge></div>
          </div>
        </footer>
      </main>
      
      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Export Report</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            <Button variant="outline" className="flex flex-col h-20 gap-2"><FileText className="w-6 h-6" /><span className="text-xs">PDF</span></Button>
            <Button variant="outline" className="flex flex-col h-20 gap-2"><FileSpreadsheet className="w-6 h-6" /><span className="text-xs">Excel</span></Button>
            <Button variant="outline" className="flex flex-col h-20 gap-2"><FileText className="w-6 h-6" /><span className="text-xs">CSV</span></Button>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button><Button className="bg-emerald-500">Export</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Leave Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            <Select><SelectTrigger><SelectValue placeholder="Leave type" /></SelectTrigger><SelectContent>{demoLeaveTypes.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}</SelectContent></Select>
            <div className="grid grid-cols-2 gap-3"><Input type="date" /><Input type="date" /></div>
            <Textarea placeholder="Reason..." rows={3} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowLeaveDialog(false)}>Cancel</Button><Button className="bg-emerald-500"><Send className="w-4 h-4 mr-2" /> Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
