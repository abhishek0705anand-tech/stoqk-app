import Foundation

// MARK: - Enums

enum ExperienceLevel: String, Codable, CaseIterable {
    case beginner, intermediate, advanced, trader

    var displayName: String {
        switch self {
        case .beginner: return "Just starting out"
        case .intermediate: return "Know the basics"
        case .advanced: return "Investing for years"
        case .trader: return "Active trader"
        }
    }
}

enum PrimaryGoal: String, Codable, CaseIterable {
    case wealth_building, inflation_beat, income, aggressive_growth

    var displayName: String {
        switch self {
        case .wealth_building: return "Grow wealth over time"
        case .inflation_beat: return "Beat FD / inflation"
        case .income: return "Monthly income"
        case .aggressive_growth: return "High growth"
        }
    }
}

enum RiskTolerance: String, Codable, CaseIterable {
    case low, medium, high

    var displayName: String {
        switch self {
        case .low: return "I'd panic and sell"
        case .medium: return "I'd worry but hold"
        case .high: return "I'd buy more"
        }
    }
}

enum InvestmentHorizon: String, Codable, CaseIterable {
    case short, medium, long, very_long

    var displayName: String {
        switch self {
        case .short: return "Within 1 year"
        case .medium: return "1–5 years"
        case .long: return "5–10 years"
        case .very_long: return "10+ years"
        }
    }
}

enum EventType: String, Codable {
    case bulk_deal, insider_buy, insider_sell, pledge_increase,
         pledge_reduction, promoter_buy, block_deal, qip

    var displayName: String { rawValue.replacingOccurrences(of: "_", with: " ").capitalized }

    var isPositive: Bool {
        switch self {
        case .insider_buy, .promoter_buy, .bulk_deal, .pledge_reduction: return true
        default: return false
        }
    }
}

enum Urgency: String, Codable { case high, medium, low }

// MARK: - User Models

struct UserProfile: Codable, Identifiable {
    let id: String
    var experience_level: ExperienceLevel
    var primary_goal: PrimaryGoal
    var risk_tolerance: RiskTolerance
    var investment_horizon: InvestmentHorizon
    var preferred_sectors: [String]
    var portfolio_size_bucket: String
    var top_holdings: [String]
    var sector_concentration: [String: Double]
    var profile_block: String
    var onboarding_completed: Bool
    var created_at: String
    var updated_at: String
}

struct UserHolding: Codable, Identifiable {
    let id: String
    var user_id: String
    var ticker: String
    var qty: Double
    var avg_buy_price: Double
    var updated_at: String

    // Enriched (added client-side)
    var current_price: Double?
    var current_value: Double?
    var cost_basis: Double?
    var unrealised_pnl: Double?
    var unrealised_pnl_pct: Double?
    var change_pct_today: Double?
}

// MARK: - Market Data

struct Signal: Codable, Identifiable {
    let id: String
    var ticker: String
    var event_type: EventType
    var significance_score: Int
    var plain_summary: String
    var historical_context: String?
    var raw_data: AnyCodable?
    var detected_at: String

    var detectedDate: Date? {
        ISO8601DateFormatter().date(from: detected_at)
    }
}

struct ChartPattern: Codable, Identifiable {
    let id: String
    var ticker: String
    var pattern_name: String
    var detected_at: String
    var plain_explanation: String
    var what_to_watch: String
    var historical_win_rate: Double?
    var avg_move_pct: Double?
    var horizon_note: String?
}

struct MacroIndicator: Codable {
    var date: String
    var nifty_close: Double
    var sensex_close: Double
    var nifty_change_pct: Double?
    var sensex_change_pct: Double?
    var fii_net_cr: Double
    var dii_net_cr: Double
    var repo_rate: Double?
}

struct PricePoint: Codable {
    var ticker: String
    var date: String
    var close: Double
}

struct PriceHistoryResponse: Decodable {
    var prices: [PricePoint]
}

struct CompanyFundamentals: Codable {
    var ticker: String
    var pe: Double?
    var roe: Double?
    var debt_equity: Double?
    var revenue_growth_pct: Double?
    var promoter_holding_pct: Double?
    var pledge_pct: Double?
    var market_cap_cr: Double?
    var sector: String?
}

struct FundamentalsResponse: Decodable {
    var fundamentals: CompanyFundamentals
}

struct DailyBrief: Codable, Identifiable {
    var id: String
    var date: String
    var brief_json: BriefContent
    var viewed_at: String?

    struct BriefContent: Codable {
        var opening: String
        var market_snapshot: String
        var fii_dii: String
        var top_signal: String
        var portfolio_update: String?
        var watch_today: String
    }
}

// MARK: - Portfolio Summary

struct PortfolioSummary {
    var totalValue: Double
    var totalCostBasis: Double
    var totalPnL: Double
    var totalPnLPct: Double
    var topGainer: UserHolding?
    var topLoser: UserHolding?

    static var empty: PortfolioSummary {
        .init(totalValue: 0, totalCostBasis: 0, totalPnL: 0, totalPnLPct: 0)
    }
}

// MARK: - Onboarding

struct OnboardingAnswers: Codable {
    var experience_level: ExperienceLevel
    var primary_goal: PrimaryGoal
    var risk_tolerance: RiskTolerance
    var investment_horizon: InvestmentHorizon
    var preferred_sectors: [String]
}

// MARK: - Chat

struct ChatMessage: Identifiable {
    let id = UUID()
    var role: Role
    var plain: String
    var deeper: String
    var isStreaming: Bool = false

    enum Role { case user, assistant }
}

// MARK: - News

struct NewsItem: Codable, Identifiable {
    var id: String
    var ticker: String?
    var headline: String
    var source: String
    var source_type: String     // "announcement" | "news"
    var url: String?
    var published_at: String
    var summary: String?

    var publishedDate: Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: published_at) ?? ISO8601DateFormatter().date(from: published_at)
    }

    var relativeTime: String {
        guard let date = publishedDate else { return "" }
        let diff = Date().timeIntervalSince(date)
        if diff < 3600 { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        return "\(Int(diff / 86400))d ago"
    }

    var isAnnouncement: Bool { source_type == "announcement" }
}

struct NewsResponse: Decodable {
    var ticker: String
    var company: String
    var news: [NewsItem]
}

struct MarketNewsResponse: Decodable {
    var news: [NewsItem]
}

// MARK: - Helpers

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode(String.self) { value = v }
        else if let v = try? container.decode(Double.self) { value = v }
        else if let v = try? container.decode(Bool.self) { value = v }
        else if let v = try? container.decode([String: AnyCodable].self) { value = v }
        else if let v = try? container.decode([AnyCodable].self) { value = v }
        else { value = "" }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let v as String: try container.encode(v)
        case let v as Double: try container.encode(v)
        case let v as Bool: try container.encode(v)
        default: try container.encodeNil()
        }
    }
}
