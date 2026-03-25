import SwiftUI

// MARK: - View Model

@MainActor
final class PortfolioViewModel: ObservableObject {
    @Published var holdings: [UserHolding] = []
    @Published var signals: [Signal] = []
    @Published var patterns: [ChartPattern] = []
    @Published var isLoading: Bool = false
    @Published var showAddSheet: Bool = false
    @Published var error: String? = nil

    var summary: PortfolioSummary {
        guard !holdings.isEmpty else { return .empty }
        let totalValue = holdings.compactMap { $0.current_value }.reduce(0, +)
        let totalCost = holdings.compactMap { $0.cost_basis }.reduce(0, +)
        let pnl = totalValue - totalCost
        let pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0

        let sorted = holdings.sorted { ($0.unrealised_pnl_pct ?? 0) > ($1.unrealised_pnl_pct ?? 0) }
        return PortfolioSummary(
            totalValue: totalValue,
            totalCostBasis: totalCost,
            totalPnL: pnl,
            totalPnLPct: pnlPct,
            topGainer: sorted.first,
            topLoser: sorted.last
        )
    }

    func load() async {
        isLoading = true
        do {
            holdings = try await APIClient.shared.getHoldings()
            let tickers = holdings.map { $0.ticker }
            if !tickers.isEmpty {
                async let sigs = APIClient.shared.getSignalsForTickers(tickers)
                async let pats = APIClient.shared.getPatternsForTickers(tickers)
                signals = try await sigs
                patterns = try await pats
            }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func deleteHolding(ticker: String) async {
        do {
            try await APIClient.shared.deleteHolding(ticker: ticker)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func signalsFor(_ ticker: String) -> [Signal] {
        signals.filter { $0.ticker == ticker }
    }

    func patternsFor(_ ticker: String) -> [ChartPattern] {
        patterns.filter { $0.ticker == ticker }
    }
}

// MARK: - Portfolio View

struct PortfolioView: View {
    @StateObject private var vm = PortfolioViewModel()
    @State private var selectedHolding: UserHolding? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                if vm.isLoading && vm.holdings.isEmpty {
                    loadingView
                } else if vm.holdings.isEmpty {
                    emptyView
                } else {
                    portfolioContent
                }
            }
            .navigationTitle("Portfolio")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        vm.showAddSheet = true
                        Haptic.light()
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $vm.showAddSheet) {
                QuickAddHoldingSheet(onSave: { Task { await vm.load() } })
            }
            .sheet(item: $selectedHolding) { holding in
                HoldingDetailSheet(holding: holding, signals: vm.signalsFor(holding.ticker), patterns: vm.patternsFor(holding.ticker))
            }
        }
        .task { await vm.load() }
    }

    var loadingView: some View {
        ScrollView {
            VStack(spacing: Spacing.sm) {
                ShimmerCard().frame(height: 140)
                ForEach(0..<4, id: \.self) { _ in ShimmerCard() }
            }
            .padding(Spacing.lg)
        }
    }

    var emptyView: some View {
        EmptyStateView(
            icon: "briefcase",
            title: "No holdings yet",
            subtitle: "Add your first stock to see personalised signals and P&L tracking",
            action: { vm.showAddSheet = true },
            actionLabel: "Add your first stock"
        )
    }

    var portfolioContent: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.lg) {
                // Summary card
                PortfolioSummaryCard(summary: vm.summary)
                    .padding(.horizontal, Spacing.lg)

                // Active signals on holdings
                if !vm.signals.isEmpty {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        SectionHeader(title: "Signals on your stocks")
                            .padding(.horizontal, Spacing.lg)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: Spacing.sm) {
                                ForEach(vm.signals.prefix(5)) { signal in
                                    SignalCard(signal: signal, compact: true)
                                        .frame(width: 280)
                                }
                            }
                            .padding(.horizontal, Spacing.lg)
                        }
                    }
                }

                // Holdings list
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    SectionHeader(title: "Holdings")
                        .padding(.horizontal, Spacing.lg)

                    ForEach(vm.holdings) { holding in
                        HoldingCard(
                            holding: holding,
                            hasSignal: !vm.signalsFor(holding.ticker).isEmpty,
                            hasPattern: !vm.patternsFor(holding.ticker).isEmpty
                        )
                        .padding(.horizontal, Spacing.lg)
                        .onTapGesture {
                            selectedHolding = holding
                            Haptic.light()
                        }
                    }
                }

                Spacer().frame(height: Spacing.xl)
            }
            .padding(.top, Spacing.sm)
        }
        .refreshable { await vm.load() }
    }
}

