---
description: 포트폴리오(봉사 히스토리) 항목을 추가하거나 자동 수집 항목을 검수합니다
argument-hint: [네이버 블로그 URL 또는 활동 설명]
---

포트폴리오 항목을 추가/검수합니다. 입력: $ARGUMENTS

1. `docs/harness/DATA_GUIDE.md` 의 2장(Supabase 콘텐츠 DB)·3장(컬럼 규칙)·5장(이미지 규격)을 먼저 읽는다. 포트폴리오 원본은 Supabase `public.portfolio_items` 이고 `mockData.ts` 에 항목을 적지 않는다.
2. 입력이 네이버 블로그 URL 이면 글 번호(log_no)를 추출하고 `portfolio_items` 에 같은 `log_no` 가 있는지 조회한다 (`npm run content:pull` 후 `src/data/generated/portfolio.json` 검색, 또는 Supabase SQL — 숨긴 행은 SQL 로만 보임).
   - 이미 있으면: `org_type`, `category`, `partner`, `participants`, `story` 가 원문과 맞는지 검수하고 수정안(UPDATE 문 또는 Table Editor 안내)을 제시한다. DB 수정은 사용자 확인 후에만 한다.
   - 없으면: 자동 수집(Actions 수동 실행, 또는 로컬 `npm run sync:blog` — `.env.local` 토큰 필요)을 먼저 안내하고, 사용자가 원하면 수동으로 추가한다.
3. 수동 추가 시:
   - 썸네일 `public/images/portfolio/item_NNN.jpg` (가로 ≤1200px, ≤300KB) 를 먼저 커밋·배포한다. 이미지가 없으면 사용자에게 요청한다 — 외부 URL 을 `image_path` 에 넣지 않는다.
   - 행 추가: `id` = 최대 id + 1, `image_path` = `images/portfolio/item_NNN.jpg`, `category` 는 5개 허용값 중 하나, `period` 는 `YYYY.MM.DD`, `year` 일치
4. `docs/harness/VERIFICATION.md` 의 L0 + L1(포트폴리오 관련 항목)을 수행하고 결과를 보고 형식대로 보고한다.
5. push 는 사용자의 명시적 요청이 있을 때만 `/release` 절차로 진행한다.
