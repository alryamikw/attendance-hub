import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/tenants - Get all tenants (platform admin only)
export async function GET(req: NextRequest) {
  try {
    const tenants = await db.tenant.findMany({
      include: {
        _count: {
          select: {
            employees: true,
            branches: true,
          },
        },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('Get tenants error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/tenants - Create new tenant (platform admin only)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, planId, employeeLimit, branchLimit } = body;
    
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }
    
    const tenant = await db.tenant.create({
      data: {
        name,
        slug,
        planId,
        employeeLimit: employeeLimit || 10,
        branchLimit: branchLimit || 1,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    
    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Create tenant error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
