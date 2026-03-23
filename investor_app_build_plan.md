# AI Investor App — Full Build Plan

---

## What we are building

An iOS app for Indian retail investors that turns raw market data into personalised, plain-English intelligence. Three modules:

1. Opportunity Radar — smart money signal detection
2. Chart Pattern Intel — technical patterns explained simply
3. Market Analyst Chat — portfolio-aware conversational AI

Everything is personalised based on who the user is, collected at onboarding and enriched from their portfolio input. No behaviour tracking. No video module.

---

## Part 1 — Onboarding & User Profile

### 1.1 Onboarding flow (5 questions, one screen at a time)

**Question 1 — Experience level**
"How would you describe your investing experience?"
- I am just starting out → beginner
- I know the basics → intermediate
- I have been investing for years → advanced
- I trade actively → trader

**Question 2 — Primary goal**
"What is your main goal with investing?"
- Grow wealth slowly over time → wealth_building
- Beat FD / inflation → inflation_beat
- Generate monthly income → income
- High growth, I can take risk → aggressive_growth

**Question 3 — Risk tolerance**
"If your portfolio dropped 20% tomorrow, you would..."
- Panic and sell everything → low
- Worry but hold → medium
- Buy more — good discount → high

**Question 4 — Investment horizon**
"When do you plan to use this money?"
- Within 1 year → short
- 1 to 5 years → medium
- 5 to 10 years → long
- 10 plus years → very_long

**Question 5 — Preferred sectors (multi-select)**
"Which sectors interest you most?"
- IT / Tech
- Banking and Finance
- Pharma
- Auto
- FMCG
- Energy
- Infrastructure
- Metals

---

### 1.2 Portfolio input (right after onboarding)

User enters their holdings manually:
- Stock ticker (NSE symbol)
- Quantity owned
- Average buy price

From this input the app derives passively:

| Derived field | How it is computed |
|---|---|
| portfolio_size_bucket | Sum of qty x avg_buy_price → under 1L / 1–10L / 10L+ |
| top_holdings | Top 3 stocks by value |
| sector_concentration | % allocation per sector based on holdings |

No behaviour tracking. No implicit signals from taps or opens. Only what the user explicitly tells us.

---

### 1.3 The user_profile record (stored in Supabase)

```
user_profiles table
─────────────────────────────────────────────
id                      uuid
experience_level        beginner | intermediate | advanced | trader
primary_goal            wealth_building | inflation_beat | income | aggressive_growth
risk_tolerance          low | medium | high
investment_horizon      short | medium | long | very_long
preferred_sectors       string[]
portfolio_size_bucket   under_1L | 1L_to_10L | above_10L
top_holdings            string[]  (derived, updated when holdings change)
sector_concentration    jsonb     (derived, updated when holdings change)
created_at              timestamp
updated_at              timestamp
```

User can update their profile any time from settings. The app never changes it automatically.

---

### 1.4 The compiled USER_PROFILE block

Before any agent runs, the backend compiles the raw profile into a plain English block. This gets injected into every prompt.

Example output for a beginner user:

```
USER_PROFILE:
Experience: Beginner investor, new to markets.
Goal: Beat FD returns over a 1–5 year horizon.
Risk tolerance: Medium — will hold through volatility but not take aggressive bets.
Preferred sectors: IT, Banking.
Portfolio: ₹1–10L range. Top holdings are INFY, HDFCBANK, TCS.
Sector concentration: IT 55%, Banking 35%, Other 10%.
Language: Use simple English. Avoid jargon. Explain terms when used.
```

Example output for a trader:

```
USER_PROFILE:
Experience: Active trader, comfortable with technical analysis.
Goal: Aggressive growth, short-term opportunities.
Risk tolerance: High — comfortable with drawdowns.
Preferred sectors: IT, Auto, Metals.
Portfolio: Above ₹10L. Top holdings are TATAMOTORS, WIPRO, HINDALCO.
Sector concentration: Auto 40%, IT 35%, Metals 25%.
Language: Direct and technical. No need to explain basics.
```

This block is under 150 tokens. It gets prepended to every agent system prompt.

---

## Part 2 — AI Agents

Seven agents in total. Each one receives USER_PROFILE and behaves differently based on it.

---

### Agent 1 — Signal Detector

