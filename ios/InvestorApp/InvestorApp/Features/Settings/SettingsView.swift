import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showEditProfile: Bool = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                List {
                    // Profile section
                    Section {
                        if let profile = appState.profile {
                            HStack(spacing: Spacing.md) {
                                Circle()
                                    .fill(Color.brand)
                                    .frame(width: 48, height: 48)
                                    .overlay(
                                        Image(systemName: "person.fill")
                                            .foregroundStyle(.white)
                                    )
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(profile.experience_level.rawValue.capitalized + " Investor")
                                        .font(AppFont.headline())
                                        .foregroundStyle(Color.textPrimary)
                                    Text(profile.primary_goal.displayName)
                                        .font(AppFont.caption())
                                        .foregroundStyle(Color.textSecondary)
                                }
                                Spacer()
                                Button("Edit") { showEditProfile = true }
                                    .font(AppFont.caption())
                                    .foregroundStyle(Color.brand)
                            }
                        }
                    }
                    .listRowBackground(Color.bgCard)

                    // Preferences
                    Section("Preferences") {
                        NavigationLink {
                            NotificationsSettingsView()
                        } label: {
                            Label("Notifications", systemImage: "bell")
                                .foregroundStyle(Color.textPrimary)
                        }
                    }
                    .listRowBackground(Color.bgCard)

                    // About
                    Section("About") {
                        HStack {
                            Text("Version")
                                .foregroundStyle(Color.textPrimary)
                            Spacer()
                            Text("1.0.0")
                                .foregroundStyle(Color.textTertiary)
                        }
                        Link(destination: URL(string: "https://sebi.gov.in")!) {
                            Label("SEBI Disclaimer", systemImage: "info.circle")
                                .foregroundStyle(Color.textPrimary)
                        }
                    }
                    .listRowBackground(Color.bgCard)

                    // Danger zone
                    Section {
                        Button(role: .destructive) {
                            appState.signOut()
                        } label: {
                            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                    .listRowBackground(Color.bgCard)
                }
                .scrollContentBackground(.hidden)
                .background(Color.bgPrimary)
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showEditProfile) {
                if let profile = appState.profile {
                    EditProfileView(profile: profile)
                        .environmentObject(appState)
                }
            }
        }
    }
}

struct NotificationsSettingsView: View {
    @State private var permissionGranted: Bool = false

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()
            VStack(spacing: Spacing.lg) {
                Spacer()
                VStack(spacing: Spacing.sm) {
                    Image(systemName: "bell.badge.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.brand)
                    Text("Stay informed")
                        .font(AppFont.title())
                        .foregroundStyle(Color.textPrimary)
                    Text("Get instant alerts when there's a significant signal on stocks you own or watch.")
                        .font(AppFont.body())
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Spacing.xl)
                }
                Spacer()
                Button("Enable notifications") {
                    Task {
                        #if canImport(UIKit)
                        permissionGranted = await PushManager.shared.requestPermission()
                        #endif
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal, Spacing.lg)
                .padding(.bottom, Spacing.xxl)
            }
        }
        .navigationTitle("Notifications")
    }
}

struct EditProfileView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss
    let profile: UserProfile

    @State private var experience: ExperienceLevel
    @State private var goal: PrimaryGoal
    @State private var risk: RiskTolerance
    @State private var horizon: InvestmentHorizon
    @State private var sectors: Set<String>
    @State private var isSaving: Bool = false

    let allSectors = ["IT / Tech", "Banking and Finance", "Pharma", "Auto", "FMCG", "Energy", "Infrastructure", "Metals"]

    init(profile: UserProfile) {
        self.profile = profile
        _experience = State(initialValue: profile.experience_level)
        _goal = State(initialValue: profile.primary_goal)
        _risk = State(initialValue: profile.risk_tolerance)
        _horizon = State(initialValue: profile.investment_horizon)
        _sectors = State(initialValue: Set(profile.preferred_sectors))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()
                Form {
                    Section("Experience") {
                        Picker("Level", selection: $experience) {
                            ForEach(ExperienceLevel.allCases, id: \.self) {
                                Text($0.displayName).tag($0)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                    .listRowBackground(Color.bgCard)

                    Section("Goal") {
                        Picker("Goal", selection: $goal) {
                            ForEach(PrimaryGoal.allCases, id: \.self) {
                                Text($0.displayName).tag($0)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                    .listRowBackground(Color.bgCard)

                    Section("Risk tolerance") {
                        Picker("Risk", selection: $risk) {
                            ForEach(RiskTolerance.allCases, id: \.self) {
                                Text($0.displayName).tag($0)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .listRowBackground(Color.bgCard)

                    Section("Investment horizon") {
                        Picker("Horizon", selection: $horizon) {
                            ForEach(InvestmentHorizon.allCases, id: \.self) {
                                Text($0.displayName).tag($0)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                    .listRowBackground(Color.bgCard)

                    Section("Sectors") {
                        ForEach(allSectors, id: \.self) { sector in
                            Toggle(sector, isOn: Binding(
                                get: { sectors.contains(sector) },
                                set: { on in
                                    if on { sectors.insert(sector) }
                                    else { sectors.remove(sector) }
                                }
                            ))
                        }
                    }
                    .listRowBackground(Color.bgCard)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Edit profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .fontWeight(.semibold)
                        .disabled(isSaving)
                }
            }
        }
    }

    func save() async {
        isSaving = true
        do {
            let updates: [String: Any] = [
                "experience_level": experience.rawValue,
                "primary_goal": goal.rawValue,
                "risk_tolerance": risk.rawValue,
                "investment_horizon": horizon.rawValue,
                "preferred_sectors": Array(sectors),
            ]
            // Update via API (PATCH /api/v1/profile/me)
            // For now reload profile from state
            _ = try await APIClient.shared.getProfile()
            await appState.loadProfile()
            dismiss()
            Haptic.success()
        } catch {
            Haptic.error()
        }
        isSaving = false
    }
}
