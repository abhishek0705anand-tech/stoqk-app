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
                if appState.isInitialLoading {
                    SplashView()
                } else if !appState.isAuthenticated {
                    LoginView()
                } else if !appState.isOnboarded {
                    OnboardingView()
                        .environmentObject(appState)
                } else {
                    MainTabView()
                        .environmentObject(appState)
                }
            }
            .animation(.easeInOut, value: appState.isInitialLoading)
            .environmentObject(appState)
            .preferredColorScheme(.none) // System default — supports dark mode
        }
    }
}

