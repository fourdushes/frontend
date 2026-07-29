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

export type TokenPair = Pick<LoginResponse, 'accessToken' | 'refreshToken'>;

export type InstitutionSearchItem = {
  institutionId: number;
  institutionName: string;
};

export type InstitutionSearchPage = {
  content: InstitutionSearchItem[];
  totalElements: number;
  totalPages: number;
  number: number;
};

export type PasswordChangePreparation = {
  id: string;
  userType: UserType;
  tempToken: string;
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

export type CareState = 'PENDING' | 'APPROVED' | 'REJECTED';

export type CareListItem = {
  careId: number;
  wardUserId: string;
  guardUserId: string;
  careState: CareState;
  createdAt: string;
  updatedAt: string;
};

export type CareListResponse = {
  totalCount: number;
  careList: CareListItem[];
};

export type ChangeCareStateResponse = {
  careId: number;
  careState: CareState;
};

export type ConnectedWard = {
  careId: number;
  wardUserId: string;
  wardUserName: string;
  userType: 'WARD';
  mainGuardUser: boolean;
};

export type ConnectedGuardian = {
  careId: number;
  guardUserId: string;
  guardUserName: string;
  userType: 'GUARDIAN';
  mainGuardUser: boolean;
};

export type ConnectedWardsResponse = {
  totalCount: number;
  wardSearchList: ConnectedWard[];
};

export type ConnectedGuardiansResponse = {
  totalCount: number;
  guardSearchList: ConnectedGuardian[];
};

export type MedicalRequestStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELED';

export type MedicalRequest = {
  medicalRequestId: number;
  wardUserId: string;
  wardUserName: string;
  institutionUserId: string;
  institutionUserName: string;
  status: MedicalRequestStatus;
  createdAt: string;
  respondedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type Institution = {
  institutionUserId: string;
  name: string;
  email: string;
};

export type ChatMessage = {
  messageId: number;
  chatRoomId: number;
  senderType: 'INSTITUTION_USER' | 'WARD_USER' | 'SYSTEM';
  senderId: string;
  senderName: string;
  messageType: 'TEXT' | 'VOICE_TRANSCRIPT' | 'SYSTEM';
  content: string;
  recordId: number | null;
  createdAt: string;
  mine: boolean;
};

export type ChatRoom = {
  chatRoomId: number;
  medicalRequestId: number;
  archiveId: number;
  institutionUser: Institution;
  wardUser: { wardUserId: string; name: string };
  status: 'IN_PROGRESS' | 'COMPLETED';
  startedAt: string;
  completedAt: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
};

export type StartTreatment = {
  chatRoomId: number;
  archiveId: number;
};

export type AiResponse = {
  wardUserId: string;
  archiveId: number;
  allChatText: string;
  mainSymptoms: string;
  doctorOpinion: string;
  remember: string;
  questionAnswer: string;
  difficultWords: string;
};

export type ArchiveListItem = {
  archiveId: number;
  archiveName: string;
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
  mainSymptoms?: string;
  doctorOpinion?: string;
  remember?: string;
  questionAnswer?: string;
  difficultWords?: string;
};

export type MyPage = {
  userId: string;
  username: string;
  email: string;
  userType: UserType;
  institytionsName?: string;
};

export type InquiryStatus = 'PENDING' | 'ANSWERED';

export type Inquiry = {
  inquiryId: number;
  userId: string;
  userName: string;
  userType: UserType;
  title: string;
  content: string;
  status: InquiryStatus;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
};

export type InquiryList = {
  totalElements: number;
  page: number;
  size: number;
  hasNext: boolean;
  inquiries: Inquiry[];
};
