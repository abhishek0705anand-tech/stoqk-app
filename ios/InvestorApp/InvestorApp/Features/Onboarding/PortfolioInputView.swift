import SwiftUI

@MainActor
final class PortfolioInputViewModel: ObservableObject {
    @Published var holdings: [HoldingInput] = []
    @Published var ticker: String = ""
    @Published var qty: String = ""
    @Published var avgPrice: String = ""
    @Published var isLoading: Bool = false
    @Published var error: String? = nil
    @Published var showAddSheet: Bool = false

    var totalValue: Double {
        holdings.reduce(0) { $0 + $1.qty * $1.avg_buy_price }
    }

    func addHolding() {
        guard !ticker.isEmpty,
              let q = Double(qty), q > 0,
              let p = Double(avgPrice), p > 0 else { return }

        let t = ticker.uppercased()
        if let idx = holdings.firstIndex(where: { $0.ticker == t }) {
            holdings[idx] = HoldingInput(ticker: t, qty: q, avg_buy_price: p)
        } else {
            holdings.append(HoldingInput(ticker: t, qty: q, avg_buy_price: p))
        }
        reset()
        Haptic.success()
    }

    func remove(at offsets: IndexSet) {
        holdings.remove(atOffsets: offsets)
    }

    func reset() {
        ticker = ""; qty = ""; avgPrice = ""; showAddSheet = false
    }

    func save(appState: AppState) async {
        isLoading = true
        do {
            if !holdings.isEmpty {
                try await APIClient.shared.bulkUpdateHoldings(holdings)
            }
            await appState.loadProfile()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct PortfolioInputView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var vm = PortfolioInputViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Header
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Your portfolio")
                                .font(AppFont.display())
                                .foregroundStyle(Color.textPrimary)
                            Text("Add your current holdings so we can personalise insights for you. You can skip this and add later.")
                                .font(AppFont.body())
                                .foregroundStyle(Color.textSecondary)
                        }
                        .padding(.horizontal, Spacing.lg)
                        .padding(.top, Spacing.lg)

                        // Holdings list
                        if vm.holdings.isEmpty {
                            EmptyStateView(
                                icon: "chart.pie",
                                title: "No holdings yet",
                                subtitle: "Tap + to add your first stock"
                            )
                        } else {
                            VStack(spacing: Spacing.sm) {
                                ForEach(vm.holdings, id: \.ticker) { holding in
                                    HoldingRow(holding: holding)
                                }
                                .onDelete(perform: vm.remove)
                            }
                            .padding(.horizontal, Spacing.lg)

                            // Total
                            AppCard {
                                HStack {
                                    Text("Total invested")
                                        .font(AppFont.body())
                                        .foregroundStyle(Color.textSecondary)
                                    Spacer()
                                    Text(formatCurrency(vm.totalValue))
                                        .font(AppFont.number(18))
                                        .foregroundStyle(Color.textPrimary)
                                }
                            }
                            .padding(.horizontal, Spacing.lg)
                        }

                        // Add button
                        Button {
                            vm.showAddSheet = true
                            Haptic.light()
                        } label: {
                            HStack {
                                Image(systemName: "plus.circle.fill")
                                Text("Add a stock")
                            }
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .padding(.horizontal, Spacing.lg)

                        // Actions
                        VStack(spacing: Spacing.sm) {
                            Button {
                                Task { await vm.save(appState: appState) }
                            } label: {
                                if vm.isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    Text(vm.holdings.isEmpty ? "Skip for now" : "Save and continue")
                                        .frame(maxWidth: .infinity)
                                }
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .disabled(vm.isLoading)
                        }
                        .padding(.horizontal, Spacing.lg)
                        .padding(.bottom, Spacing.xl)
                    }
                }
            }
            .navigationBarHidden(true)
            .sheet(isPresented: $vm.showAddSheet) {
                AddHoldingSheet(vm: vm)
            }
        }
    }

    func formatCurrency(_ value: Double) -> String {
        if value >= 10_000_000 { return String(format: "₹%.1fCr", value / 10_000_000) }
        if value >= 100_000 { return String(format: "₹%.1fL", value / 100_000) }
        return String(format: "₹%.0f", value)
    }
}

struct HoldingRow: View {
    let holding: HoldingInput

    var body: some View {
        AppCard(padding: Spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(holding.ticker)
                        .font(AppFont.headline())
                        .foregroundStyle(Color.textPrimary)
                    Text("\(Int(holding.qty)) shares · avg ₹\(Int(holding.avg_buy_price))")
                        .font(AppFont.caption())
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                Text("₹\(Int(holding.qty * holding.avg_buy_price))")
                    .font(AppFont.mono())
                    .foregroundStyle(Color.textPrimary)
            }
        }
    }
}

struct AddHoldingSheet: View {
    @ObservedObject var vm: PortfolioInputViewModel
    @FocusState private var focused: Field?

    enum Field { case ticker, qty, price }

    var canAdd: Bool {
        !vm.ticker.isEmpty &&
        Double(vm.qty) != nil &&
        Double(vm.avgPrice) != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: Spacing.lg) {
                    VStack(spacing: Spacing.sm) {
                        InputField(
                            label: "Stock symbol (NSE)",
                            placeholder: "e.g. INFY, TATAMOTORS",
                            text: $vm.ticker,
                            focused: _focused,
                            field: .ticker
                        )
                        .onChange(of: vm.ticker) { _, v in vm.ticker = v.uppercased() }

                        InputField(
                            label: "Quantity",
                            placeholder: "Number of shares",
                            text: $vm.qty,
                            focused: _focused,
                            field: .qty,
                            keyboard: .decimalPad
                        )

                        InputField(
                            label: "Average buy price (₹)",
                            placeholder: "e.g. 1450.50",
                            text: $vm.avgPrice,
                            focused: _focused,
                            field: .price,
                            keyboard: .decimalPad
                        )
                    }

                    // Preview
                    if let q = Double(vm.qty), let p = Double(vm.avgPrice), q > 0, p > 0 {
                        AppCard {
                            HStack {
                                Text("Total invested")
                                    .font(AppFont.body())
                                    .foregroundStyle(Color.textSecondary)
                                Spacer()
                                Text("₹\(Int(q * p))")
                                    .font(AppFont.number(18))
                                    .foregroundStyle(Color.textPrimary)
                            }
                        }
                    }

                    Spacer()
                }
                .padding(Spacing.lg)
            }
            .navigationTitle("Add holding")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { vm.showAddSheet = false }
                        .foregroundStyle(Color.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        vm.addHolding()
                    }
                    .fontWeight(.semibold)
                    .disabled(!canAdd)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

struct InputField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var focused: FocusState<AddHoldingSheet.Field?>
    let field: AddHoldingSheet.Field
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(AppFont.caption())
                .foregroundStyle(Color.textSecondary)
            TextField(placeholder, text: $text)
                .font(AppFont.body())
                .foregroundStyle(Color.textPrimary)
                .keyboardType(keyboard)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.characters)
                .padding(Spacing.md)
                .background(Color.bgCard)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.bgTertiary, lineWidth: 1)
                )
        }
    }
}
