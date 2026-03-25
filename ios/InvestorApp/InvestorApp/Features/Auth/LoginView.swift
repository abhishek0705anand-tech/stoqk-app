import SwiftUI

struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                // Logo
                VStack(spacing: Spacing.md) {
                    BraidedLogo(size: 80)
                        .symbolEffect(.pulse)

                    Text("Stoqk")
                        .font(AppFont.display(44))
                        .foregroundStyle(Color.textPrimary)

                    Text("Your personal market analyst")
                        .font(AppFont.body())
                        .foregroundStyle(Color.textSecondary)
                }

                Spacer()

                // Form
                VStack(spacing: Spacing.md) {
                    if let error = errorMessage {
                        Text(error)
                            .font(AppFont.caption())
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    VStack(spacing: Spacing.sm) {
                        TextField("Email", text: $email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .padding()
                            .background(Color.bgCard)
                            .cornerRadius(12)
                            .foregroundStyle(Color.textPrimary)

                        SecureField("Password", text: $password)
                            .padding()
                            .background(Color.bgCard)
                            .cornerRadius(12)
                            .foregroundStyle(Color.textPrimary)
                    }

                    Button {
                        submit()
                    } label: {
                        if isLoading {
                            ProgressView()
                                .tint(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else {
                            Text(isSignUp ? "Create account" : "Sign in")
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(isLoading || email.isEmpty || password.isEmpty)

                    Button {
                        withAnimation { isSignUp.toggle(); errorMessage = nil }
                    } label: {
                        Text(isSignUp ? "Already have an account? Sign in" : "New here? Create account")
                            .font(AppFont.caption())
                            .foregroundStyle(Color.brand)
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.bottom, Spacing.xxl)
            }
        }
    }

    private func submit() {
        errorMessage = nil
        isLoading = true
        Task {
            do {
                if isSignUp {
                    try await appState.signUp(email: email, password: password)
                } else {
                    try await appState.signIn(email: email, password: password)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}
