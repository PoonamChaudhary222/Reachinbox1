import { ApiResponse, Sender } from '../types';
import { api } from './api';

export interface CreateSenderPayload {
  email: string;
  displayName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  isDefault?: boolean;
}

export const senderService = {
  async listSenders(): Promise<Sender[]> {
    const res = await api.get<ApiResponse<{ senders: Sender[] }>>('/senders');
    return res.data.data.senders;
  },

  async createSender(payload: CreateSenderPayload): Promise<Sender> {
    const res = await api.post<ApiResponse<{ sender: Sender }>>('/senders', payload);
    return res.data.data.sender;
  },

  async updateSender(
    id: string,
    payload: Partial<Omit<CreateSenderPayload, 'email'>>
  ): Promise<Sender> {
    const res = await api.patch<ApiResponse<{ sender: Sender }>>(`/senders/${id}`, payload);
    return res.data.data.sender;
  },

  async deleteSender(id: string): Promise<void> {
    await api.delete(`/senders/${id}`);
  },
};
