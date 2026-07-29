import {
  AiResponse,
  ApiResult,
  ArchiveDetail,
  ArchiveList,
  CareListResponse,
  ChangeCareStateResponse,
  ChatMessage,
  ChatRoom,
  ConnectedGuardiansResponse,
  ConnectedWardsResponse,
  Inquiry,
  InquiryList,
  Institution,
  InstitutionSearchPage,
  LoginResponse,
  MedicalRequest,
  MyPage,
  PasswordChangePreparation,
  StartTreatment,
  UserType,
  WardSearchResponse,
} from '../types/api';
import { apiClient } from './client';

async function unwrap<T>(promise: Promise<{ data: ApiResult<T> }>) {
  const response = await promise;
  if (!response.data.status?.startsWith('2')) {
    throw new Error(response.data.message || '요청을 처리하지 못했습니다.');
  }
  return response.data.data;
}

export const teamApi = {
  login: (id: string, password: string) =>
    unwrap<LoginResponse>(apiClient.post('/api/users/login', { id, password })),

  join: (
    input: { id: string; name: string; email: string; password: string; userType: UserType },
    institutionId?: number,
  ) =>
    unwrap<string>(
      apiClient.post('/api/users/join', input, {
        params: institutionId ? { institutionId } : undefined,
      }),
    ),

  searchInstitutionsForSignup: async (keyword: string) => {
    const response = await apiClient.get<InstitutionSearchPage>('/api/institutions/search', {
      params: { keyword, page: 0, size: 8 },
    });
    return response.data;
  },

  sendEmailCode: (email: string) =>
    unwrap<null>(apiClient.post('/api/mail/send', { email })),

  checkEmailCode: (email: string, checkNumber: string) =>
    unwrap<null>(apiClient.post('/api/mail/check', { email, checkNumber })),

  findId: (name: string, email: string) =>
    unwrap<string>(apiClient.post('/api/users/find-id', { name, email })),

  preparePasswordChange: (name: string, email: string) =>
    unwrap<PasswordChangePreparation>(
      apiClient.post('/api/users/to-change-password', { name, email }),
    ),

  changePassword: (input: {
    id: string;
    newPassword: string;
    checkNewPassword: string;
    userType: UserType;
    tempToken: string;
  }) => unwrap<string>(apiClient.post('/api/users/change-password', input)),

  searchWard: (wardUserId: string, page = 0) =>
    unwrap<WardSearchResponse>(
      apiClient.get('/api/care/user/search-ward-user', {
        params: { wardUserId, page, size: 10 },
      }),
    ),

  requestCare: (wardUserId: string) =>
    unwrap<{ careId: number }>(apiClient.post('/api/care/user/save-care', { wardUserId })),

  getWardCareList: () =>
    unwrap<CareListResponse>(apiClient.get('/api/care/user/ward/check-care-list')),

  getGuardianCareList: () =>
    unwrap<CareListResponse>(apiClient.get('/api/care/user/guard/check-care-list')),

  approveCare: (careId: number) =>
    unwrap<ChangeCareStateResponse>(
      apiClient.post('/api/care/user/change-care-approve', { careId }),
    ),

  rejectCare: (careId: number) =>
    unwrap<ChangeCareStateResponse>(
      apiClient.post('/api/care/user/change-care-reject', { careId }),
    ),

  getConnectedGuardians: () =>
    unwrap<ConnectedGuardiansResponse>(apiClient.get('/api/care/user/wards')),

  getConnectedWards: () =>
    unwrap<ConnectedWardsResponse>(apiClient.get('/api/care/user/Guards')),

  setMainGuardian: (changeGuardUserId: string) =>
    unwrap<{ deleteMainCare: number | null; changeMainCare: number }>(
      apiClient.post('/api/care/check-main-guard', { changeGuardUserId }),
    ),

  deleteCareRelation: (deleteCareId: number) =>
    unwrap<null>(apiClient.post('/api/care/delete-care', { deleteCareId })),

  searchInstitutions: (keyword: string) =>
    unwrap<Institution[]>(
      apiClient.get('/api/medical-treatment/ward/institutions', { params: { keyword } }),
    ),

  createMedicalRequest: (institutionUserId: string) =>
    unwrap<MedicalRequest>(
      apiClient.post('/api/medical-treatment/ward/requests', { institutionUserId }),
    ),

  getWardRequests: () =>
    unwrap<MedicalRequest[]>(apiClient.get('/api/medical-treatment/ward/requests')),

  getInstitutionRequests: () =>
    unwrap<MedicalRequest[]>(apiClient.get('/api/medical-treatment/institution/requests')),

  getWardRequest: (requestId: number) =>
    unwrap<MedicalRequest>(
      apiClient.get(`/api/medical-treatment/ward/requests/${requestId}`),
    ),

  getInstitutionRequest: (requestId: number) =>
    unwrap<MedicalRequest>(
      apiClient.get(`/api/medical-treatment/institution/requests/${requestId}`),
    ),

  acceptRequest: (requestId: number) =>
    unwrap<MedicalRequest>(
      apiClient.post(`/api/medical-treatment/institution/requests/${requestId}/accept`),
    ),

  rejectRequest: (requestId: number) =>
    unwrap<MedicalRequest>(
      apiClient.post(`/api/medical-treatment/institution/requests/${requestId}/reject`),
    ),

  startTreatment: (requestId: number) =>
    unwrap<StartTreatment>(
      apiClient.post(`/api/medical-treatment/ward/requests/${requestId}/start`),
    ),

  getChatRoom: (chatRoomId: number) =>
    unwrap<ChatRoom>(
      apiClient.get(`/api/medical-treatment/ward/chat-rooms/${chatRoomId}`),
    ),

  getWardMessages: (chatRoomId: number) =>
    unwrap<ChatMessage[]>(
      apiClient.get(`/api/medical-treatment/ward/chat-rooms/${chatRoomId}/messages`),
    ),

  getInstitutionMessages: (chatRoomId: number) =>
    unwrap<ChatMessage[]>(
      apiClient.get(`/api/medical-treatment/institution/chat-rooms/${chatRoomId}/messages`),
    ),

  sendWardMessage: (chatRoomId: number, content: string) =>
    unwrap<ChatMessage>(
      apiClient.post(`/api/medical-treatment/ward/chat-rooms/${chatRoomId}/messages`, {
        content,
      }),
    ),

  completeTreatment: (chatRoomId: number) =>
    unwrap<AiResponse>(
      apiClient.post(`/api/medical-treatment/ward/chat-rooms/${chatRoomId}/complete`),
    ),

  uploadRecording: (chatRoomId: number, formData: FormData) =>
    unwrap<ChatMessage>(
      apiClient.post(
        `/api/medical-treatment/institution/chat-rooms/${chatRoomId}/recordings/complete`,
        formData,
        { timeout: 60000 },
      ),
    ),

  getArchives: (page = 0) =>
    unwrap<ArchiveList>(
      apiClient.get('/api/medical-treatment/ward/archives/list/for-ward', {
        params: { page, size: 10, sort: 'id,desc' },
      }),
    ),

  getGuardianArchives: (wardUserId: string, page = 0) =>
    unwrap<ArchiveList>(
      apiClient.get(`/api/medical-treatment/ward/archives/${wardUserId}/list/for-guard`, {
        params: { page, size: 10, sort: 'id,desc' },
      }),
    ),

  getArchive: (archiveId: number) =>
    unwrap<ArchiveDetail>(
      apiClient.get(`/api/medical-treatment/ward/archives/${archiveId}`),
    ),

  getMyPage: (userType: UserType) =>
    unwrap<MyPage>(
      apiClient.get(
        userType === 'WARD'
          ? '/api/mypage/ward-user'
          : userType === 'GUARDIAN'
            ? '/api/mypage/guard-user'
            : '/api/mypage/institutions-user',
      ),
    ),

  changeName: (newName: string) =>
    unwrap<{ newName: string }>(apiClient.patch('/api/mypage/change-name', { newName })),

  getInquiries: (page = 0) =>
    unwrap<InquiryList>(apiClient.get('/api/inquiries', { params: { page, size: 10 } })),

  getInquiry: (inquiryId: number) =>
    unwrap<Inquiry>(apiClient.get(`/api/inquiries/${inquiryId}`)),

  createInquiry: (title: string, content: string) =>
    unwrap<Inquiry>(apiClient.post('/api/inquiries', { title, content })),
};
