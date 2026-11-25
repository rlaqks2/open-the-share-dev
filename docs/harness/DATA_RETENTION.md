# DATA_RETENTION — Supabase 에 데이터가 불필요하게 쌓이지 않게 하는 규칙

> 목표: **무료 플랜(DB 500MB · 전송 월 5GB · Edge Function 월 50만 회) 안에서 계속 운영**하고,
> 개인정보는 처리방침(`src/data/privacyPolicy.ts` 제3조)의 보유기간보다 오래 두지 않는다.
> 정리는 마이그레이션 `20261125120000_data_hygiene.sql` 의 `public.purge_stale_data()` 한 곳에서 하고,
> pg_cron `purge-site-events` 가 **매일 04:00 KST** 호출한다.

## 1. 테이블별 보관 규칙

| 테이블 | 무엇 | 보관 | 정리 방법 | 대략 증가량 |
|---|---|---|---|---|
| `site_events` | 측정 원본 이벤트 | **1년** (처리방침) | `purge_stale_data()` | 이벤트당 ~0.7KB (인덱스 포함) |
| `site_events` 중 `utm_source=claude_*` | 확인용 테스트 방문 | **1일** | `purge_stale_data()` | — |
| `ip_lookups` | IP → 지역·기관 캐시 | 참조하는 이벤트가 있는 동안 (= 최대 1년) | `purge_stale_data()` (고아 행 삭제) | 세션 첫 방문 IP 당 1행 |
| `site_monthly_summary` | 월별 합계 (개인 식별 불가) | 영구 | 매일 03:30 KST 최근 두 달 덮어쓰기 (행이 늘지 않음) | 월 ~20행 |
| `portfolio_items`·`press_releases` | 사이트 콘텐츠 | 영구 | 삭제 대신 `is_published=false` (봇 중복 방지 키로 필요) | 글 1건당 ~2KB, 이력 테이블 없음 |
| `content_ingest_tokens` | 봇 토큰 해시 | 사용 중인 것만 | 토큰 교체 시 예전 행 수동 삭제 | 1~2행 |
| `cron.job_run_details` | pg_cron 실행 기록 | **14일** | `purge_stale_data()` | 하루 2행 |

## 2. 처음부터 쌓지 않는 장치 (이미 적용됨)

| 위치 | 장치 |
|---|---|
| `collect` 함수 | Origin 허용목록(openthe.kr 만), 이벤트명 허용목록, 8KB 크기 제한, 봇 User-Agent 무시, **IP(없으면 세션)당 분당 120건 제한** |
| `collect` 함수 | IP 지역 조회는 **세션 첫 페이지뷰**에서만, 캐시가 30일 지났을 때만 |
| 테스트 사이트·로컬 | 측정 환경변수를 넘기지 않아 **아무것도 쓰지 않음** (Origin 도 차단) |
| 콘텐츠 DB | 방문자 브라우저는 읽지 않음 → 방문자 수와 무관. 빌드 때만 읽음 |
| 콘텐츠 RPC | 한 번에 50건 제한, 이미 있는 log_no/link 는 건너뜀 (중복 행 없음) |
| `sync-blog.yml` | DB 내용 해시가 운영 `/content-version.txt` 와 같으면 빌드·배포·커밋 안 함. 커밋은 새 썸네일이 있을 때만 |
| `site_monthly_summary` | 같은 (월, 항목) 키를 덮어쓰기 → 매일 돌아도 행이 늘지 않음 |
| 전송량(Egress) | 콘텐츠 읽기는 빌드·동기화 때만 (1회 ~150KB, 매시간 돌아도 월 ~100MB = 무료 한도의 약 2%). 이미지는 Supabase Storage 가 아니라 GitHub Pages 에서 서비스 |

## 3. 용량 점검 (월 1회, [ANALYTICS 6장](../ANALYTICS.md) 점검 루틴과 함께)

Supabase SQL Editor:

```sql
-- 테이블별 용량
select * from public.v_storage_usage;

-- 정리 작업이 잘 돌았는지 (최근 5회)
select start_time, status, return_message
  from cron.job_run_details
 where command like '%purge_stale_data%'
 order by start_time desc limit 5;

-- 수동 정리 (결과: 지운 행 수)
select public.purge_stale_data();
```

판단 기준: DB 전체가 **400MB(무료 한도의 80%)** 를 넘으면 원인 테이블을 확인합니다. 현재(2026-11-25) 전체 약 11MB, 그중 사용자 데이터는 1MB 미만입니다.
전송량·함수 호출은 대시보드 Organization → Usage 에서 확인합니다.

## 4. 규칙을 바꿀 때

- 보관기간을 **늘리는** 변경은 처리방침 제3조와 `docs/DATA_COLLECTED.md` 를 같은 커밋에서 고칩니다 (CLAUDE.md R8). 줄이는 변경은 처리방침 범위 안이라 문서만 갱신합니다.
- 새 테이블을 만들면 이 문서 1장 표에 **보관기간과 정리 방법**을 함께 적습니다. 정리 방법이 없는 테이블은 만들지 않습니다.
- 정리 로직은 `purge_stale_data()` 에 추가합니다 (pg_cron 작업을 늘리지 않음 — 작업마다 실행 기록이 쌓임).
- 마이그레이션은 기존 파일을 고치지 말고 새 파일로 추가합니다.
