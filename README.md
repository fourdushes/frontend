# hearO Frontend

환자, 보호자, 의료기관을 연결하고 진료 대화를 기록하는 hearO의 프론트엔드입니다.  
Expo와 React Native로 구성되어 Web, iOS, Android 실행을 지원합니다.

## 서비스 구조

```text
사용자
├── 환자
│   ├── 의료기관 검색
│   ├── 진료 요청 및 상태 확인
│   ├── 텍스트 진료 대화
│   ├── 진료 종료
│   └── 진료 기록 조회
├── 보호자
│   ├── 환자 검색
│   ├── 보호자 연결 신청
│   └── 연결 상태 확인
└── 의료기관
    ├── 진료 요청 수락 및 거절
    ├── 진료 대화방 입장
    └── 음성 답변 및 STT 전송

Frontend
├── 화면 및 역할별 Navigation
├── JWT 세션 관리
├── hearO Backend API 연동
└── API 오류 및 응답시간 진단

Backend
├── 사용자 및 인증
├── 보호자 연결
├── 진료 요청과 채팅
├── 음성 파일 처리 및 CLOVA STT
└── 진료 Archive
```

## 디렉터리

```text
src/
├── api/          # API 클라이언트, 토큰, 진단 로그
├── components/   # 공통 UI와 비동기 작업 처리
├── context/      # 로그인 세션
├── screens/      # 역할별 서비스 화면
├── theme/        # 색상과 간격
├── types/        # API 타입
└── navigation.tsx
```

## 실행

```bash
npm install
cp .env.example .env
npm run web
```

`.env`에서 hearO Backend 주소를 지정합니다.

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
```

모바일 기기에서 실행할 때는 `localhost` 대신 Backend가 실행 중인 컴퓨터의 LAN IP를 사용합니다.

## 확인

```bash
npm run typecheck
```

토큰, 대화 내용, 음성 원본은 API 진단 로그에 저장하지 않습니다.
