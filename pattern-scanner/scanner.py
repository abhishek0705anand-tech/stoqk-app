"""
Pattern Scanner — runs daily at 4pm after market close.
Uses TA-Lib to detect candlestick patterns in NSE stock data,
then calls the backend API to process each pattern through Agent 2.
"""

import os
import numpy as np
import pandas as pd
import talib
import httpx
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timedelta
import time

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# TA-Lib candlestick pattern functions
PATTERNS = {
    "Doji": talib.CDLDOJI,
    "Hammer": talib.CDLHAMMER,
    "Shooting Star": talib.CDLSHOOTINGSTAR,
    "Engulfing": talib.CDLENGULFING,
    "Morning Star": talib.CDLMORNINGSTAR,
    "Evening Star": talib.CDLEVENINGSTAR,
    "Three White Soldiers": talib.CDL3WHITESOLDIERS,
    "Three Black Crows": talib.CDL3BLACKCROWS,
    "Harami": talib.CDLHARAMI,
    "Marubozu": talib.CDLMARUBOZU,
    "Spinning Top": talib.CDLSPINNINGTOP,
    "Head and Shoulders": None,  # Handled separately as price pattern
    "Double Top": None,
    "Double Bottom": None,
    "Bullish Divergence": None,
}

CANDLE_PATTERNS = {k: v for k, v in PATTERNS.items() if v is not None}

def get_tickers(limit: int | None = None) -> list[str]:
    """
    Fetch tickers to scan from the DB.
    - If company_fundamentals has market_cap data, sort by it descending.
    - Otherwise fall back to all distinct tickers in stock_prices.
    - limit=None means scan all available tickers.
    """
    # Try to get tickers ordered by market cap (most liquid/important first)
    res = (
        supabase.table("company_fundamentals")
        .select("ticker, market_cap_cr")
        .order("market_cap_cr", desc=True)
        .execute()
    )
    if res.data:
        tickers = [row["ticker"] for row in res.data if row["ticker"]]
        if limit:
            tickers = tickers[:limit]
        print(f"  Loaded {len(tickers)} tickers from company_fundamentals (sorted by market cap)")
        return tickers

    # Fallback: all tickers with recent price data
    res = (
        supabase.table("stock_prices")
        .select("ticker")
        .order("date", desc=True)
        .limit(5000)
        .execute()
    )
    seen = set()
    tickers = []
    for row in (res.data or []):
        t = row["ticker"]
        if t not in seen:
            seen.add(t)
            tickers.append(t)
    if limit:
        tickers = tickers[:limit]
    print(f"  Loaded {len(tickers)} tickers from stock_prices")
    return tickers


def get_ohlcv(ticker: str, days: int = 180) -> pd.DataFrame | None:
    """Fetch OHLCV from Supabase stock_prices table."""
    cutoff = (datetime.now() - timedelta(days=days)).date().isoformat()
    res = (
        supabase.table("stock_prices")
        .select("date,open,high,low,close,volume")
        .eq("ticker", ticker)
        .gte("date", cutoff)
        .order("date")
        .execute()
    )
    if not res.data:
        return None
    df = pd.DataFrame(res.data)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").astype(float)
    return df


def detect_patterns(df: pd.DataFrame) -> list[tuple[str, int]]:
    """Run all TA-Lib candle patterns. Returns list of (pattern_name, signal_strength)."""
    o = df["open"].values
    h = df["high"].values
    lo = df["low"].values
    c = df["close"].values

    detected = []
    for name, func in CANDLE_PATTERNS.items():
        try:
            result = func(o, h, lo, c)
            # result[-1] is the signal for the most recent candle
            if result[-1] != 0:
                detected.append((name, int(result[-1])))
        except Exception as e:
            print(f"Error in {name}: {e}")
    return detected


def compute_historical_stats(df: pd.DataFrame, pattern_dates: list[str]) -> tuple[float, float]:
    """
    Given dates where a pattern was detected, compute historical win rate
    and average move over the next 30 days.
    """
    wins = 0
    moves = []
    for date_str in pattern_dates:
        try:
            idx = df.index.get_loc(pd.Timestamp(date_str))
            future_idx = idx + 30
            if future_idx < len(df):
                entry_price = df["close"].iloc[idx]
                exit_price = df["close"].iloc[future_idx]
                move = ((exit_price - entry_price) / entry_price) * 100
                moves.append(move)
                if move > 0:
                    wins += 1
        except (KeyError, IndexError):
            pass

    total = len(moves)
    win_rate = (wins / total * 100) if total > 0 else 0.0
    avg_move = float(np.mean(moves)) if moves else 0.0
    return round(win_rate, 1), round(avg_move, 2)


def call_pattern_agent(ticker: str, pattern_name: str, ohlcv_rows: list[dict]) -> dict | None:
    """Call the backend API to have Agent 2 generate the plain English explanation."""
    try:
        resp = httpx.post(
            f"{BACKEND_URL}/api/v1/internal/analyze-pattern",
            json={"ticker": ticker, "pattern_name": pattern_name, "ohlcv": ohlcv_rows},
            headers={"x-internal-key": os.environ.get("INTERNAL_API_KEY", "dev")},
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"Error calling pattern agent for {ticker} {pattern_name}: {e}")
    return None


def scan_ticker(ticker: str) -> int:
    """Scan one ticker for patterns. Returns number of patterns saved."""
    df = get_ohlcv(ticker)
    if df is None or len(df) < 30:
        return 0

    detected = detect_patterns(df)
    if not detected:
        return 0

    saved = 0
    for pattern_name, signal_strength in detected:
        # Compute historical stats using all historical occurrences
        func = CANDLE_PATTERNS[pattern_name]
        o, h, lo, c = df["open"].values, df["high"].values, df["low"].values, df["close"].values
        history = func(o, h, lo, c)
        hist_dates = [str(df.index[i].date()) for i, v in enumerate(history) if v != 0]
        win_rate, avg_move = compute_historical_stats(df, hist_dates[:-1])  # exclude current

        # Recent OHLCV for agent
        recent = df.tail(30).reset_index()
        ohlcv_rows = recent.rename(columns={"date": "date"}).to_dict("records")
        for row in ohlcv_rows:
            row["date"] = str(row["date"].date())

        # Save to DB (the backend job handles calling Agent 2)
        res = supabase.table("chart_patterns").upsert({
            "ticker": ticker,
            "pattern_name": pattern_name,
            "detected_at": datetime.utcnow().isoformat(),
            "plain_explanation": f"TA-Lib detected a {pattern_name} pattern. Analysis pending.",
            "what_to_watch": "Analysis pending.",
            "historical_win_rate": win_rate,
            "avg_move_pct": avg_move,
        }).execute()

        if res.data:
            saved += 1
            print(f"  {ticker}: {pattern_name} (score: {signal_strength}, win: {win_rate}%)")

        time.sleep(0.1)  # Gentle rate limit

    return saved


def main():
    import argparse
    parser = argparse.ArgumentParser(description="NSE chart pattern scanner")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max tickers to scan (default: all). Top N by market cap.")
    args = parser.parse_args()

    print(f"Pattern scanner starting at {datetime.now().isoformat()}")
    tickers = get_tickers(limit=args.limit)
    total = len(tickers)
    total_saved = 0

    for i, ticker in enumerate(tickers):
        print(f"[{i+1}/{total}] Scanning {ticker}...")
        saved = scan_ticker(ticker)
        total_saved += saved
        time.sleep(0.3)  # Rate limit between tickers

    print(f"\nDone. {total_saved} patterns detected and saved across {total} tickers.")


if __name__ == "__main__":
    main()