**What it does:** Ingests raw market events from NSE/BSE feeds every 15 minutes. Scores each event and generates a plain English summary tailored to the user's profile.

**Input:**
- Raw event (bulk deal, insider trade, SAST filing, pledge change, promoter buy)
- USER_PROFILE block

**Prompt:**

```
SYSTEM:
You are a SEBI-compliant signal analyst. You will receive a raw market event and a user profile.

USER_PROFILE: {user_profile_block}

Your task:
1. event_type — classify as one of: bulk_deal, insider_buy, insider_sell, pledge_increase, pledge_reduction, promoter_buy, block_deal, qip
2. significance_score — integer 0 to 100. Base score on: amount in crores, percentage of total float, deviation from 6-month average volume. Then adjust:
   - If event is in user's preferred_sectors or top_holdings → add 15
   - If event is aggressive type (short squeeze, block deal) and risk_tolerance is low → subtract 10
3. plain_summary — exactly 2 sentences. Calibrate language to experience_level:
   - beginner: no jargon, explain what the event means in plain terms
   - trader: include price, volume, and float percentage
4. historical_context — did this pattern precede a price move in this stock in the last 3 years? One sentence if yes, null if no data.
5. relevance_reason — one sentence explaining why this matters to this specific user.

Output JSON only. No preamble.
```

**Output fields:** event_type, significance_score, plain_summary, historical_context, relevance_reason

---

### Agent 2 — Chart Pattern Recognition

**What it does:** Runs on end-of-day OHLCV data. TA-Lib detects the pattern in code first. Agent adds the plain English explanation layer and historical win rate.

**Input:**
- Ticker, pattern name (from TA-Lib), OHLCV data for past 6 months
- USER_PROFILE block

**Prompt:**

```
SYSTEM:
You are a technical analyst explaining chart patterns to investors.

USER_PROFILE: {user_profile_block}

You have been given a detected pattern and historical price data. Produce:

1. pattern_name — confirmed name
2. plain_explanation — what this pattern means. Calibrate to experience_level:
   - beginner: use an analogy, no technical terms, maximum 2 sentences
   - intermediate: explain the psychology behind the pattern
   - advanced / trader: include volume confirmation criteria and RSI context
3. what_to_watch — the specific price level that confirms or invalidates this pattern. One sentence.
4. historical_performance — "This pattern appeared X times in [TICKER] over 5 years. It worked Y% of the time, with an average move of Z% over the following 30 days."
5. horizon_note — if investment_horizon is short, note the 1–2 week price target only. If long, note that short-term patterns are less relevant to long-term investors.

Never use the words buy or sell. Output JSON only.
```

**Output fields:** pattern_name, plain_explanation, what_to_watch, historical_performance, horizon_note

---

### Agent 3 — Portfolio Context Builder

**What it does:** Runs before every chat response. Enriches the user's holdings with live prices and current signals to build the context block for the chat agent.

**Input:**
- user_holdings from Supabase
- Live price data from Upstox/NSE API
- Active signals from signals table
- USER_PROFILE block

**Prompt:**

```
SYSTEM:
You are building a compact portfolio context block. Be precise, not verbose. This block will be injected into another agent's prompt.

USER_PROFILE: {user_profile_block}
USER_HOLDINGS: {holdings_json}
LIVE_PRICES: {prices_json}
ACTIVE_SIGNALS: {signals_for_user_tickers}

Compute and return:
1. total_current_value
2. total_unrealised_pnl (absolute and percentage)
3. top_gainer (ticker, pnl_pct)
4. top_loser (ticker, pnl_pct)
5. sector_exposure — current % by sector at live prices
6. active_signals_on_holdings — list of signals where ticker matches a holding, with significance_score and plain_summary

Keep output under 300 tokens. Output JSON only.
```

**Output:** PORTFOLIO_CONTEXT block, injected into Agent 4 on every chat query.

---

### Agent 4 — Market Analyst Chat

**What it does:** The main conversational agent. Answers any market question the user asks, with full awareness of who they are and what they own.

**Input:**
- User message
- USER_PROFILE block
- PORTFOLIO_CONTEXT block (from Agent 3)
- Web search results (via Gemini grounding or Perplexity API)

**Prompt:**

