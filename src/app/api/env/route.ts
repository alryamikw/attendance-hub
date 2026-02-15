import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET',
    DIRECT_URL: process.env.DIRECT_URL ? 'SET (hidden)' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(k => 
      k.includes('DATABASE') || 
      k.includes('POSTGRES') || 
      k.includes('PG') ||
      k.includes('URL')
    )
  });
}