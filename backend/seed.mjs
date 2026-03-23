#!/usr/bin/env node
/**
 * seed.mjs — manual data seeder
 * Run: node --env-file=.env seed.mjs [signals|prices|macro|patterns|all]
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── NSE SESSION ──────────────────────────────────────────────────────────────

let NSE_COOKIE = "";

async function initNSESession() {
  const res = await fetch("https://www.nseindia.com/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });
  NSE_COOKIE = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  await sleep(1500);
}

function nseHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, */*",
    Referer: "https://www.nseindia.com/",
    Cookie: NSE_COOKIE,
  };
}

async function nseGet(path) {
  const res = await fetch(`https://www.nseindia.com${path}`, {
    headers: nseHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NSE ${res.status} ${path}`);
  return res.json();
}

// ─── TICKERS ──────────────────────────────────────────────────────────────────

const TICKERS = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","SBIN","BAJFINANCE",
  "BHARTIARTL","KOTAKBANK","AXISBANK","LT","ASIANPAINT","HCLTECH","MARUTI",
  "WIPRO","SUNPHARMA","ULTRACEMCO","TATAMOTORS","NTPC","POWERGRID","ADANIPORTS",
  "TATASTEEL","ONGC","TECHM","HINDALCO","DRREDDY","DIVISLAB","BAJAJ-AUTO","M&M",
  "CIPLA","NESTLEIND","BRITANNIA","ITC","HEROMOTOCO","JSWSTEEL",
];

// ─── MACRO ────────────────────────────────────────────────────────────────────

async function seedMacro() {
  console.log("\n🏦 Seeding macro indicators...");
  await initNSESession();

  const data = await nseGet("/api/allIndices");
  const today = new Date().toISOString().slice(0, 10);

  const niftyData  = data?.data?.find((d) => d.indexSymbol === "NIFTY 50");
  const sensexData = data?.data?.find((d) => d.indexSymbol === "SENSEX");

  const nifty_close  = niftyData?.last  || 0;
  const sensex_close = sensexData?.last || 0;

  console.log(`  Nifty: ${nifty_close}  Sensex: ${sensex_close}`);

  const { error } = await supabase.from("macro_indicators").upsert({
    date: today,
    nifty_close,
    sensex_close,
    fii_net_cr: 0,
    dii_net_cr: 0,
  });

  if (error) console.error("  Error:", error.message);
  else console.log(`  ✅ Macro saved for ${today}`);
}

// ─── PRICES ───────────────────────────────────────────────────────────────────

async function seedPrices() {
  console.log("\n📈 Seeding live prices for all tickers...");
  await initNSESession();

  const rows = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const ticker of TICKERS) {
    try {
      process.stdout.write(`  ${ticker}... `);
      const data = await nseGet(`/api/quote-equity?symbol=${ticker}`);

      const p = data?.priceInfo;
      if (!p) { console.log("no data"); continue; }

      rows.push({
        ticker,
        date: today,
        open:   p.open    || p.lastPrice,
        high:   p.intraDayHighLow?.max || p.lastPrice,
        low:    p.intraDayHighLow?.min || p.lastPrice,
        close:  p.lastPrice,
        volume: data?.securityInfo?.tradedVolume || 0,
      });

      console.log(`₹${p.lastPrice} (${p.pChange > 0 ? "+" : ""}${p.pChange?.toFixed(2)}%)`);
      await sleep(350);
    } catch (err) {
      console.log(`FAILED (${err.message})`);
    }
  }

  if (rows.length) {
    const { error } = await supabase.from("stock_prices").upsert(rows, { onConflict: "ticker,date" });
    if (error) console.error("  DB error:", error.message);
    else console.log(`  ✅ ${rows.length} price rows saved`);
  }
}

// ─── SIGNALS (sample data based on real market events) ────────────────────────

async function seedSignals() {
  console.log("\n📡 Seeding sample signals...");

  const samples = [
    { ticker: "RELIANCE", event_type: "bulk_deal", significance_score: 78, plain_summary: "Bulk deal: Foreign institutional investor acquired 2.3M shares of Reliance Industries at ₹2,920 — 0.8% of daily float. Signal suggests institutional accumulation at support zone.", historical_context: "Large institutional bulk deals in Reliance have historically preceded 4-8% moves over the next 10-15 trading sessions." },
    { ticker: "HDFCBANK", event_type: "insider_buy", significance_score: 85, plain_summary: "Promoter group entity purchased 500K shares of HDFC Bank at ₹1,840 (₹92 Cr total). Promoter holding increases to 26.1%. Open market purchase signals management confidence.", historical_context: "HDFC Bank promoter buys have been rare and have historically marked local bottoms within ±3% over 30 days." },
    { ticker: "TATAMOTORS", event_type: "block_deal", significance_score: 71, plain_summary: "Block deal: 4.2M shares of Tata Motors traded at ₹820 via negotiated window. Seller appears to be a mid-size FII reducing position. Buyer identity unconfirmed.", historical_context: "Post block-deal selling pressure typically resolves within 3-5 sessions as price stabilises." },
    { ticker: "INFY", event_type: "insider_sell", significance_score: 62, plain_summary: "Infosys independent director sold 50,000 shares at ₹1,650 (₹8.25 Cr). Routine disclosure under SEBI regulations. Not a promoter sale.", historical_context: "Director-level sales under ₹10 Cr are routine and historically show no correlation with price direction." },
    { ticker: "BAJFINANCE", event_type: "bulk_deal", significance_score: 82, plain_summary: "Domestic mutual fund acquired 1.8M shares of Bajaj Finance at ₹7,200 — large allocation relative to 30-day ADV. Suggests fresh position building by a large domestic fund.", historical_context: "MF bulk buys in Bajaj Finance at or near 52-week lows have historically returned 12-18% over 6 months." },
    { ticker: "SBIN", event_type: "promoter_buy", significance_score: 76, plain_summary: "GoI-backed entity increased stake in SBI by 0.3% through open market purchases at ₹825. Government showing confidence in public sector banking.", historical_context: "Government stake increases in PSU banks often coincide with bottoming of NPA cycles." },
    { ticker: "WIPRO", event_type: "insider_buy", significance_score: 69, plain_summary: "Wipro promoter family office purchased 1.2M shares at ₹490 via bulk deal (₹58.8 Cr). Marks third consecutive quarter of promoter buying.", historical_context: "Consistent promoter accumulation in IT names during earnings troughs has historically been a reliable indicator." },
    { ticker: "ADANIPORTS", event_type: "qip", significance_score: 74, plain_summary: "Adani Ports launched QIP to raise ₹5,000 Cr at ₹1,340/share (3% discount to CMP). Funds earmarked for port capacity expansion in Mundra and Vizhinjam.", historical_context: "Infrastructure QIPs with clear capex deployment plans typically see 8-15% returns within 12 months post-issue." },
    { ticker: "SUNPHARMA", event_type: "pledge_reduction", significance_score: 80, plain_summary: "Promoters of Sun Pharmaceutical reduced pledged shares from 6.2% to 3.1% — a significant deleveraging signal. ₹4,800 Cr worth of pledge released.", historical_context: "Major pledge reductions (>2%) in pharma promoters have historically been strong positive catalysts." },
    { ticker: "TATASTEEL", event_type: "bulk_deal", significance_score: 65, plain_summary: "FII sold 8M shares of Tata Steel at ₹148 in a single bulk deal session. Large block liquidation likely driven by global commodity fund rebalancing.", historical_context: "Metal sector FII selling on commodity cycle turning points has shown mixed 3-month outcomes." },
  ];

  const rows = samples.map((s) => ({
    ...s,
    raw_data: { source: "seed", generated_at: new Date().toISOString() },
  }));

  const { error, data } = await supabase.from("signals").insert(rows).select("id");
  if (error) console.error("  Error:", error.message);
  else console.log(`  ✅ Inserted ${data?.length} signals`);
}

// ─── PATTERNS (via pattern-scanner) ───────────────────────────────────────────

async function seedPatterns(limit = null) {
  const limitArg = limit ? `--limit ${limit}` : "";
  console.log(`\n🕯️  Running pattern scanner${limit ? ` (top ${limit} by market cap)` : " (all tickers)"}...`);
  const { execSync } = await import("child_process");
  const scannerDir = new URL("../pattern-scanner", import.meta.url).pathname;
  try {
    const out = execSync(
      `source venv/bin/activate && python3 scanner.py ${limitArg}`,
      { cwd: scannerDir, shell: "/bin/zsh", timeout: 600000, encoding: "utf8" }
    );
    console.log(out.trim());
  } catch (err) {
    console.error("  Pattern scanner error:", err.message);
  }
}

// ─── NIFTY 500 FULL SEED ──────────────────────────────────────────────────────

async function seedNifty500() {
  console.log("\n🏦 Fetching all Nifty 500 stocks from NSE...");
  await initNSESession();

  const res = await fetch(
    "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20500",
    { headers: nseHeaders(), signal: AbortSignal.timeout(20000) }
  );

  if (!res.ok) {
    console.error(`  NSE returned ${res.status}`);
    return;
  }

  const data = await res.json();
  const stocks = (data?.data || []).filter((s) => s.symbol !== "NIFTY 500");
  console.log(`  Got ${stocks.length} stocks\n`);

  const today = new Date().toISOString().slice(0, 10);

  // ── 1. stock_prices (today's OHLC) ────────────────────────────────────────
  console.log("  📈 Saving today's prices...");
  const priceRows = stocks.map((s) => ({
    ticker:  s.symbol,
    date:    today,
    open:    s.open         || s.lastPrice,
    high:    s.dayHigh      || s.lastPrice,
    low:     s.dayLow       || s.lastPrice,
    close:   s.lastPrice,
    volume:  s.totalTradedVolume || 0,
  }));

  // Batch upsert in chunks of 100
  for (let i = 0; i < priceRows.length; i += 100) {
    const chunk = priceRows.slice(i, i + 100);
    const { error } = await supabase
      .from("stock_prices")
      .upsert(chunk, { onConflict: "ticker,date" });
    if (error) console.error(`    chunk ${i} error:`, error.message);
    else process.stdout.write(".");
  }
  console.log(`\n  ✅ ${priceRows.length} price rows saved`);

  // ── 2. company_fundamentals ───────────────────────────────────────────────
  console.log("\n  🔬 Saving fundamentals (PE, market cap, sector)...");

  // NSE index response has PE and market cap for each stock
  const fundRows = stocks
    .filter((s) => s.pe || s.marketCap)
    .map((s) => ({
      ticker:               s.symbol,
      pe:                   s.pe            || null,
      market_cap_cr:        s.marketCap     ? s.marketCap / 10000000 : null, // paise → crores
      sector:               s.industry      || null,
      updated_at:           new Date().toISOString(),
      // Fields we don't have from this endpoint — leave null
      roe:                  null,
      debt_equity:          null,
      revenue_growth_pct:   null,
      promoter_holding_pct: null,
      pledge_pct:           null,
    }));

  if (fundRows.length) {
    for (let i = 0; i < fundRows.length; i += 100) {
      const chunk = fundRows.slice(i, i + 100);
      const { error } = await supabase
        .from("company_fundamentals")
        .upsert(chunk, { onConflict: "ticker" });
      if (error) console.error(`    fundamentals chunk ${i}:`, error.message);
      else process.stdout.write(".");
    }
    console.log(`\n  ✅ ${fundRows.length} fundamental rows saved`);
  } else {
    console.log("  ⚠️  No PE/marketCap data in response (market may be closed)");
  }

  // ── 3. Print summary ──────────────────────────────────────────────────────
  console.log(`\n  📊 Summary:`);
  const top5 = stocks.slice(0, 5).map((s) => `${s.symbol} ₹${s.lastPrice} (${s.pChange > 0 ? "+" : ""}${s.pChange?.toFixed(2)}%)`);
  top5.forEach((s) => console.log(`    ${s}`));
  console.log(`    ... and ${stocks.length - 5} more`);
}

// ─── ALL NSE COMPANIES (Bhavcopy) ─────────────────────────────────────────────

async function seedAllNSE() {
  console.log("\n🇮🇳 Seeding ALL NSE listed companies via Bhavcopy...\n");

  // Find the latest available trading day (walk back up to 5 days)
  const bhavURL = await findLatestBhavcopy();
  if (!bhavURL) {
    console.error("  ❌ Could not find a recent Bhavcopy. NSE may be down.");
    return;
  }

  console.log(`  Downloading: ${bhavURL}`);
  const res = await fetch(bhavURL, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) { console.error(`  HTTP ${res.status}`); return; }

  const csv = await res.text();
  const lines = csv.split("\n");
  const header = lines[0].split(",").map((h) => h.trim());

  const col = (row, name) => {
    const i = header.indexOf(name);
    return i === -1 ? null : row[i]?.trim();
  };

  // Parse EQ series only (regular equity stocks — exclude G-Secs, SME, etc.)
  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    const series = col(parts, "SERIES");
    if (series !== "EQ") continue;

    const symbol = col(parts, "SYMBOL");
    const dateStr = col(parts, "DATE1"); // e.g. "20-Mar-2026"
    const date = parseBhavDate(dateStr);
    if (!symbol || !date) continue;

    rows.push({
      ticker:  symbol,
      date,
      open:    parseFloat(col(parts, "OPEN_PRICE")  || "0") || 0,
      high:    parseFloat(col(parts, "HIGH_PRICE")  || "0") || 0,
      low:     parseFloat(col(parts, "LOW_PRICE")   || "0") || 0,
      close:   parseFloat(col(parts, "CLOSE_PRICE") || "0") || 0,
      volume:  parseInt(col(parts, "TTL_TRD_QNTY")  || "0", 10) || 0,
    });
  }

  console.log(`  Parsed ${rows.length} EQ stocks from Bhavcopy`);

  // Upsert in batches of 200
  let saved = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase
      .from("stock_prices")
      .upsert(chunk, { onConflict: "ticker,date" });
    if (error) { console.error(`  Batch ${i} error:`, error.message); continue; }
    saved += chunk.length;
    process.stdout.write(`\r  Saved ${saved}/${rows.length}...`);
  }

  console.log(`\n  ✅ ${saved} price rows upserted\n`);

  // Also upsert company_fundamentals with sector + ISIN from the data we have
  // We use a separate NSE equity list for metadata
  await seedEquityMaster(rows.map((r) => r.ticker));
}

async function seedEquityMaster(tickers) {
  console.log("  📋 Fetching equity master list for company metadata...");

  // NSE index constituents give sector data — try multiple indices
  const indices = ["NIFTY%20500", "NIFTY%20MIDCAP%20150", "NIFTY%20SMALLCAP%20250"];
  const sectorMap = {};

  await initNSESession();
  for (const idx of indices) {
    try {
      const r = await fetch(
        `https://www.nseindia.com/api/equity-stockIndices?index=${idx}`,
        { headers: nseHeaders(), signal: AbortSignal.timeout(15000) }
      );
      if (!r.ok) continue;
      const data = await r.json();
      for (const s of (data?.data || [])) {
        const industry = s.meta?.industry || s.industry;
        if (s.symbol && industry) sectorMap[s.symbol] = { sector: industry, ffmc: s.ffmc };
      }
      await sleep(500);
    } catch { /* skip */ }
  }

  console.log(`  Got sector data for ${Object.keys(sectorMap).length} companies`);

  const fundRows = tickers
    .filter((t) => sectorMap[t])
    .map((t) => ({
      ticker:               t,
      sector:               sectorMap[t].sector,
      market_cap_cr:        sectorMap[t].ffmc ? Math.round(sectorMap[t].ffmc / 10000000) : null,
      updated_at:           new Date().toISOString(),
      pe:                   null,
      roe:                  null,
      debt_equity:          null,
      revenue_growth_pct:   null,
      promoter_holding_pct: null,
      pledge_pct:           null,
    }));

  for (let i = 0; i < fundRows.length; i += 200) {
    const chunk = fundRows.slice(i, i + 200);
    await supabase.from("company_fundamentals").upsert(chunk, { onConflict: "ticker" });
    process.stdout.write(`\r  Saved ${Math.min(i + 200, fundRows.length)}/${fundRows.length} fundamentals...`);
  }
  console.log(`\n  ✅ ${fundRows.length} fundamental rows upserted`);
}

