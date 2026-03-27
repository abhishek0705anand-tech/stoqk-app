# Stoqk

An AI-native investing assistant for Indian retail investors. Stoqk continuously monitors NSE market events, scores them through specialized AI agents, and delivers personalized insights — push notifications, morning briefs, and a conversational market analyst — tailored to each user's portfolio and risk profile.

---

## What it does

- **Signal Detection** — Polls NSE every 15 minutes for bulk deals, insider trades, and block deals. Each event is scored by Gemini 2.0 Flash (0–100 significance) and stored.
- **Smart Alerts** — Sends push notifications only when a signal is relevant to a user's holdings or watchlist, with copy calibrated to their experience level.
- **Daily Brief** — Generates a personalized morning market summary every weekday at 7:30 AM IST combining macro data, FII/DII flows, and the user's portfolio performance.
- **Market Analyst Chat** — Conversational AI that answers questions about markets and portfolios with a two-layer response: a 5-second summary and a deep-dive analysis.
- **Portfolio Tracking** — Live prices, unrealised PnL, sector exposure, and active signals per holding.
- **Chart Patterns** — A Python TA-Lib scanner detects technical patterns daily; Gemini explains them in plain language calibrated to the user's level.

---

## Tech stack

| Layer | Technology |
|---|---|
| iOS App | Swift / SwiftUI |
| Backend | Node.js, TypeScript, Hono, Vercel |
| Database & Auth | Supabase (PostgreSQL + RLS) |
| Background Jobs | Inngest (cron + event-driven) |
| AI | Google Gemini 2.0 Flash |
| Market Data | NSE India API, Yahoo Finance |
| Push Notifications | Apple APNs |
| News | NewsAPI |

---

## Repository structure

