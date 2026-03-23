import { Hono } from "hono";
import { fetchNSEAnnouncements, fetchNewsHeadlines, getCompanyName } from "../lib/news.js";

const news = new Hono();

// GET /news/:ticker — NSE announcements + news headlines combined
news.get("/:ticker", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const companyName = getCompanyName(ticker);

  const [announcements, headlines] = await Promise.all([
    fetchNSEAnnouncements(ticker),
    fetchNewsHeadlines(ticker, companyName),
  ]);

  // Interleave: announcements first, then news, sorted by date
  const all = [...announcements, ...headlines].sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  return c.json({ ticker, company: companyName, news: all });
});

// GET /news/market/headlines — top market headlines (no ticker filter)
news.get("/market/headlines", async (c) => {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return c.json({ news: [] });

  try {
    const res = await fetch(
      `https://newsapi.org/v2/top-headlines?country=in&category=business&pageSize=10&apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json() as {
      articles?: Array<{ title: string; source: { name: string }; url: string; publishedAt: string; description: string | null }>;
    };

    const items = (data.articles || []).map((a, i) => ({
      id: `market-${i}-${a.publishedAt}`,
      ticker: null,
      headline: a.title,
      source: a.source?.name || "News",
      source_type: "news",
      url: a.url,
      published_at: a.publishedAt,
      summary: a.description,
    }));

    return c.json({ news: items });
  } catch {
    return c.json({ news: [] });
  }
});

export default news;
