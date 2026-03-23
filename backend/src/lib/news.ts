// News fetcher: NSE corporate announcements + NewsAPI headlines

export interface NewsItem {
  id: string;
  ticker: string;
  headline: string;
  source: string;
  source_type: "announcement" | "news";
  url: string | null;
  published_at: string;
  summary: string | null;
}

// NSE session cookie (shared, refreshed per request)
let nseCookie = "";
let nseLastInit = 0;

async function ensureNSESession() {
  if (Date.now() - nseLastInit < 5 * 60 * 1000) return; // reuse for 5 min
  try {
    const res = await fetch("https://www.nseindia.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });
    nseCookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    nseLastInit = Date.now();
    await new Promise((r) => setTimeout(r, 800));
  } catch {
    // ignore session errors
  }
}

export async function fetchNSEAnnouncements(ticker: string): Promise<NewsItem[]> {
  try {
    await ensureNSESession();
    const res = await fetch(
      `https://www.nseindia.com/api/top-corp-info?symbol=${ticker}&market=equities`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, */*",
          Referer: "https://www.nseindia.com/",
          Cookie: nseCookie,
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) return [];
    const data = await res.json() as {
      corporate?: Array<{
        subject: string;
        bcastDt?: string;
        attchmntText?: string;
        filingType?: string;
      }>;
    };

    return (data.corporate || []).slice(0, 8).map((item, i) => ({
      id: `nse-${ticker}-${i}-${item.bcastDt || ""}`,
      ticker,
      headline: item.subject || "Corporate announcement",
      source: "NSE",
      source_type: "announcement" as const,
      url: `https://www.nseindia.com/companies-listing/corporate-filings-announcements`,
      published_at: item.bcastDt || new Date().toISOString(),
      summary: item.attchmntText || item.filingType || null,
    }));
  } catch {
    return [];
  }
}

export async function fetchNewsHeadlines(ticker: string, companyName: string): Promise<NewsItem[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];

  try {
    const query = encodeURIComponent(`${companyName} OR ${ticker} stock NSE India`);
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&from=${from}&sortBy=publishedAt&language=en&pageSize=8&apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return [];
    const data = await res.json() as {
      articles?: Array<{
        title: string;
        source: { name: string };
        url: string;
        publishedAt: string;
        description: string | null;
      }>;
    };

    return (data.articles || []).slice(0, 8).map((a, i) => ({
      id: `news-${ticker}-${i}-${a.publishedAt}`,
      ticker,
      headline: a.title,
      source: a.source?.name || "NewsAPI",
      source_type: "news" as const,
      url: a.url,
      published_at: a.publishedAt,
      summary: a.description,
    }));
  } catch {
    return [];
  }
}

// Company name lookup for NSE tickers
const COMPANY_NAMES: Record<string, string> = {
  RELIANCE: "Reliance Industries", TCS: "Tata Consultancy Services",
  HDFCBANK: "HDFC Bank", INFY: "Infosys", ICICIBANK: "ICICI Bank",
  HINDUNILVR: "Hindustan Unilever", SBIN: "State Bank India",
  BAJFINANCE: "Bajaj Finance", BHARTIARTL: "Bharti Airtel",
  KOTAKBANK: "Kotak Mahindra Bank", AXISBANK: "Axis Bank",
  LT: "Larsen Toubro", HCLTECH: "HCL Technologies",
  WIPRO: "Wipro", SUNPHARMA: "Sun Pharmaceutical",
  TATAMOTORS: "Tata Motors", NTPC: "NTPC", POWERGRID: "Power Grid",
  ADANIPORTS: "Adani Ports", TATASTEEL: "Tata Steel",
  MARUTI: "Maruti Suzuki", ONGC: "ONGC", TECHM: "Tech Mahindra",
  HINDALCO: "Hindalco", DRREDDY: "Dr Reddys", DIVISLAB: "Divis Lab",
  BAJAJ_AUTO: "Bajaj Auto", CIPLA: "Cipla", NESTLEIND: "Nestle India",
  BRITANNIA: "Britannia Industries", ITC: "ITC", HEROMOTOCO: "Hero MotoCorp",
  JSWSTEEL: "JSW Steel", ASIANPAINT: "Asian Paints", ULTRACEMCO: "UltraTech Cement",
};

export function getCompanyName(ticker: string): string {
  return COMPANY_NAMES[ticker] || ticker;
}
