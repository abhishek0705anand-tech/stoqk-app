import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: Tab = .today

    enum Tab: Int, CaseIterable {
        case today, radar, portfolio, ask, watchlist

        var title: String {
            switch self {
            case .today: return "Today"
            case .radar: return "Radar"
            case .portfolio: return "Portfolio"
            case .ask: return "Ask"
            case .watchlist: return "Watchlist"
            }
        }

        var icon: String {
            switch self {
            case .today: return "sun.max"
            case .radar: return "antenna.radiowaves.left.and.right"
            case .portfolio: return "briefcase"
            case .ask: return "bubble.left.and.text.bubble.right"
            case .watchlist: return "star"
            }
        }

        var selectedIcon: String {
            switch self {
            case .today: return "sun.max.fill"
            case .radar: return "antenna.radiowaves.left.and.right"
            case .portfolio: return "briefcase.fill"
            case .ask: return "bubble.left.and.text.bubble.right.fill"
            case .watchlist: return "star.fill"
            }
        }
    }

    @State private var showSettings: Bool = false

    var body: some View {
        TabView(selection: $selectedTab) {
            TodayView()
                .environmentObject(appState)
                .tabItem {
                    Label(Tab.today.title, systemImage: selectedTab == .today ? Tab.today.selectedIcon : Tab.today.icon)
                }
                .tag(Tab.today)

            RadarView()
                .tabItem {
                    Label(Tab.radar.title, systemImage: selectedTab == .radar ? Tab.radar.selectedIcon : Tab.radar.icon)
                }
                .tag(Tab.radar)

            PortfolioView()
                .environmentObject(appState)
                .tabItem {
                    Label(Tab.portfolio.title, systemImage: selectedTab == .portfolio ? Tab.portfolio.selectedIcon : Tab.portfolio.icon)
                }
                .tag(Tab.portfolio)

            AskView()
                .tabItem {
                    Label(Tab.ask.title, systemImage: selectedTab == .ask ? Tab.ask.selectedIcon : Tab.ask.icon)
                }
                .tag(Tab.ask)

            WatchlistView()
                .tabItem {
                    Label(Tab.watchlist.title, systemImage: selectedTab == .watchlist ? Tab.watchlist.selectedIcon : Tab.watchlist.icon)
                }
                .tag(Tab.watchlist)
        }
        .tint(Color.brand)
        .onChange(of: selectedTab) { _, _ in Haptic.light() }
        .sheet(isPresented: $showSettings) {
            SettingsView().environmentObject(appState)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showSettings = true
                    Haptic.light()
                } label: {
                    Image(systemName: "gearshape")
                }
            }
        }
    }
}
