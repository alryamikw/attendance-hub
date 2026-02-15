import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      email, 
      password, 
      name, 
      tenantName,
      tenantSlug,
      planId 
    } = body;
    
    // Validation
    if (!email || !password || !name || !tenantName || !tenantSlug) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if email exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }
    
    // Check if tenant slug exists
    const existingTenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    
    if (existingTenant) {
      return NextResponse.json(
        { error: 'Company name already taken' },
        { status: 400 }
      );
    }
    
    // Create tenant
    const tenant = await db.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug,
        planId: planId || null,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        settings: JSON.stringify({
          timezone: 'UTC',
          currency: 'USD',
          workingDays: [1, 2, 3, 4, 5],
          graceMinutes: 15,
        }),
      },
    });
    
    // Create default branch
    const branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Branch',
        code: 'HQ',
        isGeofenceEnabled: false,
      },
    });
    
    // Create user
    const hashedPassword = hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        emailVerified: new Date(),
      },
    });
    
    // Create employee record
    const employee = await db.employee.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        employeeCode: `EMP001`,
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || '',
        email,
        branchId: branch.id,
        position: 'Admin',
        status: 'active',
      },
    });
    
    // Assign company admin role
    const adminRole = await db.role.findUnique({
      where: { name: 'company_admin' },
    });
    
    if (adminRole) {
      await db.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });
    }
    
    // Create default schedule
    await db.schedule.create({
      data: {
        tenantId: tenant.id,
        name: 'Standard Schedule',
        type: 'fixed',
        startTime: '09:00',
        endTime: '18:00',
        breakStart: '13:00',
        breakEnd: '14:00',
        breakDuration: 60,
        graceMinutes: 15,
        workingDays: '1,2,3,4,5',
      },
    });
    
    // Create default attendance rules
    await db.attendanceRule.create({
      data: {
        tenantId: tenant.id,
        name: 'Default Rules',
        lateThresholdMinutes: 15,
        earlyLeaveThresholdMinutes: 15,
        halfDayThresholdHours: 4,
        overtimeThresholdHours: 8,
        overtimeMultiplier: 1.5,
        selfieRequired: false,
        geofenceRequired: false,
        offlineEnabled: true,
        maxOfflineHours: 24,
      },
    });
    
    // Create default payroll rules
    await db.payrollRule.create({
      data: {
        tenantId: tenant.id,
        name: 'Default Payroll',
        calculationMethod: 'monthly',
        overtimeRate: 1.5,
        weekendOvertimeRate: 2.0,
        holidayOvertimeRate: 2.5,
        lateDeductionType: 'fixed',
        lateDeductionAmount: 0,
        absenceDeductionType: 'daily',
      },
    });
    
    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
