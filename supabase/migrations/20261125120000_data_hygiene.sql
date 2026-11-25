-- =============================================================================
-- 데이터 위생: Supabase 에 불필요한 데이터가 쌓이지 않게 한다 (무료 플랜 500MB 기준)
--
-- 보관 규칙 한눈에 보기 (docs/harness/DATA_RETENTION.md 와 같아야 함)
--   site_events            원본 이벤트        1년 (처리방침 제3조)   ← 기존 규칙 유지
--   site_events (테스트)   utm_source=claude_* 1일 (확인용 방문, 통계에서도 제외)
--   ip_lookups             IP 지역·기관 캐시   참조하는 이벤트가 없으면 삭제 (= 최대 1년)
--   site_monthly_summary   월별 합계           영구 (개인 식별 불가, 월 ~20행)
--   portfolio_items / press_releases  콘텐츠  영구 (숨김은 is_published=false, 봇 중복 방지에 필요)
--   content_ingest_tokens  토큰 해시           교체 시 예전 행 수동 삭제
--   cron.job_run_details   pg_cron 실행 기록   14일
--
-- 하나의 함수 purge_stale_data() 로 모으고, 기존 pg_cron 작업 purge-site-events(매일 04:00 KST)가 호출한다.
-- =============================================================================

create or replace function public.purge_stale_data()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v_events      int;
    v_test        int;
    v_ip          int;
    v_cron        int := 0;
begin
    -- 1) 원본 이벤트 1년 파기 (처리방침 제3조)
    delete from public.site_events where occurred_at < now() - interval '1 year';
    get diagnostics v_events = row_count;

    -- 2) 확인용 테스트 방문(utm_source=claude_*)은 하루 뒤 삭제 — 월별 요약에서도 이미 제외됨
    delete from public.site_events
     where utm_source like 'claude\_%'
       and occurred_at < now() - interval '1 day';
    get diagnostics v_test = row_count;

    -- 3) 어떤 이벤트도 참조하지 않는 IP 캐시 삭제
    delete from public.ip_lookups l
     where not exists (select 1 from public.site_events e where e.ip = l.ip);
    get diagnostics v_ip = row_count;

    -- 4) pg_cron 실행 기록 14일 보관 (기본값은 무기한 누적)
    begin
        delete from cron.job_run_details where end_time < now() - interval '14 days';
        get diagnostics v_cron = row_count;
    exception when insufficient_privilege or undefined_table then
        v_cron := -1;   -- 권한·스키마가 없으면 건너뜀 (나머지 정리는 계속)
    end;

    return jsonb_build_object(
        'site_events_expired', v_events,
        'site_events_test',    v_test,
        'ip_lookups_orphan',   v_ip,
        'cron_history',        v_cron
    );
end;
$$;

comment on function public.purge_stale_data() is
    '보관기간이 지난 데이터 정리 (이벤트 1년·테스트 방문 1일·고아 IP 캐시·cron 기록 14일). pg_cron purge-site-events 가 매일 호출. docs/harness/DATA_RETENTION.md';

revoke all on function public.purge_stale_data() from public, anon, authenticated;

-- 기존 작업을 같은 이름·시간으로 교체 (월별 요약 03:30 KST → 정리 04:00 KST 순서 유지)
select cron.unschedule(jobid) from cron.job where jobname = 'purge-site-events';
select cron.schedule(
    'purge-site-events',
    '0 19 * * *',
    $$ select public.purge_stale_data(); $$
);

-- 데이터가 얼마나 쌓였는지 한 번에 보는 뷰 (SQL Editor: select * from public.v_storage_usage;)
create or replace view public.v_storage_usage
with (security_invoker = true) as
select
    n.nspname                                   as schema,
    c.relname                                   as table_name,
    c.reltuples::bigint                         as approx_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
    pg_total_relation_size(c.oid)               as total_bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname in ('public', 'cron')
order by pg_total_relation_size(c.oid) desc;

revoke all on public.v_storage_usage from anon, authenticated;
