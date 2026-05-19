/**
 * Email delivery for the AEO grader.
 *
 * Sends through Resend's SMTP gateway (a nodemailer transport, with
 * RESEND_API_KEY as the credential). If RESEND_API_KEY is unset the send is
 * skipped, so the pipeline still completes in local dev without credentials.
 * Both emails carry the same audit PDF as an attachment.
 *
 * Sender config, all from env:
 *   RESEND_API_KEY           Resend credential (doubles as the SMTP password)
 *   SMTP_FROM                from address — must be a Resend-verified domain
 *   SMTP_FROM_NAME           from display name
 *   SMTP_REPLY_TO            reply-to header
 *   LEAD_NOTIFICATION_EMAIL  recipient of the lead notification
 *
 * Sent together from the unlock endpoint:
 *   sendReportEmail      -> the visitor, the full report
 *   sendLeadNotification -> the GMS owner inbox, the lead's details
 */

import nodemailer from 'nodemailer';
import type { Analysis } from './types.js';

type SendResult = { sent?: boolean; skipped?: boolean; error?: string };

/** Resend's SMTP gateway. The API key doubles as the SMTP password. */
function buildTransport(): nodemailer.Transporter | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: { user: 'resend', pass: apiKey },
  });
}

/** From header: "Display Name <address>", from SMTP_FROM_NAME / SMTP_FROM. */
function senderFrom(): string {
  const address = process.env.SMTP_FROM || 'noreply@growthmarketingstudios.com';
  const name = process.env.SMTP_FROM_NAME;
  return name ? `${name} <${address}>` : address;
}

interface PdfMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Disk path to the audit PDF, attached to the email. */
  pdfPath: string;
  pdfName: string;
  /** Short label for log lines. */
  label: string;
}

/** Shared sender: one email with the audit PDF attached. */
async function sendWithPdf(mail: PdfMail): Promise<SendResult> {
  const transport = buildTransport();
  if (!transport) {
    console.error(`[email] RESEND_API_KEY not configured — skipping ${mail.label}`);
    return { skipped: true };
  }

  try {
    await transport.sendMail({
      from: senderFrom(),
      to: mail.to,
      replyTo: process.env.SMTP_REPLY_TO || undefined,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: [
        {
          filename: mail.pdfName,
          path: mail.pdfPath,
          contentType: 'application/pdf',
        },
      ],
    });
    console.log(`[email] ${mail.label} sent to ${mail.to}`);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${mail.label} failed: ${message}`);
    return { error: message };
  }
}

interface SendReportArgs {
  to: string;
  fullName: string;
  brand: string;
  domain: string;
  analysisId: string;
  /** Compact branded HTML used as the email body. */
  emailHtml: string;
  /** Disk path to the full PDF report. */
  pdfPath: string;
}

/** The report email, sent to the visitor who completed the unlock gate. */
export async function sendReportEmail(args: SendReportArgs): Promise<SendResult> {
  return sendWithPdf({
    to: args.to,
    subject: `Your AEO Visibility Audit — ${args.brand}`,
    html: args.emailHtml,
    text:
      `Hi ${args.fullName},\n\n` +
      `Your AEO Visibility Audit for ${args.brand} (${args.domain}) is ready.\n` +
      `The full report is attached as a PDF.\n\n` +
      `This is a diagnostic scan of how the major AI engines describe your ` +
      `practice. The next step is a 20-minute call with a GMS specialist to ` +
      `walk through the findings.\n\n` +
      `Audit ID: ${args.analysisId}\n\n` +
      `Growth Marketing Studios`,
    pdfPath: args.pdfPath,
    pdfName: `aeo-audit-${args.analysisId}.pdf`,
    label: `report email (${args.analysisId})`,
  });
}

/**
 * Internal lead notification. Sent to the GMS owner inbox when a visitor
 * completes the contact gate, with the lead's details and the audit PDF.
 */
export async function sendLeadNotification(analysis: Analysis): Promise<SendResult> {
  const to = process.env.LEAD_NOTIFICATION_EMAIL || 'ferminfleites@gmail.com';
  if (!analysis.pdf_path) {
    console.error(
      `[email] lead notification for ${analysis.analysis_id} has no PDF — skipping`,
    );
    return { skipped: true };
  }

  const i = analysis.input;
  const c = analysis.contact;
  const rows: Array<[string, string]> = [
    ['First name', c?.firstName ?? ''],
    ['Last name', c?.lastName ?? ''],
    ['Email', c?.email ?? ''],
    ['Phone', c?.phone ?? ''],
    ['Brand', i.brand],
    ['Domain', i.domain],
    ['Location', i.location],
    ['Sector', i.specialty],
    ['Product or service', i.product],
    ['Audit ID', analysis.analysis_id],
    ['Submitted', new Date(analysis.created_at).toISOString()],
  ];

  return sendWithPdf({
    to,
    subject: 'For Rellenado en AEO_Auditor',
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    html:
      `<div style="font-family:Arial,sans-serif;color:#0e1116;">` +
      `<h2 style="font-size:18px;">New AEO Auditor lead</h2>` +
      `<table style="border-collapse:collapse;font-size:14px;">` +
      rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 14px 4px 0;color:#6b6e76;">${k}</td>` +
            `<td style="padding:4px 0;font-weight:600;">${v || '&mdash;'}</td></tr>`,
        )
        .join('') +
      `</table>` +
      `<p style="font-size:13px;color:#6b6e76;margin-top:14px;">` +
      `The full audit PDF is attached.</p></div>`,
    pdfPath: analysis.pdf_path,
    pdfName: `aeo-audit-${analysis.analysis_id}.pdf`,
    label: `lead notification (${analysis.analysis_id})`,
  });
}

/** Exposed for logging only. True once Resend credentials are present. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
