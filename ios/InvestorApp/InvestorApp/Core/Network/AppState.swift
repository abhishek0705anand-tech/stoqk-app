import SwiftUI
import Combine

// MARK: - Supabase Auth Client

private enum SupabaseAuth {
    static let baseURL = "https://crlzhwbxsohvgofdwjmq.supabase.co/auth/v1"
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNybHpod2J4c29odmdvZmR3am1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDI2MTksImV4cCI6MjA4OTc3ODYxOX0.4_jEvoqjRPOgJHUCnuCd0GVPaDT5SnO2x6pgWLTu57Q"

    struct SessionResponse: Decodable {
        let access_token: String
        let refresh_token: String
        let user: SupabaseUser
    }
    struct SupabaseUser: Decodable { let id: String }
    struct ErrorResponse: Decodable {
        let error_description: String?
        let msg: String?
        var message: String { error_description ?? msg ?? "Auth failed" }
    }

    static func signIn(email: String, password: String) async throws -> SessionResponse {
        try await post(path: "/token?grant_type=password", body: ["email": email, "password": password])
    }

    static func signUp(email: String, password: String) async throws -> SessionResponse {
        try await post(path: "/signup", body: ["email": email, "password": password])
    }

    static func signOut(token: String) async throws {
        guard let url = URL(string: baseURL + "/logout") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        _ = try? await URLSession.shared.data(for: req)
    }

    static func refresh(token: String) async throws -> SessionResponse {
        try await post(path: "/token?grant_type=refresh_token", body: ["refresh_token": token])
    }

    private static func post<T: Decodable>(path: String, body: [String: String]) async throws -> T {
        guard let url = URL(string: baseURL + path) else { throw AuthError.unknown }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if !(200..<300).contains(status) {
            let err = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw AuthError.message(err?.message ?? "Auth error (\(status))")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum AuthError: LocalizedError {
    case message(String)
    case unknown
    var errorDescription: String? {
        switch self {
        case .message(let m): return m
        case .unknown: return "Unknown error"
        }
    }
}

// MARK: - App State

@MainActor
final class AppState: ObservableObject {
    static let shared = AppState()

    @Published var isAuthenticated: Bool = false
    @Published var userId: String? = nil
    @Published var profile: UserProfile? = nil
    @Published var isOnboarded: Bool = false

    private let api = APIClient.shared
    private let defaults = UserDefaults.standard

    init() {
        Task { await restoreSession() }
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws {
        let session = try await SupabaseAuth.signIn(email: email, password: password)
        applySession(session)
        await loadProfile()
    }

    func signUp(email: String, password: String) async throws {
        let session = try await SupabaseAuth.signUp(email: email, password: password)
        applySession(session)
    }

    func signOut() async {
        if let token = defaults.string(forKey: "sb_access_token") {
            try? await SupabaseAuth.signOut(token: token)
        }
        clearSession()
    }

    // MARK: - Session

    private func restoreSession() async {
        guard let refreshToken = defaults.string(forKey: "sb_refresh_token") else { return }
        do {
            let session = try await SupabaseAuth.refresh(token: refreshToken)
            applySession(session)
            await loadProfile()
        } catch {
            clearSession()
        }
    }

    private func applySession(_ session: SupabaseAuth.SessionResponse) {
        userId = session.user.id
        isAuthenticated = true
        defaults.set(session.access_token, forKey: "sb_access_token")
        defaults.set(session.refresh_token, forKey: "sb_refresh_token")
        APIClient.shared.setAuthToken(session.access_token)
    }

    private func clearSession() {
        userId = nil
        profile = nil
        isAuthenticated = false
        isOnboarded = false
        defaults.removeObject(forKey: "sb_access_token")
        defaults.removeObject(forKey: "sb_refresh_token")
        APIClient.shared.setAuthToken(nil)
    }

    // MARK: - Profile

    func loadProfile() async {
        do {
            let p = try await api.getProfile()
            profile = p
            isOnboarded = p.onboarding_completed
        } catch {
            isOnboarded = false
        }
    }
}
