import { NextRequest, NextResponse } from 'next/server';
import { checkIn, checkOut, getTodayAttendance, getAttendanceHistory, startBreak, endBreak } from '@/lib/attendance';
import { db } from '@/lib/db';
import { validateAttendanceLocation } from '@/lib/geofencing';

// GET /api/attendance - Get attendance records
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const tenantId = searchParams.get('tenantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchId = searchParams.get('branchId');
    const status = searchParams.get('status');
    const action = searchParams.get('action');
    
    // Get today's attendance
    if (action === 'today' && employeeId) {
      const attendance = await getTodayAttendance(employeeId);
      return NextResponse.json({ attendance });
    }
    
    // Get attendance history
    if (employeeId && startDate && endDate) {
      const records = await getAttendanceHistory(
        employeeId,
        new Date(startDate),
        new Date(endDate)
      );
      return NextResponse.json({ records });
    }
    
    // Get all attendance for tenant
    if (tenantId && startDate && endDate) {
      const where: any = {
        tenantId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };
      
      if (branchId) where.branchId = branchId;
      if (status) where.status = status;
      
      const records = await db.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              email: true,
              branch: true,
            },
          },
          branch: true,
        },
        orderBy: { date: 'desc' },
        take: 100,
      });
      
      return NextResponse.json({ records });
    }
    
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/attendance - Check in/out or break
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...data } = body;
    
    // Check-in
    if (action === 'checkin') {
      const {
        employeeId,
        tenantId,
        branchId,
        latitude,
        longitude,
        accuracy,
        deviceId,
        photo,
        faceMatchScore,
        method,
        syncId,
      } = data;
      
      if (!employeeId || !tenantId || !branchId || latitude === undefined || longitude === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
      
      // Validate location if geofence is enabled
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        include: { branches: true },
      });
      
      const rules = await db.attendanceRule.findFirst({
        where: { tenantId },
      });
      
      if (rules?.geofenceRequired) {
        const locationValidation = await validateAttendanceLocation(
          { latitude, longitude, accuracy },
          branchId,
          tenant?.branches || [],
          true
        );
        
        if (!locationValidation.isValid) {
          return NextResponse.json(
            { error: locationValidation.errors.join(', ') },
            { status: 400 }
          );
        }
      }
      
      const ipAddress = req.headers.get('x-forwarded-for') || 
                        req.headers.get('x-real-ip') || 
                        'unknown';
      
      const result = await checkIn({
        employeeId,
        tenantId,
        branchId,
        latitude,
        longitude,
        accuracy,
        deviceId,
        ipAddress,
        photo,
        faceMatchScore,
        method,
        syncId,
      });
      
      return NextResponse.json(result);
    }
    
    // Check-out
    if (action === 'checkout') {
      const {
        employeeId,
        tenantId,
        latitude,
        longitude,
        accuracy,
        deviceId,
        photo,
        faceMatchScore,
        method,
      } = data;
      
      if (!employeeId || !tenantId || latitude === undefined || longitude === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
      
      const ipAddress = req.headers.get('x-forwarded-for') || 
                        req.headers.get('x-real-ip') || 
                        'unknown';
      
      const result = await checkOut({
        employeeId,
        tenantId,
        latitude,
        longitude,
        accuracy,
        deviceId,
        ipAddress,
        photo,
        faceMatchScore,
        method,
      });
      
      return NextResponse.json(result);
    }
    
    // Start break
    if (action === 'startBreak') {
      const { employeeId, tenantId, breakType } = data;
      
      const result = await startBreak(employeeId, tenantId, breakType);
      return NextResponse.json(result);
    }
    
    // End break
    if (action === 'endBreak') {
      const { employeeId } = data;
      
      const result = await endBreak(employeeId);
      return NextResponse.json(result);
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Attendance action error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
