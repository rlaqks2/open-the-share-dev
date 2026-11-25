-- =============================================================================
-- openthe.kr 콘텐츠 저장소 (포트폴리오 · 언론보도)
--   예전에는 src/data/mockData.ts 에 직접 적었고, 블로그 봇이 그 파일을 고쳐 커밋했다.
--   이제 원본은 이 테이블이고, 사이트는 "빌드할 때" 한 번 읽어 정적 JSON 으로 굽는다.
--     읽기: scripts/pull-content.mjs (publishable 키, 공개된 행만) → src/data/generated/*.json
--     쓰기: (1) 사람 — Supabase Table Editor
--           (2) 블로그 봇 — scripts/sync_blog.py → RPC content_ingest (토큰 검사)
--   방문자 브라우저는 이 테이블을 호출하지 않는다. (Supabase 가 멈춰도 사이트는 마지막 빌드 그대로)
--   가이드: docs/harness/DATA_GUIDE.md
-- =============================================================================

-- 1) 포트폴리오 ------------------------------------------------------------------
create table if not exists public.portfolio_items (
    id            integer primary key,                 -- 공유 링크(?story=id)에 쓰이므로 바꾸지 않는다
    log_no        bigint unique,                       -- 네이버 블로그 글 번호 (봇 중복 방지 키)
    title         text    not null,
    category      text    not null,
    org_type      text    not null check (org_type in ('기업봉사', '단체봉사')),
    partner       text    not null default '',
    period        text    not null check (period ~ '^\d{4}\.\d{2}\.\d{2}$'),  -- 블로그 게시일 YYYY.MM.DD
    year          text,
    participants  integer not null default 0 check (participants >= 0),   -- 0 = 미확인 (화면에 표시 안 함)
    image_path    text    not null,                    -- 'images/portfolio/item_001.jpg' (사이트 기준 상대경로) 또는 https URL
    gallery_urls  text[]  not null default '{}',       -- 상대경로 또는 https URL
    tags          text[]  not null default '{}',
    story         text    not null default '',
    blog_link     text,
    is_published  boolean not null default true,       -- false = 사이트에서 숨김 (삭제 대신 사용)
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on table public.portfolio_items is '사이트 포트폴리오(봉사 히스토리). 빌드 시 읽어 정적 JSON 으로 배포. is_published=false 면 숨김.';

create index if not exists portfolio_items_period_idx on public.portfolio_items (period desc, id desc);

-- 2) 언론보도 --------------------------------------------------------------------
create table if not exists public.press_releases (
    id            integer primary key,
    title         text    not null,
    date          text    not null check (date ~ '^\d{4}\.\d{2}\.\d{2}$'),
    source        text    not null default '언론보도',
    category      text    not null default '',
    summary       text    not null default '',
    link          text    not null unique,             -- 언론사 원문 URL (봇 중복 방지 키)
    is_published  boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on table public.press_releases is '사이트 언론보도 목록. 빌드 시 읽어 정적 JSON 으로 배포. is_published=false 면 숨김.';

-- 3) updated_at 자동 갱신 ---------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists portfolio_items_touch on public.portfolio_items;
create trigger portfolio_items_touch before update on public.portfolio_items
    for each row execute function public.touch_updated_at();

drop trigger if exists press_releases_touch on public.press_releases;
create trigger press_releases_touch before update on public.press_releases
    for each row execute function public.touch_updated_at();

-- 4) 접근 권한 --------------------------------------------------------------------
--    anon(publishable 키): 공개된 행 읽기만. 쓰기 권한·정책 없음.
alter table public.portfolio_items enable row level security;
alter table public.press_releases  enable row level security;

revoke all on public.portfolio_items from anon, authenticated;
revoke all on public.press_releases  from anon, authenticated;
grant select on public.portfolio_items to anon;
grant select on public.press_releases  to anon;

drop policy if exists portfolio_items_public_read on public.portfolio_items;
create policy portfolio_items_public_read on public.portfolio_items
    for select to anon using (is_published);

drop policy if exists press_releases_public_read on public.press_releases;
create policy press_releases_public_read on public.press_releases
    for select to anon using (is_published);

-- 5) 블로그 봇 쓰기용 토큰 ----------------------------------------------------------
--    평문 토큰은 GitHub Actions 시크릿 CONTENT_INGEST_TOKEN 에만 둔다. DB 에는 sha256 해시만.
--    토큰 교체: insert 새 해시 → GitHub 시크릿 교체 → 예전 행 delete
create table if not exists public.content_ingest_tokens (
    token_sha256  text primary key,
    label         text not null default '',
    created_at    timestamptz not null default now()
);

comment on table public.content_ingest_tokens is '블로그 봇(content_ingest RPC) 토큰의 sha256 해시. 평문은 저장하지 않는다.';

alter table public.content_ingest_tokens enable row level security;
revoke all on public.content_ingest_tokens from anon, authenticated;

create or replace function public.content_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select p_token is not null
       and length(p_token) >= 32
       and exists (
           select 1 from public.content_ingest_tokens
           where token_sha256 = encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex')
       );
$$;

revoke all on function public.content_token_ok(text) from public, anon, authenticated;

-- 6) 봇용 RPC: 현재 상태 조회 (숨김 행 포함 — 숨긴 글을 다시 추가하지 않도록) ----------
create or replace function public.content_state(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not public.content_token_ok(p_token) then
        raise exception 'invalid token' using errcode = '28000';
    end if;
    return jsonb_build_object(
        'portfolio_log_nos', coalesce((select jsonb_agg(log_no) from public.portfolio_items where log_no is not null), '[]'::jsonb),
        'max_portfolio_id',  coalesce((select max(id) from public.portfolio_items), 0),
        'press_links',       coalesce((select jsonb_agg(link) from public.press_releases), '[]'::jsonb)
    );
end;
$$;

-- 7) 봇용 RPC: 새 글 추가 (이미 있는 log_no / link 는 건너뜀 → 사람이 고친 값을 덮어쓰지 않음) --
create or replace function public.content_ingest(p_token text, p_portfolio jsonb default '[]'::jsonb, p_press jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_portfolio int := 0;
    v_press     int := 0;
    r           jsonb;
    v_next_press int;
begin
    if not public.content_token_ok(p_token) then
        raise exception 'invalid token' using errcode = '28000';
    end if;
    if jsonb_typeof(coalesce(p_portfolio, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_press, '[]'::jsonb)) <> 'array' then
        raise exception 'payload must be arrays';
    end if;
    if jsonb_array_length(coalesce(p_portfolio, '[]'::jsonb)) > 50 or jsonb_array_length(coalesce(p_press, '[]'::jsonb)) > 50 then
        raise exception 'too many items';
    end if;

    for r in select * from jsonb_array_elements(coalesce(p_portfolio, '[]'::jsonb)) loop
        insert into public.portfolio_items
            (id, log_no, title, category, org_type, partner, period, year, participants,
             image_path, gallery_urls, tags, story, blog_link)
        values (
            (r->>'id')::int,
            (r->>'log_no')::bigint,
            r->>'title',
            r->>'category',
            r->>'org_type',
            coalesce(r->>'partner', ''),
            r->>'period',
            r->>'year',
            coalesce((r->>'participants')::int, 0),
            r->>'image_path',
            coalesce(array(select jsonb_array_elements_text(r->'gallery_urls')), '{}'),
            coalesce(array(select jsonb_array_elements_text(r->'tags')), '{}'),
            coalesce(r->>'story', ''),
            r->>'blog_link'
        )
        on conflict do nothing;
        if found then v_portfolio := v_portfolio + 1; end if;
    end loop;

    for r in select * from jsonb_array_elements(coalesce(p_press, '[]'::jsonb)) loop
        select coalesce(max(id), 0) + 1 into v_next_press from public.press_releases;
        insert into public.press_releases (id, title, date, source, category, summary, link)
        values (
            v_next_press,
            r->>'title',
            r->>'date',
            coalesce(r->>'source', '언론보도'),
            coalesce(r->>'category', ''),
            coalesce(r->>'summary', ''),
            r->>'link'
        )
        on conflict do nothing;
        if found then v_press := v_press + 1; end if;
    end loop;

    return jsonb_build_object('portfolio_inserted', v_portfolio, 'press_inserted', v_press);
end;
$$;

revoke all on function public.content_state(text) from public, authenticated;
revoke all on function public.content_ingest(text, jsonb, jsonb) from public, authenticated;
grant execute on function public.content_state(text) to anon;
grant execute on function public.content_ingest(text, jsonb, jsonb) to anon;
