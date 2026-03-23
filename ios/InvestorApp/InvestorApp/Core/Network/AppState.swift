import SwiftUI
import Combine

// MARK: - App State (single source of truth)

@MainActor
final class AppState: ObservableObject {
    static let shared = AppState()

    @Published var isAuthenticated: Bool = false
    @Published var userId: String? = nil
    @Published var profile: UserProfile? = nil
    @Published var isOnboarded: Bool = false

    private let api = APIClient.shared

    func signIn(userId: String) {
        self.userId = userId
        self.isAuthenticated = true
        APIClient.shared.setUserId(userId)
        Task { await loadProfile() }
    }

    func loadProfile() async {
        do {
            let p = try await api.getProfile()
            self.profile = p
            self.isOnboarded = p.onboarding_completed
        } catch {
            // Profile not found — needs onboarding
            self.isOnboarded = false
        }
    }

    func signOut() {
        userId = nil
        profile = nil
        isAuthenticated = false
        isOnboarded = false
    }

    // Demo / development: auto sign-in with a fixed UUID
    func devSignIn() {
        let devId = UserDefaults.standard.string(forKey: "dev_user_id") ?? {
            let id = UUID().uuidString
            UserDefaults.standard.set(id, forKey: "dev_user_id")
            return id
        }()
        signIn(userId: devId)
    }
}
