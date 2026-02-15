import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/branches - Get all branches for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const branches = await db.branch.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    
    return NextResponse.json({ branches });
  } catch (error) {
    console.error('Get branches error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/branches - Create new branch
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      tenantId, 
      name, 
      code, 
      address, 
      city,
      country,
      latitude,
      longitude,
      geofenceRadius,
      isGeofenceEnabled,
      workingStart,
      workingEnd,
    } = body;
    
    if (!tenantId || !name) {
      return NextResponse.json(
        { error: 'Tenant ID and name are required' },
        { status: 400 }
      );
    }
    
    // Check branch limit
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { _count: { select: { branches: true } } },
    });
    
    if (tenant && tenant._count.branches >= tenant.branchLimit) {
      return NextResponse.json(
        { error: 'Branch limit reached for this plan' },
        { status: 400 }
      );
    }
    
    const branch = await db.branch.create({
      data: {
        tenantId,
        name,
        code,
        address,
        city,
        country,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        geofenceRadius: geofenceRadius ? parseInt(geofenceRadius) : 100,
        isGeofenceEnabled: isGeofenceEnabled ?? true,
        workingStart: workingStart || '09:00',
        workingEnd: workingEnd || '18:00',
      },
    });
    
    return NextResponse.json({ branch });
  } catch (error) {
    console.error('Create branch error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// PUT /api/branches - Update branch
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }
    
    const branch = await db.branch.update({
      where: { id },
      data: {
        ...data,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        geofenceRadius: data.geofenceRadius ? parseInt(data.geofenceRadius) : undefined,
      },
    });
    
    return NextResponse.json({ branch });
  } catch (error) {
    console.error('Update branch error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// DELETE /api/branches - Delete branch
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }
    
    // Check if branch has employees
    const branch = await db.branch.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    
    if (branch && branch._count.employees > 0) {
      return NextResponse.json(
        { error: 'Cannot delete branch with employees' },
        { status: 400 }
      );
    }
    
    await db.branch.delete({ where: { id } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete branch error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
