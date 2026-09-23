# INHA AI Data Analysis LAB

AI·공공데이터 기반 경진대회 운영 시스템의 기본 코드 골격입니다.

## 실행

Node.js 22.12 이상(권장 24)에서 `npm ci` 후 `npm run dev`를 실행합니다.
기본 주소는 개발 서버에 표시되는 `/AI_data_analysis_lab/` 경로입니다.
`npm run lint`, `npm run typecheck`, `npm run build`로 검증합니다.

Supabase 연결 준비 시 `.env.example`을 `.env.local`로 복사하고 프로젝트 URL과 공개 anon key를 입력합니다. 환경변수 없이도 공개 화면은 실행됩니다. 서버 관리자 키는 넣지 않습니다.

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

React·TypeScript·Vite, Tailwind, shadcn/ui용 별칭 설정, 공개 소개 화면, 로그인 안내 화면, Supabase 클라이언트 준비, GitHub CI를 포함합니다. 실제 인증, 보호 라우트, DB, RLS, CRUD, 평가, PWA 설치·오프라인 기능, 자동 배포는 아직 구현하지 않았습니다.

GitHub Pages 경로는 `/AI_data_analysis_lab/`입니다. 초기 골격은 새로고침을 지원하기 위해 해시 라우팅(`#`)을 사용하며, 명세서의 일반 경로 복원 방식은 후속 구현 대상입니다.

상세 요구사항: [개발 명세서](INHA_AI_data_analysis_lab.md)

설정 참고: [Vite 공식 문서](https://vite.dev/guide/), [Tailwind Vite 설치](https://tailwindcss.com/docs/installation/using-vite).
