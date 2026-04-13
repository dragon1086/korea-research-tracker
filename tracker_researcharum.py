#!/usr/bin/env python3
"""
리서치알음 Tracker (JSON-only, DB-free)
- researcharum.com/report/small-cap-research-list.php 크롤링
- data/researcharum.json + web/public/researcharum.json으로 상태 관리
- 신규 종목 감지 → 텔레그램 알림
- 매일 전체 업데이트: latest_price, pct_change, peak, trough
"""

import os, re, json, logging, requests, urllib.parse
from bs4 import BeautifulSoup
from datetime import datetime, date, timezone
from pathlib import Path

# ── 환경변수 로드 ─────────────────────────────────────────────────
def _load_env():
    env_local = Path(__file__).parent / ".env.local"
    if env_local.exists():
        for line in env_local.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip("'\"")
                if key and val and key not in os.environ:
                    os.environ[key] = val
    zshrc = Path.home() / ".zshrc"
    if zshrc.exists():
        for line in zshrc.read_text().splitlines():
            line = line.strip()
            if line.startswith("export "):
                line = line[7:]
            if "=" in line and not line.startswith("#"):
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip("'\"")
                if key and val and key not in os.environ:
                    os.environ[key] = val

_load_env()

SCRAPER_API_KEY    = os.environ.get("SCRAPER_API_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "7726642089")

BASE_DIR  = Path(__file__).parent
DATA_FILE = BASE_DIR / "data" / "researcharum.json"
WEB_FILE  = BASE_DIR / "web" / "public" / "researcharum.json"
LOG_PATH  = BASE_DIR / "logs" / "tracker_researcharum.log"

LOG_PATH.parent.mkdir(exist_ok=True)
DATA_FILE.parent.mkdir(exist_ok=True)

BOARD_URL = "https://www.researcharum.com/report/small-cap-research-list.php"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(LOG_PATH)],
)
log = logging.getLogger(__name__)


# ── HTTP ──────────────────────────────────────────────────────────
def _fetch_with_fallback(url: str, timeout: int = 30) -> requests.Response:
    if SCRAPER_API_KEY:
        scraper_url = (
            f"https://api.scraperapi.com/"
            f"?api_key={SCRAPER_API_KEY}"
            f"&url={urllib.parse.quote(url, safe='')}"
            f"&country_code=kr"
        )
        r = requests.get(scraper_url, timeout=timeout)
        r.raise_for_status()
        return r
    log.info("ScraperAPI 키 없음 — 직접 연결 시도")
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    r.raise_for_status()
    return r


# ── JSON 로드/저장 ────────────────────────────────────────────────
def load_data() -> dict:
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"updated_at": "", "reports": []}

def save_data(data: dict):
    data["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    text = json.dumps(data, ensure_ascii=False, indent=2)
    DATA_FILE.write_text(text, encoding="utf-8")
    WEB_FILE.write_text(text, encoding="utf-8")
    log.info("JSON 저장: %d건", len(data["reports"]))


# ── 크롤링 ───────────────────────────────────────────────────────
def fetch_board(pages: int = 10) -> list[dict]:
    items = []
    seen: set[int] = set()
    index_re = re.compile(r"index_no=(\d+)")
    scode_re  = re.compile(r"scode=(\d+)")

    for page in range(1, pages + 1):
        url = BOARD_URL if page == 1 else f"{BOARD_URL}?page={page}"
        try:
            r = _fetch_with_fallback(url)
        except Exception as e:
            log.warning("fetch 실패 (page %d): %s — 중단", page, e)
            break

        soup = BeautifulSoup(r.text, "html.parser")
        found_any = False

        for li in soup.find_all("li"):
            # 날짜 확인
            date_div = li.find("div", class_="date")
            if not date_div:
                continue
            report_date = date_div.get_text(strip=True)
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", report_date):
                continue

            # 종목명 + 티커
            tit_div = li.find("div", class_="tit")
            if not tit_div:
                continue
            a_tag = tit_div.find("a", href=scode_re)
            if not a_tag:
                continue
            href = str(a_tag.get("href") or "")
            m = scode_re.search(href)
            if not m:
                continue
            ticker = m.group(1)
            link_text = a_tag.get_text(strip=True)  # "한국주강 (025890)"
            company = re.sub(r"\s*\(\d+\)\s*$", "", link_text).strip()

            # 제목
            sub_div = li.find("div", class_="sub")
            title = sub_div.get_text(" ", strip=True) if sub_div else ""

            # 고유 ID (index_no)
            index_no = None
            btn_area = li.find("div", class_="btn-area")
            if btn_area:
                for btn in btn_area.find_all("button"):
                    onclick = str(btn.get("onclick") or "")
                    m2 = index_re.search(onclick)
                    if m2:
                        index_no = int(m2.group(1))
                        break
            if index_no is None or index_no in seen:
                continue

            seen.add(index_no)
            found_any = True

            # 전망 + 적정주가
            outlook = None
            target_price = None
            bottom = li.find("div", class_="bottom-info-wrap")
            if bottom:
                for dl in bottom.find_all("dl"):
                    dt = dl.find("dt")
                    dd = dl.find("dd")
                    if not dt or not dd:
                        continue
                    dt_text = dt.get_text(strip=True)
                    dd_text = dd.get_text(strip=True)
                    if dt_text == "주가전망":
                        outlook = dd_text.lower()
                    elif dt_text == "적정주가":
                        price_m = re.search(r"[\d,]+", dd_text)
                        if price_m:
                            try:
                                target_price = int(price_m.group(0).replace(",", ""))
                            except ValueError:
                                pass

            items.append({
                "index_no":    index_no,
                "company":     company,
                "ticker":      ticker,
                "title":       title,
                "report_date": report_date,      # "2026-03-31"
                "outlook":     outlook,           # "positive" | "neutral" | "negative"
                "target_price": target_price,     # 정수 or None
                "url":         f"https://www.researcharum.com/report/small-cap-research-view.php?index_no={index_no}",
            })

        if not found_any:
            log.info("page %d: 항목 없음 — 크롤링 종료", page)
            break

    log.info("크롤링 완료: %d건", len(items))
    return items


# ── 주가 조회 (FinanceDataReader) ─────────────────────────────────
def get_ohlcv(ticker: str, from_date: str):
    try:
        import FinanceDataReader as fdr
        start = from_date.replace(".", "-")   # 이미 대시 형식이면 no-op
        end   = date.today().strftime("%Y-%m-%d")
        df = fdr.DataReader(ticker, start, end)
        return df if (df is not None and not df.empty) else None
    except Exception as e:
        log.warning("OHLCV 조회 실패 (%s): %s", ticker, e)
        return None

def calc_stats(df, base_price: float) -> dict:
    latest_price = float(df.iloc[-1]["Close"])
    pct_change   = round((latest_price - base_price) / base_price * 100, 2)

    high_df = df[df["High"] > 0]
    low_df  = df[df["Low"]  > 0]

    peak_idx   = high_df["High"].idxmax()
    peak_price = float(high_df["High"].max())
    peak_date  = str(peak_idx.date()) if hasattr(peak_idx, "date") else str(peak_idx)[:10]
    peak_pct   = round((peak_price - base_price) / base_price * 100, 2)

    trough_idx   = low_df["Low"].idxmin()
    trough_price = float(low_df["Low"].min())
    trough_date  = str(trough_idx.date()) if hasattr(trough_idx, "date") else str(trough_idx)[:10]
    trough_pct   = round((trough_price - base_price) / base_price * 100, 2)

    return {
        "latest_price": latest_price,
        "pct_change":   pct_change,
        "peak_price":   peak_price,
        "peak_date":    peak_date,
        "peak_pct":     peak_pct,
        "trough_price": trough_price,
        "trough_date":  trough_date,
        "trough_pct":   trough_pct,
        "last_updated": date.today().isoformat(),
    }


# ── 텔레그램 ─────────────────────────────────────────────────────
def send_telegram(text: str):
    if not TELEGRAM_BOT_TOKEN:
        log.warning("TELEGRAM_BOT_TOKEN 없음 — 스킵")
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": text,
                  "parse_mode": "HTML", "disable_web_page_preview": True},
            timeout=10,
        ).raise_for_status()
    except Exception as e:
        log.error("텔레그램 실패: %s", e)


