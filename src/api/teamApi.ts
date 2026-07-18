import {
  ApiResult,
  ArchiveDetail,
  ArchiveList,
  CareListResponse,
  ChangeCareStateResponse,
  ChatMessage,
  Institution,
  LoginResponse,
  MedicalRequest,
  SaveCareResponse,
  StartTreatment,
  UserType,
  WardSearchResponse,
} from '../types/api';
import { apiClient } from './client';

async function data<T>(promise: Promise<{ data: ApiResult<T> }>) {
  const response = await promise;
  return response.data.data;
}

async function checkedData<T>(promise: Promise<{ data: ApiResult<T> }>) {
  const response = await promise;
  if (response.data.status !== '200') {
    throw new Error(response.data.message || '요청을 처리하지 못했습니다.');
  }
  return response.data.data;
}

export const teamApi = {
  health: async () => {
    const response = await apiClient.get('/api/health');
    return response.data;
  },

  login: (id: string, password: string) =>
    data<LoginResponse>(apiClient.post('/api/users/login', { id, password })),

  join: (input: {
    id: string;
    name: string;
    email: string;
    password: string;
    userType: UserType;
  }) => data<string>(apiClient.post('/api/users/join', input)),

  sendEmailCode: (email: string) =>
    checkedData<null>(apiClient.post('/api/mail/send', { email })),

  checkEmailCode: (email: string, checkNumber: string) =>
    checkedData<null>(
      apiClient.post('/api/mail/check', {
        email,
        checkNumber,
      }),
    ),

  searchWard: (wardUserId: string, page = 0) =>
    data<WardSearchResponse>(
      apiClient.get('/api/care/user/search-ward-user', {
        params: { wardUserId, page, size: 10 },
      }),
    ),

  requestCare: (wardUserId: string) =>
    data<SaveCareResponse>(apiClient.post('/api/care/user/save-care', { wardUserId })),

  getWardCareList: () =>
    data<CareListResponse>(apiClient.get('/api/care/user/ward/check-care-list')),

  getGuardianCareList: () =>
    data<CareListResponse>(apiClient.get('/api/care/user/guard/check-care-list')),

  approveCare: (careId: number) =>
    data<ChangeCareStateResponse>(
      apiClient.post('/api/care/user/change-care-approve', { careId }),
    ),

  rejectCare: (careId: number) =>
    data<ChangeCareStateResponse>(
      apiClient.post('/api/care/user/change-care-reject', { careId }),
    ),

  searchInstitutions: (keyword: string) =>
    data<Institution[]>(
      apiClient.get('/api/medical-treatment/ward/institutions', {
        params: keyword ? { keyword } : undefined,
      }),
    ),

  createMedicalRequest: (institutionUserId: string) =>
    data<MedicalRequest>(
      apiClient.post('/api/medical-treatment/ward/requests', { institutionUserId }),
    ),

  getWardRequests: () =>
    data<MedicalRequest[]>(apiClient.get('/api/medical-treatment/ward/requests')),

  getInstitutionRequests: () =>
    data<MedicalRequest[]>(apiClient.get('/api/medical-treatment/institution/requests')),

  acceptRequest: (requestId: number) =>
    data<MedicalRequest>(
      apiClient.post(`/api/medical-treatment/institution/requests/${requestId}/accept`),
    ),

  rejectRequest: (requestId: number) =>
    data<MedicalRequest>(
      apiClient.post(`/api/medical-treatment/institution/requests/${requestId}/reject`),
    ),

  startTreatment: (requestId: number) =>
    data<StartTreatment>(
      apiClient.post(`/api/medical-treatment/ward/requests/${requestId}/start`),
    ),

  getWardMessages: (chatRoomId: number) =>
    data<ChatMessage[]>(
      apiClient.get(`/api/medical-treatment/ward/chat-rooms/${chatRoomId}/messages`),
    ),

  getInstitutionMessages: (chatRoomId: number) =>
    data<ChatMessage[]>(
      apiClient.get(`/api/medical-treatment/institution/chat-rooms/${chatRoomId}/messages`),
    ),

  sendWardMessage: (chatRoomId: number, content: string) =>
    data<ChatMessage>(
      apiClient.post(`/api/medical-treatment/ward/chat-rooms/${chatRoomId}/messages`, {
        content,
      }),
    ),

  completeTreatment: (chatRoomId: number) =>
    data<unknown>(
      apiClient.post(`/api/medical-treatment/ward/chat-rooms/${chatRoomId}/complete`),
    ),

  uploadRecording: (chatRoomId: number, formData: FormData) =>
    data<ChatMessage>(
      apiClient.post(
        `/api/medical-treatment/institution/chat-rooms/${chatRoomId}/recordings/complete`,
        formData,
      ),
    ),

  getArchives: (page = 0) =>
    data<ArchiveList>(
      apiClient.get('/api/medical-treatment/ward/archives/list', {
        params: { page, size: 10, sort: 'id,asc' },
      }),
    ),

  getArchive: (archiveId: number) =>
    data<ArchiveDetail>(
      apiClient.get(`/api/medical-treatment/ward/archives/${archiveId}`),
    ),
};
