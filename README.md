# HearO Frontend

HearO의 Web·iOS·Android 클라이언트입니다. Expo 52와 React Native로 구현했으며, 현재 코드는 베타 테스트용 버전입니다.

피보호자, 보호자, 기관 소속 사용자와 기관 관리자가 하나의 앱에서 보호 관계와 기관 소속 관계를 관리하고 대면 진료 요청부터 대화 기록, 음성 전송, AI 진료 요약과 문의까지 이용할 수 있습니다.

## 주요 기능

| 사용자 | 제공 기능 |
|---|---|
| 공통 | 메인 안내, 로그인, 이메일 인증 회원가입, 아이디 찾기, 비밀번호 변경, 내 정보·이름 변경, 문의 등록·조회 |
| 피보호자 | 의료기관 검색, 진료 요청·시작, 텍스트 대화, 진료 종료, AI 요약 아카이브 조회, 보호자 연결 승인·거절 |
| 보호자 | 피보호자 검색·연결 신청, 연결 관리, 승인된 피보호자의 진료 아카이브 조회 |
| 기관 소속 사용자 | 도착한 진료 요청 수락·거절, 진료 대화 조회, 음성 녹음 및 STT 메시지 전송 |
| 기관 관리자 | 기관 전용 로그인, 소속 사용자 상태별 조회, 가입 요청 승인·거절, 승인 사용자 연결 해제 |

일반 사용자 JWT 세션은 `AsyncStorage`에 보관하고, API 요청에 Access Token을 자동 첨부합니다. HTTP 401 응답 시 Refresh Token으로 토큰을 한 번 갱신한 뒤 원래 요청을 재시도합니다. 기관 관리자 세션은 일반 사용자 세션과 별도의 저장소 키로 관리합니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Framework | Expo 52, React Native 0.76 |
| UI | React 18, React Native Web |
| Navigation | React Navigation Native Stack |
| API | Axios |
| Local storage | AsyncStorage |
| Audio | Expo Audio |
| Language | TypeScript |

## 디렉터리

```text
.
├── App.tsx
├── app.json
├── assets/                 # 앱 이미지
├── public/                 # Web 정적 파일
├── scripts/                # Web 빌드 미리보기 서버
├── src/
│   ├── api/                # API 클라이언트, 토큰, 엔드포인트
│   ├── components/         # 공통 UI
│   ├── context/            # 로그인 세션
│   ├── screens/            # 역할별 화면
│   ├── storage/            # 로컬 진료방 연결 정보
│   ├── theme/              # 색상·타이포그래피
│   ├── types/              # API 응답 타입
│   └── navigation.tsx
├── package.json
└── tsconfig.json
```

## 실행 준비

- Node.js 18 이상
- npm
- 실행 중인 HearO Backend
- 모바일 실행 시 Expo Go 또는 iOS·Android 개발 환경

의존성을 설치합니다.

```bash
npm ci
```

프로젝트 루트에 `.env`를 만들고 백엔드 주소를 지정합니다.

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://localhost:8081
```

환경변수가 없으면 `http://localhost:8081`을 기본값으로 사용합니다. 실제 모바일 기기에서는 `localhost` 대신 백엔드가 실행 중인 컴퓨터의 LAN IP를 사용해야 합니다.

`EXPO_PUBLIC_` 환경변수는 앱 번들에 포함되므로 API 주소처럼 공개 가능한 값만 사용하고 비밀번호, 토큰, API 키는 저장하지 않습니다.

## 실행 명령

| 명령 | 설명 |
|---|---|
| `npm start` | Expo 개발 서버 실행 |
| `npm run web` | Web 개발 서버 실행 |
| `npm run ios` | iOS 실행 |
| `npm run android` | Android 실행 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run build` | Web 정적 빌드를 `dist/`에 생성 |
| `npm run preview` | 생성된 Web 빌드 미리보기 |

```bash
npm run web
```

## 베타 빌드 확인

```bash
npm run typecheck
npm run build
npm run preview
```

미리보기 서버는 기본적으로 `8082` 포트를 사용합니다. 다른 포트가 필요하면 다음과 같이 실행합니다.

```bash
PORT=3000 npm run preview
```

## 백엔드 연동

프런트엔드는 백엔드의 공통 `Result<T>` 응답과 사용자 유형 `WARD`, `GUARDIAN`, `INSTITUTIONS`를 기준으로 동작합니다.

- 인증 만료 시 `/api/users/token/reissue`로 세션을 갱신합니다.
- 로그인 화면에서 일반 사용자 계정과 기관 관리자 계정을 구분합니다.
- 기관 관리자는 `/api/institutions/login`으로 로그인하고 `/institution-admin` 화면으로 이동합니다.
- 기관 관리자 화면은 승인 대기·승인·거절 사용자를 페이지 단위로 조회하고 승인·거절·연결 해제를 처리합니다.
- 진료 종료 응답과 아카이브 상세에서 주요 증상, 의사 소견, 기억할 내용, 질문 답변, 어려운 용어를 표시합니다.
- 의료기관 음성 파일 전송은 `multipart/form-data`를 사용하며 최대 60초 동안 응답을 기다립니다.
- 문의 화면은 제목과 내용 등록, 본인 목록·상세 및 답변 상태 조회를 지원합니다.

## 베타 테스트 참고

- 회원가입 화면은 화면 폭에 따라 역할 선택, 이메일 인증, 계정 입력 단계를 반응형으로 배치합니다.
- 기관 자체 회원가입과 기관 계정 복구 API 연결은 현재 프런트엔드에 적용되지 않았습니다.
- 삭제 상태 사용자 목록은 백엔드 조회 API가 없어 기관 관리자 화면에서 제공하지 않습니다.
- 보호자는 진료 대화에 직접 참여하지 않고 승인된 피보호자의 완료 아카이브를 조회합니다.
- 기관 소속 사용자 계정의 아카이브 목록은 현재 제공하지 않습니다.
- 진료 요청과 대화방 연결 정보 일부는 로컬 저장소를 함께 사용합니다.
- `.env`, `node_modules/`, `.expo/`, `dist/`는 저장소에 포함하지 않습니다.
