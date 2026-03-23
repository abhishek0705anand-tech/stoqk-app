import SwiftUI

// MARK: - Onboarding View Model

@MainActor
final class OnboardingViewModel: ObservableObject {
    @Published var currentStep: Int = 0
    @Published var experienceLevel: ExperienceLevel? = nil
    @Published var primaryGoal: PrimaryGoal? = nil
    @Published var riskTolerance: RiskTolerance? = nil
    @Published var investmentHorizon: InvestmentHorizon? = nil
    @Published var selectedSectors: Set<String> = []
    @Published var isLoading: Bool = false
    @Published var error: String? = nil

    let sectors = ["IT / Tech", "Banking and Finance", "Pharma", "Auto", "FMCG", "Energy", "Infrastructure", "Metals"]
    let totalSteps = 5

    var canProceed: Bool {
        switch currentStep {
        case 0: return experienceLevel != nil
        case 1: return primaryGoal != nil
        case 2: return riskTolerance != nil
        case 3: return investmentHorizon != nil
        case 4: return !selectedSectors.isEmpty
        default: return false
        }
    }

    func next() {
        guard canProceed, currentStep < totalSteps - 1 else { return }
        withAnimation(.spring(duration: 0.4)) { currentStep += 1 }
        Haptic.light()
    }

    func back() {
        guard currentStep > 0 else { return }
        withAnimation(.spring(duration: 0.4)) { currentStep -= 1 }
    }

    func submit(appState: AppState) async {
        guard let exp = experienceLevel, let goal = primaryGoal,
              let risk = riskTolerance, let horizon = investmentHorizon else { return }

        isLoading = true
        error = nil

        let answers = OnboardingAnswers(
            experience_level: exp,
            primary_goal: goal,
            risk_tolerance: risk,
            investment_horizon: horizon,
            preferred_sectors: Array(selectedSectors)
        )

        do {
            let profile = try await APIClient.shared.completeOnboarding(answers: answers)
            appState.profile = profile
            appState.isOnboarded = true
            Haptic.success()
        } catch {
            self.error = error.localizedDescription
            Haptic.error()
        }

        isLoading = false
    }
}

// MARK: - Onboarding Root

struct OnboardingView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var vm = OnboardingViewModel()

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress bar
                ProgressBar(current: vm.currentStep + 1, total: vm.totalSteps)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.lg)

                // Step content
                TabView(selection: $vm.currentStep) {
                    QuestionStep(
                        number: 1,
                        title: "How would you describe your investing experience?",
                        options: ExperienceLevel.allCases,
                        selection: $vm.experienceLevel,
                        displayName: \.displayName
                    )
                    .tag(0)

                    QuestionStep(
                        number: 2,
                        title: "What is your main goal with investing?",
                        options: PrimaryGoal.allCases,
                        selection: $vm.primaryGoal,
                        displayName: \.displayName
                    )
                    .tag(1)

                    RiskStep(selection: $vm.riskTolerance)
                        .tag(2)

                    QuestionStep(
                        number: 4,
                        title: "When do you plan to use this money?",
                        options: InvestmentHorizon.allCases,
                        selection: $vm.investmentHorizon,
                        displayName: \.displayName
                    )
                    .tag(3)

                    SectorStep(selected: $vm.selectedSectors, sectors: vm.sectors)
                        .tag(4)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.spring(duration: 0.4), value: vm.currentStep)

                // Navigation buttons
                BottomNav(vm: vm, appState: appState)
                    .padding(Spacing.lg)
            }
        }
    }
}

// MARK: - Progress Bar

struct ProgressBar: View {
    let current: Int
    let total: Int

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.bgTertiary)
                    .frame(height: 4)
                Capsule()
                    .fill(Color.brand)
                    .frame(width: geo.size.width * CGFloat(current) / CGFloat(total), height: 4)
                    .animation(.spring(duration: 0.4), value: current)
            }
        }
        .frame(height: 4)
    }
}

// MARK: - Generic Question Step

struct QuestionStep<T: Hashable & Identifiable>: View {
    let number: Int
    let title: String
    let options: [T]
    @Binding var selection: T?
    let displayName: (T) -> String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Question \(number) of 5")
                        .font(AppFont.caption())
                        .foregroundStyle(Color.brand)
                    Text(title)
                        .font(AppFont.display(28))
                        .foregroundStyle(Color.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.xl)

                VStack(spacing: Spacing.sm) {
                    ForEach(options) { option in
                        OptionCard(
                            label: displayName(option),
                            isSelected: selection == option,
                            action: {
                                withAnimation(.spring(duration: 0.25)) { selection = option }
                                Haptic.light()
                            }
                        )
                    }
                }
                .padding(.horizontal, Spacing.lg)
            }
        }
    }
}

// MARK: - Option Card

