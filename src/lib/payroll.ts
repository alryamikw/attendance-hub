/**
 * Payroll Engine
 * Handles salary calculations, deductions, and payroll processing
 */

import { db } from './db';

export interface PayrollCalculation {
  employeeId: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalHours: number;
  overtimeHours: number;
  baseSalary: number;
  overtimePay: number;
  allowances: number;
  lateDeductions: number;
  absenceDeductions: number;
  otherDeductions: number;
  grossPay: number;
  netPay: number;
}

export interface SalaryStructure {
  baseSalary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  overtimeRate: number;
  workingHoursPerDay: number;
}

/**
 * Get salary profile for employee
 */
export async function getEmployeeSalaryProfile(employeeId: string) {
  const profile = await db.salaryProfile.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: new Date() },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: new Date() } },
      ],
    },
  });
  
  return profile;
}

/**
 * Get payroll rules for tenant
 */
export async function getTenantPayrollRules(tenantId: string) {
  return db.payrollRule.findFirst({
    where: { tenantId },
  });
}

/**
 * Calculate late deduction
 */
export function calculateLateDeduction(
  lateMinutes: number,
  salary: number,
  rule: {
    lateDeductionType: string;
    lateDeductionAmount: number;
  },
  workingDaysInMonth: number = 22
): number {
  if (lateMinutes === 0) return 0;
  
  switch (rule.lateDeductionType) {
    case 'fixed':
      return rule.lateDeductionAmount;
    case 'percentage':
      return (salary * rule.lateDeductionAmount) / 100;
    case 'progressive':
      // Progressive: first 15 mins = X, next 15 mins = 2X, etc.
      const periods = Math.ceil(lateMinutes / 15);
      return rule.lateDeductionAmount * periods;
    default:
      return 0;
  }
}

/**
 * Calculate absence deduction
 */
export function calculateAbsenceDeduction(
  absentDays: number,
  salary: number,
  rule: {
    absenceDeductionType: string;
    absenceDeductionAmount: number;
  },
  workingDaysInMonth: number = 22
): number {
  if (absentDays === 0) return 0;
  
  const dailySalary = salary / workingDaysInMonth;
  
  switch (rule.absenceDeductionType) {
    case 'daily':
      return dailySalary * absentDays;
    case 'percentage':
      return (salary * rule.absenceDeductionAmount * absentDays) / 100;
    case 'fixed':
      return rule.absenceDeductionAmount * absentDays;
    default:
      return dailySalary * absentDays;
  }
}

/**
 * Calculate overtime pay
 */
export function calculateOvertimePay(
  overtimeHours: number,
  hourlyRate: number,
  rule: {
    overtimeRate: number;
    weekendOvertimeRate: number;
    holidayOvertimeRate: number;
  },
  isWeekend: boolean = false,
  isHoliday: boolean = false
): number {
  if (overtimeHours === 0) return 0;
  
  let rate = rule.overtimeRate;
  if (isHoliday) rate = rule.holidayOvertimeRate;
  else if (isWeekend) rate = rule.weekendOvertimeRate;
  
  return overtimeHours * hourlyRate * rate;
}

/**
 * Calculate payroll for an employee
 */
export async function calculateEmployeePayroll(
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<PayrollCalculation> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      salaryProfiles: {
        where: {
          effectiveFrom: { lte: endDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: startDate } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  });
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Get attendance records
  const attendance = await db.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });
  
  // Get payroll rules
  const rules = await getTenantPayrollRules(employee.tenantId);
  
  // Calculate days
  const workingDays = attendance.length;
  const presentDays = attendance.filter(a => 
    a.status === 'present' || a.status === 'late' || a.status === 'early_leave'
  ).length;
  const absentDays = attendance.filter(a => a.status === 'absent').length;
  const lateDays = attendance.filter(a => a.isLate).length;
  const totalLateMinutes = attendance.reduce((sum, a) => sum + a.lateMinutes, 0);
  
  // Calculate hours
  const totalHours = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);
  const overtimeHours = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
  
  // Get salary
  const salaryProfile = employee.salaryProfiles[0];
  const baseSalary = salaryProfile?.baseSalary || employee.salaryAmount || 0;
  
  // Parse allowances and deductions
  const allowances = salaryProfile?.allowances 
    ? JSON.parse(salaryProfile.allowances) 
    : {};
  const deductions = salaryProfile?.deductions 
    ? JSON.parse(salaryProfile.deductions) 
    : {};
  
  const totalAllowances = Object.values(allowances).reduce((sum: number, val) => sum + (val as number), 0);
  const otherDeductions = Object.values(deductions).reduce((sum: number, val) => sum + (val as number), 0);
  
  // Calculate hourly rate
  const workingDaysInMonth = 22; // Average working days
  const hourlyRate = baseSalary / (workingDaysInMonth * 8);
  
  // Calculate deductions and overtime
  const lateDeductions = rules 
    ? calculateLateDeduction(totalLateMinutes, baseSalary, rules)
    : 0;
  const absenceDeductions = rules 
    ? calculateAbsenceDeduction(absentDays, baseSalary, rules, workingDaysInMonth)
    : 0;
  const overtimePay = rules 
    ? calculateOvertimePay(overtimeHours, hourlyRate, rules)
    : 0;
  
  // Calculate totals
  const grossPay = baseSalary + totalAllowances + overtimePay;
  const netPay = Math.max(0, grossPay - lateDeductions - absenceDeductions - otherDeductions);
  
  return {
    employeeId,
    workingDays,
    presentDays,
    absentDays,
    lateDays,
    totalHours,
    overtimeHours,
    baseSalary,
    overtimePay,
    allowances: totalAllowances,
    lateDeductions,
    absenceDeductions,
    otherDeductions,
    grossPay,
    netPay,
  };
}

