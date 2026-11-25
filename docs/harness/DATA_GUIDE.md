# DATA_GUIDE — 콘텐츠 데이터 규칙 (`src/data/mockData.ts` + Supabase 콘텐츠 DB)

사이트에 보이는 텍스트·숫자·이미지 경로의 대부분은 `src/data/mockData.ts` 한 파일에 있습니다.
"mock" 이라는 이름이지만 **실제 운영 데이터**입니다.
단, **포트폴리오·언론보도는 Supabase 콘텐츠 DB 가 원본**이고 빌드 때 받아옵니다 (2장).

## 1. 최상위 키 지도

| 키 | 사용하는 컴포넌트 | 비고 |
|----|------------------|------|
| `hero` | HeroSection | `keywords` 는 `#` 포함/미포함 모두 허용 |
| `about` | AboutSection | `coreValues`(O.P.E.N), `features`, `personaNeeds`, `ciDescription` |
| `impactStats` | ImpactSection | **id 1·2 의 value 는 화면에서 자동 계산**(참여기관 수, 포트폴리오 수)되어 덮어써짐 |
| `flagshipBrands` | ProgramsSection | `id: "onnon" | "onting"` (아이콘 매핑에 사용) |
| `programOptions` | ProgramsSection | BASIC/옵션 A~C |
| `programs` | ProgramsSection | 4대 핵심 콘텐츠 |
| `processSteps` | ProcessSection | 4단계 |
| `portfolioItems` | Hero(최근 3건), PortfolioSection(6건), PortfolioPage(전체), SearchModal, Header/Footer(개수) | ★ **원본은 DB** `portfolio_items` (2·3장) |
| `pressReleases` | TestimonialsSection(언론보도) | ★ **원본은 DB** `press_releases` (2·3장) |
| `testimonials` | TestimonialsSection(후기) | 이름은 반드시 마스킹 (예: `김*준`) |
| `partners` | PartnersSection, Footer(개수) | ★ 아래 4장 |
| `faqs` | FAQSection | |
| `companyInfo` | Footer, InquiryForm 오류 안내 등 | 전화·메일·주소의 **단일 출처** |

## 2. 포트폴리오·언론보도는 Supabase 콘텐츠 DB 가 원본 (2026-11-25~)

`portfolioItems` / `pressReleases` 는 더 이상 `mockData.ts` 에 직접 적지 않습니다.

```
Supabase public.portfolio_items / press_releases   ← 원본 (사람: Table Editor, 봇: sync_blog.py)
        │  npm run build / dev / typecheck 시작 시 scripts/pull-content.mjs 가 자동 실행
        ▼  (publishable 키 · RLS 로 is_published = true 행만 읽기)
src/data/generated/portfolio.json · press.json   ← git 에 올리지 않음, 직접 고치지 않음
        ▼
mockData.portfolioItems / pressReleases          ← 이미지 상대경로에 BASE_URL 을 붙여 기존과 같은 모양으로 제공
```

- **방문자 브라우저는 Supabase 를 호출하지 않습니다.** 빌드할 때 JSON 으로 구워지므로 Supabase 가 일시정지돼도 사이트는 마지막 배포 그대로입니다.
- 조회 실패 시: CI 에서는 빌드 중단(이전 배포 유지), 로컬에서는 이전에 받아둔 JSON 이 있으면 경고 후 계속합니다. 포트폴리오가 0건이면 실패로 봅니다.
- 접속 정보(공개값): `scripts/content-source.json`. 마이그레이션: `supabase/migrations/20261125000000_site_content.sql`
- 배포 반영: DB 를 고치면 **블로그 동기화 워크플로가 다음 실행 때** 운영 사이트의 `/content-version.txt` 와 비교해 달라졌으면 다시 배포합니다. 바로 반영하려면 Actions → "1-Hour Auto Sync Blog Posts & Deploy" → Run workflow.

### 수정하는 법 (Supabase 대시보드 → Table Editor)
| 하고 싶은 일 | 방법 |
|---|---|
| 요약문·인원·분류 고치기 | 해당 행의 칸을 직접 수정 |
| 사이트에서 숨기기 | `is_published` 를 `false` (삭제 대신 사용 — 봇이 같은 글을 다시 추가하지 않음) |
| 수동으로 새 항목 추가 | 썸네일을 `public/images/portfolio/item_NNN.jpg` 로 먼저 커밋·배포 → `id` = 최대값 + 1 로 행 추가 |

## 3. 포트폴리오 항목 (`portfolio_items` 컬럼 → `PortfolioItem`)

