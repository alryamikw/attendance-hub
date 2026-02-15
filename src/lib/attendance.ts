/**
 * Attendance Engine
 * Handles all attendance-related business logic
 */

import { db } from './db';

export interface CheckInData {
  employeeId: string;
  tenantId: string;
  branchId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  deviceId?: string;
  ipAddress?: string;
  photo?: string;
  faceMatchScore?: number;
  method?: 'online' | 'offline';
  syncId?: string;
}

export interface CheckOutData {
  employeeId: string;
  tenantId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  deviceId?: string;
  ipAddress?: string;
  photo?: string;
  faceMatchScore?: number;
  method?: 'online' | 'offline';
}

export interface AttendanceResult {
  success: boolean;
  attendanceId?: string;
  error?: string;
  warnings?: string[];
  isLate?: boolean;
  lateMinutes?: number;
}

export interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  earlyLeave: number;
  totalHours: number;
  overtimeHours: number;
}

/**
 * Get employee's schedule for today
 */
export async function getEmployeeSchedule(employeeId: string, date: Date) {
  const dayOfWeek = date.getDay();
  
  const assignment = await db.scheduleAssignment.findFirst({
    where: {
      employeeId,
      startDate: { lte: date },
      OR: [
        { endDate: null },
        { endDate: { gte: date } },
      ],
    },
    include: {
      schedule: true,
    },
  });
  
  if (!assignment) return null;
  
  const schedule = assignment.schedule;
  const workingDays = schedule.workingDays.split(',').map(Number);
  
  if (!workingDays.includes(dayOfWeek)) {
    return { schedule, isWorkingDay: false };
  }
  
  return { schedule, isWorkingDay: true };
}

/**
 * Get tenant's attendance rules
 */
export async function getTenantAttendanceRules(tenantId: string) {
  return db.attendanceRule.findFirst({
    where: { tenantId },
  });
}

/**
 * Check if today is a holiday
 */
export async function isHoliday(tenantId: string, date: Date) {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const holiday = await db.holiday.findFirst({
    where: {
      tenantId,
      date: dateOnly,
    },
  });
  
  return holiday;
}

/**
 * Parse time string to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate late minutes
 */
export function calculateLateMinutes(
  checkInTime: Date,
  scheduleStartTime: string,
  graceMinutes: number
): number {
  const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
  const startMinutes = parseTimeToMinutes(scheduleStartTime);
  const allowedMinutes = startMinutes + graceMinutes;
  
  if (checkInMinutes <= allowedMinutes) {
    return 0;
  }
  
  return checkInMinutes - startMinutes;
}

/**
 * Calculate early leave minutes
 */
export function calculateEarlyLeaveMinutes(
  checkOutTime: Date,
  scheduleEndTime: string,
  graceMinutes: number
): number {
  const checkOutMinutes = checkOutTime.getHours() * 60 + checkOutTime.getMinutes();
  const endMinutes = parseTimeToMinutes(scheduleEndTime);
  const allowedMinutes = endMinutes - graceMinutes;
  
  if (checkOutMinutes >= allowedMinutes) {
    return 0;
  }
  
  return endMinutes - checkOutMinutes;
}

/**
 * Calculate total working hours
 */
export function calculateWorkingHours(
  checkInTime: Date,
  checkOutTime: Date,
  breakMinutes: number = 0
): number {
  const diffMs = checkOutTime.getTime() - checkInTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.max(0, diffHours - breakMinutes / 60);
}

/**
 * Calculate overtime hours
 */
export function calculateOvertimeHours(
  totalHours: number,
  standardHours: number = 8
): number {
  return Math.max(0, totalHours - standardHours);
}

/**
 * Check-in
 */