/**
 * Generate payroll period
 */
export async function generatePayrollPeriod(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  payDate: Date
) {
  // Check if period already exists
  const existing = await db.payrollPeriod.findFirst({
    where: {
      tenantId,
      startDate,
      endDate,
    },
  });
  
  if (existing) {
    throw new Error('Payroll period already exists');
  }
  
  // Create payroll period
  const period = await db.payrollPeriod.create({
    data: {
      tenantId,
      name: `Payroll ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      startDate,
      endDate,
      payDate,
      status: 'draft',
    },
  });
  
  // Get all active employees
  const employees = await db.employee.findMany({
    where: {
      tenantId,
      status: 'active',
    },
  });
  
  // Calculate payroll for each employee
  const records = [];
  for (const employee of employees) {
    const calculation = await calculateEmployeePayroll(employee.id, startDate, endDate);
    
    records.push({
      payrollPeriodId: period.id,
      employeeId: employee.id,
      workingDays: calculation.workingDays,
      presentDays: calculation.presentDays,
      absentDays: calculation.absentDays,
      lateDays: calculation.lateDays,
      totalHours: calculation.totalHours,
      overtimeHours: calculation.overtimeHours,
      baseSalary: calculation.baseSalary,
      overtimePay: calculation.overtimePay,
      allowances: calculation.allowances,
      lateDeductions: calculation.lateDeductions,
      absenceDeductions: calculation.absenceDeductions,
      otherDeductions: calculation.otherDeductions,
      grossPay: calculation.grossPay,
      netPay: calculation.netPay,
    });
  }
  
  // Create payroll records
  await db.payrollRecord.createMany({
    data: records,
  });
  
  // Update total amount
  const totalAmount = records.reduce((sum, r) => sum + r.netPay, 0);
  await db.payrollPeriod.update({
    where: { id: period.id },
    data: { totalAmount },
  });
  
  return period;
}

/**
 * Get payroll summary for a period
 */
export async function getPayrollSummary(payrollPeriodId: string) {
  const records = await db.payrollRecord.findMany({
    where: { payrollPeriodId },
    include: {
      employee: {
        include: {
          branch: true,
          department: true,
        },
      },
    },
  });
  
  return {
    records,
    summary: {
      totalEmployees: records.length,
      totalGrossPay: records.reduce((sum, r) => sum + r.grossPay, 0),
      totalNetPay: records.reduce((sum, r) => sum + r.netPay, 0),
      totalDeductions: records.reduce((sum, r) => sum + r.lateDeductions + r.absenceDeductions + r.otherDeductions, 0),
      totalOvertime: records.reduce((sum, r) => sum + r.overtimePay, 0),
    },
  };
}

/**
 * Approve payroll
 */
export async function approvePayroll(payrollPeriodId: string, approvedBy: string) {
  const period = await db.payrollPeriod.update({
    where: { id: payrollPeriodId },
    data: {
      status: 'approved',
    },
  });
  
  await db.payrollRecord.updateMany({
    where: { payrollPeriodId },
    data: { status: 'approved' },
  });
  
  await db.auditLog.create({
    data: {
      action: 'approve_payroll',
      module: 'payroll',
      resourceId: payrollPeriodId,
      newValues: JSON.stringify({ status: 'approved' }),
    },
  });
  
  return period;
}
