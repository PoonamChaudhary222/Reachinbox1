import {
  ApiResponse,
  DashboardStats,
  EmailAttachment,
  EmailRecord,
  EmailStatus,
  PaginatedEmails,
} from '../types';
import { api } from './api';

export interface ScheduleEmailPayload {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenEmailsSeconds?: number;
  hourlyLimit?: number;
  attachments?: EmailAttachment[];
  requestIdempotencyKey?: string;
}

export interface EmailQueryParams {
  status?: EmailStatus;
  search?: string;
  senderId?: string;
  sortBy?: 'scheduledAt' | 'sentAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const emailService = {
  async scheduleEmails(payload: ScheduleEmailPayload) {
    const res = await api.post<
      ApiResponse<{ scheduledCount: number; emails: EmailRecord[]; deduplicated: boolean }>
    >('/emails/schedule', payload);
    return res.data.data;
  },

  async getAllEmails(params?: EmailQueryParams): Promise<PaginatedEmails> {
    const res = await api.get<ApiResponse<PaginatedEmails>>('/emails', { params });
    return res.data.data;
  },

  async getScheduledEmails(params?: EmailQueryParams): Promise<PaginatedEmails> {
    const res = await api.get<ApiResponse<PaginatedEmails>>('/emails/scheduled', { params });
    return res.data.data;
  },

  async getSentEmails(params?: EmailQueryParams): Promise<PaginatedEmails> {
    const res = await api.get<ApiResponse<PaginatedEmails>>('/emails/sent', { params });
    return res.data.data;
  },

  async searchEmails(params: {
    q?: string;
    status?: EmailStatus;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedEmails> {
    const res = await api.get<ApiResponse<PaginatedEmails>>('/search/emails', { params });
    return res.data.data;
  },

  async getEmailById(id: string): Promise<EmailRecord> {
    const res = await api.get<ApiResponse<{ email: EmailRecord }>>(`/emails/${id}`);
    return res.data.data.email;
  },

  async toggleStar(id: string): Promise<EmailRecord> {
    const res = await api.patch<ApiResponse<{ email: EmailRecord }>>(`/emails/${id}/star`);
    return res.data.data.email;
  },

  async cancelOrDelete(id: string): Promise<{ action: 'cancelled' | 'deleted' }> {
    const res = await api.delete<ApiResponse<{ action: 'cancelled' | 'deleted' }>>(`/emails/${id}`);
    return res.data.data;
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await api.get<ApiResponse<{ stats: DashboardStats }>>('/dashboard/stats');
    return res.data.data.stats;
  },
};
