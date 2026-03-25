import SwiftUI
import Charts

// MARK: - Card

struct AppCard<Content: View>: View {
    let content: () -> Content
    var padding: CGFloat = Spacing.md

    var body: some View {
        content()
            .padding(padding)
            .background(Color.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
            .appShadow()
    }
}

// MARK: - Score Badge

struct ScoreBadge: View {
    let score: Int

    var label: String {
        switch score {
        case 80...100: return "High"
        case 60..<80:  return "Med"
        default:       return "Low"
        }
    }

    var body: some View {
        HStack(spacing: 3) {
            Circle()
                .fill(Color.scoreBadge(score))
                .frame(width: 5, height: 5)
            Text("\(score)")
                .font(AppFont.caption(11))
                .foregroundStyle(Color.scoreBadge(score))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.scoreBadge(score).opacity(0.1))
        .clipShape(Capsule())
    }
}

// MARK: - PnL Text

struct PnLText: View {
    let value: Double
    let isPercent: Bool

    var formatted: String {
        if isPercent {
            return String(format: "%+.2f%%", value)
        }
        let abs = Swift.abs(value)
        if abs >= 10_000_000 {
            return String(format: "%+.1fCr", value / 10_000_000)
        } else if abs >= 100_000 {
            return String(format: "%+.1fL", value / 100_000)
        }
        return String(format: "%+.0f", value)
    }

    var body: some View {
        Text(formatted)
            .font(AppFont.mono(13))
            .foregroundStyle(value >= 0 ? Color.gain : Color.loss)
    }
}

// MARK: - Ticker Chip

struct TickerChip: View {
    let ticker: String

    var body: some View {
        Text(ticker)
            .font(AppFont.caption(11))
            .fontWeight(.semibold)
            .foregroundStyle(Color.brand)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.brand.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
    }
}

// MARK: - Event Type Badge

struct EventTypeBadge: View {
    let eventType: String

    var label: String { eventType.replacingOccurrences(of: "_", with: " ").capitalized }

    var color: Color {
        switch eventType {
        case "insider_buy", "promoter_buy", "bulk_deal": return .gain
        case "insider_sell", "pledge_increase": return .loss
        case "block_deal", "qip": return .info
        default: return .textTertiary
        }
    }

    var body: some View {
        Text(label)
            .font(AppFont.caption(10))
            .fontWeight(.semibold)
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
    }
}

// MARK: - Loading Shimmer

struct ShimmerView: View {
    @State private var phase: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let gradient = LinearGradient(
                stops: [
                    .init(color: Color.bgSecondary, location: phase - 0.3),
                    .init(color: Color.bgTertiary, location: phase),
                    .init(color: Color.bgSecondary, location: phase + 0.3),
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            Rectangle()
                .fill(gradient)
                .frame(width: geo.size.width, height: geo.size.height)
        }
        .onAppear {
            withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                phase = 1.3
            }
        }
    }
}

struct ShimmerCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            ShimmerView()
                .frame(height: 16)
                .clipShape(RoundedRectangle(cornerRadius: 4))
            ShimmerView()
                .frame(height: 12)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .padding(.trailing, 60)
            ShimmerView()
                .frame(height: 12)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .padding(.trailing, 30)
        }
        .padding(Spacing.md)
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        .appShadow()
    }
}

// MARK: - Empty State

struct EmptyStateView: View {
    let icon: String
    let title: String
    let subtitle: String
    var action: (() -> Void)? = nil
    var actionLabel: String = ""

    var body: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 44))
                .foregroundStyle(Color.textTertiary)

            VStack(spacing: Spacing.xs) {
                Text(title)
                    .font(AppFont.headline())
                    .foregroundStyle(Color.textPrimary)
                Text(subtitle)
                    .font(AppFont.body())
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }

            if let action {
                Button(actionLabel, action: action)
                    .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(Spacing.xl)
    }
}

// MARK: - Button Styles

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppFont.headline())
            .foregroundStyle(.white)
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, Spacing.md - 4)
            .background(Color.brand)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppFont.headline())
            .foregroundStyle(Color.brand)
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, Spacing.md - 4)
            .background(Color.brand.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
    }
}

// MARK: - Section Header

struct SectionHeader: View {
    let title: String
    var action: (() -> Void)? = nil
    var actionLabel: String = "See all"

    var body: some View {
        HStack {
            Text(title)
                .font(AppFont.headline())
                .foregroundStyle(Color.textPrimary)
            Spacer()
            if let action {
                Button(actionLabel, action: action)
                    .font(AppFont.caption())
                    .foregroundStyle(Color.brand)
            }
        }
    }
}

// MARK: - Nifty / Sensex Mini Chip

