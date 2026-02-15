import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAttendanceStats, getLiveAttendanceCount } from '@/lib/attendance';

// GET /api/dashboard - Get dashboard data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const branchId = searchParams.get('branchId');
    const action = searchParams.get('action');
    
    // Platform dashboard
    if (action === 'platform') {
      const [tenantsCount, activeTenants, totalEmployees, totalBranches] = await Promise.all([
        db.tenant.count(),
        db.tenant.count({ where: { isActive: true } }),
        db.employee.count({ where: { status: 'active' } }),
        db.branch.count(),
      ]);
      
      const recentTenants = await db.tenant.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { employees: true, branches: true } },
        },
      });
      
      return NextResponse.json({
        tenantsCount,
        activeTenants,
        totalEmployees,
        totalBranches,
        recentTenants,
      });
    }
    
    // Company dashboard
    if (tenantId) {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const [
        liveCount,
        monthlyStats,
        totalEmployees,
        totalBranches,
        recentActivity,
        lateToday,
        absentToday,
      ] = await Promise.all([
        getLiveAttendanceCount(tenantId, branchId || undefined),
        getAttendanceStats(tenantId, startOfMonth, today, branchId || undefined),
        db.employee.count({
          where: {
            tenantId,
            status: 'active',
            ...(branchId ? { branchId } : {}),
          },
        }),
        db.branch.count({
          where: { tenantId, isActive: true },
        }),
        db.attendance.findMany({
          where: {
            tenantId,
            ...(branchId ? { branchId } : {}),
            date: today,
          },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeCode: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        db.attendance.count({
          where: {
            tenantId,
            date: today,
            isLate: true,
            ...(branchId ? { branchId } : {}),
          },
        }),
        db.employee.count({
          where: {
            tenantId,
            status: 'active',
            ...(branchId ? { branchId } : {}),
            NOT: {
              attendances: {
                some: { date: today },
              },
            },
          },
        }),
      ]);
      
      // Calculate compliance percentage
      const workingDaysSoFar = Math.floor((today.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
      const expectedAttendance = totalEmployees * Math.min(workingDaysSoFar, 22);
      const actualAttendance = monthlyStats.present + monthlyStats.late;
      const compliancePercentage = expectedAttendance > 0 
        ? Math.round((actualAttendance / expectedAttendance) * 100) 
        : 0;
      
      return NextResponse.json({
        live: liveCount,
        monthlyStats,
        totalEmployees,
        totalBranches,
        recentActivity,
        lateToday,
        absentToday,
        compliancePercentage,
        avgHoursPerEmployee: totalEmployees > 0 
          ? (monthlyStats.totalHours / totalEmployees).toFixed(1) 
          : '0',
      });
    }
    
    return NextResponse.json(
      { error: 'Missing tenantId or action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