| DB 컬럼 | 화면 필드 | 규칙 |
|---|---|---|
| `id` | `id` | 고유 번호. **공유 링크(`?story=id`)에 쓰이므로 바꾸지 않음**. 새 항목은 최대값 + 1 |
| `log_no` | `logNo` | 네이버 블로그 글 번호 (블로그 글이면 필수 — 봇 중복 수집 방지 키, unique) |
| `title` | `title` | |
| `category` | `category` | 아래 5개 중 하나 (필터 칩과 일치해야 필터됨) |
| `org_type` | `orgType` | `기업봉사` \| `단체봉사` (DB 제약) |
| `partner` | `partner` | 화면에 표시될 참여기관명 |
| `period` | `period` | ★ `YYYY.MM.DD` (DB 제약) — 블로그 게시일, 화면 표기 '게시일' |
| `year` | `year` | `period` 의 연도와 동일 |
| `participants` | `participants` | 모르면 0 (상세 화면에 인원 미표시) |
| `image_path` | `imageUrl` | `images/portfolio/item_111.jpg` 처럼 **앞에 `/` 없는 상대경로** (핫링크 금지) |
| `gallery_urls` | `galleryUrls` | 상대경로 또는 `https://…pstatic.net/...?type=w800` |
| `tags` | `tags` | `#` 없이 작성 (화면에서 # 붙임) |
| `story` | `story` | 1~2문장(50~80자) 요약. 누가·무엇을·누구에게. 상세는 블로그 원문으로 |
| `blog_link` | `blogLink` | |
| `is_published` | — | `false` 면 사이트에서 빠짐 |

**category 허용값** (`types.ts` 의 `PortfolioCategory`, PortfolioPage 필터 칩과 동일)
`원데이메이킹` · `찾아가는 과학교실` · `스페이스 업사이클링` · `친환경 ESG` · `지역사회 나눔`

**"OPEN THE SHARE 최신" 배지 규칙**: `period >= "2025.01.01"` 이면 자동으로 OTS 배지·탭에 포함됩니다. (`isOTSItem`, PortfolioSection·PortfolioPage 두 곳에 동일 정의)

**정렬**: `pull-content.mjs` 가 `period` 내림차순(같은 날은 `id` 오름차순)으로 받아오고, 화면도 `period` 로 다시 정렬합니다.

### 블로그 자동 수집 (`scripts/sync_blog.py` + `.github/workflows/sync-blog.yml`)
- GitHub Actions 가 **매시간**(실제로는 GitHub 사정으로 수 시간씩 늦어질 수 있음) RSS(최근 글 약 50개)를 확인 → DB 에 없는 `log_no` 이면서 블로그 카테고리가 **`현장스케치`(기업 및 단체봉사 > 현장스케치)** 인 글만 추가 (칼럼·나눔전달후기·파트너 기업 소개 등은 제외)
- 순서: ① 새 글 탐지·썸네일 저장(`--stage`) → ② 썸네일만 master 에 커밋·push → ③ DB 반영(`--ingest-pending`) → ④ 내용이 바뀌었으면 빌드·배포. 이미지가 먼저 올라가므로 깨진 썸네일이 노출되지 않습니다.
- DB 쓰기는 RPC `content_ingest` 로만 하며 토큰(`CONTENT_INGEST_TOKEN`, GitHub Actions **Secret**)을 검사합니다. 토큰 원문은 DB 에 없고 sha256 해시만 `content_ingest_tokens` 에 있습니다.
- `story` 는 og:description 을 90자 이내로 자동 요약 → 문장이 어색하면 운영자가 Table Editor 에서 다듬기
- 자동 추론값(`org_type`, `category`, `partner`, `participants: 0`=미확인)은 **정확하지 않을 수 있음** → 주기적으로 검수 권장
- 이미 있는 `log_no` 는 (숨긴 행 포함) 다시 추가하지 않으므로, 수동으로 고친 내용은 덮어써지지 않습니다.
- 자동 수집을 막고 싶은 글: 봇이 추가한 뒤 `is_published = false`, 또는 블로그에서 카테고리를 현장스케치가 아닌 곳으로 옮기기

### 언론보도 자동 수집 (`press_releases`)
- 블로그 `보도자료` 글에서 언론사 원문 링크를 찾아 추가. `link` 가 중복 방지 키(unique), `id` 는 DB 가 최대값 + 1 로 부여
- 링크의 `&#x3D;` 등 HTML 이스케이프는 풀어서 저장(안 풀면 언론사에서 404). 날짜는 기사 보도일(`article:published_time`) 우선, `YYYY.MM.DD`

### 토큰 교체 (유출 의심 시)
1. 새 토큰 생성 → SQL Editor 에서 `insert into public.content_ingest_tokens (token_sha256, label) values (encode(sha256(convert_to('<새 토큰>','UTF8')),'hex'), '...')`
2. GitHub 운영 저장소 Secrets 의 `CONTENT_INGEST_TOKEN` 교체 (로컬은 `.env.local`)
3. 예전 해시 행 `delete`

## 4. 참여기관 (`PartnerItem`)

```ts
    {
      name: "DB생명",                                          // 고유해야 함 (React key 로 사용)
      logo: `${BASE_URL}images/partners/partner_89.png`,       // 다음 번호 사용, 투명 PNG 권장, 높이 88px 이상
      group: "기업",                                           // "기업" | "공공기관·재단" | "학교·교육기관" | "단체·NGO"
      blogLink: "https://blog.naver.com/5penthe/..."           // 선택. 있으면 카드 클릭 시 이동
    },
```

## 5. 이미지 규칙

| 종류 | 위치 | 권장 규격 |
|------|------|-----------|
| 포트폴리오 썸네일 | `public/images/portfolio/item_NNN.jpg` | 가로 ≤1200px, JPEG 품질 80~85, **≤300KB** |
| 파트너 로고 | `public/images/partners/partner_NN.png` | 투명 PNG, 가로 ≤400px, ≤50KB |
| 브랜드 자산(로고·CI·아이콘) | `src/assets/` (import 해서 사용 → 해시 파일명으로 캐시) | |
| 파비콘·OG | `public/` 루트 | |

- 파일 확장자와 실제 포맷을 일치시키세요. (과거 `.jpg` 이름의 PNG 가 있었음 → 2026-11-09 JPEG 로 재압축)
- 압축 방법(로컬): `pip install pillow` 후 `sync_blog.py` 의 `optimize_thumbnail()` 재사용, 또는 squoosh.app 사용

## 6. 수정 후 확인

1. `npm run build` 통과 (따옴표·쉼표 누락은 여기서 잡힘. 첫 줄에 `[pull-content] 포트폴리오 N건` 이 찍히는지 확인)
2. `npm run dev` 로 해당 섹션 + 포트폴리오 페이지 필터/검색 확인
3. 상세 모달에서 이미지·블로그 링크 동작 확인
