import { NextRequest, NextResponse } from 'next/server';
import emailService from '@/lib/notifications';

// ============================================
// EMAIL NOTIFICATIONS API
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, to, data } = body;

    // Validate required fields
    if (!type || !to) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, to' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'welcome':
        result = await emailService.sendWelcome(to, data.name, data.companyName);
        break;

      case 'checkin':
        result = await emailService.sendCheckInConfirmation(
          to,
          data.name,
          data.time,
          data.location,
          data.isLate || false
        );
        break;

      case 'checkout':
        result = await emailService.sendCheckOutConfirmation(to, data.name, data.time, data.totalHours);
        break;

      case 'leave':
        result = await emailService.sendLeaveRequestNotification(
          to,
          data.name,
          data.leaveType,
          data.startDate,
          data.endDate,
          data.status
        );
        break;

      case 'weekly-report':
        result = await emailService.sendWeeklyReport(to, data.name, data.stats);
        break;

      case 'password-reset':
        result = await emailService.sendPasswordReset(to, data.name, data.resetToken);
        break;

      case 'custom':
        result = await emailService.sendCustom(to, data.subject, data.html, data.text);
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid email type' },
          { status: 400 }
        );
    }

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Test email endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const test = searchParams.get('test');

  if (test !== 'true') {
    return NextResponse.json({ 
      status: 'Email API is running',
      resendConfigured: !!process.env.RESEND_API_KEY 
    });
  }

  // Send test email
  const result = await emailService.sendWelcome(
    'test@example.com',
    'Test User',
    'Test Company'
  );

  return NextResponse.json({
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    demoMode: !process.env.RESEND_API_KEY
  });
}
