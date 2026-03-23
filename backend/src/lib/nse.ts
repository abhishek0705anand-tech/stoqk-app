import type { NSERawEvent, LivePrice, MacroIndicator } from "../types/index.js";

const NSE_BASE = "https://www.nseindia.com/api";
const UPSTOX_BASE = "https://api.upstox.com/v2";

const nseHeaders = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

async function nseGet<T>(path: string): Promise<T> {
  const res = await fetch(`${NSE_BASE}${path}`, {
    headers: nseHeaders,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NSE API error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchBulkDeals(): Promise<NSERawEvent[]> {
  try {
    const data = await nseGet<{ data: NSERawEvent[] }>("/bulk-deals");
    return data.data || [];
  } catch (err) {
    console.error("Failed to fetch bulk deals:", err);
    return [];
  }
}

export async function fetchInsiderTrades(): Promise<NSERawEvent[]> {
  try {
    const data = await nseGet<{ data: NSERawEvent[] }>("/insider-trading");
    return data.data || [];
  } catch (err) {
    console.error("Failed to fetch insider trades:", err);
    return [];
  }
}

export async function fetchBlockDeals(): Promise<NSERawEvent[]> {
  try {
    const data = await nseGet<{ data: NSERawEvent[] }>("/block-deals");
    return data.data || [];
  } catch (err) {
    console.error("Failed to fetch block deals:", err);
    return [];
  }
}

export async function fetchOHLCV(
  ticker: string,
  fromDate: string,
  toDate: string
): Promise<Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>> {
  try {
    const data = await nseGet<{
      data: Array<{
        CH_TIMESTAMP: string;
        CH_OPENING_PRICE: number;
        CH_HIGH_PRICE: number;
        CH_LOW_PRICE: number;
        CH_CLOSING_PRICE: number;
        CH_TOT_TRADED_QTY: number;
      }>;
    }>(`/historical/cm/equity?symbol=${ticker}&series=["EQ"]&from=${fromDate}&to=${toDate}`);

    return (data.data || []).map((d) => ({
      date: d.CH_TIMESTAMP,
      open: d.CH_OPENING_PRICE,
      high: d.CH_HIGH_PRICE,
      low: d.CH_LOW_PRICE,
      close: d.CH_CLOSING_PRICE,
      volume: d.CH_TOT_TRADED_QTY,
    }));
  } catch (err) {
    console.error(`Failed to fetch OHLCV for ${ticker}:`, err);
    return [];
  }
}

export async function fetchLivePrices(tickers: string[]): Promise<LivePrice[]> {
  if (!tickers.length) return [];

  try {
    // Upstox batch quotes
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;
    if (!accessToken) {
      // Fallback: NSE quote API
      return await fetchNSEQuotes(tickers);
    }

    const instruments = tickers.map((t) => `NSE_EQ|${t}`).join(",");
    const res = await fetch(`${UPSTOX_BASE}/market-quote/quotes?instrument_key=${instruments}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return await fetchNSEQuotes(tickers);

    const json = await res.json() as { data: Record<string, { last_price: number; net_change: number; volume: number }> };
    return Object.entries(json.data).map(([key, q]) => ({
      ticker: key.replace("NSE_EQ|", ""),
      price: q.last_price,
      change_pct: q.net_change,
      volume: q.volume,
      timestamp: new Date().toISOString(),
    }));
  } catch (err) {
    console.error("Failed to fetch live prices:", err);
    return [];
  }
}

async function fetchNSEQuotes(tickers: string[]): Promise<LivePrice[]> {
  const prices: LivePrice[] = [];
  for (const ticker of tickers.slice(0, 20)) {
    try {
      const data = await nseGet<{
        priceInfo: { lastPrice: number; change: number; pChange: number };
        securityInfo: { tradedVolume: number };
      }>(`/quote-equity?symbol=${ticker}`);

      prices.push({
        ticker,
        price: data.priceInfo.lastPrice,
        change_pct: data.priceInfo.pChange,
        volume: data.securityInfo.tradedVolume,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // skip individual failures
    }
  }
  return prices;
}

export async function fetchMacroData(): Promise<Partial<MacroIndicator>> {
  try {
    const nifty = await nseGet<{ data: Array<{ indexSymbol: string; last: number; percentChange: number }> }>(
      "/allIndices"
    );

    const niftyData = nifty.data?.find((d) => d.indexSymbol === "NIFTY 50");
    const sensexData = nifty.data?.find((d) => d.indexSymbol === "SENSEX");

    return {
      date: new Date().toISOString().slice(0, 10),
      nifty_close: niftyData?.last || 0,
      sensex_close: sensexData?.last || 0,
      nifty_change_pct: niftyData?.percentChange || 0,
      sensex_change_pct: sensexData?.percentChange || 0,
    };
  } catch (err) {
    console.error("Failed to fetch macro data:", err);
    return {};
  }
}

export async function fetchFIIDIIFlows(): Promise<{ fii_net_cr: number; dii_net_cr: number }> {
  try {
    const data = await nseGet<{
      data: Array<{ buyValue: number; sellValue: number; category: string }>;
    }>("/fiidiiTradeReact");

    let fii = 0;
    let dii = 0;
    for (const row of data.data || []) {
      const net = (row.buyValue - row.sellValue) / 10000000; // to crores
      if (row.category?.toLowerCase().includes("fii")) fii += net;
      if (row.category?.toLowerCase().includes("dii")) dii += net;
    }
    return { fii_net_cr: Math.round(fii), dii_net_cr: Math.round(dii) };
  } catch {
    return { fii_net_cr: 0, dii_net_cr: 0 };
  }
}