```
SYSTEM:
You are a sharp, honest market analyst. You have full context about this specific investor.

USER_PROFILE: {user_profile_block}
PORTFOLIO_CONTEXT: {portfolio_context_block}
ACTIVE_SIGNALS: {signals_for_holdings}
WEB_SEARCH_RESULTS: {search_results}

Rules:
1. Always answer in two layers:
   - Layer 1: A 1–2 sentence plain answer the user can act on immediately
   - Layer 2: "Dig deeper" — data, context, nuance, source citations
2. If the user's own portfolio is relevant to the question, mention their specific holdings by name
3. Frame answers through the lens of primary_goal:
   - inflation_beat → compare to FD returns where relevant
   - income → highlight dividend angle
   - aggressive_growth → highlight momentum and upside
   - wealth_building → highlight long-term compounding angle
4. If risk_tolerance is low → mention capital protection angle and downside scenario first
5. If experience_level is beginner → explain any term you use in brackets the first time
6. Every factual claim must cite a source inline
7. Never give a direct buy or sell recommendation
8. If you do not know, say so clearly

Output plain text with the two layers clearly separated.
```

---

### Agent 5 — Alert Priority Filter

**What it does:** Runs after Signal Detector. Decides which signals to push as notifications to which users, and what the push copy should say.

**Input:**
- New signal from Agent 1
- USER_PROFILE block
- user_holdings and user_watchlist

**Prompt:**

```
SYSTEM:
You are deciding whether to send a push notification to a specific user about a market signal.

USER_PROFILE: {user_profile_block}
SIGNAL: {signal_json}
USER_HOLDINGS: {holdings}
USER_WATCHLIST: {watchlist}

Rules:
1. Always notify if signal ticker is in user's top_holdings regardless of score
2. Always notify if signal ticker is in user_watchlist and significance_score > 50
3. For all other signals, notify only if significance_score > 70
4. Write push_copy at the right depth:
   - beginner: "A large fund just bought ₹320Cr of your Tata Motors. Usually a positive sign."
   - trader: "Block deal: TATAMOTORS 1.2Cr shares @ ₹267. HDFC MF. Score: 74."
5. Max 80 characters for push_copy
6. urgency: high if score > 80, medium if 60–80, low below 60

Output: should_notify (bool), push_copy, urgency, reason. JSON only.
```

---

### Agent 6 — Daily Brief Composer

**What it does:** Runs at 7:30am every morning. Pulls top signals, macro data, and portfolio P&L to compose a personalised morning brief in card format.

**Input:**
- Top 5 signals of the day
- Macro indicators (FII/DII flows, repo rate, Sensex/Nifty change)
- PORTFOLIO_CONTEXT block
- USER_PROFILE block

**Prompt:**

```
SYSTEM:
You are writing a personalised morning market brief. This will be displayed as a card in the app, not spoken.

USER_PROFILE: {user_profile_block}
TOP_SIGNALS_TODAY: {signals}
MACRO_DATA: {macro_json}
PORTFOLIO_CONTEXT: {portfolio_context}

Structure the brief in exactly this order:
1. Opening line — one striking market fact from today
2. Market snapshot — Nifty and Sensex change. If experience_level is beginner, one sentence on what this means.
3. FII/DII flows — net buy or sell figure. If beginner, explain what FII/DII means in brackets.
4. Top signal of the day — the highest scoring signal. Use personalised plain_summary from Agent 1.
5. Your portfolio — best performer, worst performer, total P&L today. Only include if portfolio data exists.
6. One thing to watch — the single most important thing for this user to monitor today based on their holdings and preferred sectors.

Calibrate tone to experience_level:
- beginner: reassuring, no jargon
- intermediate: factual and clear
- advanced / trader: direct, fast, data-first

Output JSON with keys: opening, market_snapshot, fii_dii, top_signal, portfolio_update, watch_today.
```

---

### Agent 7 — Onboarding Profile Builder

**What it does:** Only runs once, during onboarding. Receives the user's 5 answers and compiles the user_profile record and the plain English USER_PROFILE block.

**Input:**
- 5 onboarding answers

**Prompt:**

