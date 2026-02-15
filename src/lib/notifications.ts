// ============================================
// EMAIL NOTIFICATIONS SERVICE
// ============================================
// Uses Resend for email delivery (free tier: 3000 emails/month)
// Install: bun add resend

// import { Resend } from 'resend';

// Initialize Resend client (will use API key from environment)
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Email templates configuration
const EMAIL_CONFIG = {
  from: 'AttendanceHub <noreply@attendancehub.com>',
  companyName: 'AttendanceHub',
};

// ============================================
// EMAIL TEMPLATES
// ============================================

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function getWelcomeEmail(name: string, companyName: string): EmailTemplate {
  return {
    subject: `Welcome to ${companyName}! 🎉`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981, #14b8a6); padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome to ${companyName}!</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb; border-radius: 0 0 10px 10px;">
          <h2>Hello ${name},</h2>
          <p>Welcome to our attendance management system! We're excited to have you on board.</p>
          <p>With ${companyName}, you can:</p>
          <ul>
            <li>✅ Check in/out with GPS verification</li>
            <li>📅 Request and track leave days</li>
            <li>📊 View your attendance history</li>
            <li>🔔 Receive important notifications</li>
          </ul>
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXTAUTH_URL}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Get Started
            </a>
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            If you have any questions, please contact your HR department.
          </p>
        </div>
      </div>
    `,
    text: `Welcome to ${companyName}!\n\nHello ${name},\n\nWelcome to our attendance management system! You can now check in/out, request leave, and view your attendance history.\n\nGet started: ${process.env.NEXTAUTH_URL}`,
  };
}

function getCheckInEmail(name: string, time: string, location: string, isLate: boolean): EmailTemplate {
  const statusEmoji = isLate ? '⚠️' : '✅';
  const statusText = isLate ? 'Late Check-in' : 'On Time';
  
  return {
    subject: `${statusEmoji} ${statusText} - ${time}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${isLate ? '#f59e0b' : '#10b981'}; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">${statusEmoji} ${statusText}</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <p>Hello ${name},</p>
          <p>Your check-in has been recorded:</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>🕐 Time:</strong> ${time}</p>
            <p style="margin: 5px 0;"><strong>📍 Location:</strong> ${location}</p>
            <p style="margin: 5px 0;"><strong>📊 Status:</strong> ${statusText}</p>
          </div>
          ${isLate ? '<p style="color: #f59e0b;">⚠️ You checked in after the grace period. Please try to arrive on time.</p>' : ''}
        </div>
      </div>
    `,
    text: `${statusEmoji} ${statusText}\n\nHello ${name},\n\nYour check-in at ${time} has been recorded.\nLocation: ${location}\n${isLate ? '⚠️ You checked in late.' : ''}`,
  };
}

function getCheckOutEmail(name: string, time: string, totalHours: number): EmailTemplate {
  return {
    subject: `👋 Check-out Recorded - ${totalHours.toFixed(1)}h Today`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">👋 Goodbye, ${name}!</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <p>Your work day has ended:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 15px 0;">
            <p style="font-size: 48px; font-weight: bold; color: #10b981; margin: 0;">${totalHours.toFixed(1)}h</p>
            <p style="color: #6b7280; margin: 5px 0;">Total working hours today</p>
          </div>
          <p style="text-align: center; color: #6b7280;">Check-out time: ${time}</p>
          <p style="text-align: center; margin-top: 20px;">Have a great evening! 🌙</p>
        </div>
      </div>
    `,
    text: `Goodbye ${name}!\n\nYou checked out at ${time}.\nTotal hours today: ${totalHours.toFixed(1)}h\n\nHave a great evening!`,
  };
}

function getLeaveRequestEmail(name: string, leaveType: string, startDate: string, endDate: string, status: 'submitted' | 'approved' | 'rejected'): EmailTemplate {
  const statusConfig = {
    submitted: { emoji: '📝', color: '#6366f1', text: 'Submitted' },
    approved: { emoji: '✅', color: '#10b981', text: 'Approved' },
    rejected: { emoji: '❌', color: '#ef4444', text: 'Rejected' },
  };
  
  const config = statusConfig[status];
  
  return {
    subject: `${config.emoji} Leave Request ${config.text}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${config.color}; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">${config.emoji} Leave Request ${config.text}</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <p>Hello ${name},</p>
          <p>Your leave request has been ${status === 'submitted' ? 'submitted for review' : config.text.toLowerCase()}:</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>📋 Type:</strong> ${leaveType}</p>
            <p style="margin: 5px 0;"><strong>📅 From:</strong> ${startDate}</p>
            <p style="margin: 5px 0;"><strong>📅 To:</strong> ${endDate}</p>
          </div>
          ${status === 'submitted' ? '<p style="color: #6b7280;">Your manager will review your request shortly.</p>' : ''}
          ${status === 'approved' ? '<p style="color: #10b981;">✅ Your leave has been approved. Enjoy your time off!</p>' : ''}
          ${status === 'rejected' ? '<p style="color: #ef4444;">❌ Unfortunately, your request was not approved. Please contact your manager.</p>' : ''}
        </div>
      </div>
    `,
    text: `${config.emoji} Leave Request ${config.text}\n\nHello ${name},\n\nYour ${leaveType} request (${startDate} to ${endDate}) has been ${status === 'submitted' ? 'submitted' : config.text.toLowerCase()}.`,
  };
}