// MARK: - Portfolio Summary Card

struct PortfolioSummaryCard: View {
    let summary: PortfolioSummary

    var body: some View {
        AppCard {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Text("Total portfolio")
                    .font(AppFont.caption())
                    .foregroundStyle(Color.textSecondary)

                HStack(alignment: .firstTextBaseline, spacing: Spacing.sm) {
                    Text(formatCrore(summary.totalValue))
                        .font(AppFont.number(32))
                        .foregroundStyle(Color.textPrimary)

                    PnLText(value: summary.totalPnLPct, isPercent: true)
                        .font(AppFont.mono(14))
                }

                HStack(spacing: Spacing.xs) {
                    Text("P&L: ")
                        .font(AppFont.caption())
                        .foregroundStyle(Color.textTertiary)
                    PnLText(value: summary.totalPnL, isPercent: false)
                }

                if let gainer = summary.topGainer, let loser = summary.topLoser, gainer.ticker != loser.ticker {
                    Divider()
                    HStack {
                        MiniHoldingStat(label: "Best", ticker: gainer.ticker, pct: gainer.unrealised_pnl_pct ?? 0)
                        Spacer()
                        Divider().frame(height: 30)
                        Spacer()
                        MiniHoldingStat(label: "Worst", ticker: loser.ticker, pct: loser.unrealised_pnl_pct ?? 0)
                    }
                }
            }
        }
    }

    func formatCrore(_ v: Double) -> String {
        if v >= 10_000_000 { return String(format: "₹%.2fCr", v / 10_000_000) }
        if v >= 100_000 { return String(format: "₹%.1fL", v / 100_000) }
        return String(format: "₹%.0f", v)
    }
}

struct MiniHoldingStat: View {
    let label: String
    let ticker: String
    let pct: Double

    var body: some View {
        VStack(spacing: 4) {
            Text(label).font(AppFont.caption(10)).foregroundStyle(Color.textTertiary)
            Text(ticker).font(AppFont.caption(12)).fontWeight(.semibold).foregroundStyle(Color.textPrimary)
            Text(String(format: "%+.1f%%", pct))
                .font(AppFont.mono(12))
                .foregroundStyle(pct >= 0 ? Color.gain : Color.loss)
        }
    }
}

// MARK: - Holding Card

struct HoldingCard: View {
    let holding: UserHolding
    let hasSignal: Bool
    let hasPattern: Bool

    var body: some View {
        AppCard {
            VStack(spacing: Spacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: Spacing.xs) {
                            Text(holding.ticker)
                                .font(AppFont.headline())
                                .foregroundStyle(Color.textPrimary)
                            if hasSignal {
                                Circle().fill(Color.warning).frame(width: 6, height: 6)
                            }
                        }
                        Text("\(Int(holding.qty)) shares · avg ₹\(Int(holding.avg_buy_price))")
                            .font(AppFont.caption())
                            .foregroundStyle(Color.textSecondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        if let price = holding.current_price {
                            Text(String(format: "₹%.2f", price))
                                .font(AppFont.mono())
                                .foregroundStyle(Color.textPrimary)
                        }
                        if let changePct = holding.change_pct_today {
                            Text(String(format: "%+.2f%%", changePct))
                                .font(AppFont.caption(11))
                                .foregroundStyle(changePct >= 0 ? Color.gain : Color.loss)
                        }
                    }
                }

                // P&L bar
                if let pnl = holding.unrealised_pnl_pct {
                    HStack {
                        PnLText(value: holding.unrealised_pnl ?? 0, isPercent: false)
                        Text("·")
                            .foregroundStyle(Color.textTertiary)
                        PnLText(value: pnl, isPercent: true)
                        Spacer()
                        if hasPattern {
                            Label("Pattern", systemImage: "chart.xyaxis.line")
                                .font(AppFont.caption(10))
                                .foregroundStyle(Color.info)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Holding Detail Sheet

struct HoldingDetailSheet: View {
    let holding: UserHolding
    let signals: [Signal]
    let patterns: [ChartPattern]
    @Environment(\.dismiss) private var dismiss
    @State private var fundamentals: CompanyFundamentals? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        // Chart
                        StockChart(ticker: holding.ticker)
                            .padding(.bottom, 8)

                        // Stats
                        HoldingStatsCard(holding: holding)

                        // Fundamentals
                        if let f = fundamentals {
                            FundamentalsCard(fundamentals: f)
                        } else {
                            ShimmerCard().frame(height: 120)
                        }

                        // Signals
                        if !signals.isEmpty {
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                SectionHeader(title: "Recent signals")
                                ForEach(signals.prefix(3)) { signal in
                                    SignalCard(signal: signal, compact: false)
                                }
                            }
                        }

                        // Patterns
                        if !patterns.isEmpty {
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                SectionHeader(title: "Chart patterns")
                                ForEach(patterns.prefix(2)) { pattern in
                                    PatternCard(pattern: pattern)
                                }
                            }
                        }
                    }
                    .padding(Spacing.lg)
                }
            }
            .navigationTitle(holding.ticker)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                do {
                    fundamentals = try await APIClient.shared.getFundamentals(ticker: holding.ticker)
                } catch {
                    print("Fundamentals failed: \(error)")
                }
            }
        }
    }
}

