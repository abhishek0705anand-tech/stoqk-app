import SwiftUI

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
