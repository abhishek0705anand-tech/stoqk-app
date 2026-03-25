# Stoqk: AI-Native Investment Intelligence Platform
## Technical Architecture and System Design Document

### 1. Product Functional Overview
Stoqk is an automated investment intelligence platform designed to transform raw market data into actionable, personalized insights for retail investors. The system follows a continuous pipeline of data acquisition, multi-agent analysis, and context-aware delivery.

#### 1.1 The Operational Cycle
The platform operates on a synchronized daily cycle to ensure institutional-grade precision for retail users:

1. **Phase 1: Data Acquisition (07:00 IST)**
   - Automated ingestion of NSE (National Stock Exchange) market data including Bhavcopy (Daily Prices), Bulk/Block deal registries, and Insider Trading disclosures.
   - Integration with Yahoo Finance API for 90-day historical Open-High-Low-Close-Volume (OHLCV) data and corporate fundamentals (P/E ratios, Return on Equity, Debt-to-Equity).

2. **Phase 2: Signal Synthesis (07:15 IST)**
   - **Signal Agent**: Analyzes the magnitude and historical relevance of insider transactions and bulk deals. It applies a normalized significance score (0-100) based on institutional movement.
   - **Pattern Agent**: Executes technical analysis via TA-Lib on historical price charts to identify momentum patterns (e.g., breakouts, engulfing candles).
   - **Performance Agent**: Quantifies agent reliability by back-testing previous signals against actual market movement at T+1, T+7, and T+30 intervals.

3. **Phase 3: Personalized Delivery (07:30 IST)**
   - **Briefing Agent**: Synthesizes global macro-indicators and portfolio-specific context into a card-based "Morning Brief."
   - **Priority Filter**: Analyzes user-specific risk tolerance and holdings to determine push notification urgency, effectively reducing alert fatigue.

---

### 2. System Architecture

#### 2.1 Technology Stack
- **Frontend**: Native iOS application developed in SwiftUI using Apple’s Swift Charts for high-performance data visualization.
- **Backend API**: Node.js environment utilizing TypeScript for type-safety, hosted on a scalable runtime.
- **Task Orchestration**: Inngest for event-driven background job management and serverless execution.
- **Intelligence Layer**: Anthropic Claude-3-Haiku LLM integrated via low-latency API calls for real-time analysis.
- **Persistence Layer**: Supabase (PostgreSQL) providing Row-Level Security (RLS) and real-time data streaming.
- **Data Sources**: NSE India Scrapers and Yahoo Finance API.

#### 2.2 System Data Flow

```ascii
      ┌───────────────────────────┐
      │       MOBILE CLIENT       │
      │ (Native iOS - SwiftUI)    │
      └─────────────┬─────────────┘
                    │ (HTTPS/WSS via Supabase SDK)
                    ▼
      ┌───────────────────────────┐
      │      API & DB LAYER       │
      │ (Supabase + Node.js API)  │
      └─────────────┬─────────────┘
                    │ (Webhook / Event Trigger)
                    ▼
      ┌───────────────────────────┐      ┌────────────────────────┐
      │    BACKGROUND RUNTIME     │─────▶│     AI/LLM AGENTS      │
      │ (Inngest Serverless Jobs) │◀─────│ (Claude-3-Haiku API)   │
      └─────────────┬─────────────┘      └────────────────────────┘
                    │
                    ▼
      ┌───────────────────────────┐
      │      EXTERNAL DATA        │
      │ (NSE India / Yahoo Finance)│
      └───────────────────────────┘
```

---

### 3. Data Schema and Storage Design

The database is structured to support high-frequency updates while maintaining strict user data isolation through PostgreSQL Row-Level Security.

#### 3.1 Market Data Core
- **stock_prices**: Stores 90-day time-series data (ticker, date, OHLCV).
- **company_fundamentals**: Normalized financial metrics for 2,400+ NSE symbols.
- **macro_indicators**: Global and domestic indices tracking (Nifty 50, Sensex, FII/DII Net Flow).

#### 3.2 Intelligence and Signals
- **signals**: The heart of the intelligence engine.
  - *Metadata*: Ticker, event type, significance score, plain-English summary.
  - *Performance*: Entry price, 1-day/7-day/30-day percentage change, and a boolean profitability flag for win-rate calculation.
- **chart_patterns**: Technical patterns detected via algorithmic scanners.

#### 3.3 User and Personalization
- **user_profiles**: Encapsulates user experience level, risk tolerance, and investment horizon.
- **user_holdings**: Real-time positions used to weight the relevance of incoming market signals.
- **daily_briefs**: Pre-computed, JSON-structured content cached for zero-latency delivery to the mobile client.

---

### 4. Logic Implementation: Win-Rate Evaluation
To establish platform credibility, Stoqk implements a self-auditing performance loop:
1. Each signal records the "Entry Price" at the timestamp of detection.
2. At set intervals (1, 7, and 30 days), the **Performance Agent** queries historical price data.
3. It calculates the delta: `((Current Price - Entry Price) / Entry Price) * 100`.
4. The cumulative success rate forms the "Global Agent Win-Rate," providing users with a data-backed metric of AI accuracy.

---

### 5. Future Development Roadmap
1. **Automated Trading Integration**: Secure OAuth-based connection to Kite Connect for real-time portfolio synchronization.
2. **Predictive Concentration Analysis**: AI-driven alerts for sector-specific risk exposure exceeding predefined thresholds.
3. **Natural Language Consultation**: Context-aware chat interface allowing users to query their specific portfolio state against real-time market events.
4. **Institutional Signal Tracking**: Expansion of signal detection to include Mutual Fund monthly portfolio disclosures and large-scale bulk deal aggregations.
