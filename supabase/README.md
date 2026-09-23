# Supabase

기존 운영 프로젝트 `AI_Career_Lab`을 사용합니다.

- 프로젝트 URL: `https://pyiltnkahsdscuotlenw.supabase.co`
- 프로젝트 참조 ID: `pyiltnkahsdscuotlenw`
- 신규 앱 테이블: `public` 스키마, 대문자 `AD_` 프리픽스 필수
- SQL 식별자 예시: `public."AD_profiles"`, `public."AD_teams"`
- Supabase 클라이언트 테이블명 예시: `AD_profiles`, `AD_teams`

`migrations/`는 스키마·RLS, `functions/`는 권한이 필요한 서버 작업을 위한 위치입니다. `AD_profiles` 테이블과 본인 조회 RLS를 적용했습니다. Edge Function과 나머지 업무 테이블은 아직 구현하지 않았습니다. 예정 테이블 목록은 루트 개발 명세서 8.1절에 있습니다.

## 공유 프로젝트 변경 원칙

기존 테이블·데이터·RLS·함수를 유지하며 새 앱 전용 객체 이름에도 `AD_`를 사용합니다. Supabase 관리 테이블인 `auth.users`와 `storage.objects`는 예외입니다. 공유 Auth 사용자와 앱의 역할·참가 정보를 구분하고 이 앱 가입 여부를 별도로 검증합니다.

마이그레이션 전에 기존 객체 이름과 Auth 트리거·Storage 정책 충돌을 확인합니다. 원격 DB reset이나 기존 스키마 전체 교체는 하지 않습니다. 추가 권한·계정 정책 확정 후 이 앱의 변경만 추가합니다. 관리자용 키는 브라우저에 포함하지 않습니다.

## 최초 적용 기록

2026-09-24에 `migrations/20260924000100_ad_profiles.sql`을 대상 프로젝트에서 트랜잭션으로 적용하고, 기존 Auth 계정에 초기 교수 역할과 연락처를 연결했습니다. Auth 계정·비밀번호·기존 서비스 테이블은 변경하지 않았습니다. 개인별 초기 데이터는 마이그레이션에 포함하지 않습니다.

공유 프로젝트의 기존 마이그레이션 이력을 덮어쓰지 않기 위해 이번 SQL은 명시적으로 실행했으며 CLI migration history에는 등록하지 않았습니다. 이 파일을 원격에 재실행하거나 `db push`하지 마세요. 후속 배포 전 공유 프로젝트의 마이그레이션 관리 방식과 적용 이력을 먼저 조정해야 합니다.

테이블 이름이 이미 있으면 최초 생성 SQL은 실패하도록 되어 있습니다. RLS 검증 파일은 `tests/ad_profiles_access.sql`이며 권한 있는 DB 연결에서 실행합니다. 익명 조회와 인증 사용자의 삽입·수정·삭제는 허용하지 않습니다. 현재 인증 사용자는 본인의 활성 프로필만 조회합니다.