function getWeeklyReportEmail(name: string, data: { present: number; late: number; absent: number; totalHours: number }): EmailTemplate {
  return {
    subject: `📊 Weekly Attendance Report`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">📊 Weekly Attendance Report</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <p>Hello ${name},</p>
          <p>Here's your attendance summary for this week:</p>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0;">
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #10b981; margin: 0;">${data.present}</p>
              <p style="color: #6b7280; margin: 5px 0;">Present Days</p>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #f59e0b; margin: 0;">${data.late}</p>
              <p style="color: #6b7280; margin: 5px 0;">Late Days</p>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #ef4444; margin: 0;">${data.absent}</p>
              <p style="color: #6b7280; margin: 5px 0;">Absent Days</p>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #6366f1; margin: 0;">${data.totalHours.toFixed(1)}h</p>
              <p style="color: #6b7280; margin: 5px 0;">Total Hours</p>
            </div>
          </div>
          <p style="text-align: center;">
            <a href="${process.env.NEXTAUTH_URL}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Details
            </a>
          </p>
        </div>
      </div>
    `,
    text: `📊 Weekly Attendance Report\n\nHello ${name},\n\nYour weekly summary:\n- Present: ${data.present} days\n- Late: ${data.late} days\n- Absent: ${data.absent} days\n- Total Hours: ${data.totalHours.toFixed(1)}h`,
  };
}

function getPasswordResetEmail(name: string, resetLink: string): EmailTemplate {
  return {
    subject: '🔐 Reset Your Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🔐 Password Reset</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <p>Hello ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #1f2937; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `,
    text: `Reset Your Password\n\nHello ${name},\n\nClick this link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`,
  };
}

// ============================================
// EMAIL SERVICE FUNCTIONS
// ============================================

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using Resend
 */
async function sendEmail(to: string, template: EmailTemplate): Promise<SendEmailResult> {
  // If no Resend API key, log and return success (demo mode)
  if (!resend) {
    console.log('📧 [DEMO MODE] Email would be sent to:', to);
    console.log('📧 Subject:', template.subject);
    return { success: true, messageId: `demo-${Date.now()}` };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (error) {
      console.error('Email error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// PUBLIC API
// ============================================

export const emailService = {
  /**
   * Send welcome email to new user
   */
  async sendWelcome(to: string, name: string, companyName: string = 'AttendanceHub'): Promise<SendEmailResult> {
    return sendEmail(to, getWelcomeEmail(name, companyName));
  },

  /**
   * Send check-in confirmation
   */
  async sendCheckInConfirmation(
    to: string,
    name: string,
    time: string,
    location: string,
    isLate: boolean = false
  ): Promise<SendEmailResult> {
    return sendEmail(to, getCheckInEmail(name, time, location, isLate));
  },

  /**
   * Send check-out confirmation
   */
  async sendCheckOutConfirmation(
    to: string,
    name: string,
    time: string,
    totalHours: number
  ): Promise<SendEmailResult> {
    return sendEmail(to, getCheckOutEmail(name, time, totalHours));
  },

  /**
   * Send leave request notification
   */
  async sendLeaveRequestNotification(
    to: string,
    name: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    status: 'submitted' | 'approved' | 'rejected'
  ): Promise<SendEmailResult> {
    return sendEmail(to, getLeaveRequestEmail(name, leaveType, startDate, endDate, status));
  },

  /**
   * Send weekly attendance report
   */
  async sendWeeklyReport(
    to: string,
    name: string,
    data: { present: number; late: number; absent: number; totalHours: number }
  ): Promise<SendEmailResult> {
    return sendEmail(to, getWeeklyReportEmail(name, data));
  },

  /**
   * Send password reset email
   */
  async sendPasswordReset(to: string, name: string, resetToken: string): Promise<SendEmailResult> {
    const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;
    return sendEmail(to, getPasswordResetEmail(name, resetLink));
  },

  /**
   * Send custom email
   */
  async sendCustom(to: string, subject: string, html: string, text?: string): Promise<SendEmailResult> {
    return sendEmail(to, { subject, html, text: text || '' });
  },
};

// Default export
export default emailService;
