/**
 * @file pull-content.mjs
 * @description 빌드 전에 Supabase 콘텐츠 DB(포트폴리오·언론보도)에서 "공개된 행"을 읽어
 *              src/data/generated/*.json 으로 저장합니다. 사이트는 이 JSON 을 번들에 굽기 때문에
 *              방문자 브라우저는 Supabase 를 호출하지 않습니다.
 *
 * - 접속 정보: scripts/content-source.json (공개값: URL + publishable 키, RLS 로 읽기 전용)
 *   환경변수 CONTENT_SUPABASE_URL / CONTENT_PUBLISHABLE_KEY 로 덮어쓸 수 있음
 * - 실패 시:
 *     CI(GitHub Actions) → 빌드 중단 (빈 포트폴리오로 배포되는 사고 방지, 이전 배포가 그대로 유지됨)
 *     로컬 → 이전에 받아둔 JSON 이 있으면 경고 후 그대로 사용, 없으면 중단
 * - 결과 해시를 public/content-version.txt 에 적습니다. 블로그 동기화 워크플로가
 *   운영 사이트의 이 값과 비교해 "DB 가 바뀌었을 때만" 다시 배포합니다.
 *
 * 사용: node scripts/pull-content.mjs   (npm run build / dev / typecheck 가 자동 실행)
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'data', 'generated');
const PORTFOLIO_OUT = join(OUT_DIR, 'portfolio.json');
const PRESS_OUT = join(OUT_DIR, 'press.json');
const VERSION_OUT = join(ROOT, 'public', 'content-version.txt');

const cfg = JSON.parse(readFileSync(join(ROOT, 'scripts', 'content-source.json'), 'utf8'));
const URL_BASE = process.env.CONTENT_SUPABASE_URL || cfg.url;
const KEY = process.env.CONTENT_PUBLISHABLE_KEY || cfg.publishableKey;
const IS_CI = !!process.env.CI;

async function get(path) {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
        headers: { apikey: KEY, Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
}

/** DB 행 → src/types.ts PortfolioItem 모양 (이미지 경로는 상대경로 유지, mockData.ts 가 BASE_URL 을 붙임) */
function toPortfolio(r) {
    const item = {
        id: r.id,
        title: r.title,
        category: r.category,
        orgType: r.org_type,
        partner: r.partner,
        period: r.period,
        participants: r.participants,
        imageUrl: r.image_path,
        galleryUrls: r.gallery_urls,
        tags: r.tags,
        story: r.story,
    };
    if (r.log_no != null) item.logNo = Number(r.log_no);
    if (r.year) item.year = r.year;
    if (r.blog_link) item.blogLink = r.blog_link;
    return item;
}

function toPress(r) {
    return { id: r.id, title: r.title, date: r.date, source: r.source, category: r.category, summary: r.summary, link: r.link };
}

async function main() {
    let portfolio, press;
    try {
        const [p, pr] = await Promise.all([
            get('portfolio_items?select=id,log_no,title,category,org_type,partner,period,year,participants,image_path,gallery_urls,tags,story,blog_link&is_published=eq.true&order=period.desc,id.asc'),
            get('press_releases?select=id,title,date,source,category,summary,link&is_published=eq.true&order=date.desc,id.desc'),
        ]);
        portfolio = p.map(toPortfolio);
        press = pr.map(toPress);
        if (portfolio.length === 0 && !process.env.ALLOW_EMPTY_CONTENT) {
            throw new Error('포트폴리오가 0건입니다 (DB 비어 있음 또는 권한 문제). 의도한 경우 ALLOW_EMPTY_CONTENT=1');
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!IS_CI && existsSync(PORTFOLIO_OUT) && existsSync(PRESS_OUT)) {
            console.warn(`[pull-content] ⚠️ Supabase 조회 실패 — 이전에 받아둔 데이터로 계속합니다: ${msg}`);
            return;
        }
        console.error(`[pull-content] ❌ Supabase 콘텐츠 조회 실패: ${msg}`);
        process.exit(1);
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const pJson = JSON.stringify(portfolio, null, 2) + '\n';
    const prJson = JSON.stringify(press, null, 2) + '\n';
    writeFileSync(PORTFOLIO_OUT, pJson);
    writeFileSync(PRESS_OUT, prJson);
    const version = createHash('sha256').update(pJson).update(prJson).digest('hex').slice(0, 16);
    writeFileSync(VERSION_OUT, version + '\n');
    console.log(`[pull-content] 포트폴리오 ${portfolio.length}건 · 언론보도 ${press.length}건 (version ${version})`);
}

main();
