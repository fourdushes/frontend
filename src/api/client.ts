import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { addDiagnostic } from './diagnostics';
import { getApiAccessToken } from './tokenStore';

type TimedConfig = InternalAxiosRequestConfig & {
  metadata?: {
    startedAt: number;
    requestId: string;
  };
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8080';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

function requestId() {
  return `front-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function record(config: TimedConfig | undefined, status: number | undefined, ok: boolean, message?: string) {
  const startedAt = config?.metadata?.startedAt ?? Date.now();
  addDiagnostic({
    id: `${startedAt}-${Math.random()}`,
    method: (config?.method || 'GET').toUpperCase(),
    path: config?.url || 'unknown',
    status,
    durationMs: Date.now() - startedAt,
    requestId: config?.metadata?.requestId || 'missing',
    at: new Date().toISOString(),
    ok,
    message,
  });
}

apiClient.interceptors.request.use((rawConfig) => {
  const config = rawConfig as TimedConfig;
  const id = requestId();
  config.metadata = { startedAt: Date.now(), requestId: id };
  config.headers['X-Client-Request-ID'] = id;

  const token = getApiAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    record(response.config as TimedConfig, response.status, true);
    return response;
  },
  (unknownError: unknown) => {
    const error = unknownError as AxiosError<{ message?: string }>;
    const message =
      error.response?.data?.message ||
      error.message ||
      '알 수 없는 네트워크 오류';
    record(error.config as TimedConfig | undefined, error.response?.status, false, message);
    return Promise.reject(error);
  },
);

export function readableError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message || error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
