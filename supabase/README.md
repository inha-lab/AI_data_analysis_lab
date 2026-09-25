# Supabase

기존 운영 프로젝트 `AI_Career_Lab`을 사용합니다.

- 프로젝트 URL: `https://pyiltnkahsdscuotlenw.supabase.co`
- 프로젝트 참조 ID: `pyiltnkahsdscuotlenw`
- 신규 앱 테이블: `public` 스키마, 대문자 `AD_` 프리픽스 필수
- SQL 식별자 예시: `public."AD_profiles"`, `public."AD_teams"`
- Supabase 클라이언트 테이블명 예시: `AD_profiles`, `AD_teams`

`migrations/`는 스키마·RLS, `functions/`는 권한이 필요한 서버 작업을 위한 위치입니다. `AD_profiles`, `AD_cohorts`, `AD_participants`, `AD_schedules`, `AD_teams`, `AD_team_members`, `AD_proposals`, `AD_reports`, `AD_comments`, `AD_deliverables`와 역할·참여 기반 접근 제어를 적용했습니다. 계정 생성·연결과 최초 비밀번호 변경 함수를 배포했습니다. 평가 테이블은 후속 구현 대상입니다.

## 공유 프로젝트 변경 원칙

기존 테이블·데이터·RLS·함수를 유지하며 새 앱 전용 객체 이름에도 `AD_`를 사용합니다. Supabase 관리 테이블인 `auth.users`와 `storage.objects`는 예외입니다. 공유 Auth 사용자와 앱의 역할·참가 정보를 구분하고 이 앱 가입 여부를 별도로 검증합니다.

마이그레이션 전에 기존 객체 이름과 Auth 트리거·Storage 정책 충돌을 확인합니다. 원격 DB reset이나 기존 스키마 전체 교체는 하지 않습니다. 추가 권한·계정 정책 확정 후 이 앱의 변경만 추가합니다. 관리자용 키는 브라우저에 포함하지 않습니다.

## 최초 적용 기록

2026-09-24에 `migrations/20260924000100_ad_profiles.sql`을 대상 프로젝트에서 트랜잭션으로 적용하고, 기존 Auth 계정에 초기 교수 역할과 연락처를 연결했습니다. Auth 계정·비밀번호·기존 서비스 테이블은 변경하지 않았습니다. 개인별 초기 데이터는 마이그레이션에 포함하지 않습니다.

공유 프로젝트의 기존 마이그레이션 이력을 덮어쓰지 않기 위해 이번 SQL은 명시적으로 실행했으며 CLI migration history에는 등록하지 않았습니다. 이 파일을 원격에 재실행하거나 `db push`하지 마세요. 후속 배포 전 공유 프로젝트의 마이그레이션 관리 방식과 적용 이력을 먼저 조정해야 합니다.

테이블 이름이 이미 있으면 최초 생성 SQL은 실패하도록 되어 있습니다. RLS 검증 파일은 `tests/ad_profiles_access.sql`이며 권한 있는 DB 연결에서 실행합니다. 익명 조회와 인증 사용자의 삽입·수정·삭제는 허용하지 않습니다. 현재 인증 사용자는 본인의 활성 프로필만 조회합니다.

## 프로그램 관리 적용 기록 (2026-09-24)

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

## 프로그램 일정 적용 기록 (2026-09-24)

`migrations/20260924000500_ad_schedules.sql`을 이름 충돌 확인 후 트랜잭션으로 적용했습니다. `AD_schedules`, 수정 시각 트리거, 교수 관리·학생 소속 조회 RLS 및 `AD_public_schedules()`를 추가했습니다. 기존 서비스 객체는 수정하지 않았습니다. 공유 CLI migration history에는 등록하지 않았으므로 재실행하거나 `db push`하지 않습니다.

교수는 활성 상태이며 최초 비밀번호 변경을 마친 경우에만 일정을 관리합니다. 학생은 활성 프로필·활성 참가 정보·완료된 비밀번호 변경 조건을 모두 충족한 자신의 프로그램 일정을 조회합니다. 프로그램·작성자·생성/수정 시각의 클라이언트 변경과 삭제는 허용하지 않으며 취소 상태로 기록을 유지합니다.

