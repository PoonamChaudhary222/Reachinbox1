import { ApiResponse, SlackStatus } from '../types';
import { API_BASE_URL, api } from './api';

export const slackService = {
  getConnectUrl(): string {
    return `${API_BASE_URL}/api/slack/connect`;
  },

  async getStatus(): Promise<SlackStatus> {
    const res = await api.get<ApiResponse<SlackStatus>>('/slack/status');
    return res.data.data;
  },

  async disconnect(): Promise<void> {
    await api.post('/slack/disconnect');
  },
};
