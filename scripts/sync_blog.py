"""
@file sync_blog.py
@description 네이버 공식 블로그(https://blog.naver.com/5penthe)에서 새로운 글을 탐지하여
1) 포트폴리오: 블로그 '현장스케치' 카테고리 글만 수집 → 썸네일 다운로드 → Supabase public.portfolio_items 에 추가
2) 언론보도: '보도자료' 글에서 실제 언론사 원문 기사 URL 을 추출해 public.press_releases 에 추가

쓰기는 RPC content_ingest(토큰 검사) 로만 합니다. 이미 있는 글(log_no / 기사 링크)은 건너뛰므로
사람이 Table Editor 에서 고친 값이나 숨긴(is_published=false) 글을 덮어쓰지 않습니다.
토큰: 환경변수 CONTENT_INGEST_TOKEN (GitHub Actions 시크릿) 또는 로컬 .env.local

실행 방법
  python scripts/sync_blog.py                  # 로컬: 썸네일 저장 + 바로 DB 반영 (이후 public/images/portfolio 커밋 필요)
  python scripts/sync_blog.py --stage          # CI 1단계: 썸네일 저장 + 반영할 내용을 .sync-pending.json 에 기록
  python scripts/sync_blog.py --ingest-pending # CI 2단계: (썸네일을 push 한 뒤) .sync-pending.json 을 DB 에 반영
  → 이미지가 배포되기 전에 DB 행이 생겨 '깨진 썸네일'이 노출되는 것을 막기 위해 CI 는 2단계로 나눕니다.
  (pillow 설치 시 썸네일 자동 리사이즈: pip install pillow)
"""

import os
import re
import sys
import html
import json
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

# 프로젝트 루트 경로
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PORTFOLIO_IMG_DIR = os.path.join(ROOT_DIR, "public", "images", "portfolio")
CONTENT_SOURCE_PATH = os.path.join(ROOT_DIR, "scripts", "content-source.json")
PENDING_PATH = os.path.join(ROOT_DIR, ".sync-pending.json")
ENV_LOCAL_PATH = os.path.join(ROOT_DIR, ".env.local")

RSS_URL = "https://rss.blog.naver.com/5penthe.xml"
BLOG_USER = "5penthe"

# 썸네일 최적화 기준 (원본 블로그 이미지가 600KB~800KB 이상인 경우가 많아 페이지 로딩이 느려짐)
THUMB_MAX_WIDTH = 1200
THUMB_JPEG_QUALITY = 82


def optimize_thumbnail(img_bytes: bytes) -> bytes:
    """Pillow 가 설치되어 있으면 가로 최대 1200px, JPEG 품질 82 로 재압축합니다. 실패/미설치 시 원본 그대로 반환."""
    try:
        from io import BytesIO
        from PIL import Image, ImageOps
    except ImportError:
        print("  (pillow 미설치: 썸네일 원본 저장)")
        return img_bytes
    try:
        im = Image.open(BytesIO(img_bytes))
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            # 투명 영역이 검게 변하지 않도록 흰 배경 위에 합성
            rgba = im.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.getchannel("A"))
            im = bg
        elif im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        if im.width > THUMB_MAX_WIDTH:
            ratio = THUMB_MAX_WIDTH / im.width
            im = im.resize((THUMB_MAX_WIDTH, round(im.height * ratio)), Image.LANCZOS)
        out = BytesIO()
        im.save(out, format="JPEG", quality=THUMB_JPEG_QUALITY, optimize=True, progressive=True)
        optimized = out.getvalue()
        return optimized if len(optimized) < len(img_bytes) else img_bytes
    except Exception as e:  # 손상 이미지 등
        print(f"  (썸네일 최적화 실패, 원본 저장: {e})")
        return img_bytes

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = html.unescape(html.unescape(text))
    text = text.replace("삼奉사", "삼봉사")
    text = text.replace("溫&ON", "ON&ON").replace("溫ting", "ON-ting").replace("(溫)", "")
    text = re.sub(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]", "", text)
    text = re.sub(r"[\ud800-\udfff]", "", text)
    return text.strip()

def extract_log_no(url: str) -> int:
    m = re.search(r"/(\d{10,14})", url)
    return int(m.group(1)) if m else 0

