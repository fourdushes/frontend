import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { ApiResult, TokenPair } from '../types/api';
import {
  expireApiSession,
  getApiAccessToken,
  getApiRefreshToken,
  updateApiTokens,
} from './tokenStore';

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8081';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let refreshPromise: Promise<TokenPair> | null = null;

apiClient.interceptors.request.use((config) => {
  const token = getApiAccessToken();
  config.headers['X-Client-Request-ID'] =
    `front-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (unknownError: unknown) => {
    const error = unknownError as AxiosError<ApiResult<unknown>>;
    const config = error.config as RetryConfig | undefined;
    const refreshToken = getApiRefreshToken();

    if (error.response?.status !== 401 || !config || config._retry || !refreshToken) {
      return Promise.reject(error);
    }

    config._retry = true;
    refreshPromise ??= refreshClient
      .post<ApiResult<TokenPair>>('/api/users/token/reissue', { refreshToken })
      .then((response) => {
        if (!response.data.data || !response.data.status.startsWith('2')) {
          throw new Error(response.data.message || '세션을 갱신하지 못했습니다.');
        }
        updateApiTokens(response.data.data);
        return response.data.data;
      })
      .finally(() => {
        refreshPromise = null;
      });

    try {
      const next = await refreshPromise;
      config.headers.Authorization = `Bearer ${next.accessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      expireApiSession();
      return Promise.reject(refreshError);
    }
  },
);

export function readableError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const result = error.response?.data as ApiResult<unknown> | undefined;
    if (result?.message) return result.message;
    if (!error.response) return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    return error.message || '요청을 처리하지 못했습니다.';
  }
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}
