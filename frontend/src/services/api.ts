import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const apiMsg = err.response?.data?.error?.message || err.response?.data?.message;
    if (apiMsg) return String(apiMsg);
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}
