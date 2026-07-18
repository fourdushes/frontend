export type UserType = 'WARD' | 'GUARDIAN' | 'INSTITUTIONS';

export type ApiResult<T> = {
  status: string;
  message: string;
  data: T;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  userType: UserType;
};

export type WardSearchItem = {
  wardUserId: string;
  wardUserName: string;
};

export type WardSearchResponse = {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  wardUserList: WardSearchItem[];
};

export type CareListItem = {
  wardUserId: string;
  guardUserId: string;
  careState: string;
  createdAt: string;
  updatedAt: string;
};

export type CareListResponse = {
  totalCount: number;
  careList: CareListItem[];
};

export type SaveCareResponse = {
  careId: number;
};

export type ChangeCareStateResponse = {
  careId: number;
  careState: string;
};

export type MedicalRequest = {
  medicalRequestId: number;
  wardUserId: string;
  wardUserName: string;
  institutionUserId: string;
  institutionUserName: string;
  status: string;
  createdAt: string;
  respondedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type Institution = {
  institutionUserId: string;
  name: string;
  email: string;
};

export type ChatMessage = {
  messageId: number;
  chatRoomId: number;
  senderType: string;
  senderId: string;
  senderName: string;
  messageType: string;
  content: string;
  recordId?: number | null;
  createdAt: string;
  mine: boolean;
};

export type StartTreatment = {
  chatRoomId: number;
  archiveId: number;
};

export type ArchiveListItem = {
  archiveId: number;
  archiveName?: string;
  arhciveName?: string;
  archiveDate: string;
};

export type ArchiveList = {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  list: ArchiveListItem[];
};

export type ArchiveDetail = {
  archiveId: number;
  title: string;
  archiveDate: string;
  text: string;
  allChatText: string;
};

export type DiagnosticEntry = {
  id: string;
  method: string;
  path: string;
  status?: number;
  durationMs: number;
  requestId: string;
  at: string;
  ok: boolean;
  message?: string;
};
