/**
 * Time-Off Management Engine
 * Handles leave requests, balances, and approvals
 */

import { db } from './db';

export interface TimeOffRequestData {
  employeeId: string;
  tenantId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  documentUrl?: string;
}

export interface TimeOffResult {
  success: boolean;
  requestId?: string;
  error?: string;
  totalDays?: number;
}

/**
 * Calculate working days between two dates
 */
export function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // Exclude weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Get leave balance for employee
 */
export async function getLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number = new Date().getFullYear()
) {
  return db.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId,
        year,
      },
    },
    include: {
      leaveType: true,
    },
  });
}

/**
 * Get all leave balances for employee
 */
export async function getEmployeeLeaveBalances(employeeId: string, year?: number) {
  const targetYear = year || new Date().getFullYear();
  
  return db.leaveBalance.findMany({
    where: {
      employeeId,
      year: targetYear,
    },
    include: {
      leaveType: true,
    },
  });
}

/**
 * Initialize leave balance for employee
 */
export async function initializeLeaveBalance(
  tenantId: string,
  employeeId: string,
  leaveTypeId: string,
  year: number = new Date().getFullYear()
) {
  const leaveType = await db.leaveType.findUnique({
    where: { id: leaveTypeId },
  });
  
  if (!leaveType) {
    throw new Error('Leave type not found');
  }
  
  // Check if balance already exists
  const existing = await getLeaveBalance(employeeId, leaveTypeId, year);
  if (existing) {
    return existing;
  }
  
  // Get carried over days from previous year
  let carriedOver = 0;
  if (leaveType.isCarryOver) {
    const prevBalance = await getLeaveBalance(employeeId, leaveTypeId, year - 1);
    if (prevBalance) {
      const remaining = prevBalance.totalDays - prevBalance.usedDays;
      carriedOver = Math.min(remaining, leaveType.maxCarryOver);
    }
  }
  
  return db.leaveBalance.create({
    data: {
      tenantId,
      employeeId,
      leaveTypeId,
      year,
      totalDays: leaveType.daysAllowed + carriedOver,
      carriedOver,
    },
    include: {
      leaveType: true,
    },
  });
}

/**
 * Submit time-off request
 */
