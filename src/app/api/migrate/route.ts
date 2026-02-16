import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss', {
      timeout: 60000,
    });

    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully',
      stdout,
      stderr
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    }, { status: 500 });
  }
}