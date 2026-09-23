# INHA AI Data Analysis LAB

AI·공공데이터 기반 경진대회 운영 시스템의 기본 코드 골격입니다.

## 실행

Node.js 22.12 이상(권장 24)에서 `npm ci` 후 `npm run dev`를 실행합니다.
기본 주소는 개발 서버에 표시되는 `/AI_data_analysis_lab/` 경로입니다.
`npm run lint`, `npm run typecheck`, `npm run build`로 검증합니다.

Supabase 연결 준비 시 `.env.example`을 `.env.local`로 복사하고 설정된 `AI_Career_Lab` 프로젝트 URL을 확인하고 해당 프로젝트의 공개 anon key를 입력합니다. 환경변수 없이도 공개 화면은 실행됩니다. 서버 관리자 키는 넣지 않습니다.

## 구조

- `src/app/`: 앱 라우팅
- `src/components/`: 공통 레이아웃과 UI
- `src/features/`: 인증·기수·팀·보고서 등 기능별 구현 위치
- `src/pages/`: 공개 홈과 오류 화면
- `src/lib/`: Supabase 클라이언트와 공통 유틸리티
- `src/types/`: 도메인 타입
- `src/styles/`: Tailwind와 전역 스타일
- `supabase/migrations/`: 추후 DB 및 RLS 마이그레이션
- `supabase/functions/`: 추후 관리자 서버 함수
- `.github/workflows/ci.yml`: lint와 빌드 검증

## 현재 범위

React·TypeScript·Vite, Tailwind, shadcn/ui용 별칭 설정, 공개 소개 화면, 로그인 안내 화면, Supabase 클라이언트 준비, GitHub CI를 포함합니다. 이메일·비밀번호 인증, 세션 복원·로그아웃, `AD_profiles` 기반 앱 권한 조회를 구현했습니다. 업무용 보호 라우트, CRUD, 평가, PWA 설치·오프라인 기능, 자동 배포는 후속 구현 대상입니다.

GitHub Pages 경로는 `/AI_data_analysis_lab/`입니다. 초기 골격은 새로고침을 지원하기 위해 해시 라우팅(`#`)을 사용하며, 명세서의 일반 경로 복원 방식은 후속 구현 대상입니다.

상세 요구사항: [개발 명세서](INHA_AI_data_analysis_lab.md)

설정 참고: [Vite 공식 문서](https://vite.dev/guide/), [Tailwind Vite 설치](https://tailwindcss.com/docs/installation/using-vite).

## 공유 Supabase 프로젝트

- 프로젝트: `AI_Career_Lab`
- URL: `https://pyiltnkahsdscuotlenw.supabase.co`
- 새 테이블은 반드시 대문자 `AD_` 프리픽스를 사용합니다(예: `AD_profiles`, `AD_teams`).
- SQL에서는 `public."AD_teams"`처럼 큰따옴표로 대소문자를 보존합니다.
- 기존 서비스 테이블과 정책은 유지하고, 이 앱의 역할·참여 정보는 별도 관리합니다.
- 공개 키 연결 검증과 `AD_profiles` 테이블·RLS 생성을 완료했습니다. 지정된 기존 Auth 계정에 교수 역할을 연결했습니다. 다른 업무 테이블은 후속 구현 대상입니다.

## 로그인 및 DB 검증

테스트 로그인 주소는 `http://127.0.0.1:5173/AI_data_analysis_lab/#/login`입니다. 기존 Supabase 계정의 비밀번호를 사용합니다. 기존 서비스 계정이 있어도 활성 `AD_profiles` 등록이 없으면 이 앱의 참여 권한이 부여되지 않습니다. 현재 로그인 후에는 계정 연결 상태를 보여주며 업무 화면은 준비 중입니다.

- `npm run check:db`: Auth 서버 응답과 앱 테이블의 익명 접근 차단 확인
- `supabase/tests/ad_profiles_access.sql`: RLS 및 클라이언트 쓰기 권한 검증, 데이터 변경 없이 롤백
- 세션 저장 키는 `AD_auth_session`으로 다른 앱과 구분합니다.
- 초기 교수의 개인정보와 계정 연결용 SQL은 Git 제외 경로에서만 처리하며 공개 저장소에 포함하지 않습니다.
- 실제 비밀번호 입력을 통한 로그인은 사용자 확인이 필요합니다. 비밀번호 변경·초대 링크 처리는 아직 구현하지 않았습니다.