```
SYSTEM:
You are building a user profile from onboarding answers. The user has answered 5 questions.

Answers: {onboarding_answers_json}

Compile:
1. The structured user_profile JSON with all fields
2. The plain English USER_PROFILE block (under 150 tokens) that will be injected into all future agent prompts. Write it in second person context — "This user is a beginner investor..." — so agents can read it naturally.

Be accurate. Do not infer beyond what the user answered. Output JSON with two keys: profile_record and profile_block.
```

---

## Part 3 — Data Sources & APIs

### Free / Official

| Source | What it provides | URL |
|---|---|---|
| NSE India | Bulk deals, insider trades, OHLCV, corporate actions | nseindia.com/api |
| BSE India | SAST filings, announcements, financial results | bseindia.com |
| SEBI | Promoter pledging data, QIP filings | sebi.gov.in |
| RBI | FII/DII flows, repo rate, macro data | rbi.org.in |
| ET Markets RSS | News feed, market stories | economictimes.com/markets/rss |

### Affordable paid

| Source | What it provides | Cost |
|---|---|---|
| Upstox Market Data API | Real-time WebSocket quotes, OHLCV | Free basic tier |
| Kite Connect (Zerodha) | Live quotes, historical data, portfolio sync | ₹2000/month |
| Trendlyne | Promoter pledging changes, DII holding data | ~₹500/month |

### AI models

| Model | Used for | Why |
|---|---|---|
| Gemini 2.0 Flash | Agents 1, 2, 5, 6, 7 | Fast, cheap, handles high volume batch runs |
| Claude Sonnet | Agent 4 (Chat) | Best citation quality and nuanced reasoning |
| TA-Lib (Python library) | Pattern detection engine | Code-level pattern detection, free |

The pattern detection flow is: TA-Lib detects the pattern in code → Agent 2 adds the plain English layer on top. This is more reliable than asking an LLM to detect patterns from raw numbers.

---

## Part 4 — Database Schema (Supabase / Postgres)

### User tables

```sql
user_profiles
  id                    uuid primary key
  experience_level      text
  primary_goal          text
  risk_tolerance        text
  investment_horizon    text
  preferred_sectors     text[]
  portfolio_size_bucket text
  top_holdings          text[]
  sector_concentration  jsonb
  profile_block         text  -- compiled plain English block
  created_at            timestamptz
  updated_at            timestamptz

user_holdings
  id          uuid primary key
  user_id     uuid references user_profiles
  ticker      text
  qty         numeric
  avg_buy_price numeric
  updated_at  timestamptz

user_watchlist
  id          uuid primary key
  user_id     uuid references user_profiles
  ticker      text
  added_at    timestamptz

user_notifications
  id            uuid primary key
  user_id       uuid references user_profiles
  signal_id     uuid references signals
  push_copy     text
  urgency       text
  sent_at       timestamptz
  opened        boolean default false
```

### Market data tables

```sql
signals
  id                  uuid primary key
  ticker              text
  event_type          text
  significance_score  integer
  plain_summary       text
  historical_context  text
  raw_data            jsonb
  detected_at         timestamptz

chart_patterns
  id                    uuid primary key
  ticker                text
  pattern_name          text
  detected_at           timestamptz
  plain_explanation     text
  what_to_watch         text
  historical_win_rate   numeric
  avg_move_pct          numeric
  horizon_note          text

stock_prices
  ticker    text
  date      date
  open      numeric
  high      numeric
  low       numeric
  close     numeric
  volume    bigint
  primary key (ticker, date)

company_fundamentals
  ticker                text primary key
  pe                    numeric
  roe                   numeric
  debt_equity           numeric
  revenue_growth_pct    numeric
  promoter_holding_pct  numeric
  pledge_pct            numeric
  updated_at            timestamptz

macro_indicators
  date        date primary key
  nifty_close numeric
  sensex_close numeric
  fii_net_cr  numeric
  dii_net_cr  numeric
  repo_rate   numeric

daily_briefs
  id            uuid primary key
  user_id       uuid references user_profiles
  date          date
  brief_json    jsonb
  viewed_at     timestamptz
```

---

## Part 5 — iOS App Structure (SwiftUI)

### 5 tabs

**Tab 1 — Today**
- Morning brief card (from Agent 6 output, generated at 7:30am)
- Active signals on user's holdings sorted by significance_score
- Nifty and Sensex snapshot
- FII/DII flow indicator

