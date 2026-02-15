import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Try to create tables by running a simple query
    // This will work if prisma db push was run during build
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    
    return NextResponse.json({
      success: true,
      message: 'Database connected successfully',
      result
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: 'Database tables may not be created. Check Railway logs.'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}