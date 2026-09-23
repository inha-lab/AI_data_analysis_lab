# Supabase

기존 운영 프로젝트 `AI_Career_Lab`을 사용합니다.

- 프로젝트 URL: `https://pyiltnkahsdscuotlenw.supabase.co`
- 프로젝트 참조 ID: `pyiltnkahsdscuotlenw`
- 신규 앱 테이블: `public` 스키마, 대문자 `AD_` 프리픽스 필수
- SQL 식별자 예시: `public."AD_profiles"`, `public."AD_teams"`
- Supabase 클라이언트 테이블명 예시: `AD_profiles`, `AD_teams`

`migrations/`는 스키마·RLS, `functions/`는 권한이 필요한 서버 작업을 위한 위치입니다. `AD_profiles`, `AD_cohorts`, `AD_participants`와 역할·참여 기반 RLS를 적용했습니다. 계정 생성·연결과 최초 비밀번호 변경 함수를 배포했습니다. 나머지 업무 테이블은 후속 구현 대상입니다.

## 공유 프로젝트 변경 원칙

기존 테이블·데이터·RLS·함수를 유지하며 새 앱 전용 객체 이름에도 `AD_`를 사용합니다. Supabase 관리 테이블인 `auth.users`와 `storage.objects`는 예외입니다. 공유 Auth 사용자와 앱의 역할·참가 정보를 구분하고 이 앱 가입 여부를 별도로 검증합니다.

마이그레이션 전에 기존 객체 이름과 Auth 트리거·Storage 정책 충돌을 확인합니다. 원격 DB reset이나 기존 스키마 전체 교체는 하지 않습니다. 추가 권한·계정 정책 확정 후 이 앱의 변경만 추가합니다. 관리자용 키는 브라우저에 포함하지 않습니다.

## 최초 적용 기록

2026-09-24에 `migrations/20260924000100_ad_profiles.sql`을 대상 프로젝트에서 트랜잭션으로 적용하고, 기존 Auth 계정에 초기 교수 역할과 연락처를 연결했습니다. Auth 계정·비밀번호·기존 서비스 테이블은 변경하지 않았습니다. 개인별 초기 데이터는 마이그레이션에 포함하지 않습니다.

공유 프로젝트의 기존 마이그레이션 이력을 덮어쓰지 않기 위해 이번 SQL은 명시적으로 실행했으며 CLI migration history에는 등록하지 않았습니다. 이 파일을 원격에 재실행하거나 `db push`하지 마세요. 후속 배포 전 공유 프로젝트의 마이그레이션 관리 방식과 적용 이력을 먼저 조정해야 합니다.

테이블 이름이 이미 있으면 최초 생성 SQL은 실패하도록 되어 있습니다. RLS 검증 파일은 `tests/ad_profiles_access.sql`이며 권한 있는 DB 연결에서 실행합니다. 익명 조회와 인증 사용자의 삽입·수정·삭제는 허용하지 않습니다. 현재 인증 사용자는 본인의 활성 프로필만 조회합니다.

## 기수 관리 적용 기록 (2026-09-24)

`migrations/20260924000200_ad_cohorts.sql`을 명시적으로 적용했습니다. `AD_cohorts` 테이블, 대소문자 무시 이름 고유 인덱스, 수정 시각 갱신 함수·트리거, 교수 전용 RLS를 추가했습니다. 기존 서비스 객체는 변경하지 않았습니다. 이 SQL도 공유 CLI migration history에는 등록하지 않았으므로 재실행하지 않습니다.

인증 사용자의 쓰기 권한은 기수명·소개·운영 기간·상태 컬럼에만 부여했습니다. 작성자와 시각은 DB에서 설정하며 브라우저에서 변경할 수 없습니다. 종료 기수도 유지하도록 삭제 권한은 부여하지 않았습니다. `tests/ad_cohorts_access.sql`의 트랜잭션 롤백 검증을 통과했습니다.

참고: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [컬럼 접근 제어](https://supabase.com/docs/guides/database/postgres/column-level-security).

## 참가자 관리 적용 기록 (2026-09-24)

`migrations/20260924000300_ad_participants.sql`을 명시적으로 적용했습니다. `AD_participants` 테이블, 기수별 이메일·학번·프로필 고유 제약, 연락처·직무·상태 검증, 수정 시각 트리거와 교수 전용 RLS를 추가했습니다. 이 SQL도 공유 CLI migration history에는 등록하지 않았으므로 재실행하지 않습니다.

`profile_id`는 계정 연결 전까지 NULL입니다. 브라우저에서 인증 계정을 지정하거나 기존 행의 기수·작성자·수정 시각을 바꿀 수 없습니다. 참가자 비활성화는 행의 상태만 변경하며 Auth에는 영향을 주지 않습니다. 계정 생성·연결은 `ad-provision-account` 서버 함수에서만 수행합니다.

## 계정 생성·연결 적용 기록 (2026-09-24)

`migrations/20260924000400_ad_account_provisioning.sql`을 명시적으로 적용했습니다. `AD_profiles.must_change_password`, 서버 전용 `AD_find_auth_user`·`AD_link_participant_account`, 연결된 이메일 변경 방지 트리거와 학생 본인 참가·기수 조회 정책을 추가했습니다. 이 SQL도 공유 migration history에는 등록하지 않았으며 재실행하지 않습니다.

배포 함수는 `ad-provision-account`, `ad-change-password`입니다. 각 함수는 Auth `getUser`로 토큰을 검증하고 활성 앱 프로필과 권한을 확인합니다. `verify_jwt=false`는 기존 HS256 전용 게이트 대신 함수 내부 검증을 사용하기 위한 설정입니다. 무인증 접근을 허용하지 않으며 실제 배포에서 무인증·잘못된 토큰·anon 키 요청의 401 차단을 확인했습니다.

계정 조회·연결 RPC는 `service_role`만 실행합니다. 호출 교수, 참가자의 이메일·수정 버전·활성 상태, 기존 앱 역할을 트랜잭션에서 재검증합니다. 신규 Auth 계정은 서버 메타데이터 `ad_lab_created`로 구분하고 신규 학생 프로필에 최초 비밀번호 변경을 요구합니다. 기존 프로필의 상태와 역할은 덮어쓰지 않습니다.

기존 `on_auth_user_created` 트리거는 신규 Auth 사용자에 대해 기존 서비스 `public.profiles`도 생성합니다. 해당 동작을 검사했으며 기존 트리거는 수정하지 않았습니다. 테스트에서는 이 자료도 모두 롤백했습니다.

최초 비밀번호 변경은 본인의 토큰으로 Auth API를 호출한 뒤 서버가 완료 플래그를 갱신합니다. DB 갱신만 실패하면 비밀번호는 이미 변경되었다는 안내를 반환합니다. 일반 비밀번호 초기화, 임시 비밀번호 재발급, 계정 삭제는 제공하지 않습니다.

검증: 단위 테스트 18개, Deno·프론트엔드 타입 검사, 빌드, `tests/ad_account_provisioning.sql`, 배포 함수 인증 차단 검사 통과. 실제 참가자 대상 발급·비밀번호 변경은 운영자 검수가 필요합니다.
