import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';

export const apiClient = createClient<paths>({
  baseUrl,
});

export const wsBaseUrl = baseUrl.replace(/^http/, 'ws');

