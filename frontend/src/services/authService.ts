import { ApiResponse, User } from '../types';
import { API_BASE_URL, api } from './api';

export const authService = {
  getGoogleOAuthRedirectUrl(): string {
    return `${API_BASE_URL}/api/auth/google`;
  },

  async loginWithGoogleToken(idToken: string): Promise<User> {
    const res = await api.post<ApiResponse<{ user: User }>>('/auth/google', { idToken });
    return res.data.data.user;
  },

  async loginWithPassword(email: string, password: string): Promise<User> {
    const res = await api.post<ApiResponse<{ user: User }>>('/auth/login', {
      email,
      password,
    });
    return res.data.data.user;
  },

  async registerWithPassword(name: string, email: string, password: string): Promise<User> {
    const res = await api.post<ApiResponse<{ user: User }>>('/auth/register', {
      name,
      email,
      password,
    });
    return res.data.data.user;
  },

  async getCurrentUser(): Promise<User> {
    const res = await api.get<ApiResponse<{ user: User }>>('/auth/me');
    return res.data.data.user;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
