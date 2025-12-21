import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';

export const getClientId = (): string => {
  const key = 'graphboard_client_id';
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;

  const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  window.sessionStorage.setItem(key, created);
  return created;
};

export const apiClient = createClient<paths>({
  baseUrl,
});

export const wsBaseUrl = baseUrl.replace(/^http/, 'ws');


