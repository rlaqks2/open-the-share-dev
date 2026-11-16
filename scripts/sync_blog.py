"""
@file sync_blog.py
@description 네이버 공식 블로그(https://blog.naver.com/5penthe)에서 새로운 글을 탐지하여
1) 포트폴리오: 블로그 '현장스케치' 카테고리 글만 수집 → 썸네일 다운로드 → src/data/mockData.ts 에 시간순 정렬 반영
2) 언론보도: '보도자료' 글에서 실제 언론사 원문 기사 URL 을 추출해 pressReleases 에 반영

⚠️ 이 스크립트는 mockData.ts 의 아래 두 "마커" 문자열에 의존합니다. 절대 이름/들여쓰기를 바꾸지 마세요.
   - "  portfolioItems: ["
   - "  ] as PortfolioItem[],"
   (docs/harness/DATA_GUIDE.md 참고)

로컬 실행:  python scripts/sync_blog.py   (pillow 설치 시 썸네일 자동 리사이즈: pip install pillow)
"""

import os
import re
import html
import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

# 프로젝트 루트 경로
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MOCKDATA_PATH = os.path.join(ROOT_DIR, "src", "data", "mockData.ts")
PORTFOLIO_IMG_DIR = os.path.join(ROOT_DIR, "public", "images", "portfolio")

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
    자동 요약이 어색하면 mockData.ts 에서 사람이 다듬습니다.
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

def sort_mockdata_portfolio_items(mock_txt: str) -> str:
    s_idx = mock_txt.find("  portfolioItems: [")
    if s_idx == -1:
        return mock_txt
    e_idx = mock_txt.find("  ] as PortfolioItem[],", s_idx)
    if e_idx == -1:
        return mock_txt

    header_part = mock_txt[:s_idx + len("  portfolioItems: [")]
    body_part = mock_txt[s_idx + len("  portfolioItems: ["):e_idx]
    footer_part = mock_txt[e_idx:]

    item_blocks = re.findall(r"(\s*\{\s*id:\s*\d+[\s\S]*?\n\s*\})(?:,|\s*$)", body_part)
    if not item_blocks:
        return mock_txt

    def get_period(block: str) -> str:
        m = re.search(r'period:\s*"([^"]+)"', block)
        return m.group(1) if m else "0000.00.00"

    item_blocks_sorted = sorted(item_blocks, key=get_period, reverse=True)
    new_body = ",\n".join(b.rstrip() for b in item_blocks_sorted) + "\n"
    return header_part + "\n" + new_body + footer_part