struct OptionCard: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(label)
                    .font(AppFont.body())
                    .foregroundStyle(isSelected ? .white : Color.textPrimary)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.white)
                }
            }
            .padding(Spacing.md)
            .background(isSelected ? Color.brand : Color.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(isSelected ? Color.brand : Color.bgTertiary, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(isSelected ? 0.98 : 1)
        .animation(.spring(duration: 0.25), value: isSelected)
    }
}

// MARK: - Risk Step (special visual)

struct RiskStep: View {
    @Binding var selection: RiskTolerance?

    let scenarios: [(RiskTolerance, String, String, String)] = [
        (.low, "😰", "Panic and sell", "I'd get out immediately"),
        (.medium, "😐", "Worry but hold", "I'd be nervous but stay patient"),
        (.high, "🤑", "Buy more", "A 20% drop? Great opportunity"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xl) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Question 3 of 5")
                    .font(AppFont.caption())
                    .foregroundStyle(Color.brand)
                Text("If your portfolio dropped 20% tomorrow, you would...")
                    .font(AppFont.display(28))
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.xl)

            VStack(spacing: Spacing.sm) {
                ForEach(scenarios, id: \.0) { risk, emoji, label, sub in
                    Button {
                        withAnimation(.spring(duration: 0.25)) { selection = risk }
                        Haptic.light()
                    } label: {
                        HStack(spacing: Spacing.md) {
                            Text(emoji)
                                .font(.system(size: 28))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(label)
                                    .font(AppFont.headline())
                                    .foregroundStyle(selection == risk ? .white : Color.textPrimary)
                                Text(sub)
                                    .font(AppFont.body(13))
                                    .foregroundStyle(selection == risk ? .white.opacity(0.8) : Color.textSecondary)
                            }
                            Spacer()
                            if selection == risk {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.white)
                            }
                        }
                        .padding(Spacing.md)
                        .background(selection == risk ? Color.brand : Color.bgCard)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .stroke(selection == risk ? Color.brand : Color.bgTertiary, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .scaleEffect(selection == risk ? 0.98 : 1)
                    .animation(.spring(duration: 0.25), value: selection)
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
    }
}

// MARK: - Sector Step

struct SectorStep: View {
    @Binding var selected: Set<String>
    let sectors: [String]

    let icons = ["IT / Tech": "laptopcomputer", "Banking and Finance": "building.columns",
                 "Pharma": "pills", "Auto": "car", "FMCG": "cart", "Energy": "bolt",
                 "Infrastructure": "building.2", "Metals": "cube.box"]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xl) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Question 5 of 5")
                    .font(AppFont.caption())
                    .foregroundStyle(Color.brand)
                Text("Which sectors interest you most?")
                    .font(AppFont.display(28))
                    .foregroundStyle(Color.textPrimary)
                Text("Pick at least one")
                    .font(AppFont.body())
                    .foregroundStyle(Color.textSecondary)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.xl)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.sm) {
                ForEach(sectors, id: \.self) { sector in
                    SectorChip(
                        name: sector,
                        icon: icons[sector] ?? "chart.bar",
                        isSelected: selected.contains(sector),
                        action: {
                            if selected.contains(sector) { selected.remove(sector) }
                            else { selected.insert(sector) }
                            Haptic.light()
                        }
                    )
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
    }
}

struct SectorChip: View {
    let name: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundStyle(isSelected ? .white : Color.brand)
                Text(name)
                    .font(AppFont.caption(12))
                    .foregroundStyle(isSelected ? .white : Color.textPrimary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .background(isSelected ? Color.brand : Color.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(isSelected ? Color.brand : Color.bgTertiary, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(isSelected ? 0.96 : 1)
        .animation(.spring(duration: 0.25), value: isSelected)
    }
}

// MARK: - Bottom Navigation

struct BottomNav: View {
    @ObservedObject var vm: OnboardingViewModel
    var appState: AppState

    var body: some View {
        HStack(spacing: Spacing.md) {
            if vm.currentStep > 0 {
                Button("Back") { vm.back() }
                    .buttonStyle(SecondaryButtonStyle())
            }

            Spacer()

            if vm.currentStep < vm.totalSteps - 1 {
                Button("Continue") { vm.next() }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!vm.canProceed)
                    .opacity(vm.canProceed ? 1 : 0.4)
            } else {
                VStack(spacing: Spacing.sm) {
                    if let error = vm.error {
                        Text(error)
                            .font(AppFont.caption(12))
                            .foregroundStyle(Color.loss)
                            .multilineTextAlignment(.center)
                    }
                    Button {
                        Task { await vm.submit(appState: appState) }
                    } label: {
                        HStack {
                            if vm.isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Get started")
                            }
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!vm.canProceed || vm.isLoading)
                    .opacity(vm.canProceed ? 1 : 0.4)
                }
            }
        }
    }
}

// MARK: - Identifiable conformance helpers

extension ExperienceLevel: Identifiable { public var id: String { rawValue } }
extension PrimaryGoal: Identifiable { public var id: String { rawValue } }
extension RiskTolerance: Identifiable { public var id: String { rawValue } }
extension InvestmentHorizon: Identifiable { public var id: String { rawValue } }
