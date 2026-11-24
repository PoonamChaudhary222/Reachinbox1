import crypto from 'crypto';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { EmailAttachmentPayload } from '../../types';
import { decryptSecret } from '../../utils/crypto';
import { htmlToPlainText } from '../../utils/html';

export interface SmtpConfigInput {
  host?: string | null;
  port?: number | null;
  user?: string | null;
  encryptedPass?: string | null;
}

export interface SendEmailParams {
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  attachments?: EmailAttachmentPayload[];
  smtpConfig?: SmtpConfigInput;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | null;
}

let cachedAutoEtherealAccount: { user: string; pass: string } | null = null;
const transporterCache = new Map<string, Transporter>();

async function resolveSmtpCredentials(smtpConfig?: SmtpConfigInput) {
  const host = smtpConfig?.host || env.ETHEREAL_HOST || 'smtp.ethereal.email';
  const port = smtpConfig?.port || env.ETHEREAL_PORT || 587;
  let user = smtpConfig?.user || env.ETHEREAL_USER;
  let pass = smtpConfig?.encryptedPass
    ? decryptSecret(smtpConfig.encryptedPass)
    : env.ETHEREAL_PASS;

  if ((!user || !pass) && host.includes('ethereal')) {
    if (!cachedAutoEtherealAccount) {
      const testAccount = await nodemailer.createTestAccount();
      cachedAutoEtherealAccount = {
        user: testAccount.user,
        pass: testAccount.pass,
      };
      console.log(
        `[Ethereal] Auto-generated development Ethereal account: ${cachedAutoEtherealAccount.user}`
      );
    }
    user = cachedAutoEtherealAccount.user;
    pass = cachedAutoEtherealAccount.pass;
  }

  if (!user || !pass) {
    throw new Error(
      'SMTP credentials are not configured. Set ETHEREAL_USER/ETHEREAL_PASS or sender SMTP credentials.'
    );
  }

  return { host, port, user, pass };
}

async function getTransporter(smtpConfig?: SmtpConfigInput): Promise<Transporter> {
  const creds = await resolveSmtpCredentials(smtpConfig);
  const passHash = crypto.createHash('sha256').update(creds.pass).digest('hex').slice(0, 12);
  const cacheKey = `${creds.host}:${creds.port}:${creds.user}:${passHash}`;

  const existing = transporterCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const transporter = nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.port === 465,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
  });

  transporterCache.set(cacheKey, transporter);
  return transporter;
}

export async function sendViaSmtp(params: SendEmailParams): Promise<SendEmailResult> {
  const transporter = await getTransporter(params.smtpConfig);
  const plainText = params.text?.trim() || htmlToPlainText(params.html);

  const nodemailerAttachments = (params.attachments || [])
    .filter((att) => Boolean(att.dataUrl))
    .map((att) => ({
      filename: att.name,
      path: att.dataUrl,
      contentType: att.mimeType,
    }));

  const info = await transporter.sendMail({
    from: `"${params.fromName}" <${params.fromEmail}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: plainText,
    attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  return {
    messageId: info.messageId,
    previewUrl,
  };
}
