import { Resend } from 'resend';
import { createLogger } from '../lib/logger';

const logger = createLogger('email');

// Lazy-initialize Resend client (only when needed and API key exists)
let _resend: Resend | null = null;
function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Email configuration
const FROM_EMAIL = process.env.EMAIL_FROM || 'Relay <noreply@relay.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const APP_NAME = 'Relay';

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

interface MagicLinkEmailParams {
  to: string;
  token: string;
}

interface WelcomeEmailParams {
  to: string;
  name?: string;
}

interface NotificationEmailParams {
  to: string;
  subject: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}

// ============================================================================
// SEND FUNCTIONS
// ============================================================================

export async function sendMagicLinkEmail({ to, token }: MagicLinkEmailParams): Promise<boolean> {
  const magicLinkUrl = `${APP_URL}/auth/verify?token=${token}`;
  const env = process.env.NODE_ENV || 'development';
  const isDev = env === 'development' || env === 'test';

  // Always log magic link URL in non-production for easy testing
  if (isDev) {
    console.log('\n' + '='.repeat(60));
    console.log('MAGIC LINK FOR:', to);
    console.log('='.repeat(60));
    console.log(magicLinkUrl);
    console.log('='.repeat(60) + '\n');
    // Skip sending email in dev - just use the logged URL
    return true;
  }

  try {
    // In production without API key, log warning
    const resend = getResendClient();
    if (!resend) {
      logger.warn({ to, magicLinkUrl }, 'No RESEND_API_KEY configured - email not sent');
      return true;
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Sign in to ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sign in to ${APP_NAME}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 32px 32px 0;">
                      <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #171717;">${APP_NAME}</h1>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 24px 32px;">
                      <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #404040;">
                        Click the button below to sign in to your account. This link will expire in 15 minutes.
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 8px 0 24px;">
                            <a href="${magicLinkUrl}" style="display: inline-block; padding: 14px 32px; background-color: #171717; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 8px;">
                              Sign in to ${APP_NAME}
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 0; font-size: 14px; line-height: 20px; color: #737373;">
                        If you didn't request this email, you can safely ignore it.
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
                      <p style="margin: 0; font-size: 12px; color: #a3a3a3;">
                        This link will expire in 15 minutes. If the button doesn't work, copy and paste this URL into your browser:
                      </p>
                      <p style="margin: 8px 0 0; font-size: 12px; color: #737373; word-break: break-all;">
                        ${magicLinkUrl}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `Sign in to ${APP_NAME}\n\nClick the link below to sign in to your account. This link will expire in 15 minutes.\n\n${magicLinkUrl}\n\nIf you didn't request this email, you can safely ignore it.`,
    });

    if (error) {
      logger.error({ error, to }, 'Failed to send magic link email');
      return false;
    }

    logger.info({ to, emailId: data?.id }, 'Magic link email sent');
    return true;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send magic link email');
    return false;
  }
}

export async function sendWelcomeEmail({ to, name }: WelcomeEmailParams): Promise<boolean> {
  const greeting = name ? `Hi ${name}` : 'Welcome';

  try {
    const resend = getResendClient();
    if (!resend) {
      logger.info({ to }, 'Welcome email (no API key - email not sent)');
      return true;
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Welcome to ${APP_NAME}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${APP_NAME}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 32px 32px 0;">
                      <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #171717;">${APP_NAME}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 32px;">
                      <p style="margin: 0 0 16px; font-size: 18px; font-weight: 500; color: #171717;">
                        ${greeting}!
                      </p>
                      <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #404040;">
                        Thanks for joining ${APP_NAME}. We're excited to help you understand your users better.
                      </p>
                      <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #404040;">
                        Here's how to get started:
                      </p>
                      <ol style="margin: 0 0 24px; padding-left: 24px; font-size: 16px; line-height: 24px; color: #404040;">
                        <li style="margin-bottom: 8px;">Create your first project</li>
                        <li style="margin-bottom: 8px;">Install the SDK in your app</li>
                        <li style="margin-bottom: 8px;">Start collecting feedback</li>
                      </ol>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${APP_URL}/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #171717; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 8px;">
                              Go to Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
                      <p style="margin: 0; font-size: 12px; color: #a3a3a3;">
                        Need help? Reply to this email and we'll get back to you.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `${greeting}!\n\nThanks for joining ${APP_NAME}. We're excited to help you understand your users better.\n\nHere's how to get started:\n1. Create your first project\n2. Install the SDK in your app\n3. Start collecting feedback\n\nGo to your dashboard: ${APP_URL}/dashboard\n\nNeed help? Reply to this email and we'll get back to you.`,
    });

    if (error) {
      logger.error({ error, to }, 'Failed to send welcome email');
      return false;
    }

    logger.info({ to, emailId: data?.id }, 'Welcome email sent');
    return true;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send welcome email');
    return false;
  }
}

export async function sendNotificationEmail({
  to,
  subject,
  title,
  body,
  actionUrl,
  actionLabel,
}: NotificationEmailParams): Promise<boolean> {
  try {
    const resend = getResendClient();
    if (!resend) {
      logger.info({ to, subject }, 'Notification email (no API key - email not sent)');
      return true;
    }

    const actionButton = actionUrl && actionLabel
      ? `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 24px 0 0;">
              <a href="${actionUrl}" style="display: inline-block; padding: 14px 32px; background-color: #171717; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 8px;">
                ${actionLabel}
              </a>
            </td>
          </tr>
        </table>
      `
      : '';

    const actionText = actionUrl && actionLabel
      ? `\n\n${actionLabel}: ${actionUrl}`
      : '';

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 32px 32px 0;">
                      <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #171717;">${APP_NAME}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 32px;">
                      <p style="margin: 0 0 16px; font-size: 18px; font-weight: 500; color: #171717;">
                        ${title}
                      </p>
                      <p style="margin: 0; font-size: 16px; line-height: 24px; color: #404040;">
                        ${body}
                      </p>
                      ${actionButton}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
                      <p style="margin: 0; font-size: 12px; color: #a3a3a3;">
                        You're receiving this because you have notifications enabled for your ${APP_NAME} account.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `${title}\n\n${body}${actionText}\n\nYou're receiving this because you have notifications enabled for your ${APP_NAME} account.`,
    });

    if (error) {
      logger.error({ error, to, subject }, 'Failed to send notification email');
      return false;
    }

    logger.info({ to, subject, emailId: data?.id }, 'Notification email sent');
    return true;
  } catch (error) {
    logger.error({ error, to, subject }, 'Failed to send notification email');
    return false;
  }
}

// Export the resend client getter for advanced use cases
export { getResendClient };