struct IndexChip: View {
    let name: String
    let value: Double
    let changePct: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(name)
                .font(AppFont.caption(10))
                .foregroundStyle(Color.textTertiary)
            Text(String(format: "%.0f", value))
                .font(AppFont.mono(14))
                .foregroundStyle(Color.textPrimary)
            Text(String(format: "%+.2f%%", changePct))
                .font(AppFont.caption(10))
                .foregroundStyle(changePct >= 0 ? Color.gain : Color.loss)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .appShadow(radius: 4, opacity: 0.04)
    }
}

// MARK: - App Logo

struct BraidedLogo: View {
    var size: CGFloat = 80
    var color: Color = .brand
    
    var body: some View {
        ZStack {
            // Background glow
            Circle()
                .fill(color.opacity(0.1))
                .frame(width: size * 1.4, height: size * 1.4)
            
            // Outer Ring
            Circle()
                .stroke(color.opacity(0.2), lineWidth: size * 0.05)
                .frame(width: size, height: size)
            
            // Stylized 'S' using the provided asset
            Image("Logo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: size * 0.8, height: size * 0.8)
                .clipShape(Circle())
        }
    }
}

struct ChartDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let price: Double
}

struct StockChart: View {
    let ticker: String
    @State private var data: [ChartDataPoint] = []
    @State private var isLoading = true
    @State private var selectedPoint: ChartDataPoint? = nil
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if isLoading {
                ShimmerView()
                    .frame(height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            } else if data.isEmpty {
                VStack {
                    Image(systemName: "chart.line.flattrend.xyaxis")
                        .font(.system(size: 32))
                        .foregroundStyle(Color.textTertiary)
                    Text("No price history available")
                        .font(AppFont.caption())
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 180)
                .background(Color.bgCard)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    // Header with price info
                    HStack(alignment: .firstTextBaseline) {
                        let currentPrice = selectedPoint?.price ?? data.last?.price ?? 0
                        Text(String(format: "₹%.2f", currentPrice))
                            .font(AppFont.number(24))
                            .foregroundStyle(Color.textPrimary)
                        
                        if let first = data.first?.price {
                            let last = data.last?.price ?? 0
                            let diff = last - first
                            let pct = (diff / first) * 100
                            Text(String(format: "%+.2f%%", pct))
                                .font(AppFont.mono(12))
                                .foregroundStyle(diff >= 0 ? Color.gain : Color.loss)
                        }
                        Spacer()
                    }
                    
                    Chart {
                        ForEach(data) { point in
                            LineMark(
                                x: .value("Date", point.date),
                                y: .value("Price", point.price)
                            )
                            .foregroundStyle(Color.brand.gradient)
                            .interpolationMethod(.catmullRom)
                            
                            AreaMark(
                                x: .value("Date", point.date),
                                y: .value("Price", point.price)
                            )
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [Color.brand.opacity(0.2), Color.brand.opacity(0.0)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                        }
                        
                        if let selected = selectedPoint {
                            RuleMark(x: .value("Selected", selected.date))
                                .foregroundStyle(Color.textTertiary)
                                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4]))
                            
                            PointMark(x: .value("Selected", selected.date), y: .value("Selected", selected.price))
                                .foregroundStyle(Color.brand)
                                .symbolSize(100)
                        }
                    }
                    .chartXAxis {
                        AxisMarks(values: .stride(by: .day, count: 20)) { value in
                            AxisValueLabel(format: .dateTime.day().month())
                                .font(AppFont.caption(9))
                        }
                    }
                    .chartYAxis {
                        AxisMarks(position: .trailing) { value in
                            AxisValueLabel()
                                .font(AppFont.mono(9))
                        }
                    }
                    .frame(height: 180)
                    .chartOverlay { proxy in
                        GeometryReader { geo in
                            Rectangle().fill(.clear).contentShape(Rectangle())
                                .gesture(
                                    DragGesture()
                                        .onChanged { value in
                                            let x = value.location.x - geo[proxy.plotAreaFrame].origin.x
                                            if let date: Date = proxy.value(atX: x) {
                                                selectedPoint = data.min(by: { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) })
                                            }
                                        }
                                        .onEnded { _ in selectedPoint = nil }
                                )
                        }
                    }
                }
            }
        }
        .task { await loadData() }
    }
    
    private func loadData() async {
        isLoading = true
        do {
            let prices = try await APIClient.shared.getPriceHistory(ticker: ticker)
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            
            data = prices.compactMap { p in
                guard let date = formatter.date(from: p.date) else { return nil }
                return ChartDataPoint(date: date, price: p.close)
            }
        } catch {
            print("Chart error: \(error)")
        }
        isLoading = false
    }
}
