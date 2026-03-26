import YahooFinance from "yahoo-finance2";
import { supabase } from "./supabase.js";

const yahoo = new YahooFinance();

/**
 * Fetches fundamentals for a stock from Yahoo Finance (API approach).
 */
export async function fetchFundamentalsFromYahoo(ticker: string): Promise<{
  pe?: number;
  roe?: number;
  debt_equity?: number;
  revenue_growth_pct?: number;
  promoter_holding_pct?: number;
  pledge_pct?: number;
  market_cap_cr?: number;
  sector?: string;
} | null> {
  try {
    // Yahoo uses .NS for NSE stocks
    const yahooTicker = ticker.endsWith(".NS") ? ticker : `${ticker}.NS`;
    const result = await yahoo.quoteSummary(yahooTicker, {
      modules: ["defaultKeyStatistics", "financialData", "summaryDetail", "summaryProfile"]
    });

    if (!result) return null;

    const stats = result.defaultKeyStatistics;
    const fin = result.financialData;
    const detail = result.summaryDetail;
    const profile = (result as any).summaryProfile;

    // Convert values
    // market_cap_cr: detail.marketCap is in absolute INR. Divide by 1Cr (10^7)
    const market_cap_cr = detail?.marketCap ? Math.round(detail.marketCap / 10000000) : undefined;
    
    // PE Ratio
    const pe = detail?.trailingPE || detail?.forwardPE || stats?.forwardPE;

    // ROE (Return on Equity)
    const roe = (fin as any)?.returnOnEquity ? (fin as any).returnOnEquity * 100 : undefined;

    // Debt to Equity
    const debt_equity = fin?.debtToEquity ? fin.debtToEquity / 100 : undefined;

    // Revenue Growth (0.104 -> 10.4)
    const revenue_growth_pct = fin?.revenueGrowth ? fin.revenueGrowth * 100 : undefined;

    // Promoter Holding (0.51 -> 51.0)
    const promoter_holding_pct = stats?.heldPercentInsiders ? stats.heldPercentInsiders * 100 : undefined;

    // Pledge pct is not directly available in Yahoo Finance
    const pledge_pct = undefined;

    const sector = profile?.sector;

    return {
      pe,
      roe,
      debt_equity,
      revenue_growth_pct,
      promoter_holding_pct,
      pledge_pct,
      market_cap_cr,
      sector,
    };
  } catch (err) {
    if ((err as any).name === 'HTTPError' && (err as any).response?.statusCode === 404) {
        // Ticker not found on Yahoo with .NS suffix — try without or just skip
        console.warn(`[fundamentals] ${ticker} not found on Yahoo Finance`);
    } else {
        console.error(`[fundamentals] Yahoo error for ${ticker}:`, err);
    }
    return null;
  }
}

/**
 * Updates a batch of stocks in company_fundamentals.
 */
export async function syncBatchFundamentals(tickers: string[]): Promise<number> {
  let count = 0;
  for (const ticker of tickers) {
    const data = await fetchFundamentalsFromYahoo(ticker);
    if (!data) continue;

    const { error } = await supabase.from("company_fundamentals").upsert({
      ticker,
      ...data,
      updated_at: new Date().toISOString(),
    });

    if (error) {
        console.error(`[fundamentals] DB error for ${ticker}:`, error.message);
    } else {
        count++;
    }
    
    // Rate limit for Yahoo (more lenient than Screener scraper but good to have)
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return count;
}