def fetch_post_details(log_no: int):
    url = f"https://m.blog.naver.com/{BLOG_USER}/{log_no}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    })
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw_html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Failed to fetch post {log_no}: {e}")
        return None

    og_img = re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', raw_html)
    og_title = re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']+)["\']', raw_html)
    og_desc = re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\']([^"\']+)["\']', raw_html)

    # PC PostView 본문 내 se-image-resource 사진 탐색 (첫 번째 썸네일 중복 및 하단 배너/스티커 제외, 404 방지 mblogthumb-phinf 변환)
    gallery = []
    seen = set()
    try:
        pc_url = f"https://blog.naver.com/PostView.naver?blogId={BLOG_USER}&logNo={log_no}"
        pc_req = urllib.request.Request(pc_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(pc_req, timeout=12) as pc_resp:
            pc_html = pc_resp.read().decode("utf-8", errors="replace")
        img_tags = re.findall(r'<img[^>]*class="[^"]*se-image-resource[^"]*"[^>]*>', pc_html)
        for idx, tag in enumerate(img_tags):
            if idx == 0:
                continue  # 첫 번째 사진은 대표 썸네일(local_filename)과 동일하므로 중복 제외
            m_src = re.search(r'data-lazy-src="([^"]+)"', tag) or re.search(r'src="([^"]+)"', tag)
            if not m_src:
                continue
            base_p = m_src.group(1).split("?")[0].replace("https://postfiles.pstatic.net/", "https://mblogthumb-phinf.pstatic.net/")
            if any(ign in base_p for ign in [
                "%ED%93%A8%EC%B2%98", "%EC%89%90%EC%96%B4", "블로그하단",
                "thumb-6a802ff34b9c413c79fdbeb176665ab8", "%BF%C0%C7%C2%B4%F5%C7%BB%C3%B3",
                "MDAxNzgzNTcwMDA3OTg5"
            ]):
                continue
            if base_p not in seen:
                seen.add(base_p)
                gallery.append(base_p + "?type=w800")
                if len(gallery) >= 7:
                    break
    except Exception as e:
        print(f"Warning: Failed to fetch PC gallery for {log_no}: {e}")

    img_url = og_img.group(1) if og_img else ""
    if img_url and "?type=" not in img_url:
        img_url += "?type=w800"

    return {
        "title": og_title.group(1) if og_title else "",
        "desc": og_desc.group(1) if og_desc else "",
        "imageUrl": img_url,
        "gallery": gallery
    }

def fetch_press_article_details(log_no: int):
    """
    보도자료 포스트에서 실제 언론사 원문 링크 및 언론사명을 추출합니다.
    언론사 링크가 없으면 None을 반환합니다.
    """
    url = f"https://blog.naver.com/PostView.naver?blogId={BLOG_USER}&logNo={log_no}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    })
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw_html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Failed to fetch press post {log_no}: {e}")
        return None

    # 언론사 원문 링크 탐색 (naver, pstatic, youtube, widget 제외)
    hrefs = re.findall(r'href=["\'](https?://[^"\']+)["\']', raw_html)
    press_link = None
    for h in hrefs:
        if any(ign in h for ign in ["naver.com", "pstatic.net", "w3.org", "schema.org", "daum.net/favicon", "openthefuture.kr", "openthe.kr"]):
            continue
        # 블로그 HTML 속 링크는 '=' 가 '&#x3D;' 처럼 이스케이프돼 있어 그대로 쓰면 언론사에서 404 가 남
        press_link = html.unescape(h).replace("%29", "").strip()
        break

    if not press_link:
        # plain url text 검색
        plain_urls = re.findall(r'(https?://[a-zA-Z0-9_\-\./]+[a-zA-Z0-9_\-/])', raw_html)
        for u in plain_urls:
            if any(ign in u for ign in ["naver.com", "pstatic.net", "w3.org", "schema.org", "openthe"]):
                continue
            press_link = html.unescape(u).strip()
            break

    if not press_link:
        return None

    # 출처 언론사명 추출
    source = "언론보도"
    m_src = re.search(r'출처\s*:\s*([가-힣A-Za-z0-9]+)', raw_html)
    if m_src:
        source = m_src.group(1).strip()
    else:
        # 도메인 기반 언론사명 매핑
        if "siminilbo" in press_link:
            source = "시민일보"
        elif "bizwnews" in press_link:
            source = "비즈월드"
        elif "chukkyung" in press_link:
            source = "축산경제신문"
        elif "gosiweek" in press_link:
            source = "피앤피뉴스"
        elif "eanews" in press_link:
            source = "얼리어답터뉴스"
        elif "nbntv" in press_link:
            source = "내외경제TV"
        elif "kihoilbo" in press_link:
            source = "기호일보"
        elif "kdpress" in press_link:
            source = "데일리경제"
        elif "ksilbo" in press_link:
            source = "경상일보"
        elif "cstimes" in press_link:
            source = "컨슈머타임스"

    # 본문 첫 단락에서 요약문 추출
    paragraphs = re.findall(r'<p[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)</p>', raw_html)
    summary = ""
    for p in paragraphs:
        clean_p = re.sub(r'<[^>]+>', '', p).strip()
        clean_p = clean_text(clean_p)
        if len(clean_p) > 25 and not clean_p.startswith("출처") and not clean_p.startswith("202"):
            clean_p = re.sub(r'^["“”\']|["“”\']$', '', clean_p)
            summary = clean_p
            break

    # 언론사 기사 페이지에서 실제 보도일·요약문 보강 (실패해도 진행)
    article_date = ""
    try:
        a_req = urllib.request.Request(press_link, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(a_req, timeout=12) as a_resp:
            a_html = a_resp.read().decode("utf-8", errors="replace")
        m_date = re.search(r'article:published_time["\']\s+content=["\'](\d{4})-(\d{2})-(\d{2})', a_html)
        if m_date:
            article_date = f"{m_date.group(1)}.{m_date.group(2)}.{m_date.group(3)}"
        m_desc = re.search(r'property=["\']og:description["\']\s+content=["\']([^"\']+)["\']', a_html)
        if m_desc:
            # "| 내외경제TV=홍길동 기자 |" 같은 머리말 제거
            a_desc = re.sub(r"^\s*\|?[^|]*기자\s*\|\s*", "", clean_text(m_desc.group(1))).strip()
            if len(a_desc) > 30:
                summary = a_desc[:140].rstrip() + ("…" if len(a_desc) > 140 else "")
    except Exception as e:
        print(f"  (기사 페이지 메타 조회 실패: {e})")

    return {
        "press_link": press_link,
        "source": source,
        "summary": summary,
        "date": article_date,
    }

# 포트폴리오로 가져오는 블로그 카테고리 (기업 및 단체봉사 > 현장스케치)
PORTFOLIO_CATEGORY = "현장스케치"


def is_open_the_share_portfolio(title: str, category: str, desc: str) -> bool:
    """'현장스케치' 카테고리 글만 포트폴리오로 인정합니다. (칼럼·나눔전달후기·파트너 기업 소개 등 제외)"""
    return category.strip() == PORTFOLIO_CATEGORY


def summarize_story(desc: str, title: str) -> str:
    """
    프로젝트 스토리는 1~2문장 요약만 둡니다. (상세 내용은 블로그 원문 링크로)
    og:description 은 본문 앞부분이 잘린 문장이라, 이모지·말줄임을 걷어내고 최대 90자로 자릅니다.
    자동 요약이 어색하면 Supabase Table Editor(portfolio_items.story)에서 사람이 다듬습니다.
    """
    text = re.sub(r"[\U0001F300-\U0001FAFF☀-➿️♡♥★☆]", "", desc or "")
    text = re.sub(r"\s+", " ", text).strip().rstrip(".…").strip()
    if not text:
        return title
    if len(text) > 90:
        cut = text[:90]
        # 마지막 문장 끝(다/요/.)에서 자를 수 있으면 거기서 자름
        m = re.search(r"^(.*[다요]\.?)\s", cut)
        text = m.group(1) if m and len(m.group(1)) >= 30 else cut.rstrip() + "…"
    return text

def determine_metadata(title: str, desc: str):
    org_type = "단체봉사"
    group_keywords = ["학교", "중학교", "고등학교", "대학교", "RCY", "재단", "공공기관", "센터", "협회"]
    if any(k in title for k in group_keywords):
        org_type = "단체봉사"
    elif any(k in title for k in ["기업", "임직원", "주식회사", "(주)", "회사", "전자", "생명", "화재", "케미칼", "제약"]):
        org_type = "기업봉사"

    cat = "원데이메이킹"
    if "과학교실" in title or "STEAM" in title:
        cat = "찾아가는 과학교실"
    elif "업사이클링" in title or "공간" in title:
        cat = "스페이스 업사이클링"
    elif "친환경" in title or "플로깅" in title or "EM" in title:
        cat = "친환경 ESG"
    elif "김장" in title or "베이킹" in title or "나눔" in title:
        cat = "지역사회 나눔"

    partner = "OPEN THE SHARE"
    m_org = re.search(
        r"([가-힣A-Za-z0-9·]+(?:전자|생명|화재|화재서비스|케미칼|제약|바이오|메디칼|시스템즈|모빌리티|이노베이션|중학교|고등학교|대학교\s*RCY|대\s*RCY|대학교|학교|재단|진흥원|연구원|공사|공단|협회|복지관|아동센터|병원|그룹|은행|증권))",
        f"{title} {desc}"
    )
    if m_org:
        partner = m_org.group(1).strip()

    return org_type, cat, partner

# ---------------------------------------------------------------------------
# Supabase 콘텐츠 DB 연동
# ---------------------------------------------------------------------------

def load_content_source():
    with open(CONTENT_SOURCE_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    url = os.environ.get("CONTENT_SUPABASE_URL") or cfg["url"]
    key = os.environ.get("CONTENT_PUBLISHABLE_KEY") or cfg["publishableKey"]
    return url.rstrip("/"), key


def load_ingest_token() -> str:
    token = os.environ.get("CONTENT_INGEST_TOKEN", "").strip()
    if not token and os.path.exists(ENV_LOCAL_PATH):
        with open(ENV_LOCAL_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("CONTENT_INGEST_TOKEN="):
                    token = line.split("=", 1)[1].strip()
    if not token:
        raise SystemExit(
            "CONTENT_INGEST_TOKEN 이 없습니다. GitHub Actions 시크릿 또는 .env.local 에 등록하세요. (docs/harness/DATA_GUIDE.md)"
        )
    return token


def call_rpc(name: str, payload: dict):
    url, key = load_content_source()
    body = json.dumps({"p_token": load_ingest_token(), **payload}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/{name}",
        data=body,
        method="POST",
        headers={"apikey": key, "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Supabase RPC {name} 실패 ({e.code}): {detail}")


def ingest(payload: dict) -> None:
    portfolio = payload.get("portfolio", [])
    press = payload.get("press", [])
    if not portfolio and not press:
        print("Nothing to ingest.")
        return
    result = call_rpc("content_ingest", {"p_portfolio": portfolio, "p_press": press})
    print(f"Supabase 반영: 포트폴리오 {result.get('portfolio_inserted')}/{len(portfolio)}건, "
          f"언론보도 {result.get('press_inserted')}/{len(press)}건")
    if result.get("portfolio_inserted") != len(portfolio) or result.get("press_inserted") != len(press):
        print("⚠️ 일부는 이미 DB 에 있어(같은 id·log_no·link) 건너뛰었습니다.")


# ---------------------------------------------------------------------------
# 블로그 수집
# ---------------------------------------------------------------------------

def collect_new_posts() -> dict:
    """RSS 에서 DB 에 없는 새 포트폴리오·언론보도를 찾아 {portfolio: [...], press: [...]} 로 반환 (썸네일은 바로 저장)."""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Checking Naver Blog RSS feed...")

    req = urllib.request.Request(RSS_URL, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            xml_data = resp.read()
    except Exception as e:
        print(f"Error fetching RSS: {e}")
        return {"portfolio": [], "press": []}

    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError as e:
        print(f"Error parsing RSS XML: {e}")
        return {"portfolio": [], "press": []}
    items = root.findall(".//item")
    print(f"Found {len(items)} posts in RSS feed.")

    # 숨긴 글까지 포함한 DB 현재 상태 (숨긴 글을 다시 추가하지 않도록)
    state = call_rpc("content_state", {})
    existing_log_nos = set(int(x) for x in state.get("portfolio_log_nos", []))
    max_id = int(state.get("max_portfolio_id") or 0)
    existing_press_links = set(html.unescape(x) for x in state.get("press_links", []))
    print(f"Existing portfolio items in DB: {len(existing_log_nos)} posts (Max ID: {max_id}), press: {len(existing_press_links)}")

    new_portfolio = []
    new_press = []

    for item in items:
        link = item.findtext("link", "").strip()
        log_no = extract_log_no(link)
        title = item.findtext("title", "").strip()
        category = item.findtext("category", "").strip()
        pub_date_str = item.findtext("pubDate", "").strip()
        desc_rss = item.findtext("description", "").strip()

        # 1. 언론보도(보도자료) 포스트 처리
        if "보도자료" in category or "보도" in category or title.startswith("[보도자료]"):
            print(f"Potential press release post detected: [{log_no}] {title}")
            press_info = fetch_press_article_details(log_no)
            if not press_info or not press_info["press_link"]:
                print(f"-> Skipping: no direct external news article link in blog post {log_no}")
                continue
            if press_info["press_link"] in existing_press_links:
                continue

            # 날짜: 기사 보도일 > 블로그 게시일 > 오늘
            press_date = press_info.get("date") or ""
            if not press_date:
                try:
                    dt = datetime.strptime(pub_date_str[:16], "%a, %d %b %Y")
                    press_date = dt.strftime("%Y.%m.%d")
                except Exception:
                    press_date = datetime.now().strftime("%Y.%m.%d")

            clean_p_title = clean_text(title).replace("[보도자료]", "").strip()
            clean_p_title = re.sub(r'^\d{4}\.\d{2}\.\d{2}\.?\s*', '', clean_p_title)
            cat_name = "원데이메이킹"
            if "과학교실" in clean_p_title or "STEAM" in clean_p_title:
                cat_name = "찾아가는 과학교실"
            elif "흙공" in clean_p_title or "친환경" in clean_p_title or "ESG" in clean_p_title:
                cat_name = "친환경 ESG"
            elif "나눔" in clean_p_title or "김장" in clean_p_title:
                cat_name = "지역사회 나눔"

            new_press.append({
                "title": clean_p_title,
                "date": press_date,
                "source": press_info["source"],
                "category": cat_name,
                "summary": press_info["summary"] if press_info["summary"] else clean_p_title,
                "link": press_info["press_link"],
            })
            existing_press_links.add(press_info["press_link"])
            print(f"-> New press release: {clean_p_title} ({press_info['press_link']})")
            continue

        # 2. 나눔 포트폴리오 포스트 처리
        if not log_no or log_no in existing_log_nos:
            continue

        if not is_open_the_share_portfolio(title, category, desc_rss):
            continue

        print(f"New portfolio post detected: [{log_no}] {title}")
        details = fetch_post_details(log_no)
        if not details or not details["imageUrl"]:
            print(f"Skipping: could not extract image for {log_no}")
            continue

        try:
            dt = datetime.strptime(pub_date_str[:16], "%a, %d %b %Y")
            period = dt.strftime("%Y.%m.%d")
            year = dt.strftime("%Y")
        except Exception:
            period = datetime.now().strftime("%Y.%m.%d")
            year = datetime.now().strftime("%Y")

        max_id += 1
        local_filename = f"item_{max_id:03d}.jpg"
        local_path = os.path.join(PORTFOLIO_IMG_DIR, local_filename)

        try:
            img_req = urllib.request.Request(details["imageUrl"], headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://blog.naver.com/"
            })
            with urllib.request.urlopen(img_req, timeout=15) as img_resp:
                img_bytes = optimize_thumbnail(img_resp.read())
            os.makedirs(PORTFOLIO_IMG_DIR, exist_ok=True)
            with open(local_path, "wb") as f_img:
                f_img.write(img_bytes)
            print(f"Downloaded thumbnail -> {local_filename} ({len(img_bytes)} bytes)")
        except Exception as e:
            print(f"Failed to download image {details['imageUrl']}: {e}")
            max_id -= 1
            continue

        clean_tit = clean_text(title)
        clean_story = summarize_story(clean_text(details["desc"]), clean_tit)
        org_type, cat, partner = determine_metadata(clean_tit, clean_story)
        image_path = f"images/portfolio/{local_filename}"

        new_portfolio.append({
            "id": max_id,
            "log_no": log_no,
            "title": clean_tit,
            "category": cat,
            "org_type": org_type,
            "partner": clean_text(partner),
            "period": period,
            "year": year,
            "participants": 0,  # 0 = 인원 미확인 (화면에 표시 안 함). 블로그 원문 확인 후 Table Editor 에서 수정
            "image_path": image_path,
            "gallery_urls": [image_path] + details["gallery"],
            "tags": [org_type, cat, "사회공헌·나눔"],
            "story": clean_story,
            "blog_link": f"https://blog.naver.com/{BLOG_USER}/{log_no}",
        })
        existing_log_nos.add(log_no)

    return {"portfolio": new_portfolio, "press": new_press}


def main():
    args = sys.argv[1:]

    if "--ingest-pending" in args:
        if not os.path.exists(PENDING_PATH):
            print("No pending sync file. Nothing to ingest.")
            return
        with open(PENDING_PATH, "r", encoding="utf-8") as f:
            payload = json.load(f)
        ingest(payload)
        os.remove(PENDING_PATH)
        return

    payload = collect_new_posts()
    n_p, n_pr = len(payload["portfolio"]), len(payload["press"])
    if not n_p and not n_pr:
        print("No new posts or press releases. Website is up to date.")
        return

    if "--stage" in args:
        with open(PENDING_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"Staged {n_p} portfolio / {n_pr} press items -> .sync-pending.json")
        return

    ingest(payload)
    if n_p:
        print("👉 새 썸네일(public/images/portfolio/)을 커밋·push 해야 사이트에 이미지가 보입니다.")


if __name__ == "__main__":
    main()
