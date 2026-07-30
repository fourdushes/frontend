import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { API_BASE_URL } from './client';

const STORAGE_KEY = 'hearo.institution.session';

export type InstitutionSession = {
  accessToken: string;
  refreshToken: string;
  institutionId: number;
};

export type InstitutionUserState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETE';

export type InstitutionUser = {
  userId: string;
  username: string;
  userEmail: string;
  state: InstitutionUserState;
  institutionName: string;
};

export type InstitutionUserPage = {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  judgeUserList: InstitutionUser[];
};

type ApiResult<T> = {
  status: string;
  message: string;
  data: T;
};

type InstitutionAction = 'APPROVE' | 'REJECT' | 'DELETE';

const listEndpoints: Partial<Record<InstitutionUserState, string>> = {
  PENDING: '/api/institutions/search-pending-user',
  APPROVED: '/api/institutions/search-approved-user',
  REJECTED: '/api/institutions/search-reject-user',
};

const actionEndpoints: Record<InstitutionAction, string> = {
  APPROVE: '/api/institutions/user/approved',
  REJECT: '/api/institutions/user/reject',
  DELETE: '/api/institutions/user/delete',
};

const institutionClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

let currentSession: InstitutionSession | null = null;

async function unwrap<T>(promise: Promise<{ data: ApiResult<T> }>) {
  const response = await promise;
  if (!response.data.status?.startsWith('2')) {
    throw new Error(response.data.message || '요청을 처리하지 못했습니다.');
  }
  return response.data.data;
}

function authorization(session: InstitutionSession) {
  return { Authorization: `Bearer ${session.accessToken}` };
}

export const institutionApi = {
  async login(loginId: string, password: string) {
    const session = await unwrap<InstitutionSession>(
      institutionClient.post('/api/institutions/login', { loginId, password }),
    );
    currentSession = session;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  },

  async getSession() {
    if (currentSession) return currentSession;
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      currentSession = JSON.parse(stored) as InstitutionSession;
      return currentSession;
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
  },

  async logout() {
    currentSession = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  async list(state: InstitutionUserState, page = 0, size = 10) {
    const session = await this.getSession();
    if (!session) throw new Error('기관 로그인이 필요합니다.');
    const endpoint = listEndpoints[state];
    if (!endpoint) throw new Error('삭제 사용자 목록 조회 API가 제공되지 않습니다.');
    return unwrap<InstitutionUserPage>(
      institutionClient.post(endpoint, {}, {
        params: { page, size },
        headers: authorization(session),
      }),
    );
  },

  async changeState(action: InstitutionAction, institutionsUserId: string) {
    const session = await this.getSession();
    if (!session) throw new Error('기관 로그인이 필요합니다.');
    return unwrap<unknown>(
      institutionClient.post(
        actionEndpoints[action],
        { institutionsUserId },
        { headers: authorization(session) },
      ),
    );
  },
};
