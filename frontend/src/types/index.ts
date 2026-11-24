export type UserRole = 'USER' | 'ADMIN';

export type EmailStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: UserRole;
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailAttachment {
  name: string;
  size: number;
  mimeType: string;
  dataUrl?: string;
}

export interface EmailRecord {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  textBody: string | null;
  attachments: EmailAttachment[] | null;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  delayBetweenEmailsMs: number;
  hourlyLimit: number | null;
  starred: boolean;
  errorMessage: string | null;
  etherealPreviewUrl: string | null;
  idempotencyKey: string;
  bullJobId: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    email: string;
    displayName: string;
  };
}

export interface PaginatedEmails {
  items: EmailRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  engine?: 'elasticsearch' | 'postgresql-fallback';
}

export interface DashboardStats {
  total: number;
  scheduled: number;
  sent: number;
  failed: number;
  cancelled: number;
  sentAndFailed: number;
}

export interface SlackStatus {
  connected: boolean;
  integration: {
    id: string;
    teamId: string;
    teamName: string | null;
    channelId: string | null;
    channelName: string | null;
    connectedAt: string;
  } | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
