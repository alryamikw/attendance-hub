import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    // Check if already setup
    const tenantCount = await db.tenant.count();
    
    if (tenantCount > 0) {
      return NextResponse.json({ 
        isSetupComplete: true, 
        message: 'Setup already completed' 
      });
    }

    // Create default tenant
    const tenant = await db.tenant.create({
      data: {
        name: 'شركة النور الشرقي',
        slug: 'alnoor-alsharqi',
        timezone: 'Asia/Kuwait',
        currency: 'KWD',
        subscriptionStatus: 'active',
        employeeLimit: 100,
        branchLimit: 10,
      }
    });

    // Create default branch
    const branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'الفرع الرئيسي',
        code: 'HQ',
        workingStart: '08:00',
        workingEnd: '17:00',
        isGeofenceEnabled: false,
      }
    });

    // Create admin user
    const hashedPassword = await hashPassword('admin123');
    const user = await db.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: hashedPassword,
        name: 'مدير النظام',
        isActive: true,
        emailVerified: new Date(),
      }
    });

    // Create admin employee
    await db.employee.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        employeeCode: 'EMP001',
        firstName: 'مدير',
        lastName: 'النظام',
        email: 'admin@example.com',
        branchId: branch.id,
        position: 'مدير النظام',
        status: 'active',
      }
    });

    // Create default attendance rule
    await db.attendanceRule.create({
      data: {
        tenantId: tenant.id,
        name: 'قاعدة الحضور الافتراضية',
        lateThresholdMinutes: 15,
        earlyLeaveThresholdMinutes: 15,
        halfDayThresholdHours: 4,
        overtimeThresholdHours: 8,
        overtimeMultiplier: 1.5,
        weekendOvertimeMultiplier: 2.0,
        holidayOvertimeMultiplier: 2.5,
        geofenceRequired: false,
        offlineEnabled: true,
      }
    });

    // Create default payroll rule
    await db.payrollRule.create({
      data: {
        tenantId: tenant.id,
        name: 'قاعدة الرواتب الافتراضية',
        calculationMethod: 'monthly',
        overtimeRate: 1.5,
        weekendOvertimeRate: 2.0,
        holidayOvertimeRate: 2.5,
      }
    });

    // Create default leave types
    await db.leaveType.createMany({
      data: [
        {
          tenantId: tenant.id,
          name: 'إجازة سنوية',
          code: 'annual',
          daysAllowed: 30,
          isPaid: true,
          requiresApproval: true,
        },
        {
          tenantId: tenant.id,
          name: 'إجازة مرضية',
          code: 'sick',
          daysAllowed: 14,
          isPaid: true,
          requiresApproval: true,
          requiresDocument: true,
        },
        {
          tenantId: tenant.id,
          name: 'إجازة طوارئ',
          code: 'emergency',
          daysAllowed: 5,
          isPaid: false,
          requiresApproval: true,
        },
      ]
    });

    return NextResponse.json({ 
      success: true,
      message: 'تم إعداد النظام بنجاح!',
      credentials: {
        email: 'admin@example.com',
        password: 'admin123'
      }
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ 
      error: 'Setup failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}