# CLAUDE.md — 오픈더쉐어(openthe.kr) 웹사이트 작업 하네스

> AI 코딩 에이전트(Claude Code, Cursor, Codex 등)와 사람이 이 저장소에서 작업할 때 **가장 먼저 읽는 문서**입니다.
> 세부 규칙은 `docs/harness/` 아래 문서로 연결됩니다. 이 파일은 짧게 유지하고, 상세 내용은 하위 문서에 씁니다.

---

## 1. 프로젝트 한 줄 요약

**(주)오픈더쉐어** — 기업·단체 단위 사회공헌(봉사) 프로그램을 기획·운영하는 회사의 공식 사이트.
주 목적은 **① 기업 소개** **② 기업·단체 봉사 히스토리(포트폴리오) 공유** **③ 파트너십 문의 수집**.

- 운영 주소: https://openthe.kr (GitHub Pages + 커스텀 도메인, `public/CNAME`)
- 저장소: `rlaqks2/open-the-share-website`, 기본 브랜치 `master`
- 스택: **React 18 + TypeScript + Vite 5 + Tailwind CSS 3** (정적 SPA)
- **자체 백엔드 없음.** 서버·로그인 없음. DB 는 Supabase(SaaS) 하나 — ① 측정 데이터(브라우저는 Edge Function 을 통해서만 씀) ② 포트폴리오·언론보도 콘텐츠(빌드 때만 읽어 정적 JSON 으로 굽고, 블로그 봇이 토큰 RPC 로 씀). → 반드시 [NO_BACKEND_POLICY](docs/harness/NO_BACKEND_POLICY.md) 준수

## 2. 절대 규칙 (Must / Must Not)

| # | 규칙 |
|---|------|
| R1 | **비밀값을 코드·`VITE_*` 환경변수에 넣지 않는다.** 빌드 결과물은 전부 공개된다. (EmailJS Public Key 처럼 "공개용" 키만 허용) |
| R2 | **포트폴리오·언론보도의 원본은 Supabase 콘텐츠 DB**(`portfolio_items`·`press_releases`)다. `mockData.ts` 에 항목을 다시 적거나 `src/data/generated/*.json` 을 손으로 고치거나 커밋하지 않는다. 방문자 브라우저에서 DB 를 호출하지 않는다(빌드 때만 읽음). 쓰기 토큰 `CONTENT_INGEST_TOKEN` 은 GitHub Secret·`.env.local` 에만 둔다. ([DATA_GUIDE §2](docs/harness/DATA_GUIDE.md)) |
| R3 | `index.html` 의 `<meta name="referrer" content="no-referrer">` **삭제 금지** — 네이버 블로그 이미지(pstatic.net) 핫링크 차단 회피용. |
| R4 | 배포는 **`master` push → GitHub Actions** 한 경로만 쓴다. `gh-pages` 브랜치를 손으로 수정하지 않는다. 운영 반영 전 확인은 `npm run ship:dev` → https://rlaqks2.github.io/open-the-share-dev/ ([DEPLOYMENT §1-1](docs/harness/DEPLOYMENT.md)) |
| R5 | `npm run build` (= `tsc && vite build`) 가 통과하지 않는 변경은 커밋하지 않는다. `noUnusedLocals` 가 켜져 있어 **안 쓰는 import 하나로도 배포가 실패**한다. |
| R6 | 새 이미지는 `public/images/...` 에 넣고 **가로 1200px 이하 / 300KB 이하**로 최적화한다. |
| R7 | 사용자에게 보이는 문구는 **한국어**, `break-keep` 유지. 회사 정보(전화·메일·주소)는 하드코딩하지 말고 `mockData.companyInfo` 를 참조한다. |
| R8 | 방문자 IP 등 개인정보 수집 기능을 늘리지 않는다. 수집 항목·외부 서비스·보유기간이 바뀌면 **`src/data/privacyPolicy.ts`(처리방침·문의폼 고지)를 같은 커밋에서 갱신**한다. |
| R9 | **Supabase 에 정리 규칙 없는 데이터를 쌓지 않는다.** 새 테이블·새 이벤트는 보관기간과 정리 방법을 [DATA_RETENTION](docs/harness/DATA_RETENTION.md) 표에 먼저 적고, 정리는 `purge_stale_data()` 에 추가한다(pg_cron 작업을 늘리지 않음). 방문자 브라우저가 DB 를 읽게 만들지 않는다. 마이그레이션은 새 파일로만 추가한다. |

