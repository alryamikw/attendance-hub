import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

// GET /api/employees - Get all employees for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const branchId = searchParams.get('branchId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const where: any = { tenantId };
    
    if (branchId) {
      where.branchId = branchId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { employeeCode: { contains: search } },
      ];
    }
    
    const employees = await db.employee.findMany({
      where,
      include: {
        branch: true,
        department: true,
        user: {
          select: {
            id: true,
            email: true,
            avatar: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    
    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/employees - Create new employee
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenantId,
      employeeCode,
      firstName,
      lastName,
      email,
      phone,
      branchId,
      departmentId,
      position,
      hireDate,
      employmentType,
      salaryType,
      salaryAmount,
      workingHoursPerWeek,
    } = body;
    
    // Validation
    if (!tenantId || !employeeCode || !firstName || !lastName || !email || !branchId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check employee limit
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { _count: { select: { employees: true } } },
    });
    
    if (tenant && tenant._count.employees >= tenant.employeeLimit) {
      return NextResponse.json(
        { error: 'Employee limit reached for this plan' },
        { status: 400 }
      );
    }
    
    // Check if employee code or email exists
    const existing = await db.employee.findFirst({
      where: {
        tenantId,
        OR: [
          { employeeCode },
          { email },
        ],
      },
    });
    
    if (existing) {
      return NextResponse.json(
        { error: existing.employeeCode === employeeCode ? 'Employee code already exists' : 'Email already exists' },
        { status: 400 }
      );
    }
    
    // Create user account
    const passwordHash = hashPassword('password123'); // Default password
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name: `${firstName} ${lastName}`,
        phone,
      },
    });
    
    // Assign employee role
    const employeeRole = await db.role.findUnique({
      where: { name: 'employee' },
    });
    
    if (employeeRole) {
      await db.userRole.create({
        data: {
          userId: user.id,
          roleId: employeeRole.id,
        },
      });
    }
    
    // Create employee
    const employee = await db.employee.create({
      data: {
        tenantId,
        userId: user.id,
        employeeCode,
        firstName,
        lastName,
        email,
        phone,
        branchId,
        departmentId,
        position,
        hireDate: hireDate ? new Date(hireDate) : new Date(),
        employmentType: employmentType || 'full_time',
        salaryType: salaryType || 'monthly',
        salaryAmount: salaryAmount ? parseFloat(salaryAmount) : null,
        workingHoursPerWeek: workingHoursPerWeek || 40,
        status: 'active',
      },
      include: {
        branch: true,
        department: true,
      },
    });
    
    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// PUT /api/employees - Update employee
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }
    
    const employee = await db.employee.update({
      where: { id },
      data: {
        ...data,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
        salaryAmount: data.salaryAmount ? parseFloat(data.salaryAmount) : undefined,
      },
    });
    
    // Update user if needed
    if (data.firstName || data.lastName || data.phone) {
      await db.user.update({
        where: { id: employee.userId },
        data: {
          name: `${data.firstName || employee.firstName} ${data.lastName || employee.lastName}`,
          phone: data.phone,
        },
      });
    }
    
    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// DELETE /api/employees - Delete employee
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }
    
    // Soft delete by setting status to terminated
    const employee = await db.employee.update({
      where: { id },
      data: {
        status: 'terminated',
        terminationDate: new Date(),
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
