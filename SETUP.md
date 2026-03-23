# Investor App — Setup Guide

## Prerequisites
- Node.js 20+ with npm
- Python 3.11+ (for pattern scanner)
- Xcode 15.4+ (for iOS app)
- Supabase account
- Anthropic API key

---

## 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in your keys in .env
npm install
npm run dev
```

The server starts on `http://localhost:3000`.

### Environment variables

| Key | Where to get |
|---|---|
| `GEMINI_API_KEY` | aistudio.google.com/apikey |
| `SUPABASE_URL` | Supabase project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase project Settings → API |
| `INNGEST_SIGNING_KEY` | app.inngest.com |
| `INNGEST_EVENT_KEY` | app.inngest.com |
| `INTERNAL_API_KEY` | any secret string (shared with pattern scanner) |

---

## 2. Database (Supabase)

Apply migrations in order:

```bash
# In Supabase SQL Editor, run:
# 1. supabase/migrations/001_initial_schema.sql
# 2. supabase/migrations/002_devices.sql
```

---

## 3. Pattern Scanner (Python)

```bash
cd pattern-scanner
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Note: TA-Lib requires the C library: brew install ta-lib (macOS)
```

Create `.env` in `pattern-scanner/`:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
BACKEND_URL=http://localhost:3000
INTERNAL_API_KEY=your_internal_key
```

Run manually:
```bash
python scanner.py
```

Schedule via cron (4pm IST daily):
```
30 10 * * 1-5 cd /path/to/pattern-scanner && python scanner.py
```

---

## 4. iOS App

1. Open `ios/InvestorApp/InvestorApp.xcodeproj` in Xcode
2. Set your development team in the target Signing settings
3. Update `BACKEND_URL` in `APIClient.swift` (line ~15) to your backend URL
4. Run on simulator or device

For push notifications:
- Enable Push Notifications capability in Xcode target
- Add your APNs auth key in Supabase Edge Function environment variables:
  - `APNS_AUTH_KEY` — contents of your .p8 file
  - `APNS_KEY_ID` — 10-char key ID from Apple Developer portal
  - `APNS_TEAM_ID` — your Apple Team ID
  - `APNS_BUNDLE_ID` — `com.stoqk.app`

---

## 5. Supabase Edge Function (Push Notifications)

```bash
npx supabase functions deploy push-notifications --project-ref your-project-ref
```

---

## 6. Deploy Backend (Vercel)

```bash
cd backend
npx vercel --prod
```

Set all environment variables in Vercel dashboard.

---

## Architecture at a glance

```
iOS App (SwiftUI)
  ↕ REST + SSE
Backend API (Hono/Node.js on Vercel)
  ├── 7 AI Agents (Claude Haiku + Sonnet via Anthropic API)
  ├── Background Jobs (Inngest: signal fetch, price sync, daily brief)
  └── Database (Supabase Postgres)
       └── Push (APNs via Supabase Edge Function)

Pattern Scanner (Python + TA-Lib)
  └── Runs daily, writes to Supabase, triggers Agent 2
```