## 3. 자주 쓰는 명령

```bash
npm install            # 최초 1회
npm run dev            # 로컬 미리보기 http://localhost:5173/
npm run build          # 타입체크 + 프로덕션 빌드 (커밋 전 필수)
npm run preview        # 빌드 결과 미리보기
npm run typecheck      # 타입체크만
npm run content:pull   # Supabase 콘텐츠 DB → src/data/generated/*.json (dev/build/typecheck 가 자동 실행)
npm run sync:blog      # 네이버 블로그 새 글 → Supabase DB 반영 (Python 3, pip install pillow 권장, .env.local 에 CONTENT_INGEST_TOKEN 필요)
npm run ship           # pull → build → commit → push (= 배포)
deploy.bat             # Windows 더블클릭 배포 (위와 동일)
```

## 4. 폴더 지도

```
src/
├── App.tsx                 # 화면 상태('home' | 'portfolio') + 모달 상태 관리 (라우터 없음)
├── config/site.ts          # 외부 서비스 설정 (EmailJS 등, 공개값만)
├── data/mockData.ts        # ★ 사이트 콘텐츠 (문구·파트너·FAQ·회사정보). 포트폴리오·언론보도는 generated/*.json 을 읽음
├── data/generated/         # 빌드 때 Supabase 에서 받은 포트폴리오·언론보도 JSON (git 제외, 직접 수정 금지)
├── types.ts                # PortfolioItem / PartnerItem / PressReleaseItem 타입
├── components/
│   ├── layout/             # Header, Footer
│   ├── sections/           # 메인 페이지 섹션 (Hero → About → Impact → Programs → Process → Portfolio → Testimonials → Partners → FAQ → CTA)
│   ├── pages/              # PortfolioPage (전체 아카이브 + 필터 + 페이지네이션)
│   ├── modals/             # Search, Inquiry, PortfolioDetail, PrivacyPolicy
│   ├── forms/InquiryForm   # 파트너십 문의 → EmailJS
│   └── ui/Modal            # 공통 모달 (ESC/바깥클릭 닫기, 스크롤 잠금)
├── hooks/useScrollObserver # <section> 페이드인
├── services/analytics.ts   # ★ 측정 단일 진입점 (trackPageView/trackEvent → GA4·Supabase·구글 시트)
└── utils/                  # visitorTracker(방문자 로그 → 관리자 구글 시트, 사이트 UI 없음), a11y(clickableProps)
supabase/                   # 측정·콘텐츠 DB 마이그레이션(SQL) + Edge Function collect (docs/ANALYTICS.md, DATA_GUIDE §2)
public/                     # 그대로 배포되는 정적 파일 (CNAME, 파비콘, images/)
scripts/pull-content.mjs    # 빌드 전 Supabase 콘텐츠 → src/data/generated/*.json (공개 키·RLS 읽기 전용)
scripts/sync_blog.py        # 블로그 RSS → Supabase 콘텐츠 DB 자동 반영 (GitHub Actions 매시간)
.github/workflows/          # deploy.yml(배포), sync-blog.yml(블로그 동기화+배포)
docs/harness/               # ★ 하네스 문서 (아래)
.claude/commands/           # 에이전트 슬래시 커맨드 (/add-portfolio, /verify, /release, /new-section)
```

## 5. 작업 절차 (에이전트 기본 루프)

