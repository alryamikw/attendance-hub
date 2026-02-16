import { NextResponse } from 'next/server';

// Set database URL before any Prisma code runs
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@postgres.railway.internal:5432/railway';
process.env.DIRECT_URL = process.env.DIRECT_URL || 'postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@postgres.railway.internal:5432/railway';

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    DIRECT_URL: process.env.DIRECT_URL ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    databaseUrlPreview: process.env.DATABASE_URL?.substring(0, 30) + '...',
  });
}