async function findLatestBhavcopy() {
  for (let daysBack = 0; daysBack <= 5; daysBack++) {
    const d = new Date(Date.now() - daysBack * 86400000);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();

    const url = `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${dd}${mm}${yyyy}.csv`;
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (r?.ok) return url;
  }
  return null;
}

function parseBhavDate(str) {
  if (!str) return null;
  // Format: "20-Mar-2026"
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const [dd, mon, yyyy] = str.split("-");
  if (!dd || !mon || !yyyy) return null;
  return new Date(parseInt(yyyy), months[mon], parseInt(dd)).toISOString().slice(0, 10);
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const cmd = process.argv[2] || "all";
// Optional: node seed.mjs patterns --limit 500
const limitArg = process.argv.indexOf("--limit");
const patternLimit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1]) : null;
console.log(`🌱 Stoqk data seeder — target: ${cmd}\n`);

if (cmd === "signals"  || cmd === "all") await seedSignals();
if (cmd === "macro"    || cmd === "all") await seedMacro();
if (cmd === "prices"   || cmd === "all") await seedPrices();
if (cmd === "patterns" || cmd === "all") await seedPatterns(patternLimit);
if (cmd === "nifty500")                  await seedNifty500();
if (cmd === "nse-all")                   await seedAllNSE();

console.log("\n✅ Done.\n");
