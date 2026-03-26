import SwiftUI

// MARK: - View Model

@MainActor
final class WatchlistViewModel: ObservableObject {
    @Published var items: [WatchlistItem] = []
    @Published var isLoading: Bool = false
    @Published var showAddSheet: Bool = false
    @Published var searchText: String = ""
    @Published var error: String? = nil

    func load() async {
        isLoading = true
        do {
            items = try await APIClient.shared.getWatchlist()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func add(ticker: String) async {
        let t = ticker.uppercased().trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return }
        do {
            try await APIClient.shared.addToWatchlist(ticker: t)
            await load()
            Haptic.success()
        } catch {
            self.error = error.localizedDescription
            Haptic.error()
        }
    }

    func remove(ticker: String) async {
        do {
            try await APIClient.shared.removeFromWatchlist(ticker: ticker)
            items.removeAll { $0.ticker == ticker }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Watchlist View

struct WatchlistView: View {
    @StateObject private var vm = WatchlistViewModel()
    @State private var addTicker: String = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                if vm.isLoading && vm.items.isEmpty {
                    loadingState
                } else if vm.items.isEmpty {
                    emptyState
                } else {
                    watchlistContent
                }
            }
            .navigationTitle("Watchlist")
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
                AddToWatchlistSheet(vm: vm)
            }
        }
        .task { await vm.load() }
    }

    var loadingState: some View {
        ScrollView {
            VStack(spacing: Spacing.sm) {
                ForEach(0..<5, id: \.self) { _ in ShimmerCard() }
            }
            .padding(Spacing.lg)
        }
    }

    var emptyState: some View {
        EmptyStateView(
            icon: "star",
            title: "Nothing on your watchlist",
            subtitle: "Track stocks you're interested in but don't own yet",
            action: { vm.showAddSheet = true },
            actionLabel: "Add a stock"
        )
    }

    var watchlistContent: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.sm) {
                ForEach(vm.items) { item in
                    WatchlistItemCard(item: item, onRemove: {
                        Task { await vm.remove(ticker: item.ticker) }
                    })
                    .padding(.horizontal, Spacing.lg)
                }
            }
            .padding(.vertical, Spacing.sm)
        }
        .refreshable { await vm.load() }
    }
}

// MARK: - Watchlist Item Card

struct WatchlistItemCard: View {
    let item: WatchlistItem
    let onRemove: () -> Void
    @State private var showPatterns: Bool = false
    @State private var showDetail: Bool = false

    var body: some View {
        AppCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.ticker)
                            .font(AppFont.headline())
                            .foregroundStyle(Color.textPrimary)

                        let patterns = item.patterns ?? []
                        if !patterns.isEmpty {
                            Label("\(patterns.count) pattern\(patterns.count == 1 ? "" : "s") detected", systemImage: "chart.xyaxis.line")
                                .font(AppFont.caption(11))
                                .foregroundStyle(Color.info)
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        if let lp = item.price {
                            Text(String(format: "₹%.2f", lp.price))
                                .font(AppFont.mono())
                                .foregroundStyle(Color.textPrimary)
                            Text(String(format: "%+.2f%%", lp.change_pct))
                                .font(AppFont.caption(11))
                                .foregroundStyle(lp.change_pct >= 0 ? Color.gain : Color.loss)
                        } else {
                            Text("—")
                                .font(AppFont.mono())
                                .foregroundStyle(Color.textTertiary)
                        }
                    }
                }
                .padding(Spacing.md)

                let patterns = item.patterns ?? []
                if !patterns.isEmpty {
                    Divider()
                    Button {
                        withAnimation(.spring(duration: 0.3)) { showPatterns.toggle() }
                        Haptic.light()
                    } label: {
                        HStack {
                            Label(showPatterns ? "Hide patterns" : "Show patterns", systemImage: showPatterns ? "chevron.up" : "chart.xyaxis.line")
                                .font(AppFont.caption(12)).foregroundStyle(Color.brand)
                            Spacer()
                        }
                        .padding(.horizontal, Spacing.md).padding(.vertical, Spacing.sm)
                    }
                    .buttonStyle(.plain)

                    if showPatterns {
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            ForEach(patterns.prefix(2)) { pattern in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(pattern.pattern_name)
                                        .font(AppFont.caption(12)).fontWeight(.semibold)
                                        .foregroundStyle(Color.textPrimary)
                                    Text(pattern.plain_explanation)
                                        .font(AppFont.caption(12))
                                        .foregroundStyle(Color.textSecondary)
                                        .lineLimit(2)
                                }
                                if patterns.prefix(2).last?.id != pattern.id {
                                    Divider()
                                }
                            }
                        }
                        .padding(Spacing.md)
                        .background(Color.bgSecondary)
                    }
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { showDetail = true }
        .sheet(isPresented: $showDetail) {
            StockDetailSheet(ticker: item.ticker)
        }
        .contextMenu {
            Button(role: .destructive) {
                onRemove()
            } label: {
                Label("Remove from watchlist", systemImage: "trash")
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) { onRemove() } label: {
                Label("Remove", systemImage: "trash")
            }
        }
    }
}

// MARK: - Add To Watchlist Sheet

struct AddToWatchlistSheet: View {
    @ObservedObject var vm: WatchlistViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var ticker: String = ""
    @FocusState private var isFocused: Bool

    let popularStocks = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
                         "TATAMOTORS", "WIPRO", "BAJFINANCE", "SUNPHARMA", "LT"]

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(alignment: .leading, spacing: Spacing.xl) {
                    // Search field
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundStyle(Color.textTertiary)
                            TextField("NSE symbol (e.g. INFY)", text: $ticker)
                                .font(AppFont.body())
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                                .focused($isFocused)
                                .onChange(of: ticker) { _, v in ticker = v.uppercased() }
                                .onSubmit { Task { await vm.add(ticker: ticker); dismiss() } }
                        }
                        .padding(Spacing.md)
                        .background(Color.bgCard)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.bgTertiary, lineWidth: 1))
                    }

                    // Popular picks
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("Popular stocks")
                            .font(AppFont.caption())
                            .foregroundStyle(Color.textTertiary)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.sm) {
                            ForEach(popularStocks, id: \.self) { stock in
                                Button(stock) {
                                    ticker = stock
                                    Task { await vm.add(ticker: stock); dismiss() }
                                }
                                .font(AppFont.caption(12))
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.brand)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 6)
                                .frame(maxWidth: .infinity)
                                .background(Color.brand.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
                            }
                        }
                    }

                    Spacer()
                }
                .padding(Spacing.lg)
            }
            .navigationTitle("Add to watchlist")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task { await vm.add(ticker: ticker); dismiss() }
                    }
                    .fontWeight(.semibold)
                    .disabled(ticker.isEmpty)
                }
            }
            .onAppear { isFocused = true }
        }
        .presentationDetents([.medium])
    }
}