// MARK: - Fundamentals Component

struct FundamentalsCard: View {
    let fundamentals: CompanyFundamentals

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SectionHeader(title: "Company Fundamentals")
            
            AppCard {
                VStack(spacing: Spacing.md) {
                    HStack {
                        StatItem(label: "P/E Ratio", value: fundamentals.pe.map { String(format: "%.2fx", $0) } ?? "—")
                        Spacer()
                        StatItem(label: "ROE", value: fundamentals.roe.map { String(format: "%.1f%%", $0) } ?? "—")
                        Spacer()
                        StatItem(label: "D/E Ratio", value: fundamentals.debt_equity.map { String(format: "%.2f", $0) } ?? "—")
                    }
                    Divider()
                    HStack {
                        StatItem(label: "Rev Growth", value: fundamentals.revenue_growth_pct.map { String(format: "%.1f%%", $0) } ?? "—")
                        Spacer()
                        StatItem(label: "Promoter", value: fundamentals.promoter_holding_pct.map { String(format: "%.1f%%", $0) } ?? "—")
                        Spacer()
                        StatItem(label: "Market Cap", value: fundamentals.market_cap_cr.map { formatMCap($0) } ?? "—")
                    }
                }
            }
            
            if let sector = fundamentals.sector {
                Text("Sector: \(sector)")
                    .font(AppFont.caption(12))
                    .foregroundStyle(Color.textTertiary)
                    .padding(.top, 4)
            }
        }
    }

    func formatMCap(_ v: Double) -> String {
        if v >= 100_000 { return String(format: "₹%.1fL Cr", v / 100_000) }
        return String(format: "₹%.0f Cr", v)
    }
}

struct HoldingStatsCard: View {
    let holding: UserHolding

    var body: some View {
        AppCard {
            VStack(spacing: Spacing.md) {
                HStack {
                    StatItem(label: "Current price", value: holding.current_price.map { String(format: "₹%.2f", $0) } ?? "—")
                    Spacer()
                    StatItem(label: "Avg buy price", value: String(format: "₹%.2f", holding.avg_buy_price))
                    Spacer()
                    StatItem(label: "Quantity", value: "\(Int(holding.qty))")
                }
                Divider()
                HStack {
                    StatItem(label: "Current value", value: holding.current_value.map { formatCurrency($0) } ?? "—")
                    Spacer()
                    StatItem(label: "Cost basis", value: formatCurrency(holding.qty * holding.avg_buy_price))
                    Spacer()
                    VStack(alignment: .leading, spacing: 4) {
                        Text("P&L").font(AppFont.caption()).foregroundStyle(Color.textTertiary)
                        if let pnl = holding.unrealised_pnl {
                            PnLText(value: pnl, isPercent: false)
                        }
                    }
                }
            }
        }
    }

    func formatCurrency(_ v: Double) -> String {
        if v >= 10_000_000 { return String(format: "₹%.1fCr", v / 10_000_000) }
        if v >= 100_000 { return String(format: "₹%.1fL", v / 100_000) }
        return String(format: "₹%.0f", v)
    }
}