export async function submitTimeOffRequest(data: TimeOffRequestData): Promise<TimeOffResult> {
  try {
    // Calculate total days
    const totalDays = calculateWorkingDays(data.startDate, data.endDate);
    
    if (totalDays <= 0) {
      return { success: false, error: 'Invalid date range' };
    }
    
    // Check leave type
    const leaveType = await db.leaveType.findUnique({
      where: { id: data.leaveTypeId },
    });
    
    if (!leaveType) {
      return { success: false, error: 'Leave type not found' };
    }
    
    // Check balance
    const year = data.startDate.getFullYear();
    let balance = await getLeaveBalance(data.employeeId, data.leaveTypeId, year);
    
    if (!balance) {
      // Initialize balance
      balance = await initializeLeaveBalance(data.tenantId, data.employeeId, data.leaveTypeId, year);
    }
    
    const availableDays = balance.totalDays - balance.usedDays - balance.pendingDays;
    if (availableDays < totalDays) {
      return { success: false, error: `Insufficient leave balance. Available: ${availableDays} days` };
    }
    
    // Create request
    const request = await db.timeOffRequest.create({
      data: {
        tenantId: data.tenantId,
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays,
        reason: data.reason,
        documentUrl: data.documentUrl,
        status: leaveType.requiresApproval ? 'pending' : 'approved',
      },
    });
    
    // Update pending balance
    if (leaveType.requiresApproval) {
      await db.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pendingDays: { increment: totalDays },
        },
      });
    } else {
      // Auto-approve
      await db.leaveBalance.update({
        where: { id: balance.id },
        data: {
          usedDays: { increment: totalDays },
        },
      });
    }
    
    return { success: true, requestId: request.id, totalDays };
  } catch (error) {
    console.error('Time-off request error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Approve time-off request
 */
export async function approveTimeOffRequest(
  requestId: string,
  reviewerId: string,
  notes?: string
): Promise<TimeOffResult> {
  try {
    const request = await db.timeOffRequest.findUnique({
      where: { id: requestId },
      include: { leaveType: true },
    });
    
    if (!request) {
      return { success: false, error: 'Request not found' };
    }
    
    if (request.status !== 'pending') {
      return { success: false, error: 'Request is not pending' };
    }
    
    // Update request
    await db.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });
    
    // Update balance (move from pending to used)
    const year = new Date(request.startDate).getFullYear();
    const balance = await getLeaveBalance(request.employeeId, request.leaveTypeId, year);
    
    if (balance) {
      await db.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pendingDays: { decrement: request.totalDays },
          usedDays: { increment: request.totalDays },
        },
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Approve time-off error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Reject time-off request
 */
export async function rejectTimeOffRequest(
  requestId: string,
  reviewerId: string,
  notes: string
): Promise<TimeOffResult> {
  try {
    const request = await db.timeOffRequest.findUnique({
      where: { id: requestId },
    });
    
    if (!request) {
      return { success: false, error: 'Request not found' };
    }
    
    if (request.status !== 'pending') {
      return { success: false, error: 'Request is not pending' };
    }
    
    // Update request
    await db.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });
    
    // Release pending balance
    const year = new Date(request.startDate).getFullYear();
    const balance = await getLeaveBalance(request.employeeId, request.leaveTypeId, year);
    
    if (balance) {
      await db.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pendingDays: { decrement: request.totalDays },
        },
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Reject time-off error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Cancel time-off request
 */
export async function cancelTimeOffRequest(requestId: string): Promise<TimeOffResult> {
  try {
    const request = await db.timeOffRequest.findUnique({
      where: { id: requestId },
    });
    
    if (!request) {
      return { success: false, error: 'Request not found' };
    }
    
    if (request.status === 'cancelled') {
      return { success: false, error: 'Request already cancelled' };
    }
    
    // Update request
    await db.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status: 'cancelled',
      },
    });
    
    // Release balance
    const year = new Date(request.startDate).getFullYear();
    const balance = await getLeaveBalance(request.employeeId, request.leaveTypeId, year);
    
    if (balance) {
      if (request.status === 'pending') {
        await db.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pendingDays: { decrement: request.totalDays },
          },
        });
      } else if (request.status === 'approved') {
        await db.leaveBalance.update({
          where: { id: balance.id },
          data: {
            usedDays: { decrement: request.totalDays },
          },
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Cancel time-off error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Get pending requests for manager
 */
export async function getPendingRequests(tenantId: string, branchId?: string) {
  return db.timeOffRequest.findMany({
    where: {
      tenantId,
      status: 'pending',
      ...(branchId ? {
        employee: { branchId },
      } : {}),
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          branch: { select: { name: true } },
        },
      },
      leaveType: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get employee's time-off history
 */
export async function getTimeOffHistory(employeeId: string, year?: number) {
  const targetYear = year || new Date().getFullYear();
  const startOfYear = new Date(targetYear, 0, 1);
  const endOfYear = new Date(targetYear, 11, 31);
  
  return db.timeOffRequest.findMany({
    where: {
      employeeId,
      startDate: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    include: {
      leaveType: true,
    },
    orderBy: { startDate: 'desc' },
  });
}

/**
 * Get default leave types
 */
export function getDefaultLeaveTypes(): Partial<import('@prisma/client').LeaveType>[] {
  return [
    {
      name: 'Annual Leave',
      code: 'annual',
      description: 'Paid annual vacation leave',
      daysAllowed: 21,
      isPaid: true,
      isCarryOver: true,
      maxCarryOver: 10,
      requiresApproval: true,
      color: '#10b981',
    },
    {
      name: 'Sick Leave',
      code: 'sick',
      description: 'Paid sick leave for illness',
      daysAllowed: 10,
      isPaid: true,
      isCarryOver: false,
      requiresApproval: true,
      requiresDocument: true,
      color: '#f59e0b',
    },
    {
      name: 'Personal Leave',
      code: 'personal',
      description: 'Unpaid personal leave',
      daysAllowed: 5,
      isPaid: false,
      isCarryOver: false,
      requiresApproval: true,
      color: '#6366f1',
    },
    {
      name: 'Maternity Leave',
      code: 'maternity',
      description: 'Maternity leave for expecting mothers',
      daysAllowed: 90,
      isPaid: true,
      isCarryOver: false,
      requiresApproval: true,
      requiresDocument: true,
      color: '#ec4899',
    },
    {
      name: 'Paternity Leave',
      code: 'paternity',
      description: 'Paternity leave for new fathers',
      daysAllowed: 14,
      isPaid: true,
      isCarryOver: false,
      requiresApproval: true,
      color: '#3b82f6',
    },
    {
      name: 'Emergency Leave',
      code: 'emergency',
      description: 'Emergency leave for urgent matters',
      daysAllowed: 3,
      isPaid: true,
      isCarryOver: false,
      requiresApproval: false,
      color: '#ef4444',
    },
  ];
}

/**
 * Seed default leave types for tenant
 */
export async function seedDefaultLeaveTypes(tenantId: string) {
  const defaults = getDefaultLeaveTypes();
  
  for (const leaveType of defaults) {
    await db.leaveType.create({
      data: {
        tenantId,
        ...leaveType,
      } as any,
    });
  }
}
