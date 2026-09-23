# INHA AI Data Analysis LAB

AI·공공데이터 기반 경진대회 운영 시스템의 기본 코드 골격입니다.

## 실행

Node.js 22.12 이상(권장 24)에서 `npm ci` 후 `npm run dev`를 실행합니다.
기본 주소는 개발 서버에 표시되는 `/AI_data_analysis_lab/` 경로입니다.
`npm run lint`, `npm test`, `npm run typecheck`, `npm run build`로 검증합니다.

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

React·TypeScript·Vite, Tailwind, shadcn/ui용 별칭 설정, 공개 소개 화면, Supabase 연결, GitHub CI를 포함합니다. 이메일·비밀번호 인증, 세션 복원·로그아웃, 앱 권한 조회, 보호 라우트, 교수용 대시보드, 기수 조회·생성·수정과 참가자 직접 등록·조회·수정·비활성화를 구현했습니다. 참가자 계정 생성·연결, 엑셀 업로드, 팀·프로젝트 관리, 평가, PWA 설치·오프라인 기능, 자동 배포는 후속 구현 대상입니다.

GitHub Pages 경로는 `/AI_data_analysis_lab/`입니다. 초기 골격은 새로고침을 지원하기 위해 해시 라우팅(`#`)을 사용하며, 명세서의 일반 경로 복원 방식은 후속 구현 대상입니다.

상세 요구사항: [개발 명세서](INHA_AI_data_analysis_lab.md)

설정 참고: [Vite 공식 문서](https://vite.dev/guide/), [Tailwind Vite 설치](https://tailwindcss.com/docs/installation/using-vite).

## 공유 Supabase 프로젝트

- 프로젝트: `AI_Career_Lab`
- URL: `https://pyiltnkahsdscuotlenw.supabase.co`
- 새 테이블은 반드시 대문자 `AD_` 프리픽스를 사용합니다(예: `AD_profiles`, `AD_teams`).
- SQL에서는 `public."AD_teams"`처럼 큰따옴표로 대소문자를 보존합니다.
- 기존 서비스 테이블과 정책은 유지하고, 이 앱의 역할·참여 정보는 별도 관리합니다.
- 공개 키 연결 검증과 `AD_profiles`, `AD_cohorts`, `AD_participants` 테이블·RLS 생성을 완료했습니다. 지정된 기존 Auth 계정에 교수 역할을 연결했습니다. 다른 업무 테이블은 후속 구현 대상입니다.

## 로그인 및 DB 검증

테스트 로그인 주소는 `http://127.0.0.1:5173/AI_data_analysis_lab/#/login`입니다. 기존 Supabase 계정의 비밀번호를 사용합니다. 기존 서비스 계정이 있어도 활성 `AD_profiles` 등록이 없으면 이 앱의 참여 권한이 부여되지 않습니다. 로그인 후 `/dashboard`로 이동하며 교수는 `/cohorts`에서 기수를 관리합니다.

- `npm run check:db`: Auth 서버 응답과 앱 테이블의 익명 접근 차단 확인
- `supabase/tests/ad_profiles_access.sql`: RLS 및 클라이언트 쓰기 권한 검증, 데이터 변경 없이 롤백
- 세션 저장 키는 `AD_auth_session`으로 다른 앱과 구분합니다.
- 초기 교수의 개인정보와 계정 연결용 SQL은 Git 제외 경로에서만 처리하며 공개 저장소에 포함하지 않습니다.
- 2026-09-24 사용자가 기존 교수 계정으로 정상 로그인을 확인했습니다. 비밀번호 변경·초대 링크 처리는 아직 구현하지 않았습니다.

## 기수 관리 (2026-09-24)

- 대시보드: `http://127.0.0.1:5173/AI_data_analysis_lab/#/dashboard`
- 기수 관리: `http://127.0.0.1:5173/AI_data_analysis_lab/#/cohorts`
- 기수명, 소개, 시작·종료일, 상태(준비 중·운영 중·종료)를 등록·수정합니다.
- 날짜가 미정이면 시작·종료일을 모두 비워 둘 수 있습니다. 기수명은 대소문자를 구분하지 않고 중복을 방지합니다.
- 교수만 관리할 수 있습니다. 연구원·컨설턴트의 관리 권한은 정책 확정 후 확대합니다. 학생의 기수 조회는 참가자 연결 기능과 함께 추가합니다.
- 삭제는 제공하지 않으며 종료 상태로 기록을 유지합니다. 동시 수정 충돌 시 덮어쓰지 않고 다시 조회하도록 안내합니다.
- 대시보드 통계는 실제 등록 기수만 집계하며 샘플 기수는 등록하지 않습니다.
- `supabase/tests/ad_cohorts_access.sql`은 테스트 자료와 임시 역할 변경을 같은 트랜잭션에서 롤백하여 검증합니다.

검증: lint, 입력 검증 테스트 4개, TypeScript 및 프로덕션 빌드 통과. DB에서 교수 생성·조회·수정, 다른 역할·미등록·비활성 계정 차단, 중복·기간 제약, 변경 충돌, 생성자·수정 시각 위조 및 삭제 차단을 확인했습니다. 새 화면의 브라우저 조작 검수는 별도로 필요합니다.

## 참가자 관리 (2026-09-24)

- 화면: `http://127.0.0.1:5173/AI_data_analysis_lab/#/participants`
- 먼저 기수를 등록한 뒤 참가자의 이름·이메일·학과·학번·학년·전화번호·희망 직무를 입력합니다.
- 교수만 참가자를 직접 등록·조회·수정·비활성화할 수 있습니다. 기수 선택, 검색, 상태 필터, 이름·학번·학과·이메일 정렬을 지원합니다.
- 같은 기수의 이메일·학번 중복은 차단하고 다른 기수 재참여는 허용합니다. 학번은 문자열로 저장하여 앞자리 0을 유지합니다.
- 현재는 참가 정보만 저장합니다. 인증 계정을 생성하거나 자동 연결하지 않으며, 계정이 연결되지 않은 참가자는 '계정 연결 대기'로 표시합니다.
- 비활성화는 해당 기수의 참가 정보에만 적용합니다. 공유 Auth 계정·비밀번호·기존 서비스 데이터는 변경하지 않습니다.
- 신규 계정 생성, 기존 계정 연결, 엑셀 일괄 업로드, 학생 본인 참가 정보 조회는 후속 구현 대상입니다.
- 입력 검증은 `tests/participants.test.mjs`, DB 검증은 `supabase/tests/ad_participants_access.sql`에 있습니다. DB 테스트는 임시 데이터를 모두 롤백합니다.

검증: 입력 검증 테스트 총 7개, lint·타입 검사·빌드 통과. 참가자의 생성·조회·수정·비활성화, 기수별 중복 제약, 역할별 접근 차단, 기수·연결 계정·수정 시각 변경 차단을 DB에서 확인했습니다. 실제 브라우저에서의 등록·수정 흐름은 사용자 검수가 필요합니다.