export async function checkIn(data: CheckInData): Promise<AttendanceResult> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if already checked in today
    const existingAttendance = await db.attendance.findFirst({
      where: {
        employeeId: data.employeeId,
        date: today,
        checkInTime: { not: null },
      },
    });
    
    if (existingAttendance) {
      return {
        success: false,
        error: 'Already checked in today',
      };
    }
    
    // Get schedule and rules
    const [scheduleData, rules, holiday] = await Promise.all([
      getEmployeeSchedule(data.employeeId, today),
      getTenantAttendanceRules(data.tenantId),
      isHoliday(data.tenantId, today),
    ]);
    
    // Determine status
    let status = 'present';
    let isLate = false;
    let lateMinutes = 0;
    const warnings: string[] = [];
    
    if (holiday) {
      status = 'holiday';
    } else if (scheduleData && !scheduleData.isWorkingDay) {
      status = 'off';
    } else if (scheduleData?.schedule) {
      const schedule = scheduleData.schedule;
      const graceMinutes = schedule.graceMinutes || rules?.lateThresholdMinutes || 15;
      
      lateMinutes = calculateLateMinutes(new Date(), schedule.startTime, graceMinutes);
      
      if (lateMinutes > 0) {
        isLate = true;
        status = 'late';
        warnings.push(`You are ${lateMinutes} minutes late`);
      }
    }
    
    // Create attendance record
    const attendance = await db.attendance.create({
      data: {
        tenantId: data.tenantId,
        employeeId: data.employeeId,
        branchId: data.branchId,
        date: today,
        checkInTime: new Date(),
        checkInLatitude: data.latitude,
        checkInLongitude: data.longitude,
        checkInAccuracy: data.accuracy,
        checkInPhoto: data.photo,
        checkInDeviceId: data.deviceId,
        checkInIpAddress: data.ipAddress,
        checkInMethod: data.method || 'online',
        isLate,
        lateMinutes,
        status,
        faceMatchScore: data.faceMatchScore,
        syncId: data.syncId,
        syncStatus: data.method === 'offline' ? 'pending' : 'synced',
      },
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: data.tenantId,
        action: 'check_in',
        module: 'attendance',
        resourceId: attendance.id,
      },
    });
    
    return {
      success: true,
      attendanceId: attendance.id,
      isLate,
      lateMinutes,
      warnings,
    };
  } catch (error) {
    console.error('Check-in error:', error);
    return {
      success: false,
      error: 'An error occurred during check-in',
    };
  }
}

/**
 * Check-out
 */
export async function checkOut(data: CheckOutData): Promise<AttendanceResult> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find today's attendance
    const attendance = await db.attendance.findFirst({
      where: {
        employeeId: data.employeeId,
        date: today,
        checkInTime: { not: null },
        checkOutTime: null,
      },
    });
    
    if (!attendance) {
      return {
        success: false,
        error: 'No check-in record found for today',
      };
    }
    
    // Get schedule and rules
    const [scheduleData, rules] = await Promise.all([
      getEmployeeSchedule(data.employeeId, today),
      getTenantAttendanceRules(data.tenantId),
    ]);
    
    // Calculate times
    let isEarlyLeave = false;
    let earlyLeaveMinutes = 0;
    let totalHours = 0;
    let overtimeHours = 0;
    const warnings: string[] = [];
    
    if (attendance.checkInTime) {
      const checkInTime = new Date(attendance.checkInTime);
      const checkOutTime = new Date();
      
      totalHours = calculateWorkingHours(checkInTime, checkOutTime, attendance.breakMinutes);
      overtimeHours = calculateOvertimeHours(totalHours);
      
      if (scheduleData?.schedule) {
        const schedule = scheduleData.schedule;
        const graceMinutes = schedule.graceMinutes || rules?.earlyLeaveThresholdMinutes || 15;
        
        earlyLeaveMinutes = calculateEarlyLeaveMinutes(checkOutTime, schedule.endTime, graceMinutes);
        
        if (earlyLeaveMinutes > 0) {
          isEarlyLeave = true;
          warnings.push(`You are leaving ${earlyLeaveMinutes} minutes early`);
        }
      }
    }
    
    // Update attendance record
    const updated = await db.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOutTime: new Date(),
        checkOutLatitude: data.latitude,
        checkOutLongitude: data.longitude,
        checkOutAccuracy: data.accuracy,
        checkOutPhoto: data.photo,
        checkOutDeviceId: data.deviceId,
        checkOutIpAddress: data.ipAddress,
        checkOutMethod: data.method || 'online',
        isEarlyLeave,
        earlyLeaveMinutes,
        totalHours,
        overtimeHours,
        status: isEarlyLeave ? 'early_leave' : attendance.status,
        faceMatchScore: data.faceMatchScore,
        syncStatus: data.method === 'offline' ? 'pending' : 'synced',
      },
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: data.tenantId,
        action: 'check_out',
        module: 'attendance',
        resourceId: updated.id,
      },
    });
    
    return {
      success: true,
      attendanceId: updated.id,
      warnings,
    };
  } catch (error) {
    console.error('Check-out error:', error);
    return {
      success: false,
      error: 'An error occurred during check-out',
    };
  }
}

