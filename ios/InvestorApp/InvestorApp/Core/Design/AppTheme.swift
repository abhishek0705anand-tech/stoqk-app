import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Color Palette

extension Color {
    // Brand
    static let brand = Color("Brand")                    // Indigo-ish
    static let brandMuted = Color("BrandMuted")

    // Backgrounds
    static let bgPrimary = Color("BgPrimary")
    static let bgSecondary = Color("BgSecondary")
    static let bgTertiary = Color("BgTertiary")
    static let bgCard = Color("BgCard")

    // Text
    static let textPrimary = Color("TextPrimary")
    static let textSecondary = Color("TextSecondary")
    static let textTertiary = Color("TextTertiary")

    // Semantic
    static let gain = Color("Gain")                      // Green
    static let loss = Color("Loss")                      // Red
    static let warning = Color("Warning")                // Amber
    static let info = Color("Info")                      // Blue

    // Score badges
    static func scoreBadge(_ score: Int) -> Color {
        switch score {
        case 80...100: return .loss       // High urgency — red
        case 60..<80:  return .warning    // Medium — amber
        default:       return .info       // Low — blue
        }
    }
}

// MARK: - Typography

struct AppFont {
    // Display
    static func display(_ size: CGFloat = 34) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
    static func title(_ size: CGFloat = 22) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }
    static func headline(_ size: CGFloat = 17) -> Font {
        .system(size: size, weight: .semibold, design: .default)
    }
    static func body(_ size: CGFloat = 15) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }
    static func caption(_ size: CGFloat = 12) -> Font {
        .system(size: size, weight: .medium, design: .default)
    }
    static func mono(_ size: CGFloat = 15) -> Font {
        .system(size: size, weight: .medium, design: .monospaced)
    }
    static func number(_ size: CGFloat = 24) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }
}

// MARK: - Spacing

enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

// MARK: - Corner Radius

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let pill: CGFloat = 100
}

// MARK: - Shadow

struct AppShadow: ViewModifier {
    var radius: CGFloat = 8
    var opacity: Double = 0.06
    var y: CGFloat = 4

    func body(content: Content) -> some View {
        content
            .shadow(color: Color.black.opacity(opacity), radius: radius, x: 0, y: y)
    }
}

extension View {
    func appShadow(radius: CGFloat = 8, opacity: Double = 0.06, y: CGFloat = 4) -> some View {
        modifier(AppShadow(radius: radius, opacity: opacity, y: y))
    }
}

// MARK: - Haptics

enum Haptic {
    #if canImport(UIKit)
    static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func medium() { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
    #else
    static func light() {}
    static func medium() {}
    static func success() {}
    static func error() {}
    #endif
}
