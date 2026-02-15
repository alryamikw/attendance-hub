import { NextRequest, NextResponse } from 'next/server';
import { logout, getCurrentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    
    if (user) {
      const token = req.cookies.get('session_token')?.value;
      if (token) {
        await logout(token);
      }
    }
    
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_token');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
