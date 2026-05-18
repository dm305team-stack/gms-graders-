/**
 * Email delivery for the AEO grader.
 *
 * Ported from the HIPAA grader's hpx-api: SMTP via nodemailer, pointed at
 * Resend's SMTP gateway. If SMTP_HOST is unset the send is skipped (so the
 * pipeline still completes in local dev without credentials).
 */

import nodemailer from 'nodemailer';

interface SendReportArgs {
  to: string;
  fullName: string;
  brand: string;
  domain: string;
  analysisId: string;
  /** Compact branded HTML used as the email body. */
  emailHtml: string;
  /** Disk path to the full HTML report, attached to the email. */
  reportPath: string;
}

function buildTransport(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendReportEmail(
  args: SendReportArgs,
): Promise<{ sent?: boolean; skipped?: boolean; error?: string }> {
  const transport = buildTransport();
  if (!transport) {
    console.error(
      `[email] SMTP_HOST not configured — skipping email for ${args.analysisId}`,
    );
    return { skipped: true };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'audits@growthmarketingstudios.com';

  try {
    await transport.sendMail({
      from,
      to: args.to,
      subject: `Your AEO Visibility Audit — ${args.brand}`,
      html: args.emailHtml,
      text:
        `Hi ${args.fullName},\n\n` +
        `Your AEO Visibility Audit for ${args.brand} (${args.domain}) is ready.\n` +
        `The full report is attached as an HTML file.\n\n` +
        `This is a diagnostic scan of how the 4 major AI engines describe your ` +
        `practice. The next step is a 20-minute call with a GMS specialist to ` +
        `walk through the findings.\n\n` +
        `Analysis ID: ${args.analysisId}\n\n` +
        `— Growth Marketing Studios`,
      attachments: [
        {
          filename: `aeo-audit-${args.analysisId}.html`,
          path: args.reportPath,
          contentType: 'text/html',
        },
      ],
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] send failed for ${args.analysisId}: ${message}`);
    return { error: message };
  }
}

/** Exposed for logging only. */
export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}