struct StatItem: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(AppFont.caption()).foregroundStyle(Color.textTertiary)
            Text(value).font(AppFont.mono(14)).foregroundStyle(Color.textPrimary)
        }
    }
}

// MARK: - Pattern Card

struct PatternCard: View {
    let pattern: ChartPattern
    @State private var isExpanded: Bool = false

    var body: some View {
        AppCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    HStack {
                        Label(pattern.pattern_name, systemImage: "chart.xyaxis.line")
                            .font(AppFont.headline(15))
                            .foregroundStyle(Color.textPrimary)
                        Spacer()
                        if let wr = pattern.historical_win_rate {
                            Text(String(format: "%.0f%% win", wr))
                                .font(AppFont.caption(11))
                                .foregroundStyle(wr >= 60 ? Color.gain : Color.textSecondary)
                                .padding(.horizontal, 8).padding(.vertical, 3)
                                .background(wr >= 60 ? Color.gain.opacity(0.1) : Color.bgTertiary)
                                .clipShape(Capsule())
                        }
                    }
                    Text(pattern.plain_explanation)
                        .font(AppFont.body())
                        .foregroundStyle(Color.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(Spacing.md)

                Divider()

                Button {
                    withAnimation(.spring(duration: 0.3)) { isExpanded.toggle() }
                    Haptic.light()
                } label: {
                    HStack {
                        Label(isExpanded ? "Less" : "What to watch", systemImage: isExpanded ? "chevron.up" : "eye")
                            .font(AppFont.caption(12)).foregroundStyle(Color.brand)
                        Spacer()
                    }
                    .padding(.horizontal, Spacing.md).padding(.vertical, Spacing.sm)
                }
                .buttonStyle(.plain)

                if isExpanded {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text(pattern.what_to_watch)
                            .font(AppFont.body()).foregroundStyle(Color.textPrimary)
                        if let note = pattern.horizon_note {
                            Label(note, systemImage: "calendar")
                                .font(AppFont.caption(12)).foregroundStyle(Color.textSecondary)
                        }
                    }
                    .padding(Spacing.md)
                    .background(Color.bgSecondary)
                }
            }
        }
    }
}

// MARK: - Quick Add Sheet

struct QuickAddHoldingSheet: View {
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var ticker = ""
    @State private var qty = ""
    @State private var price = ""
    @State private var isLoading = false

    var canSave: Bool { !ticker.isEmpty && Double(qty) != nil && Double(price) != nil }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()
                VStack(spacing: Spacing.lg) {
                    VStack(spacing: Spacing.sm) {
                        stockField
                        qtyField
                        priceField
                    }
                    Spacer()
                }
                .padding(Spacing.lg)
            }
            .navigationTitle("Add holding")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .fontWeight(.semibold)
                        .disabled(!canSave || isLoading)
                }
            }
        }
        .presentationDetents([.medium])
    }

    var stockField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Stock symbol").font(AppFont.caption()).foregroundStyle(Color.textSecondary)
            TextField("INFY, TATAMOTORS...", text: $ticker)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .onChange(of: ticker) { _, v in ticker = v.uppercased() }
                .fieldStyle()
        }
    }

    var qtyField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Quantity").font(AppFont.caption()).foregroundStyle(Color.textSecondary)
            TextField("Number of shares", text: $qty)
                .keyboardType(.decimalPad)
                .fieldStyle()
        }
    }

    var priceField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Average buy price (₹)").font(AppFont.caption()).foregroundStyle(Color.textSecondary)
            TextField("e.g. 1450.50", text: $price)
                .keyboardType(.decimalPad)
                .fieldStyle()
        }
    }

    func save() async {
        guard let q = Double(qty), let p = Double(price) else { return }
        isLoading = true
        do {
            _ = try await APIClient.shared.upsertHolding(ticker: ticker, qty: q, avgBuyPrice: p)
            onSave()
            dismiss()
            Haptic.success()
        } catch {}
        isLoading = false
    }
}

extension View {
    func fieldStyle() -> some View {
        self
            .font(AppFont.body())
            .foregroundStyle(Color.textPrimary)
            .padding(Spacing.md)
            .background(Color.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.bgTertiary, lineWidth: 1))
    }
}