def main():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Checking Naver Blog RSS feed...")
    
    req = urllib.request.Request(RSS_URL, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            xml_data = resp.read()
    except Exception as e:
        print(f"Error fetching RSS: {e}")
        return

    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError as e:
        print(f"Error parsing RSS XML: {e}")
        return
    items = root.findall(".//item")
    print(f"Found {len(items)} posts in RSS feed.")

    mock_txt = open(MOCKDATA_PATH, "r", encoding="utf-8").read()
    existing_log_nos = set(int(x) for x in re.findall(r"logNo:\s*(\d+)", mock_txt))
    # 포트폴리오 블록 안의 id 만 집계 (pressReleases/faqs 등 다른 배열의 id 와 섞이지 않도록)
    p_start = mock_txt.find("  portfolioItems: [")
    p_end = mock_txt.find("  ] as PortfolioItem[],", p_start)
    portfolio_block = mock_txt[p_start:p_end] if p_start != -1 and p_end != -1 else mock_txt
    existing_ids = [int(x) for x in re.findall(r"\bid:\s*(\d+)", portfolio_block)]
    max_id = max(existing_ids) if existing_ids else 110

    # 기존 언론보도 링크 확인 (중복 등록 방지 — 이스케이프 여부와 무관하게 비교)
    existing_press_links = set(html.unescape(x) for x in re.findall(r'link:\s*"([^"]+)"', mock_txt))
    # 언론보도 id 는 React key 로 쓰이므로 반드시 고유해야 함 (예전엔 전부 999 로 들어가 화면이 꼬였음)
    pr_start = mock_txt.find("pressReleases: [")
    pr_end = mock_txt.find("] as PressReleaseItem[]", pr_start)
    press_block = mock_txt[pr_start:pr_end] if pr_start != -1 and pr_end != -1 else ""
    press_ids = [int(x) for x in re.findall(r"\bid:\s*(\d+)", press_block) if int(x) != 999]
    max_press_id = max(press_ids) if press_ids else 0

    print(f"Existing portfolio items in mockData: {len(existing_log_nos)} posts (Max ID: {max_id})")

    new_portfolio_entries = []
    new_press_entries = []

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

            press_summary = press_info["summary"] if press_info["summary"] else clean_p_title

            max_press_id += 1
            press_entry = f"""    {{
      id: {max_press_id},
      title: {json.dumps(clean_p_title, ensure_ascii=False)},
      date: {json.dumps(press_date, ensure_ascii=False)},
      source: {json.dumps(press_info['source'], ensure_ascii=False)},
      category: {json.dumps(cat_name, ensure_ascii=False)},
      summary: {json.dumps(press_summary, ensure_ascii=False)},
      link: {json.dumps(press_info['press_link'], ensure_ascii=False)}
    }},"""
            new_press_entries.append(press_entry)
            existing_press_links.add(press_info["press_link"])
            print(f"-> Added new press release item: {clean_p_title} ({press_info['press_link']})")
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
            with open(local_path, "wb") as f_img:
                f_img.write(img_bytes)
            print(f"Downloaded thumbnail -> {local_filename} ({len(img_bytes)} bytes)")
        except Exception as e:
            print(f"Failed to download image {details['imageUrl']}: {e}")
            continue

        clean_tit = clean_text(title)
        clean_story = summarize_story(clean_text(details["desc"]), clean_tit)
        org_type, cat, partner = determine_metadata(clean_tit, clean_story)

        gal_urls = [f"`${{BASE_URL}}images/portfolio/{local_filename}`"]
        for g in details["gallery"]:
            gal_urls.append(json.dumps(g, ensure_ascii=False))

        entry_code = f"""    {{
      id: {max_id},
      logNo: {log_no},
      title: {json.dumps(clean_tit, ensure_ascii=False)},
      category: {json.dumps(cat, ensure_ascii=False)},
      orgType: {json.dumps(org_type, ensure_ascii=False)},
      partner: {json.dumps(clean_text(partner), ensure_ascii=False)},
      period: {json.dumps(period, ensure_ascii=False)},
      year: {json.dumps(year, ensure_ascii=False)},
      participants: 30,
      imageUrl: `${{BASE_URL}}images/portfolio/{local_filename}`,
      galleryUrls: [{', '.join(gal_urls)}],
      tags: [{json.dumps(org_type, ensure_ascii=False)}, {json.dumps(cat, ensure_ascii=False)}, "사회공헌·나눔"],
      story: {json.dumps(clean_story, ensure_ascii=False)},
      blogLink: {json.dumps(f"https://blog.naver.com/{BLOG_USER}/{log_no}", ensure_ascii=False)}
    }},"""

        new_portfolio_entries.append(entry_code)

    has_changes = False
    updated_mock = mock_txt

    # 포트폴리오 삽입
    if new_portfolio_entries:
        target_needle = "portfolioItems: ["
        pos = updated_mock.find(target_needle)
        if pos != -1:
            insert_pos = pos + len(target_needle)
            updated_mock = (
                updated_mock[:insert_pos]
                + "\n"
                + "\n".join(new_portfolio_entries)
                + updated_mock[insert_pos:]
            )
            updated_mock = sort_mockdata_portfolio_items(updated_mock)
            has_changes = True

    # 언론보도 삽입
    if new_press_entries:
        target_press_needle = "pressReleases: ["
        pos_press = updated_mock.find(target_press_needle)
        if pos_press != -1:
            insert_pos_press = pos_press + len(target_press_needle)
            updated_mock = (
                updated_mock[:insert_pos_press]
                + "\n"
                + "\n".join(new_press_entries)
                + updated_mock[insert_pos_press:]
            )
            # Re-index ids
            has_changes = True

    if has_changes:
        with open(MOCKDATA_PATH, "w", encoding="utf-8") as f:
            f.write(updated_mock)
        print("Successfully updated mockData.ts with new blog and press releases!")
    else:
        print("No new posts or press releases to update. Website is up to date.")

if __name__ == "__main__":
    main()
