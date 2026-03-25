import Foundation

// MARK: - API Client

final class APIClient: ObservableObject {
    static let shared = APIClient()

    private let baseURL: String
    private var authToken: String?

    init(baseURL: String = "https://stoqk-app.vercel.app/api/v1") {
        self.baseURL = baseURL
    }

    func setAuthToken(_ token: String?) { self.authToken = token }

    private func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: (some Encodable)? = nil as String?,
        isRetry: Bool = false
    ) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let authToken {
            req.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0

        // Token expired — refresh once and retry
        if statusCode == 401 && !isRetry {
            try await AppState.shared.refreshTokenIfNeeded()
            return try await request(path, method: method, body: body, isRetry: true)
        }

        guard (200..<300).contains(statusCode) else {
            if let errorBody = try? JSONDecoder().decode(APIErrorBody.self, from: data) {
                throw APIError.serverError(errorBody.error)
            }
            throw APIError.httpError(statusCode)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Profile

    func getProfile() async throws -> UserProfile {
        let res: ProfileResponse = try await request("/profile/me")
        return res.profile
    }

    func completeOnboarding(answers: OnboardingAnswers) async throws -> UserProfile {
        let res: ProfileResponse = try await request("/profile/onboarding", method: "POST", body: answers)
        return res.profile
    }

    // MARK: - Holdings

    func getHoldings() async throws -> [UserHolding] {
        let res: HoldingsResponse = try await request("/holdings")
        return res.holdings
    }

    func upsertHolding(ticker: String, qty: Double, avgBuyPrice: Double) async throws -> UserHolding {
        let body = HoldingInput(ticker: ticker, qty: qty, avg_buy_price: avgBuyPrice)
        let res: HoldingResponse = try await request("/holdings", method: "PUT", body: body)
        return res.holding
    }

    func deleteHolding(ticker: String) async throws {
        let _: SuccessResponse = try await request("/holdings/\(ticker)", method: "DELETE")
    }

    func bulkUpdateHoldings(_ holdings: [HoldingInput]) async throws {
        struct BulkBody: Encodable { let holdings: [HoldingInput] }
        let _: SuccessResponse = try await request("/holdings/bulk", method: "POST", body: BulkBody(holdings: holdings))
    }

    // MARK: - Signals

    func getSignals(page: Int = 1, eventType: String? = nil, minScore: Int = 0, ticker: String? = nil) async throws -> SignalFeedResponse {
        var path = "/signals?page=\(page)&min_score=\(minScore)"
        if let et = eventType { path += "&event_type=\(et)" }
        if let t = ticker { path += "&ticker=\(t)" }
        return try await request(path)
    }

    func getSignalsForTickers(_ tickers: [String]) async throws -> [Signal] {
        struct Body: Encodable { let tickers: [String] }
        let res: SignalsResponse = try await request("/signals/for-tickers", method: "POST", body: Body(tickers: tickers))
        return res.signals
    }

    // MARK: - Watchlist

    func getWatchlist() async throws -> [WatchlistItem] {
        let res: WatchlistResponse = try await request("/watchlist")
        return res.watchlist
    }

    func addToWatchlist(ticker: String) async throws {
        struct Body: Encodable { let ticker: String }
        let _: WatchlistItemResponse = try await request("/watchlist", method: "POST", body: Body(ticker: ticker))
    }

    func removeFromWatchlist(ticker: String) async throws {
        let _: SuccessResponse = try await request("/watchlist/\(ticker)", method: "DELETE")
    }

    // MARK: - Briefs

    func getTodayBrief() async throws -> BriefResponse {
        return try await request("/briefs/today")
    }

    func getMacro() async throws -> MacroResponse {
        return try await request("/briefs/macro")
    }

    // MARK: - Patterns

    func getPatternsForTickers(_ tickers: [String]) async throws -> [ChartPattern] {
        struct Body: Encodable { let tickers: [String] }
        let res: PatternsResponse = try await request("/patterns/for-tickers", method: "POST", body: Body(tickers: tickers))
        return res.patterns
    }

    func getPriceHistory(ticker: String) async throws -> [PricePoint] {
        let res: PriceHistoryResponse = try await request("/prices/history/\(ticker)")
        return res.prices
    }

    func getFundamentals(ticker: String) async throws -> CompanyFundamentals {
        let res: FundamentalsResponse = try await request("/prices/fundamentals/\(ticker)")
        return res.fundamentals
    }

    // MARK: - News

    func getNews(ticker: String) async throws -> NewsResponse {
        return try await request("/news/\(ticker)")
    }

    func getMarketHeadlines() async throws -> [NewsItem] {
        let res: MarketNewsResponse = try await request("/news/market/headlines")
        return res.news
    }

    // MARK: - Chat

    func registerDeviceToken(_ token: String) async throws {
        struct Body: Encodable { let apns_token: String; let platform: String }
        let _: SuccessResponse = try await request("/internal/devices", method: "POST", body: Body(apns_token: token, platform: "ios"))
    }

    func getChatSuggestions() async throws -> [String] {
        struct Res: Decodable { let suggestions: [String] }
        let res: Res = try await request("/chat/suggestions")
        return res.suggestions
    }

    func sendChat(message: String) async throws -> String {
        struct Body: Encodable { let message: String }
        struct Res: Decodable { let job_id: String }
        let res: Res = try await request("/chat", method: "POST", body: Body(message: message))
        return res.job_id
    }

    func getChatResult(jobId: String) async throws -> ChatJobResult {
        return try await request("/chat/result/\(jobId)")
    }
}

// MARK: - Response Types

struct ProfileResponse: Decodable { let profile: UserProfile }
struct HoldingsResponse: Decodable { let holdings: [UserHolding] }
struct HoldingResponse: Decodable { let holding: UserHolding }
struct SignalFeedResponse: Decodable { let signals: [Signal]; let total: Int?; let page: Int?; let limit: Int? }
struct SignalsResponse: Decodable { let signals: [Signal] }
struct WatchlistResponse: Decodable { let watchlist: [WatchlistItem] }
struct WatchlistItemResponse: Decodable { let item: WatchlistItem }
struct BriefResponse: Decodable { let brief: DailyBrief.BriefContent?; let date: String }
struct MacroResponse: Decodable { let macro: MacroIndicator? }
struct PatternsResponse: Decodable { let patterns: [ChartPattern] }
struct SuccessResponse: Decodable { let success: Bool? }
struct APIErrorBody: Decodable { let error: String }
struct ChatJobResult: Decodable {
    var id: String
    var status: String   // "pending" | "done" | "error"
    var plain: String?
    var deeper: String?
    var created_at: String
    var completed_at: String?
}

struct WatchlistItem: Codable, Identifiable {
    var id: String
    var user_id: String
    var ticker: String
    var added_at: String
    var price: LivePrice?
    var patterns: [ChartPattern]?

    struct LivePrice: Codable {
        var price: Double
        var change_pct: Double
    }
}

struct HoldingInput: Codable {
    var ticker: String
    var qty: Double
    var avg_buy_price: Double
}

// MARK: - Errors

enum APIError: Error, LocalizedError {
    case invalidURL
    case httpError(Int)
    case serverError(String)
    case decodingError

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .httpError(let code): return "Server error \(code)"
        case .serverError(let msg): return msg
        case .decodingError: return "Failed to decode response"
        }
    }
}
