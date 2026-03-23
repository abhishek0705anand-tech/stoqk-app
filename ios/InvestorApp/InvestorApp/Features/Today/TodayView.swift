import SwiftUI

// MARK: - View Model

@MainActor
final class TodayViewModel: ObservableObject {
    @Published var brief: DailyBrief.BriefContent? = nil
    @Published var macro: MacroIndicator? = nil
    @Published var holdingSignals: [Signal] = []
    @Published var isLoading: Bool = true
    @Published var error: String? = nil

    func load(userId: String) async {
        isLoading = true
        error = nil

        await withTaskGroup(of: Void.self) { group in
            group.addTask { [weak self] in
                do {
                    let res = try await APIClient.shared.getTodayBrief()
                    await MainActor.run { self?.brief = res.brief }
                } catch {
                    await MainActor.run { self?.error = error.localizedDescription }
                }
            }

            group.addTask { [weak self] in
                do {
                    let res = try await APIClient.shared.getMacro()
                    await MainActor.run { self?.macro = res.macro }
                } catch {}
            }

            group.addTask { [weak self] in
                do {
                    let holdings = try await APIClient.shared.getHoldings()
                    let tickers = holdings.map { $0.ticker }
                    if !tickers.isEmpty {
                        let signals = try await APIClient.shared.getSignalsForTickers(tickers)
                        await MainActor.run { self?.holdingSignals = signals.prefix(3).map { $0 } }
                    }
                } catch {}
            }
        }

        isLoading = false
    }
}

// MARK: - View

struct TodayView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var vm = TodayViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: Spacing.lg) {
                        // Greeting
                        GreetingHeader(profile: appState.profile)

                        // Index chips
                        if let macro = vm.macro {
                            MacroStrip(macro: macro)
                        } else if vm.isLoading {
                            ShimmerCard().frame(height: 70)
                                .padding(.horizontal, Spacing.lg)
                        }

                        // Morning brief
                        if let brief = vm.brief {
                            BriefSection(brief: brief)
                        } else if vm.isLoading {
                            VStack(spacing: Spacing.sm) {
                                ShimmerCard(); ShimmerCard()
                            }
                            .padding(.horizontal, Spacing.lg)
                        }

                        // Active signals on holdings
                        if !vm.holdingSignals.isEmpty {
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                SectionHeader(title: "On your holdings")
                                    .padding(.horizontal, Spacing.lg)
                                ForEach(vm.holdingSignals) { signal in
                                    SignalCard(signal: signal, compact: true)
                                        .padding(.horizontal, Spacing.lg)
                                }
                            }
                        }

                        Spacer().frame(height: Spacing.xl)
                    }
                    .padding(.top, Spacing.sm)
                }
                .refreshable {
                    if let uid = appState.userId { await vm.load(userId: uid) }
                }
            }
            .navigationBarHidden(true)
        }
        .task {
            if let uid = appState.userId { await vm.load(userId: uid) }
        }
    }
}

// MARK: - Greeting Header

struct GreetingHeader: View {
    let profile: UserProfile?

    var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    var subtitle: String {
        let level = profile?.experience_level.rawValue ?? "investor"
        switch level {
        case "beginner": return "Here's what matters for you today."
        case "trader": return "Markets are open. Here's what's moving."
        default: return "Here's your market intelligence for today."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(greeting)
                .font(AppFont.display())
                .foregroundStyle(Color.textPrimary)
            Text(subtitle)
                .font(AppFont.body())
                .foregroundStyle(Color.textSecondary)
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.lg)
    }
}

// MARK: - Macro Strip

struct MacroStrip: View {
    let macro: MacroIndicator

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                IndexChip(name: "NIFTY 50", value: macro.nifty_close, changePct: macro.nifty_change_pct ?? 0)
                IndexChip(name: "SENSEX", value: macro.sensex_close, changePct: macro.sensex_change_pct ?? 0)

                // FII/DII mini
                FIIDIIChip(label: "FII", value: macro.fii_net_cr)
                FIIDIIChip(label: "DII", value: macro.dii_net_cr)

                if let repo = macro.repo_rate {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("REPO").font(AppFont.caption(10)).foregroundStyle(Color.textTertiary)
                        Text(String(format: "%.2f%%", repo)).font(AppFont.mono(14)).foregroundStyle(Color.textPrimary)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Color.bgCard)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                    .appShadow(radius: 4, opacity: 0.04)
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
    }
}

struct FIIDIIChip: View {
    let label: String
    let value: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(AppFont.caption(10)).foregroundStyle(Color.textTertiary)
            Text(String(format: "%+.0fCr", value))
                .font(AppFont.mono(14))
                .foregroundStyle(value >= 0 ? Color.gain : Color.loss)
            Text(value >= 0 ? "Net buy" : "Net sell")
                .font(AppFont.caption(10))
                .foregroundStyle(Color.textTertiary)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .appShadow(radius: 4, opacity: 0.04)
    }
}

// MARK: - Brief Section

struct BriefSection: View {
    let brief: DailyBrief.BriefContent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            SectionHeader(title: "Morning brief")
                .padding(.horizontal, Spacing.lg)

            // Opening card — large, prominent
            AppCard {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    HStack {
                        Label("Today's insight", systemImage: "sparkles")
                            .font(AppFont.caption())
                            .foregroundStyle(Color.brand)
                        Spacer()
                    }
                    Text(brief.opening)
                        .font(AppFont.title(20))
                        .foregroundStyle(Color.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, Spacing.lg)

            // Market snapshot
            BriefCard(icon: "chart.bar.xaxis", label: "Market", content: brief.market_snapshot)
                .padding(.horizontal, Spacing.lg)

            // FII/DII
            BriefCard(icon: "arrow.left.arrow.right", label: "Flows", content: brief.fii_dii)
                .padding(.horizontal, Spacing.lg)

            // Top signal
            BriefCard(icon: "bolt.fill", label: "Top signal", content: brief.top_signal, accentColor: .warning)
                .padding(.horizontal, Spacing.lg)

            // Portfolio update
            if let portUpdate = brief.portfolio_update {
                BriefCard(icon: "briefcase.fill", label: "Your portfolio", content: portUpdate, accentColor: .gain)
                    .padding(.horizontal, Spacing.lg)
            }

            // Watch today
            AppCard {
                HStack(spacing: Spacing.md) {
                    Image(systemName: "eye.fill")
                        .foregroundStyle(Color.brand)
                        .font(.system(size: 18))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Watch today")
                            .font(AppFont.caption())
                            .foregroundStyle(Color.brand)
                        Text(brief.watch_today)
                            .font(AppFont.body())
                            .foregroundStyle(Color.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
    }
}

struct BriefCard: View {
    let icon: String
    let label: String
    let content: String
    var accentColor: Color = .textTertiary

    var body: some View {
        AppCard {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Label(label, systemImage: icon)
                    .font(AppFont.caption())
                    .foregroundStyle(accentColor)
                Text(content)
                    .font(AppFont.body())
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
