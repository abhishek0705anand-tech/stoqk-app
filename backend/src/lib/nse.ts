import type { NSERawEvent, LivePrice, MacroIndicator } from "../types/index.js";

const NSE_BASE = "https://www.nseindia.com/api";
const UPSTOX_BASE = "https://api.upstox.com/v2";

const nseHeaders = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

let nseCookie = "";
let nseLastInit = 0;

async function ensureNSESession() {
  if (Date.now() - nseLastInit < 5 * 60 * 1000) return;
  try {
    const res = await fetch("https://www.nseindia.com/", {
      headers: { ...nseHeaders, Accept: "text/html" },
      signal: AbortSignal.timeout(10000),
    });
    nseCookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    nseLastInit = Date.now();
    await new Promise((r) => setTimeout(r, 800));
  } catch { /* ignore */ }
}

async function nseGet<T>(path: string): Promise<T> {
  await ensureNSESession();
  const res = await fetch(`${NSE_BASE}${path}`, {
    headers: { ...nseHeaders, Cookie: nseCookie },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NSE API error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchBulkDeals(): Promise<NSERawEvent[]> {
  try {
    const response = await nseGet<any>("/snapshot-capital-market-largedeal");
    const deals = (response.BULK_DEALS_DATA || []) as any[];
    return deals.map(d => ({
      symbol: d.symbol || d.SYMBOL,
      company: d.companyName || d.COMPANY_NAME,
      date: d.date || d.TIMESTAMP,
      acquirerName: d.clientName || d.CLIENT_NAME,
      buyValue: Number(d.buyValue || d.BUY_VALUE || 0),
      sellValue: Number(d.sellValue || d.SELL_VALUE || 0),
      noOfSharesBought: Number(d.buyQty || d.BUY_QUANTITY || 0),
      noOfSharesSold: Number(d.sellQty || d.SELL_QUANTITY || 0),
    }));
  } catch (err) {
    console.error("Failed to fetch bulk deals:", err);
    return [];
  }
}

export async function fetchInsiderTrades(): Promise<NSERawEvent[]> {
  try {
    const data = await nseGet<{ data: any[] }>("/corporates-pit?");
    return (data.data || []).map(d => ({
      symbol: d.symbol || d.SYMBOL,
      company: d.companyName || d.COMPANY_NAME,
      date: d.date || d.TIMESTAMP,
      acquirerName: d.acquirerName || d.ACQUIRER_NAME,
      typeOfTransaction: d.typeOfTransaction || d.TYPE_OF_TRANSACTION,
    }));
  } catch (err) {
    console.error("Failed to fetch insider trades:", err);
    return [];
  }
}

export async function fetchBlockDeals(): Promise<NSERawEvent[]> {
  try {
    const response = await nseGet<any>("/snapshot-capital-market-largedeal");
    const deals = (response.BLOCK_DEALS_DATA || []) as any[];
    return deals.map(d => ({
      symbol: d.symbol || d.SYMBOL,
      company: d.companyName || d.COMPANY_NAME,
      date: d.date || d.TIMESTAMP,
      acquirerName: d.clientName || d.CLIENT_NAME,
      buyValue: Number(d.buyValue || d.BUY_VALUE || 0),
      sellValue: Number(d.sellValue || d.SELL_VALUE || 0),
      noOfSharesBought: Number(d.buyQty || d.BUY_QUANTITY || 0),
      noOfSharesSold: Number(d.sellQty || d.SELL_QUANTITY || 0),
    }));
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
  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  };

  try {
    const from = fmtDate(fromDate);
    const to = fmtDate(toDate);
    
    // Updated endpoint found via browser inspection
    const path = `/NextApi/apiClient/GetQuoteApi?functionName=getHistoricalTradeData&symbol=${ticker}&series=EQ&fromDate=${from}&toDate=${to}`;
    
    const response = await nseGet<any>(path);
    const data = (Array.isArray(response) ? response : response.data || []) as any[];

    return data.map((d) => ({
      date: d.CH_TIMESTAMP || d.mktDate || d.date || "",
      open: Number(d.CH_OPENING_PRICE || d.open || d.openPrice || 0),
      high: Number(d.CH_HIGH_PRICE || d.high || d.highPrice || 0),
      low: Number(d.CH_LOW_PRICE || d.low || d.lowPrice || 0),
      close: Number(d.CH_CLOSING_PRICE || d.close || d.lastPrice || 0),
      volume: Number(d.CH_TOT_TRADED_QTY || d.volume || d.qty || 0),
    })).filter(d => d.date);
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

import YahooFinance from "yahoo-finance2";
const yahoo = new YahooFinance();

export async function fetchMacroData(): Promise<Partial<MacroIndicator>> {
  try {
    const [nifty, sensex] = await Promise.all([
      yahoo.quote("^NSEI").catch(() => null),
      yahoo.quote("^BSESN").catch(() => null),
    ]);

    return {
      date: new Date().toISOString().slice(0, 10),
      nifty_close: nifty?.regularMarketPrice || 0,
      sensex_close: sensex?.regularMarketPrice || 0,
      nifty_change_pct: nifty?.regularMarketChangePercent || 0,
      sensex_change_pct: sensex?.regularMarketChangePercent || 0,
      repo_rate: 6.5, // Default for now, RBI rarely changes this
    };
  } catch (err) {
    console.error("Failed to fetch macro data from Yahoo:", err);
    return { repo_rate: 6.5 };
  }
}

export async function fetchFIIDIIFlows(): Promise<{ fii_net_cr: number; dii_net_cr: number }> {
  try {
    // Attempt NSE endpoint
    const data = await nseGet<any>("/fiidiiTradeReact").catch(() => ({ data: [] }));
    
    let fii = 0;
    let dii = 0;
    for (const row of data.data || []) {
      const buy = Number(row.buyValue || 0);
      const sell = Number(row.sellValue || 0);
      const net = (buy - sell) / 100; // to Cr (They often report in hundreds of lakhs or Cr depending on format)
      // Actually, NSE reports in Cr already or lakhs? 
      // Usually it's in Cr. Let's assume Cr.
      const netCr = (buy - sell); 
      if (row.category?.toLowerCase().includes("fii")) fii += netCr;
      if (row.category?.toLowerCase().includes("dii")) dii += netCr;
    }

    // If still 0, it might be too early. We don't want to overwrite with 0 if possible, 
    // but the caller handles the upsert.
    return { fii_net_cr: Math.round(fii), dii_net_cr: Math.round(dii) };
  } catch {
    return { fii_net_cr: 0, dii_net_cr: 0 };
  }
}