```
stoqk-app/
├── backend/                        # Node.js / Hono backend (deployed to Vercel)
│   ├── src/
│   │   ├── app.ts                  # Hono app — routes + Inngest webhook
│   │   ├── index.ts                # Local dev server entry point
│   │   ├── agents/                 # AI agent logic (Gemini calls)
│   │   │   ├── signal-detector.ts  # Scores raw NSE events 0-100
│   │   │   ├── alert-priority.ts   # Decides push notification per user
│   │   │   ├── daily-brief.ts      # Composes personalized morning brief
│   │   │   ├── market-analyst-chat.ts  # Conversational two-layer chat agent
│   │   │   ├── chart-pattern.ts    # Explains technical patterns in plain language
│   │   │   ├── portfolio-context.ts    # Pure TS math — builds portfolio summary
│   │   │   └── profile-builder.ts  # Onboarding answers → profile_block text
│   │   ├── jobs/                   # Inngest background jobs
│   │   │   ├── signal-fetch.ts     # Every 15 min — fetch NSE events, score, alert
│   │   │   ├── daily-brief.ts      # 7:30am IST — generate briefs for all users
│   │   │   ├── price-sync.ts       # 4pm IST — sync 180d OHLCV for 45 tickers
│   │   │   ├── macro-sync.ts       # 6pm IST — Nifty, Sensex, FII/DII flows
│   │   │   ├── fundamental-sync.ts # Weekly Sunday — PE, ROE, market cap
│   │   │   ├── chat-process.ts     # On-demand — process user chat messages
│   │   │   └── index.ts            # Mount all jobs on Inngest webhook
│   │   ├── routes/                 # REST API route handlers
│   │   │   ├── profile.ts          # GET/POST/PATCH user profile
│   │   │   ├── holdings.ts         # CRUD user holdings with live prices
│   │   │   ├── signals.ts          # Paginated signal feed
│   │   │   ├── briefs.ts           # Daily brief + macro indicators
│   │   │   ├── chat.ts             # Chat enqueue + result polling
│   │   │   ├── watchlist.ts        # Watchlist with live prices + patterns
│   │   │   ├── patterns.ts         # Chart patterns per ticker
│   │   │   ├── prices.ts           # OHLCV history + fundamentals
│   │   │   ├── news.ts             # NSE announcements + NewsAPI headlines
│   │   │   └── internal.ts         # Internal routes (pattern scanner, devices)
│   │   ├── lib/                    # Shared libraries
│   │   │   ├── anthropic.ts        # Gemini SDK wrapper (runAgent / streamAgent)
│   │   │   ├── supabase.ts         # Supabase service-role + anon clients
│   │   │   ├── nse.ts              # NSE India API client + session spoofing
│   │   │   ├── apns.ts             # Apple push notification sender
│   │   │   ├── profile.ts          # profile_block compiler + sector mapping
│   │   │   ├── fundamentals.ts     # Yahoo Finance fundamentals fetcher
│   │   │   └── news.ts             # NSE announcements + NewsAPI fetcher
│   │   ├── middleware/
│   │   │   └── auth.ts             # JWT validation via Supabase
│   │   ├── types/
│   │   │   └── index.ts            # Shared TypeScript types
│   │   └── scripts/                # One-off data scripts (seed, debug, backfill)
│   ├── vercel.json                 # Vercel deployment config
│   ├── package.json
│   └── .env.example                # Required environment variables
│
├── ios/                            # Native iOS app (SwiftUI)
│   └── InvestorApp/
│       └── InvestorApp/
│           ├── InvestorAppApp.swift         # App entry point + splash routing
│           ├── Core/
│           │   ├── Design/
│           │   │   ├── AppTheme.swift       # Colors, fonts, spacing, radius
│           │   │   └── Components.swift     # Shared UI components + SplashView
│           │   ├── Models/
│           │   │   └── Models.swift         # All Codable data models
│           │   └── Network/
│           │       ├── APIClient.swift      # REST client with auto token refresh
│           │       ├── AppState.swift       # Global auth + profile state
│           │       └── PushManager.swift    # APNs registration + notification routing
│           └── Features/
│               ├── Auth/LoginView.swift
│               ├── Onboarding/
│               │   ├── OnboardingView.swift
│               │   └── PortfolioInputView.swift
│               ├── MainTabView.swift        # 5-tab root navigator
│               ├── Today/TodayView.swift    # Daily brief + macro + signals
│               ├── Radar/RadarView.swift    # Paginated signal feed
│               ├── Portfolio/PortfolioView.swift
│               ├── Ask/AskView.swift        # Two-layer AI chat
│               ├── Watchlist/WatchlistView.swift
│               └── Settings/SettingsView.swift
│
└── Architecture_Documentation.html  # Full system architecture with diagrams
```

---

## AI agents

| Agent | File | Gemini calls | Purpose |
|---|---|---|---|
| Signal Detector | `agents/signal-detector.ts` | ~20/day | Scores raw NSE events 0–100 |
| Alert Priority | `agents/alert-priority.ts` | ~100/day | Decides push per user per signal |
| Daily Brief | `agents/daily-brief.ts` | 1 per user/day | Morning market summary |
| Market Analyst Chat | `agents/market-analyst-chat.ts` | Per message | Conversational two-layer responses |
| Chart Pattern | `agents/chart-pattern.ts` | ~10/day | Explains TA-Lib detected patterns |
| Portfolio Context | `agents/portfolio-context.ts` | 0 | Pure TypeScript math — no AI |
| Profile Builder | `agents/profile-builder.ts` | 0 | Deterministic profile_block compiler |

All agents use `gemini-2.0-flash`. Estimated total: **~230 Gemini calls/day** at 100 users.

> Signal-fetch de-duplicates by ticker + event_type per day before calling Gemini, preventing NSE's full-day list from being re-scored on every 15-minute poll.

---

## Background jobs (Inngest)

| Job | Schedule | Purpose |
|---|---|---|
| `signal-fetch` | Every 15 min, Mon–Fri | Fetch NSE deals, score with AI, push alerts |
| `daily-brief` | 7:30 AM IST, Mon–Fri | Generate morning briefs for all users |
| `price-sync` | 4:00 PM IST, Mon–Fri | Sync 180d OHLCV for 45 NSE tickers |
| `macro-sync` | 6:00 PM IST, Mon–Fri | Nifty, Sensex, FII/DII flows |
| `fundamental-sync` | 10:00 AM IST, Sunday | PE, ROE, debt/equity, market cap |
| `chat-process` | On demand (event trigger) | Process user chat messages asynchronously |

