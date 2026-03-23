import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

@main
struct InvestorAppApp: App {
    #if canImport(UIKit)
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    #endif
    @StateObject private var appState = AppState.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if !appState.isAuthenticated {
                    AuthGate()
                } else if !appState.isOnboarded {
                    OnboardingView()
                        .environmentObject(appState)
                } else {
                    MainTabView()
                        .environmentObject(appState)
                }
            }
            .environmentObject(appState)
            .preferredColorScheme(.none) // System default — supports dark mode
        }
    }
}

// MARK: - Auth Gate (dev: auto-sign in)

struct AuthGate: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                VStack(spacing: Spacing.md) {
                    Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                        .font(.system(size: 72))
                        .foregroundStyle(Color.brand)
                        .symbolEffect(.pulse)

                    Text("Stoqk")
                        .font(AppFont.display(44))
                        .foregroundStyle(Color.textPrimary)

                    Text("Your personal market analyst")
                        .font(AppFont.body())
                        .foregroundStyle(Color.textSecondary)
                }

                Spacer()

                VStack(spacing: Spacing.md) {
                    Button("Get started") {
                        appState.devSignIn()
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .frame(maxWidth: .infinity)

                    Text("By continuing you agree to our Terms of Service and Privacy Policy.")
                        .font(AppFont.caption(11))
                        .foregroundStyle(Color.textTertiary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.bottom, Spacing.xxl)
            }
        }
    }
}