**Tab 2 — Radar**
- Full signal feed for all NSE stocks
- Filter by event_type and significance_score
- Each signal card shows: ticker, plain_summary (calibrated to profile), score badge
- Tap to expand: historical_context + relevance_reason + link to deeper data

**Tab 3 — Portfolio**
- Holdings list with live P&L
- Active signals on owned stocks highlighted at top
- Chart patterns detected on holdings
- Total portfolio value and unrealised P&L

**Tab 4 — Ask**
- Chat interface powered by Agent 4
- Pre-filled suggested questions based on current holdings and active signals
- Each answer renders in two layers: plain summary first, dig deeper section below
- Inline source citations as tappable links

**Tab 5 — Watchlist**
- Stocks being tracked, not yet owned
- Chart pattern alerts for watchlist stocks
- Tap to add to portfolio

### The naive to expert UX rule

Every piece of information has a default view and an expanded view. The app never forces depth on users who did not ask for it.

Default view example (beginner user, bulk deal signal):
"A large mutual fund bought a big chunk of Tata Motors today. Usually a sign of confidence."

Expanded view (tap Dig deeper):
"Bulk deal: HDFC MF, 1.2Cr shares @ ₹267. 2.3% of float. Significance score: 74. Last 3 similar events in TATAMOTORS: +12%, +8%, -3% over 30 days."

The depth is the same data. The default view is just the plain English version of it. Both are generated by the agent at the same time and stored separately in the signals table (plain_summary and raw_data).

---

## Part 6 — Backend Architecture

### Infrastructure

| Layer | Tool | Why |
|---|---|---|
| API server | Vercel Pro (Node.js) | Same as Ordo, already familiar |
| Background jobs | Inngest | Handles retries, scheduling, webhook orchestration |
| Database | Supabase (Postgres + RLS) | Same as Ordo, realtime subscriptions built in |
| Storage | Supabase Storage | Brief assets, cached data |
| Push notifications | APNs via Supabase Edge Function | Native iOS push |
| Analytics | PostHog | Same as Ordo |

### Job schedule

| Job | Frequency | What it does |
|---|---|---|
| signal_fetch | Every 15 minutes, market hours only | Fetches NSE/BSE bulk deal, insider trade feeds. Runs Agent 1 on new events. Runs Agent 5 to decide push notifications. |
| pattern_scan | Daily at 4pm (after market close) | Runs TA-Lib on OHLCV data for all NSE stocks. Runs Agent 2 on detected patterns. Writes to chart_patterns table. |
| price_sync | Daily at 4pm | Fetches EOD prices for all stocks. Updates stock_prices table. Recomputes portfolio P&L. |
| fundamental_sync | Weekly on Sunday | Updates company_fundamentals from Screener/Trendlyne. |
| macro_sync | Daily at 6pm | Fetches FII/DII flows, Nifty/Sensex close, repo rate. |
| daily_brief | Daily at 7:30am | Runs Agent 3 (Portfolio Context) then Agent 6 (Brief Composer) for every active user. Writes to daily_briefs table. |

### Signal pipeline (the most important flow)

```
NSE/BSE raw feed (every 15 min)
  ↓
Parse new events (Node.js)
  ↓
Agent 1 — Signal Detector
  → significance_score
  → plain_summary (calibrated per profile)
  → historical_context
  ↓
Write to signals table
  ↓
Agent 5 — Alert Priority Filter
  → cross-reference with user_holdings and user_watchlist
  → decide should_notify and push_copy per user
  ↓
Send APNs push notification
  ↓
iOS app receives push → opens to signal card
```

### Chat pipeline (on every user message)

```
User sends message
  ↓
Fetch USER_PROFILE from Supabase
  ↓
Agent 3 — Portfolio Context Builder
  → fetches live prices + active signals for holdings
  → builds PORTFOLIO_CONTEXT block
  ↓
Web search (Perplexity or Gemini grounding)
  → relevant news and data for the query
  ↓
Agent 4 — Market Analyst Chat
  → receives: user message + USER_PROFILE + PORTFOLIO_CONTEXT + search results
  → returns two-layer answer
  ↓
Stream response to iOS app
```

---

## Part 7 — Personalisation in Practice

The USER_PROFILE block is injected into every agent. Here is how the same signal reads differently for two users.