---

## Supabase tables

**Market data (publicly readable)**

| Table | Updated by | Read by |
|---|---|---|
| `signals` | `signal-fetch` job | iOS Radar feed, chat context, daily brief |
| `stock_prices` | `price-sync` job | iOS charts, portfolio PnL calc |
| `company_fundamentals` | `fundamental-sync` job | iOS fundamentals strip, sector mapping |
| `macro_indicators` | `macro-sync` job | iOS Today view, daily brief |
| `chart_patterns` | Python TA-Lib scanner | iOS Watchlist + Portfolio |

**User data (Row Level Security — own rows only)**

| Table | Purpose |
|---|---|
| `user_profiles` | Onboarding answers + compiled `profile_block` injected into every AI prompt |
| `user_holdings` | Portfolio positions (ticker, qty, avg_buy_price) |
| `user_watchlist` | Monitored tickers |
| `user_devices` | APNs tokens for push notifications |
| `user_notifications` | Push history (signal_id, push_copy, urgency, opened) |
| `daily_briefs` | Per-user per-day AI brief JSON |
| `chat_messages` | Chat history with `plain` + `deeper` fields and `status` (pending/done/error) |

---

## API endpoints

All routes require `Authorization: Bearer <JWT>` (Supabase access token).

```
GET    /api/v1/profile/me
POST   /api/v1/profile/onboarding
PATCH  /api/v1/profile/me

GET    /api/v1/holdings
PUT    /api/v1/holdings
DELETE /api/v1/holdings/:ticker
POST   /api/v1/holdings/bulk

GET    /api/v1/signals
POST   /api/v1/signals/for-tickers
GET    /api/v1/signals/:id

GET    /api/v1/briefs/today
GET    /api/v1/briefs/macro
GET    /api/v1/briefs/history

POST   /api/v1/chat
GET    /api/v1/chat/result/:job_id
GET    /api/v1/chat/suggestions

GET    /api/v1/watchlist
POST   /api/v1/watchlist
DELETE /api/v1/watchlist/:ticker

GET    /api/v1/patterns
POST   /api/v1/patterns/for-tickers

GET    /api/v1/prices/history/:ticker
GET    /api/v1/prices/fundamentals/:ticker

GET    /api/v1/news/:ticker
GET    /api/v1/news/market/headlines

POST   /api/v1/internal/analyze-pattern   # x-internal-key header
POST   /api/v1/internal/devices           # x-internal-key + x-user-id headers
```

---

## Local development

### Backend

```bash
cd backend
cp .env.example .env
# Fill in all values in .env

npm install
npm run dev          # starts Hono server on :3000

# In a separate terminal — run Inngest dev server
npm run inngest      # connects to http://localhost:3000/api/inngest
```

### Environment variables

```env
# AI
GEMINI_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Inngest
INNGEST_SIGNING_KEY=
INNGEST_EVENT_KEY=

# Apple Push Notifications
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_PRIVATE_KEY=
APNS_BUNDLE_ID=com.stoqk.app
APNS_ENV=sandbox

# News
NEWS_API_KEY=

# Optional — live price quotes (falls back to NSE if not set)
UPSTOX_ACCESS_TOKEN=

# Internal route auth (shared with Python pattern scanner)
INTERNAL_API_KEY=

PORT=3000
```

### iOS

Open `ios/InvestorApp/InvestorApp.xcodeproj` in Xcode. The backend URL is configured in `Core/Network/APIClient.swift`. Update it to point to your local or deployed backend.

---

## Deployment

The backend deploys automatically to Vercel on every push to `main`. The `vercel.json` in `backend/` routes all traffic through `api/index.ts`.

Inngest cron jobs are registered at `/api/inngest` and managed from the [Inngest dashboard](https://app.inngest.com).

---

## Architecture

See [`Architecture_Documentation.html`](./Architecture_Documentation.html) for the full system architecture including Mermaid diagrams for every data flow, agent I/O schemas, database relationships, and key design decisions.