# ── 메인 ─────────────────────────────────────────────────────────
def main():
    log.info("=== 리서치알음 Tracker 시작 ===")

    data = load_data()
    reports_map  = {r["index_no"]: r for r in data["reports"]}
    existing_ids = set(reports_map.keys())

    # 1) 신규 감지
    crawled   = fetch_board(pages=10)
    new_count = 0
    for item in crawled:
        if item["index_no"] in existing_ids:
            continue

        ticker = item["ticker"]
        df     = get_ohlcv(ticker, item["report_date"])

        if df is not None and not df.empty:
            base  = float(df.iloc[0]["Close"])
            stats = calc_stats(df, base)
        else:
            base, stats = None, {}

        log.info("신규: %s (%s), 작성일가: %s", item["company"], ticker, base)

        entry = {**item, "price_on_date": base, **stats}
        for key in ("latest_price", "pct_change", "peak_price", "peak_date",
                    "peak_pct", "trough_price", "trough_date", "trough_pct"):
            entry.setdefault(key, None)

        reports_map[item["index_no"]] = entry
        existing_ids.add(item["index_no"])
        new_count += 1

        outlook_emoji = {"positive": "📈", "neutral": "➡️", "negative": "📉"}.get(
            item.get("outlook", ""), "📋"
        )
        target_str = f"{item['target_price']:,}원" if item.get("target_price") else "-"
        price_str  = f"{base:,.0f}원" if base else "-"

        send_telegram(
            f"{outlook_emoji} <b>리서치알음 신규 리포트</b>\n\n"
            f"종목: <b>{item['company']}</b> (<b>{ticker}</b>)\n"
            f"제목: {item['title'][:60]}\n"
            f"작성일: {item['report_date']} | 전망: {item.get('outlook', '-')}\n"
            f"적정주가: {target_str} | 작성일 가격: {price_str}\n"
            f"🔗 <a href=\"{item['url']}\">리포트 보기</a>"
        )

    log.info("신규 종목: %d건", new_count)

    # 2) 전체 주가 업데이트
    updated = 0
    for entry in reports_map.values():
        ticker = entry.get("ticker")
        if not ticker:
            continue
        base = entry.get("price_on_date")
        df = get_ohlcv(ticker, entry["report_date"])
        if df is None:
            continue
        if not base:
            base = float(df.iloc[0]["Close"])
            entry["price_on_date"] = base
        stats = calc_stats(df, base)
        entry.update(stats)
        updated += 1

    log.info("주가 업데이트: %d건", updated)

    # 3) 저장 (report_date 내림차순)
    data["reports"] = sorted(
        reports_map.values(),
        key=lambda r: r["report_date"], reverse=True
    )
    save_data(data)
    log.info("=== 완료 ===")


if __name__ == "__main__":
    main()