1. **이해** — 어느 파일을 건드릴지 [STRUCTURE](docs/harness/STRUCTURE.md) 5장에서, 요청이 어떤 유형인지 [WORKFLOWS](docs/harness/WORKFLOWS.md) 에서 찾는다. (콘텐츠 수정 / 포트폴리오 추가 / 섹션 추가 / 페이지 추가 / 외부연동 추가)
2. **확인** — 백엔드가 필요한 요청이면 [NO_BACKEND_POLICY](docs/harness/NO_BACKEND_POLICY.md) 의 대안 패턴을 먼저 제시한다.
3. **변경** — 가능한 한 데이터(`mockData.ts`, 포트폴리오·언론보도는 Supabase DB)만 바꾸고, 컴포넌트 변경은 최소화한다. 기존 Tailwind 스타일 톤(로고 블루 `brand`·보조 노랑 `amber`/slate, `rounded-3xl`, `font-black` 제목)을 따른다.
4. **검증** — [VERIFICATION](docs/harness/VERIFICATION.md) 체크리스트 실행. 최소한 `npm run build` 통과 + 모바일 폭(375px) 확인.
5. **기록** — 구조·규칙이 바뀌면 해당 하네스 문서와 [CHANGELOG](docs/harness/CHANGELOG.md) 를 같이 수정한다.
6. **배포** — [DEPLOYMENT](docs/harness/DEPLOYMENT.md). 사람의 확인 없이 `master` 에 push 하지 않는다.

## 6. 하네스 문서 목록

| 문서 | 언제 읽나 |
|------|-----------|
| [docs/harness/STRUCTURE.md](docs/harness/STRUCTURE.md) | ★ 전체 소스 구조도 (폴더 트리·화면·데이터 흐름 다이어그램, "무엇을 고치면 어디가 바뀌나") |
| [docs/harness/ARCHITECTURE.md](docs/harness/ARCHITECTURE.md) | 구조·데이터 흐름·외부 서비스 파악 |
| [docs/harness/NO_BACKEND_POLICY.md](docs/harness/NO_BACKEND_POLICY.md) | 폼·통계·관리자·DB 성격의 기능 요청을 받았을 때 |
| [docs/harness/DATA_GUIDE.md](docs/harness/DATA_GUIDE.md) | `mockData.ts` 수정, 포트폴리오/파트너 추가 (포트폴리오·언론보도는 Supabase) |
| [docs/harness/DATA_RETENTION.md](docs/harness/DATA_RETENTION.md) | Supabase 테이블별 보관기간·자동 정리·용량 점검 (새 테이블·이벤트 추가 전 필수) |
| [docs/harness/WORKFLOWS.md](docs/harness/WORKFLOWS.md) | 유형별 작업 플레이북 |
| [docs/harness/VERIFICATION.md](docs/harness/VERIFICATION.md) | 완료 전 검증 (Definition of Done) |
| [docs/harness/DEPLOYMENT.md](docs/harness/DEPLOYMENT.md) | 배포·도메인·롤백 |
| [docs/harness/ROADMAP.md](docs/harness/ROADMAP.md) | 확장 계획과 남은 기술부채 |
| [docs/harness/CHANGELOG.md](docs/harness/CHANGELOG.md) | 구조적 변경 이력 |
| [docs/PLANNER_GUIDE.md](docs/PLANNER_GUIDE.md) | 비개발자(기획·운영) 작업 가이드 |
| [docs/ANALYTICS.md](docs/ANALYTICS.md) | 측정(GA4·Supabase Postgres) 설정·이벤트 목록·SQL 분석 |
| [docs/DATA_COLLECTED.md](docs/DATA_COLLECTED.md) | 수집 데이터 전체 명세 (테이블·컬럼·GA4 항목·브라우저 저장값) — 수집 항목 변경 시 함께 수정 |
| [docs/VISITOR_LOG.md](docs/VISITOR_LOG.md) | 방문자 로그(구글 시트, 병행 후 종료 예정) 설정·분석·관리 |
| [docs/current_specs.md](docs/current_specs.md) | 현재 화면·기능 명세 |
