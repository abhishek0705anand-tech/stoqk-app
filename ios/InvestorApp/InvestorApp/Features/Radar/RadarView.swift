import SwiftUI

// MARK: - View Model

@MainActor
final class RadarViewModel: ObservableObject {
    @Published var signals: [Signal] = []
    @Published var isLoading: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String? = nil
    @Published var selectedEventType: String? = nil
    @Published var minScore: Int = 0
    @Published var currentPage: Int = 1
    @Published var hasMore: Bool = true

    let eventTypeFilters = ["All", "bulk_deal", "insider_buy", "insider_sell", "promoter_buy", "pledge_increase", "block_deal"]

    func load(reset: Bool = false) async {
        if reset {
            signals = []; currentPage = 1; hasMore = true
        }
        guard hasMore, !isLoading else { return }
        isLoading = reset

        do {
            let res = try await APIClient.shared.getSignals(
                page: currentPage,
                eventType: selectedEventType,
                minScore: minScore
            )
            signals += res.signals
            hasMore = res.signals.count == (res.limit ?? 20)
            currentPage += 1
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func loadMore() async {
        guard !isLoadingMore, hasMore else { return }
        isLoadingMore = true
        await load()
        isLoadingMore = false
    }
}

// MARK: - Radar View

struct RadarView: View {
    @StateObject private var vm = RadarViewModel()
    @State private var selectedSignal: Signal? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Filter bar
                    FilterBar(vm: vm)

                    // Signal feed
                    if vm.isLoading && vm.signals.isEmpty {
                        loadingState
                    } else if vm.signals.isEmpty {
                        EmptyStateView(
                            icon: "antenna.radiowaves.left.and.right",
                            title: "No signals yet",
                            subtitle: "Market signals will appear here as they are detected"
                        )
                    } else {
                        signalList
                    }
                }
            }
            .navigationTitle("Radar")
            .navigationBarTitleDisplayMode(.large)
            .sheet(item: $selectedSignal) { signal in
                SignalDetailSheet(signal: signal)
            }
        }
        .task { await vm.load(reset: true) }
    }

    var loadingState: some View {
        ScrollView {
            VStack(spacing: Spacing.sm) {
                ForEach(0..<5, id: \.self) { _ in ShimmerCard() }
            }
            .padding(Spacing.lg)
        }
    }

    var signalList: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.sm) {
                ForEach(vm.signals) { signal in
                    SignalCard(signal: signal, compact: false)
                        .padding(.horizontal, Spacing.lg)
                        .onTapGesture {
                            selectedSignal = signal
                            Haptic.light()
                        }
                        .task {
                            if signal.id == vm.signals.last?.id {
                                await vm.loadMore()
                            }
                        }
                }

                if vm.isLoadingMore {
                    ProgressView()
                        .padding()
                }
            }
            .padding(.vertical, Spacing.sm)
        }
        .refreshable { await vm.load(reset: true) }
    }
}

// MARK: - Filter Bar

struct FilterBar: View {
    @ObservedObject var vm: RadarViewModel

    var body: some View {
        VStack(spacing: Spacing.sm) {
            // Event type chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.sm) {
                    ForEach(vm.eventTypeFilters, id: \.self) { filter in
                        FilterChip(
                            label: filter == "All" ? "All" : filter.replacingOccurrences(of: "_", with: " ").capitalized,
                            isSelected: filter == "All" ? vm.selectedEventType == nil : vm.selectedEventType == filter,
                            action: {
                                vm.selectedEventType = filter == "All" ? nil : filter
                                Task { await vm.load(reset: true) }
                                Haptic.light()
                            }
                        )
                    }
                }
                .padding(.horizontal, Spacing.lg)
            }

            // Score filter
            HStack {
                Text("Min score")
                    .font(AppFont.caption())
                    .foregroundStyle(Color.textSecondary)
                    .padding(.leading, Spacing.lg)

                ForEach([0, 50, 70, 80], id: \.self) { score in
                    Button("\(score)+") {
                        vm.minScore = score
                        Task { await vm.load(reset: true) }
                        Haptic.light()
                    }
                    .font(AppFont.caption(11))
                    .foregroundStyle(vm.minScore == score ? Color.brand : Color.textTertiary)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(vm.minScore == score ? Color.brand.opacity(0.1) : Color.clear)
                    .clipShape(Capsule())
                }
                Spacer()
            }
        }
        .padding(.vertical, Spacing.sm)
        .background(Color.bgPrimary)
    }
}

struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(AppFont.caption(12))
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundStyle(isSelected ? .white : Color.textSecondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.brand : Color.bgCard)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(isSelected ? Color.clear : Color.bgTertiary, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Signal Card (used in Today + Radar tabs)

struct SignalCard: View {
    let signal: Signal
    var compact: Bool = false
    @State private var isExpanded: Bool = false

    var body: some View {
        AppCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                // Main content
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: Spacing.xs) {
                            HStack(spacing: Spacing.xs) {
                                TickerChip(ticker: signal.ticker)
                                EventTypeBadge(eventType: signal.event_type.rawValue)
                            }
                            Text(timeAgo(signal.detected_at))
                                .font(AppFont.caption(10))
                                .foregroundStyle(Color.textTertiary)
                        }
                        Spacer()
                        ScoreBadge(score: signal.significance_score)
                    }

                    Text(signal.plain_summary)
                        .font(AppFont.body())
                        .foregroundStyle(Color.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineLimit(compact ? 3 : nil)

                    if let ctx = signal.historical_context, !ctx.isEmpty, !compact {
                        Label(ctx, systemImage: "clock.arrow.circlepath")
                            .font(AppFont.caption(12))
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                .padding(Spacing.md)

                // Dig deeper toggle
                if !compact {
                    Divider()
                        .background(Color.bgTertiary)

                    Button {
                        withAnimation(.spring(duration: 0.3)) { isExpanded.toggle() }
                        Haptic.light()
                    } label: {
                        HStack {
                            Label(isExpanded ? "Less" : "Dig deeper", systemImage: isExpanded ? "chevron.up" : "chevron.down")
                                .font(AppFont.caption(12))
                                .foregroundStyle(Color.brand)
                            Spacer()
                        }
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)
                    }
                    .buttonStyle(.plain)

                    if isExpanded {
                        RawDataView(signal: signal)
                            .padding(Spacing.md)
                            .background(Color.bgSecondary)
                    }
                }
            }
        }
    }

    func timeAgo(_ isoString: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: isoString) else { return "" }
        let diff = Date().timeIntervalSince(date)
        if diff < 3600 { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        return "\(Int(diff / 86400))d ago"
    }
}

struct RawDataView: View {
    let signal: Signal

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Raw data")
                .font(AppFont.caption())
                .foregroundStyle(Color.textTertiary)

            if let raw = signal.raw_data?.value as? [String: AnyCodable] {
                ForEach(Array(raw.keys.sorted()), id: \.self) { key in
                    HStack {
                        Text(key)
                            .font(AppFont.caption(11))
                            .foregroundStyle(Color.textSecondary)
                        Spacer()
                        Text("\(raw[key]?.value ?? "" as AnyObject)")
                            .font(AppFont.mono(11))
                            .foregroundStyle(Color.textPrimary)
                            .lineLimit(1)
                    }
                }
            } else {
                Text("Score: \(signal.significance_score) · Type: \(signal.event_type.displayName)")
                    .font(AppFont.caption(11))
                    .foregroundStyle(Color.textSecondary)
            }
        }
    }
}

// MARK: - Signal Detail Sheet

struct SignalDetailSheet: View {
    let signal: Signal
    @Environment(\.dismiss) private var dismiss
    @State private var news: [NewsItem] = []
    @State private var isLoadingNews = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        // Header
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            HStack {
                                TickerChip(ticker: signal.ticker)
                                EventTypeBadge(eventType: signal.event_type.rawValue)
                                Spacer()
                                ScoreBadge(score: signal.significance_score)
                            }
                            Text(signal.plain_summary)
                                .font(AppFont.title())
                                .foregroundStyle(Color.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        StockChart(ticker: signal.ticker)
                            .padding(.vertical, 8)

                        FundamentalsStrip(ticker: signal.ticker)

                        Divider()

                        if let ctx = signal.historical_context {
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                Label("Historical context", systemImage: "chart.line.uptrend.xyaxis")
                                    .font(AppFont.caption()).foregroundStyle(Color.textTertiary)
                                Text(ctx)
                                    .font(AppFont.body()).foregroundStyle(Color.textPrimary)
                            }
                            Divider()
                        }

                        // News section
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Label("News & Announcements", systemImage: "newspaper")
                                .font(AppFont.caption()).foregroundStyle(Color.textTertiary)

                            if isLoadingNews {
                                ForEach(0..<3, id: \.self) { _ in ShimmerView().frame(height: 64).clipShape(RoundedRectangle(cornerRadius: Radius.sm)) }
                            } else if news.isEmpty {
                                Text("No recent news found")
                                    .font(AppFont.body(13))
                                    .foregroundStyle(Color.textTertiary)
                            } else {
                                ForEach(news) { item in NewsRow(item: item) }
                            }
                        }
                    }
                    .padding(Spacing.lg)
                }
            }
            .navigationTitle(signal.ticker)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await loadNews() }
        }
    }

    private func loadNews() async {
        isLoadingNews = true
        if let res = try? await APIClient.shared.getNews(ticker: signal.ticker) {
            news = res.news
        }
        isLoadingNews = false
    }
}

// MARK: - News Row

struct NewsRow: View {
    let item: NewsItem

    var body: some View {
        Group {
            if let urlStr = item.url, let url = URL(string: urlStr) {
                Link(destination: url) { rowContent }
            } else {
                rowContent
            }
        }
        .buttonStyle(.plain)
    }

    var rowContent: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            // Source badge
            Text(item.isAnnouncement ? "NSE" : item.source.prefix(4))
                .font(AppFont.mono(9))
                .foregroundStyle(item.isAnnouncement ? Color.brand : Color.textTertiary)
                .padding(.horizontal, 5).padding(.vertical, 3)
                .background(item.isAnnouncement ? Color.brand.opacity(0.12) : Color.bgTertiary)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .frame(width: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.headline)
                    .font(AppFont.body(13))
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: Spacing.xs) {
                    Text(item.source)
                        .font(AppFont.caption(10))
                        .foregroundStyle(Color.textTertiary)
                    Text("·")
                        .font(AppFont.caption(10))
                        .foregroundStyle(Color.textTertiary)
                    Text(item.relativeTime)
                        .font(AppFont.caption(10))
                        .foregroundStyle(Color.textTertiary)
                    if item.url != nil {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 9))
                            .foregroundStyle(Color.brand)
                    }
                }
            }
        }
        .padding(Spacing.sm)
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
    }
}