/**
 * Get today's attendance for employee
 */
export async function getTodayAttendance(employeeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return db.attendance.findFirst({
    where: {
      employeeId,
      date: today,
    },
    include: {
      branch: true,
      breaks: true,
    },
  });
}

/**
 * Get attendance history
 */
export async function getAttendanceHistory(
  employeeId: string,
  startDate: Date,
  endDate: Date
) {
  return db.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      branch: true,
    },
    orderBy: {
      date: 'desc',
    },
  });
}

/**
 * Get attendance statistics
 */
export async function getAttendanceStats(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  branchId?: string
): Promise<AttendanceStats> {
  const where: any = {
    tenantId,
    date: {
      gte: startDate,
      lte: endDate,
    },
  };
  
  if (branchId) {
    where.branchId = branchId;
  }
  
  const records = await db.attendance.findMany({
    where,
    select: {
      status: true,
      totalHours: true,
      overtimeHours: true,
    },
  });
  
  return {
    present: records.filter(r => r.status === 'present' || r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
    late: records.filter(r => r.status === 'late').length,
    earlyLeave: records.filter(r => r.status === 'early_leave').length,
    totalHours: records.reduce((sum, r) => sum + (r.totalHours || 0), 0),
    overtimeHours: records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
  };
}

/**
 * Start break
 */
export async function startBreak(
  employeeId: string,
  tenantId: string,
  breakType: string = 'break'
): Promise<{ success: boolean; breakId?: string; error?: string }> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const attendance = await db.attendance.findFirst({
      where: {
        employeeId,
        date: today,
        checkInTime: { not: null },
        checkOutTime: null,
      },
    });
    
    if (!attendance) {
      return { success: false, error: 'No active attendance record' };
    }
    
    // Check for existing active break
    const activeBreak = await db.attendanceBreak.findFirst({
      where: {
        attendanceId: attendance.id,
        breakEnd: null,
      },
    });
    
    if (activeBreak) {
      return { success: false, error: 'Already on break' };
    }
    
    const breakRecord = await db.attendanceBreak.create({
      data: {
        attendanceId: attendance.id,
        breakStart: new Date(),
        breakType,
      },
    });
    
    return { success: true, breakId: breakRecord.id };
  } catch (error) {
    console.error('Start break error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * End break
 */
export async function endBreak(
  employeeId: string
): Promise<{ success: boolean; duration?: number; error?: string }> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const attendance = await db.attendance.findFirst({
      where: {
        employeeId,
        date: today,
      },
    });
    
    if (!attendance) {
      return { success: false, error: 'No attendance record found' };
    }
    
    const activeBreak = await db.attendanceBreak.findFirst({
      where: {
        attendanceId: attendance.id,
        breakEnd: null,
      },
    });
    
    if (!activeBreak) {
      return { success: false, error: 'No active break found' };
    }
    
    const breakEnd = new Date();
    const duration = Math.round(
      (breakEnd.getTime() - new Date(activeBreak.breakStart).getTime()) / 60000
    );
    
    await db.attendanceBreak.update({
      where: { id: activeBreak.id },
      data: {
        breakEnd,
        duration,
      },
    });
    
    // Update total break minutes
    await db.attendance.update({
      where: { id: attendance.id },
      data: {
        breakMinutes: { increment: duration },
      },
    });
    
    return { success: true, duration };
  } catch (error) {
    console.error('End break error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Get live attendance count (present today)
 */
export async function getLiveAttendanceCount(tenantId: string, branchId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const where: any = {
    tenantId,
    date: today,
    checkInTime: { not: null },
  };
  
  if (branchId) {
    where.branchId = branchId;
  }
  
  const [total, checkedIn, checkedOut] = await Promise.all([
    db.employee.count({
      where: {
        tenantId,
        status: 'active',
        ...(branchId ? { branchId } : {}),
      },
    }),
    db.attendance.count({
      where: {
        ...where,
        checkOutTime: null,
      },
    }),
    db.attendance.count({
      where: {
        ...where,
        checkOutTime: { not: null },
      },
    }),
  ]);
  
  return {
    totalEmployees: total,
    currentlyPresent: checkedIn,
    alreadyLeft: checkedOut,
    notYetArrived: total - checkedIn - checkedOut,
  };
}