**Signal:** HDFC MF bulk deal, TATAMOTORS, 1.2Cr shares at ₹267. Raw significance score: 74.

**User A — Beginner, inflation_beat goal, medium risk, holds TATAMOTORS**

Push notification:
"A large mutual fund just bought a big chunk of your Tata Motors. Usually a positive sign."

Card plain view:
"HDFC Mutual Fund bought Tata Motors shares worth ₹320 crore today. This kind of big institutional purchase is generally a sign of confidence in the stock. Since you already own Tata Motors, this is relevant to your position."

Card expanded view:
"Bulk deal at market close. 1.2Cr shares at ₹267, slight premium to day's VWAP. 2.3% of total float. Historical: last 3 similar HDFC MF entries in TATAMOTORS returned +12%, +8%, -3% over 30 days. Current signal score: 74."

**User B — Active trader, aggressive growth goal, high risk**

Push notification:
"Block deal: TATAMOTORS 1.2Cr @ ₹267. HDFC MF. Score: 74."

Card plain view:
"HDFC MF bulk entry at market close. 2.3% float. Score 74. Previous similar entries: +12%, +8%, -3% over 30d."

Card expanded view:
"Volume: 2.1x 30-day average. Price at ₹267 = 0.8% above VWAP. Promoter holding stable at 42.6%. No pledge changes in last 30 days. FII net buyers in auto sector today."

---

## Part 8 — Phase-wise Build Plan

### Phase 1 — Hackathon MVP (build in 2–3 days)

Goal: one complete end-to-end flow that judges can experience.

Build:
- Onboarding flow (5 questions) → user_profile record
- Portfolio input screen → user_holdings
- NSE bulk deal + insider trade feed integration
- Agent 1 (Signal Detector) running on live data
- Agent 5 (Alert Priority) deciding push relevance
- Radar tab in iOS app showing signal cards
- Plain / expert view toggle on each card

Demo flow for judges:
1. Complete onboarding as a beginner investor with TATAMOTORS and HDFCBANK holdings
2. Radar tab shows personalised signals for those stocks
3. Tap a signal → see plain English card calibrated to beginner profile
4. Tap Dig deeper → see full data layer
5. Show the same signal through a trader profile → completely different language

This alone demonstrates the core value proposition.

### Phase 2 — Post hackathon (weeks 1–4)

- Agent 4 (Chat) with portfolio context awareness
- Tab 4 (Ask) in iOS app with suggested questions
- Agent 6 (Daily Brief) and Tab 1 (Today)
- TestFlight release to first 50 users
- Push notifications live via APNs

### Phase 3 — Growth (month 2–3)

- Agent 2 (Chart Pattern) with TA-Lib pipeline
- Tab 5 (Watchlist) with pattern alerts
- Kite Connect integration for automatic portfolio sync (no manual entry)
- Signal win rate tracking — after 30 days, did signals with score > 70 precede a move? This data becomes proprietary.
- Shareable signal cards (the viral loop — each shared card is a CTA to download)

---

## Part 9 — Cost Estimate at 1000 users

| Item | Monthly cost |
|---|---|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Gemini 2.0 Flash (Agents 1, 2, 5, 6, 7) | ~$15 |
| Claude Sonnet (Agent 4 chat) | ~$20 |
| Upstox / Kite Connect data | ~$30 |
| Trendlyne | ~$7 |
| Total | ~$117/month |

Breaks even at approximately 120 users paying ₹99/month.

---

## Part 10 — What makes this defensible

The product gets better the longer it runs, in a way competitors cannot shortcut.

Signal win rate data is proprietary. After 3 months of tracking which signals with which scores preceded actual price moves, the app knows things about NSE stocks that no other product has. This is not data you can buy — it is data you accumulate.

The personalisation layer means two users with the same app have fundamentally different experiences. A beginner user and a trader are essentially using different products. This is hard to copy quickly because it requires getting the prompt engineering right for every experience level and goal combination, not just building the feature.

The portfolio awareness compounds. Every time a user adds a holding, every agent becomes more relevant to them. The chat agent knows their position. The radar highlights signals on their stocks. The brief is built around their portfolio. This creates genuine retention pressure — leaving means losing all that context.

---

*End of build plan.*
