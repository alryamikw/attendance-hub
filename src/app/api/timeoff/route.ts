import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  submitTimeOffRequest,
  approveTimeOffRequest,
  rejectTimeOffRequest,
  cancelTimeOffRequest,
  getPendingRequests,
  getTimeOffHistory,
  getEmployeeLeaveBalances,
  seedDefaultLeaveTypes,
} from '@/lib/timeoff';

// GET /api/timeoff - Get time-off data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const employeeId = searchParams.get('employeeId');
    const action = searchParams.get('action');
    const branchId = searchParams.get('branchId');
    const year = searchParams.get('year');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    // Get leave types
    if (action === 'types') {
      const leaveTypes = await db.leaveType.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: 'asc' },
      });
      
      if (leaveTypes.length === 0) {
        // Seed default leave types
        await seedDefaultLeaveTypes(tenantId);
        const newTypes = await db.leaveType.findMany({
          where: { tenantId, isActive: true },
          orderBy: { name: 'asc' },
        });
        return NextResponse.json({ leaveTypes: newTypes });
      }
      
      return NextResponse.json({ leaveTypes });
    }
    
    // Get leave balances
    if (action === 'balances' && employeeId) {
      const balances = await getEmployeeLeaveBalances(
        employeeId,
        year ? parseInt(year) : undefined
      );
      return NextResponse.json({ balances });
    }
    
    // Get pending requests (for managers)
    if (action === 'pending') {
      const requests = await getPendingRequests(tenantId, branchId || undefined);
      return NextResponse.json({ requests });
    }
    
    // Get employee's time-off history
    if (action === 'history' && employeeId) {
      const history = await getTimeOffHistory(
        employeeId,
        year ? parseInt(year) : undefined
      );
      return NextResponse.json({ history });
    }
    
    // Get all requests for tenant
    if (action === 'all') {
      const requests = await db.timeOffRequest.findMany({
        where: { tenantId },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
          leaveType: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({ requests });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Time-off GET error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/timeoff - Create/manage time-off requests
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...data } = body;
    
    // Submit new request
    if (action === 'submit') {
      const {
        employeeId,
        tenantId,
        leaveTypeId,
        startDate,
        endDate,
        reason,
      } = data;
      
      if (!employeeId || !tenantId || !leaveTypeId || !startDate || !endDate) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
      
      const result = await submitTimeOffRequest({
        employeeId,
        tenantId,
        leaveTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
      });
      
      return NextResponse.json(result);
    }
    
    // Approve request
    if (action === 'approve') {
      const { requestId, reviewerId, notes } = data;
      
      if (!requestId || !reviewerId) {
        return NextResponse.json(
          { error: 'Request ID and reviewer ID are required' },
          { status: 400 }
        );
      }
      
      const result = await approveTimeOffRequest(requestId, reviewerId, notes);
      return NextResponse.json(result);
    }
    
    // Reject request
    if (action === 'reject') {
      const { requestId, reviewerId, notes } = data;
      
      if (!requestId || !reviewerId || !notes) {
        return NextResponse.json(
          { error: 'Request ID, reviewer ID, and notes are required' },
          { status: 400 }
        );
      }
      
      const result = await rejectTimeOffRequest(requestId, reviewerId, notes);
      return NextResponse.json(result);
    }
    
    // Cancel request
    if (action === 'cancel') {
      const { requestId } = data;
      
      if (!requestId) {
        return NextResponse.json(
          { error: 'Request ID is required' },
          { status: 400 }
        );
      }
      
      const result = await cancelTimeOffRequest(requestId);
      return NextResponse.json(result);
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Time-off POST error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
