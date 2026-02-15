import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAttendanceStats } from '@/lib/attendance';

// GET /api/reports - Get various reports
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const type = searchParams.get('type') || 'daily';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchId = searchParams.get('branchId');
    const employeeId = searchParams.get('employeeId');
    const format = searchParams.get('format') || 'json';
    
    if (!tenantId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    switch (type) {
      case 'daily': {
        // Daily attendance report
        const records = await db.attendance.findMany({
          where: {
            tenantId,
            date: { gte: start, lte: end },
            ...(branchId ? { branchId } : {}),
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                branch: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { date: 'desc' },
        });
        
        return NextResponse.json({ records, type: 'daily' });
      }
      
      case 'employee': {
        // Employee detailed report
        if (!employeeId) {
          return NextResponse.json(
            { error: 'Employee ID is required for employee report' },
            { status: 400 }
          );
        }
        
        const [records, stats, employee] = await Promise.all([
          db.attendance.findMany({
            where: {
              employeeId,
              date: { gte: start, lte: end },
            },
            orderBy: { date: 'asc' },
          }),
          getAttendanceStats(tenantId, start, end, branchId || undefined),
          db.employee.findUnique({
            where: { id: employeeId },
            include: { branch: true, department: true },
          }),
        ]);
        
        const totalLateMinutes = records.reduce((sum, r) => sum + r.lateMinutes, 0);
        const totalEarlyLeaveMinutes = records.reduce((sum, r) => sum + r.earlyLeaveMinutes, 0);
        
        return NextResponse.json({
          employee,
          records,
          stats: {
            ...stats,
            totalLateMinutes,
            totalEarlyLeaveMinutes,
            avgHoursPerDay: records.length > 0 
              ? (stats.totalHours / records.length).toFixed(2)
              : '0',
          },
          type: 'employee',
        });
      }
      
      case 'late': {
        // Late arrivals report
        const records = await db.attendance.findMany({
          where: {
            tenantId,
            date: { gte: start, lte: end },
            isLate: true,
            ...(branchId ? { branchId } : {}),
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                branch: { select: { name: true } },
              },
            },
          },
          orderBy: { date: 'desc' },
        });
        
        // Group by employee
        const byEmployee = records.reduce((acc, r) => {
          const empId = r.employeeId;
          if (!acc[empId]) {
            acc[empId] = {
              employee: r.employee,
              count: 0,
              totalMinutes: 0,
              records: [],
            };
          }
          acc[empId].count++;
          acc[empId].totalMinutes += r.lateMinutes;
          acc[empId].records.push(r);
          return acc;
        }, {} as Record<string, any>);
        
        const ranking = Object.values(byEmployee).sort((a: any, b: any) => b.count - a.count);
        
        return NextResponse.json({ records, byEmployee, ranking, type: 'late' });
      }
      
      case 'hours': {
        // Hours worked report
        const records = await db.attendance.findMany({
          where: {
            tenantId,
            date: { gte: start, lte: end },
            ...(branchId ? { branchId } : {}),
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                workingHoursPerWeek: true,
              },
            },
          },
        });
        
        // Group by employee
        const byEmployee = records.reduce((acc, r) => {
          const empId = r.employeeId;
          if (!acc[empId]) {
            acc[empId] = {
              employee: r.employee,
              totalHours: 0,
              overtimeHours: 0,
              records: [],
            };
          }
          acc[empId].totalHours += r.totalHours || 0;
          acc[empId].overtimeHours += r.overtimeHours || 0;
          acc[empId].records.push(r);
          return acc;
        }, {} as Record<string, any>);
        
        const summary = Object.values(byEmployee).map((emp: any) => {
          const expectedHours = (emp.employee.workingHoursPerWeek / 5) * 
            Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          return {
            ...emp,
            expectedHours,
            deficit: Math.max(0, expectedHours - emp.totalHours),
          };
        });
        
        return NextResponse.json({ summary, type: 'hours' });
      }
      
      case 'branch': {
        // Branch comparison report
        const branches = await db.branch.findMany({
          where: { tenantId },
          include: {
            _count: { select: { employees: true } },
          },
        });
        
        const branchStats = await Promise.all(
          branches.map(async (branch) => {
            const stats = await getAttendanceStats(tenantId, start, end, branch.id);
            return {
              branch,
              ...stats,
              complianceRate: branch._count.employees > 0
                ? Math.round((stats.present / (branch._count.employees * Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))) * 100)
                : 0,
            };
          })
        );
        
        return NextResponse.json({ branchStats, type: 'branch' });
      }
      
      case 'compliance': {
        // Compliance report
        const stats = await getAttendanceStats(tenantId, start, end, branchId || undefined);
        
        const totalEmployees = await db.employee.count({
          where: {
            tenantId,
            status: 'active',
            ...(branchId ? { branchId } : {}),
          },
        });
        
        const workingDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const expectedAttendance = totalEmployees * workingDays;
        
        const violations = await db.attendance.findMany({
          where: {
            tenantId,
            date: { gte: start, lte: end },
            OR: [
              { isLate: true },
              { isEarlyLeave: true },
              { status: 'absent' },
            ],
            ...(branchId ? { branchId } : {}),
          },
          include: {
            employee: {
              select: { firstName: true, lastName: true, employeeCode: true },
            },
          },
        });
        
        return NextResponse.json({
          stats,
          compliancePercentage: Math.round((stats.present / expectedAttendance) * 100),
          violations,
          type: 'compliance',
        });
      }
      
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
