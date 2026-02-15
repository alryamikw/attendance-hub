import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/setup/status - Check if setup is complete
export async function GET(req: NextRequest) {
  try {
    // Check if any tenant exists
    const tenantCount = await db.tenant.count();
    
    // Check if any user exists
    const userCount = await db.user.count();
    
    // Check if roles exist
    const roleCount = await db.role.count();
    
    const isSetupComplete = tenantCount > 0 && userCount > 0 && roleCount > 0;
    
    return NextResponse.json({
      isSetupComplete,
      tenantCount,
      userCount,
      roleCount,
      needsSetup: !isSetupComplete,
    });
  } catch (error) {
    console.error('Setup status error:', error);
    return NextResponse.json({
      isSetupComplete: false,
      needsSetup: true,
      error: 'Database not initialized',
    });
  }
}

// POST /api/setup/complete - Run initial setup
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      companyName, 
      companySlug,
      adminName, 
      adminEmail, 
      adminPassword,
      timezone,
      currency,
    } = body;
    
    // Validate required fields
    if (!companyName || !companySlug || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if already setup
    const existingTenant = await db.tenant.findFirst();
    if (existingTenant) {
      return NextResponse.json(
        { error: 'Setup already completed' },
        { status: 400 }
      );
    }
    
    // Create roles first
    const roles = await Promise.all([
      db.role.upsert({
        where: { name: 'platform_owner' },
        create: { name: 'platform_owner', displayName: 'Platform Owner', isSystem: true },
        update: {},
      }),
      db.role.upsert({
        where: { name: 'company_admin' },
        create: { name: 'company_admin', displayName: 'Company Admin', isSystem: true },
        update: {},
      }),
      db.role.upsert({
        where: { name: 'branch_admin' },
        create: { name: 'branch_admin', displayName: 'Branch Admin', isSystem: true },
        update: {},
      }),
      db.role.upsert({
        where: { name: 'hr_manager' },
        create: { name: 'hr_manager', displayName: 'HR Manager', isSystem: true },
        update: {},
      }),
      db.role.upsert({
        where: { name: 'employee' },
        create: { name: 'employee', displayName: 'Employee', isSystem: true },
        update: {},
      }),
    ]);
    
    // Create permissions
    const permissions = [
      { module: 'employees', action: 'create', resource: 'all' },
      { module: 'employees', action: 'read', resource: 'all' },
      { module: 'employees', action: 'update', resource: 'all' },
      { module: 'employees', action: 'delete', resource: 'all' },
      { module: 'attendance', action: 'create', resource: 'own' },
      { module: 'attendance', action: 'read', resource: 'all' },
      { module: 'attendance', action: 'approve', resource: 'all' },
      { module: 'reports', action: 'read', resource: 'all' },
      { module: 'reports', action: 'export', resource: 'all' },
      { module: 'payroll', action: 'read', resource: 'all' },
      { module: 'payroll', action: 'create', resource: 'all' },
      { module: 'settings', action: 'read', resource: 'all' },
      { module: 'settings', action: 'update', resource: 'all' },
      { module: 'branches', action: 'create', resource: 'all' },
      { module: 'branches', action: 'read', resource: 'all' },
      { module: 'branches', action: 'update', resource: 'all' },
    ];
    
    for (const perm of permissions) {
      await db.permission.upsert({
        where: {
          module_action_resource: {
            module: perm.module,
            action: perm.action,
            resource: perm.resource,
          },
        },
        create: perm,
        update: {},
      });
    }
    
    // Hash password
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(adminPassword, salt, 10000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;
    
    // Create user
    const user = await db.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: adminName,
        emailVerified: new Date(),
      },
    });
    
    // Create tenant
    const tenant = await db.tenant.create({
      data: {
        name: companyName,
        slug: companySlug,
        timezone: timezone || 'UTC',
        currency: currency || 'USD',
        settings: JSON.stringify({
          workingDays: [1, 2, 3, 4, 5],
          graceMinutes: 15,
          workingStart: '09:00',
          workingEnd: '18:00',
        }),
        employeeLimit: 100,
        branchLimit: 10,
      },
    });
    
    // Create default branch
    const branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Branch',
        code: 'HQ',
        isGeofenceEnabled: false,
        workingStart: '09:00',
        workingEnd: '18:00',
      },
    });
    
    // Create employee record
    const employee = await db.employee.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        employeeCode: 'EMP001',
        firstName: adminName.split(' ')[0],
        lastName: adminName.split(' ').slice(1).join(' ') || '',
        email: adminEmail,
        branchId: branch.id,
        position: 'Administrator',
        status: 'active',
      },
    });
    
    // Assign admin role
    const adminRole = roles.find(r => r.name === 'company_admin');
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
      },
    });
    
    // Create default leave types
    const leaveTypes = [
      { name: 'Annual Leave', code: 'annual', daysAllowed: 21, color: '#10b981', isPaid: true, isCarryOver: true, maxCarryOver: 10 },
      { name: 'Sick Leave', code: 'sick', daysAllowed: 10, color: '#f59e0b', isPaid: true, requiresDocument: true },
      { name: 'Personal Leave', code: 'personal', daysAllowed: 5, color: '#6366f1', isPaid: false },
      { name: 'Emergency Leave', code: 'emergency', daysAllowed: 3, color: '#ef4444', isPaid: true, requiresApproval: false },
    ];
    
    for (const lt of leaveTypes) {
      await db.leaveType.create({
        data: {
          tenantId: tenant.id,
          ...lt,
        } as any,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Setup completed successfully',
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
      employee: {
        id: employee.id,
        code: employee.employeeCode,
      },
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
