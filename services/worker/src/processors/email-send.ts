import { Job } from 'bullmq';
import { prisma } from '../index.js';

interface EmailSendJob {
  type: 'magic_link' | 'notification' | 'digest';
  to: string;
  subject?: string;
  templateId?: string;
  data?: Record<string, unknown>;
}

export async function emailSendProcessor(job: Job<EmailSendJob>) {
  const { type, to, subject, templateId, data } = job.data;

  console.log(`Processing email: ${type} to ${to}`);

  switch (type) {
    case 'magic_link':
      return await sendMagicLinkEmail(to, data as { token: string; loginUrl: string });
    case 'notification':
      return await sendNotificationEmail(to, subject!, templateId!, data!);
    case 'digest':
      return await sendDigestEmail(to, data!);
    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

async function sendMagicLinkEmail(
  to: string,
  data: { token: string; loginUrl: string }
) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Relay</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6366f1; margin: 0;">Relay</h1>
  </div>

  <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin-top: 0;">Sign in to your account</h2>
    <p>Click the button below to sign in to Relay. This link will expire in 15 minutes.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.loginUrl}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
        Sign in to Relay
      </a>
    </div>

    <p style="color: #64748b; font-size: 14px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${data.loginUrl}" style="color: #6366f1; word-break: break-all;">${data.loginUrl}</a>
    </p>
  </div>

  <div style="color: #94a3b8; font-size: 12px; text-align: center;">
    <p>If you didn't request this email, you can safely ignore it.</p>
    <p>&copy; ${new Date().getFullYear()} Relay. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return await sendEmail({
    to,
    subject: 'Sign in to Relay',
    html,
  });
}

async function sendNotificationEmail(
  to: string,
  subject: string,
  templateId: string,
  data: Record<string, unknown>
) {
  let html: string;

  switch (templateId) {
    case 'new_bug_assigned':
      html = buildNewBugAssignedEmail(data);
      break;
    case 'status_changed':
      html = buildStatusChangedEmail(data);
      break;
    case 'new_comment':
      html = buildNewCommentEmail(data);
      break;
    default:
      throw new Error(`Unknown template: ${templateId}`);
  }

  return await sendEmail({ to, subject, html });
}

async function sendDigestEmail(to: string, data: Record<string, unknown>) {
  const { projectName, period, stats, topIssues } = data as {
    projectName: string;
    period: string;
    stats: {
      newBugs: number;
      resolved: number;
      newFeedback: number;
      chatMessages: number;
    };
    topIssues: Array<{
      id: string;
      title: string;
      severity: string;
      status: string;
    }>;
  };

  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${period} Digest - ${projectName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6366f1; margin: 0;">Relay</h1>
    <p style="color: #64748b;">${period} Digest for ${projectName}</p>
  </div>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="margin-top: 0; margin-bottom: 20px;">Summary</h2>

    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
      <div style="background: white; padding: 16px; border-radius: 6px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${stats.newBugs}</div>
        <div style="color: #64748b; font-size: 14px;">New Bugs</div>
      </div>
      <div style="background: white; padding: 16px; border-radius: 6px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #22c55e;">${stats.resolved}</div>
        <div style="color: #64748b; font-size: 14px;">Resolved</div>
      </div>
      <div style="background: white; padding: 16px; border-radius: 6px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${stats.newFeedback}</div>
        <div style="color: #64748b; font-size: 14px;">Feedback</div>
      </div>
      <div style="background: white; padding: 16px; border-radius: 6px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${stats.chatMessages}</div>
        <div style="color: #64748b; font-size: 14px;">Messages</div>
      </div>
    </div>
  </div>

  ${
    topIssues.length > 0
      ? `
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="margin-top: 0;">Top Issues</h2>
    ${topIssues
      .map(
        (issue) => `
      <div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
        <a href="${dashboardUrl}/dashboard/inbox/${issue.id}" style="color: #6366f1; text-decoration: none; font-weight: 500;">
          ${issue.title}
        </a>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
          ${issue.severity} · ${issue.status}
        </div>
      </div>
    `
      )
      .join('')}
  </div>
  `
      : ''
  }

  <div style="text-align: center; margin-bottom: 20px;">
    <a href="${dashboardUrl}/dashboard" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
      View Dashboard
    </a>
  </div>

  <div style="color: #94a3b8; font-size: 12px; text-align: center;">
    <p>&copy; ${new Date().getFullYear()} Relay. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return await sendEmail({
    to,
    subject: `${period} Digest - ${projectName}`,
    html,
  });
}

function buildNewBugAssignedEmail(data: Record<string, unknown>): string {
  const { title, description, assignee, url } = data as {
    title: string;
    description: string;
    assignee: string;
    url: string;
  };

  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>New Bug Assigned to You</h2>
  <p>Hi ${assignee},</p>
  <p>A new bug has been assigned to you:</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0;">${title}</h3>
    <p>${description?.slice(0, 300) || 'No description provided.'}</p>
  </div>

  <a href="${url}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
    View Bug
  </a>
</body>
</html>
  `;
}

function buildStatusChangedEmail(data: Record<string, unknown>): string {
  const { title, oldStatus, newStatus, changedBy, url } = data as {
    title: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
    url: string;
  };

  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Status Updated</h2>
  <p>The status of "${title}" has been changed:</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p><strong>${oldStatus}</strong> → <strong>${newStatus}</strong></p>
    <p style="color: #64748b; font-size: 14px;">Changed by ${changedBy}</p>
  </div>

  <a href="${url}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
    View Details
  </a>
</body>
</html>
  `;
}

function buildNewCommentEmail(data: Record<string, unknown>): string {
  const { title, comment, commentBy, url } = data as {
    title: string;
    comment: string;
    commentBy: string;
    url: string;
  };

  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>New Comment</h2>
  <p>New comment on "${title}":</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p>${comment}</p>
    <p style="color: #64748b; font-size: 14px;">— ${commentBy}</p>
  </div>

  <a href="${url}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
    Reply
  </a>
</body>
</html>
  `;
}

async function sendEmail(options: { to: string; subject: string; html: string }) {
  const smtpUrl = process.env.SMTP_URL;

  if (!smtpUrl) {
    // Development: log to console
    console.log('📧 Email (dev mode):', {
      to: options.to,
      subject: options.subject,
    });
    return { success: true, dev: true };
  }

  // Production: Use nodemailer or your email service
  // This is a placeholder - integrate with your email provider
  const response = await fetch(smtpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email send failed: ${response.status}`);
  }

  return { success: true };
}
