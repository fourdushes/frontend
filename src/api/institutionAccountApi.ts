import axios from 'axios';

import { API_BASE_URL } from './client';

type ApiResult<T> = {
  status: string;
  message: string;
  data: T;
};

export type InstitutionPasswordPreparation = {
  institutionId: number;
  tempToken: string;
};

export type InstitutionJoinInput = {
  institutionName: string;
  email: string;
  institutionId: string;
  password: string;
  checkPassword: string;
};

const institutionAccountClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

async function unwrap<T>(promise: Promise<{ data: ApiResult<T> }>) {
  const response = await promise;
  if (!response.data.status?.startsWith('2')) {
    throw new Error(response.data.message || '요청을 처리하지 못했습니다.');
  }
  return response.data.data;
}

export const institutionAccountApi = {
  sendVerificationCode: (email: string) =>
    unwrap<null>(institutionAccountClient.post('/api/mail/send', { email })),

  verifyVerificationCode: (email: string, checkNumber: string) =>
    unwrap<null>(institutionAccountClient.post('/api/mail/check', { email, checkNumber })),

  findLoginId: (institutionName: string, email: string) =>
    unwrap<string>(
      institutionAccountClient.post('/api/institutions/id-find', { institutionName, email }),
    ),

  preparePasswordChange: (institutionName: string, email: string) =>
    unwrap<InstitutionPasswordPreparation>(
      institutionAccountClient.post('/api/institutions/to-change-password', {
        institutionName,
        email,
      }),
    ),

  changePassword: (input: {
    institutionId: number;
    newPassword: string;
    checkNewPassword: string;
    tempToken: string;
  }) =>
    unwrap<number>(institutionAccountClient.post('/api/institutions/change-password', input)),

  join: (input: InstitutionJoinInput) =>
    unwrap<{ id: number }>(
      institutionAccountClient.post('/api/institutions/join', input),
    ),
};