공개 RPC는 공개 지정 일정과 프로그램명만 반환하는 고정 SQL입니다. `security definer`와 빈 `search_path`, 스키마를 명시한 참조를 사용하며 익명 역할에는 이 함수 실행 권한만 부여합니다. 일정·프로그램 원본 테이블의 익명 조회 권한은 없습니다. 작성자, 프로필, 참가자 데이터는 RPC 반환 대상에서 제외합니다. 참고: [Supabase 함수 권한](https://supabase.com/docs/guides/database/functions).

`tests/ad_schedules_access.sql`의 교수 CRUD·수정 충돌·입력 제약·학생 소속·비활성/미등록/다른 역할 차단·공개 해제 검증을 통과했습니다. 모든 테스트 자료와 임시 역할 변경은 롤백했습니다. `npm run check:db`는 일정 원본 테이블의 익명 차단과 공개 RPC 응답도 검사합니다.

## 팀 관리 적용 기록 (2026-09-24)

`migrations/20260924000600_ad_teams.sql`을 이름 충돌 확인과 스키마·검증 전체 롤백 실행 후 적용했습니다. `AD_teams`, `AD_team_members`, RLS, 교수의 원자적 팀 구성 저장·빈 팀 삭제, 소속 학생의 프로젝트 정보 수정, 최소 필드 팀원 조회와 교수 전용 배정 후보 조회 함수를 추가했습니다. 기존 `AD_participants`에 프로그램 일치 검증용 `(id, cohort_id)` 고유 제약만 추가했습니다. 다른 서비스 테이블·정책·Auth는 변경하지 않았습니다.

인증 클라이언트의 팀·구성원 직접 쓰기는 차단합니다. 교수와 학생 모두 전용 RPC를 사용하며 역할·프로필·현재 소속을 서버에서 다시 확인합니다. 프로그램별 팀명 고유 인덱스, 참가자당 하나의 소속, 팀당 하나의 팀장과 프로그램 일치 FK를 적용했습니다. 구성원 저장은 프로그램 행 잠금 후 팀 정보·전체 명단·팀장을 한 트랜잭션에서 갱신하며 팀 버전으로 오래된 편집을 차단합니다. 학생은 주제·단계·링크만 수정할 수 있습니다.

`tests/ad_teams_access.sql`은 임시 Auth 계정과 기존 Auth 트리거의 생성 자료까지 롤백합니다. 원자적 저장, 중복·미연결·타 프로그램 배정, 팀장, 링크 제약, 빈 팀 삭제, 학생의 개인정보·쓰기 범위, 소속 해제·계정 상태·미등록·익명 접근과 수정 충돌을 검증합니다. 실제 운영 참가자의 배정은 변경하지 않았습니다.

이 SQL들도 공유 CLI migration history에는 등록하지 않습니다. 이미 적용된 파일을 재실행하거나 `db push`하지 않습니다. 향후 팀 제출물은 `AD_teams`에 `ON DELETE RESTRICT`로 참조하여 자료가 있는 팀의 삭제를 제한해야 합니다. 참고: [PostgreSQL 행 잠금](https://www.postgresql.org/docs/17/explicit-locking.html).

`migrations/20260924000700_ad_team_workspace.sql`도 전체 팀 검증을 포함한 롤백 사전 실행 후 적용했습니다. `AD_team_workspace()`는 하나의 STABLE SQL에서 팀 정보·수정 버전·명단·배정 후보를 같은 스냅샷으로 반환합니다. 별도 HTTP 조회 시 새 버전과 이전 명단이 섞일 수 있는 문제를 방지합니다. 학생 응답의 배정 후보는 항상 빈 배열이며 소속 팀만 반환합니다. 이 파일도 공유 migration history에 등록하지 않았으므로 재실행하지 않습니다.

## 프로젝트 기획서 적용 기록 (2026-09-25)

`migrations/20260924000800_ad_proposals.sql`을 이름 충돌 조회와 전체 롤백 검증 후 적용했습니다. `AD_proposals`는 팀당 한 건의 기획서, 프로젝트명·6개 본문·보조 링크, 임시 저장/제출/검토 완료 상태, 최종 변경·제출·최근 검토 기록을 보관합니다. 팀 FK는 `ON DELETE RESTRICT`로 기획서가 있는 팀의 삭제를 막습니다. 기존 서비스·Auth 스키마는 변경하지 않았습니다.

RLS와 전용 `AD_save_proposal`·`AD_review_proposal` 함수가 교수·현재 활성 팀원 권한을 재검사합니다. 팀원은 현재 팀 소속이며 최초 비밀번호 변경을 마친 경우에만 초안을 작성·제출합니다. 교수는 제출 내용에 검토 완료 또는 사유를 포함한 수정 요청을 남깁니다. 제출·검토 완료 중 팀원 수정은 잠그고 수정 요청으로 작성 중 상태를 다시 엽니다. 교수에게 학생 본문 직접 수정 권한은 부여하지 않았습니다. 함수에서 팀 행을 잠가 첫 초안과 상태 변경을 직렬화하고 `updated_at`으로 오래된 편집을 차단합니다.

`tests/ad_proposals_access.sql`에서 공동 작성, 제출 필수 항목, 상태·본문 위조, 검토/수정 요청/재제출, 개인정보·다른 팀 접근, 삭제 제한과 동시 수정 충돌을 검증했습니다. 검증용 Auth 사용자·기존 Auth 트리거 생성 자료는 모두 롤백했습니다. 원격 DB에는 CLI migration history 등록 없이 명시적으로 적용했으므로 이미 적용된 SQL을 재실행하거나 `db push`하지 않습니다.

## 주간·일일 보고서 적용 기록 (2026-09-25)

`migrations/20260925000100_ad_reports.sql`을 전체 롤백 검증 후 명시적으로 적용했습니다. `AD_reports`는 팀·보고 구분·회차별 한 건을 저장하고 작성일, 5개 본문 항목, 작성·제출·검토 기록과 최근 피드백을 보관합니다. 팀 FK의 `ON DELETE RESTRICT`로 보고서가 있는 팀의 삭제를 막습니다. 기존 서비스·Auth 객체는 변경하지 않았습니다.

RLS와 `AD_save_report`·`AD_review_report` 함수가 현재 활성 팀원과 교수 권한을 확인합니다. 팀원은 검토 전 제출 보고서를 수정 저장해 제출 상태를 유지하거나 재제출해 제출자·시각을 갱신할 수 있습니다. 검토 완료 후에는 교수의 수정 요청이 있어야 다시 작성합니다. 팀 행 잠금과 수정 버전으로 동시 변경을 차단합니다.

`tests/ad_reports_access.sql`에서 초안·필수 입력·공동 수정·상태 유지·재제출·검토·수정 요청, 타 팀·비활성 계정 제한, 자료 보존을 검증했습니다. 임시 Auth 사용자와 공유 트리거 생성 자료는 롤백했습니다. 공유 CLI migration history에는 등록하지 않았으므로 재실행하거나 `db push`하지 않습니다.

## 기획서·보고서 코멘트 적용 기록 (2026-09-25)

`migrations/20260925000200_ad_comments.sql`을 스키마·권한 전체 롤백 검증 후 적용했습니다. `AD_comments`는 기획서 또는 보고서 한 곳만 가리키며 팀 일치 여부를 검증합니다. 작성자·본문·작성/수정 시각을 기록하고 대상·팀 자료가 남은 동안 삭제를 제한합니다. RLS로 현재 팀원과 교수 조회를 허용하며 익명 접근을 막습니다.

`AD_save_comment`·`AD_delete_comment`는 현재 교수만 실행할 수 있습니다. 교수는 본인이 작성한 코멘트만 수정·삭제하며 수정 버전으로 오래된 요청을 차단합니다. 검토 완료·수정 요청 함수와 코멘트 기록은 분리했습니다. `tests/ad_comments_access.sql`은 대상 일치, 작성자·학생·익명 권한, 수정 충돌과 삭제를 확인하며 모든 임시 자료를 롤백합니다. 이 SQL도 공유 CLI migration history에는 등록하지 않았으므로 재실행하거나 `db push`하지 않습니다.

## 프로그램 진행 현황 적용 기록 (2026-09-25)

`migrations/20260925000300_ad_monitoring.sql`의 교수 전용 `AD_program_monitoring()`을 롤백 검증 후 명시적으로 적용했습니다. 프로그램별 활성 참가자·팀·기획서 제출 수, 팀별 단계와 보고서/이슈 건수, 보고 구분·회차별 제출 및 미제출 팀을 한 DB 스냅샷에서 반환합니다. 초안은 미제출로 집계하며 실제 생성된 회차만 표시합니다. 학생과 익명 실행을 차단하고 기존 서비스 객체는 변경하지 않았습니다.

`tests/ad_monitoring_access.sql`은 집계 수치·미제출 팀·권한을 검증하고 모든 임시 자료를 롤백합니다. 공유 CLI migration history에는 등록하지 않았으므로 재실행하거나 `db push`하지 않습니다.

## 참가자 수료·중탈 및 대시보드 카드 (2026-09-25)

`migrations/20260925000400_ad_participant_outcomes.sql`을 롤백 검증 후 명시적으로 적용했습니다. 기존 `AD_participants.status` 제약에 `completed`, `dropout`을 추가하되 기존 `active`, `inactive` 데이터는 변경하지 않았습니다. `AD_dashboard_participant_counts()`는 교수에게 전체 프로그램 참가 등록 건수와 상태별 수치를 반환합니다. 비활성은 전체 수에 포함하지만 중탈로 합치지 않습니다.

`tests/ad_participant_outcomes.sql`은 새 상태, 무효 상태 거부, 상태별 합계 및 비인가/익명 차단을 검증하며 임시 자료를 롤백합니다. 기존 active 조건의 팀·일정 접근 및 계정 연결 정책은 수료·중탈 참가자에게 접근을 허용하지 않습니다. 이 SQL도 공유 CLI migration history에 등록하지 않았으므로 재실행하거나 `db push`하지 않습니다.

## 팀 전체리포트 조회 적용 기록 (2026-09-25)

`migrations/20260925000500_ad_team_full_report.sql`을 롤백 검증 후 명시적으로 적용했습니다. `AD_team_full_report()`는 현재 교수 또는 활성 소속 팀원 권한을 확인한 뒤 프로그램명·팀 정보·최소 필드 팀원 명단·기획서·전체 보고서를 하나의 DB 스냅샷에서 반환합니다. 이메일·전화번호·학번·다른 팀 자료는 포함하지 않습니다. 신규 테이블이나 기존 서비스 객체 변경은 없습니다.

`tests/ad_team_full_report_access.sql`에서 자료 구성, 소속 팀 조회, 타 팀·수료자·익명 차단을 확인했으며 임시 Auth 사용자와 공유 트리거 생성 자료는 모두 롤백했습니다. 공유 CLI migration history에는 등록하지 않았으므로 재실행하거나 `db push`하지 않습니다.

## 링크 산출물 적용 기록 (2026-09-25)

`migrations/20260925000600_ad_deliverable_links.sql`을 전체 롤백 검증 후 명시적으로 적용했습니다. `AD_deliverables`는 팀·유형·제목·설명·검증된 http/https URL·최근 제출자/시각을 보관합니다. 팀 FK는 `ON DELETE RESTRICT`입니다. 직접 클라이언트 쓰기를 막고 RLS 조회 및 `AD_save_deliverable`·`AD_delete_deliverable`에서 현재 활성 팀원과 수정 버전을 검증합니다. 교수는 조회만 가능합니다. 파일 첨부를 위한 Storage 설정은 변경하지 않았습니다.

`tests/ad_deliverable_links_access.sql`은 URL·유형 제약, 팀원 공동 수정·삭제, 다른 팀·교수·익명 차단과 동시 수정 충돌을 검증하며 임시 자료를 롤백합니다. 공유 CLI migration history에는 등록하지 않았으므로 재실행하거나 `db push`하지 않습니다.

## 프로그램 산출물 현황 적용 기록 (2026-09-25)

`migrations/20260925000700_ad_program_deliverables.sql`을 롤백 검증 후 명시적으로 적용했습니다. 교수 전용 `AD_program_deliverables()`는 선택 프로그램의 모든 팀을 최근 제출 시각 내림차순으로, 팀 내 링크 산출물을 최신 제출 순으로 반환합니다. 전체·제출·미제출 팀 수와 산출물 건수를 함께 집계하며 자료가 없는 팀은 마지막에 표시합니다. 기존 서비스 객체는 변경하지 않았습니다.

`tests/ad_program_deliverables_access.sql`은 팀 그룹·자료 정렬, 빈 팀·집계 수치, 비인가·익명 실행 차단을 검증하며 임시 자료를 롤백합니다. 공유 CLI migration history에는 등록하지 않았으므로 재실행하거나 `db push`하지 않습니다.

## 산출물 코멘트 적용 기록 (2026-09-25)

`migrations/20260925000800_ad_deliverable_comments.sql`은 `AD_comments`에 산출물 대상을 추가하고 세 대상 중 정확히 하나만 지정하도록 제한합니다. 교수 전용 `AD_save_deliverable_comment()`는 팀과 산출물의 일치, 작성자, 수정 버전을 확인합니다. 기존 `AD_delete_comment()`로 본인 코멘트를 삭제합니다. 코멘트가 남은 산출물은 외래 키로 삭제를 제한합니다. `tests/ad_deliverable_comments_access.sql`은 팀원·다른 팀·익명 접근, 직접 쓰기, 수정 충돌과 삭제 제한을 임시 자료로 검증하고 롤백합니다. 공유 CLI migration history에는 등록하지 않았으므로 `db push`로 재적용하지 않습니다.

## 프로그램 공지사항 적용 기록 (2026-09-25)

`migrations/20260925000900_ad_announcements.sql`을 롤백 검증 후 명시적으로 적용했습니다. `AD_announcements`는 프로그램별 제목·본문·중요 표시·작성자·시각을 보관합니다. 조회 RLS는 현재 교수와 해당 프로그램의 활성 학생 참가자로 제한합니다. 직접 쓰기를 막고 `AD_save_announcement()`·`AD_delete_announcement()`에서 교수 권한·입력·프로그램 일치·수정 버전을 검사합니다. `tests/ad_announcements_access.sql`은 작성·수정·삭제, 학생 프로그램 범위, 직접 쓰기·익명 차단을 검증하며 임시 자료를 롤백합니다. 공유 CLI migration history에는 등록하지 않았으므로 `db push`로 재적용하지 않습니다.
