import { EmailStatus, UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: UserRole;
}

export interface EmailAttachmentPayload {
  name: string;
  size: number;
  mimeType: string;
  dataUrl?: string;
}

export interface EmailJobData {
  emailId: string;
  userId: string;
  senderId: string;
  idempotencyKey: string;
}

export interface EmailSearchDocument {
  id: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  recipient: string;
  subject: string;
  body: string;
  textBody: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
