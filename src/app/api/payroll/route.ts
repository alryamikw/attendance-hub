import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePayrollPeriod, getPayrollSummary, approvePayroll, calculateEmployeePayroll } from '@/lib/payroll';

// GET /api/payroll - Get payroll data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const action = searchParams.get('action');
    const periodId = searchParams.get('periodId');
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    // Get payroll periods
    if (action === 'periods') {
      const periods = await db.payrollPeriod.findMany({
        where: { tenantId },
        orderBy: { startDate: 'desc' },
        take: 12,
      });
      
      return NextResponse.json({ periods });
    }
    
    // Get specific period details
    if (action === 'period' && periodId) {
      const summary = await getPayrollSummary(periodId);
      return NextResponse.json(summary);
    }
    
    // Calculate preview for employee
    if (action === 'preview' && employeeId && startDate && endDate) {
      const calculation = await calculateEmployeePayroll(
        employeeId,
        new Date(startDate),
        new Date(endDate)
      );
      
      return NextResponse.json(calculation);
    }
    
    // Get payroll rules
    if (action === 'rules') {
      const rules = await db.payrollRule.findFirst({
        where: { tenantId },
      });
      
      return NextResponse.json({ rules });
    }
    
    // Default: get all payroll records for tenant
    const periods = await db.payrollPeriod.findMany({
      where: { tenantId },
      include: {
        _count: { select: { records: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    
    return NextResponse.json({ periods });
  } catch (error) {
    console.error('Payroll GET error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/payroll - Create payroll period
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, tenantId, startDate, endDate, payDate, periodId } = body;
    
    // Generate new payroll period
    if (action === 'generate') {
      if (!tenantId || !startDate || !endDate || !payDate) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
      
      const period = await generatePayrollPeriod(
        tenantId,
        new Date(startDate),
        new Date(endDate),
        new Date(payDate)
      );
      
      return NextResponse.json({ period });
    }
    
    // Approve payroll
    if (action === 'approve' && periodId) {
      const period = await approvePayroll(periodId, 'system');
      return NextResponse.json({ period });
    }
    
    // Create/update payroll rules
    if (action === 'rules') {
      const { tenantId, ...rulesData } = body;
      
      const rules = await db.payrollRule.upsert({
        where: {
          tenantId_name: {
            tenantId,
            name: rulesData.name || 'Default',
          },
        },
        create: {
          tenantId,
          ...rulesData,
        },
        update: rulesData,
      });
      
      return NextResponse.json({ rules });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Payroll POST error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
