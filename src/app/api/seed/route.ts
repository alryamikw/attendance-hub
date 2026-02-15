import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';

// GET /api/seed - Check and run seed if needed
export async function GET(req: NextRequest) {
  try {
    const result = await seedDatabase();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
