# Supabase

기존 운영 프로젝트 `AI_Career_Lab`을 사용합니다.

- 프로젝트 URL: `https://pyiltnkahsdscuotlenw.supabase.co`
- 프로젝트 참조 ID: `pyiltnkahsdscuotlenw`
- 신규 앱 테이블: `public` 스키마, 대문자 `AD_` 프리픽스 필수
- SQL 식별자 예시: `public."AD_profiles"`, `public."AD_teams"`
- Supabase 클라이언트 테이블명 예시: `AD_profiles`, `AD_teams`

`migrations/`는 스키마·RLS, `functions/`는 권한이 필요한 서버 작업을 위한 위치입니다. 현재 DB 및 Edge Function 구현은 없습니다. 예정 테이블 목록은 루트 개발 명세서 8.1절에 있습니다.

## 공유 프로젝트 변경 원칙

기존 테이블·데이터·RLS·함수를 유지하며 새 앱 전용 객체 이름에도 `AD_`를 사용합니다. Supabase 관리 테이블인 `auth.users`와 `storage.objects`는 예외입니다. 공유 Auth 사용자와 앱의 역할·참가 정보를 구분하고 이 앱 가입 여부를 별도로 검증합니다.

마이그레이션 전에 기존 객체 이름과 Auth 트리거·Storage 정책 충돌을 확인합니다. 원격 DB reset이나 기존 스키마 전체 교체는 하지 않습니다. 권한·계정 정책 확정 후 이 앱의 변경만 추가합니다. 관리자용 키는 브라우저에 포함하지 않습니다.
