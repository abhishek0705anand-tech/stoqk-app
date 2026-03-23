import SwiftUI

// MARK: - View Model

@MainActor
final class AskViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var inputText: String = ""
    @Published var suggestions: [String] = []
    @Published var isStreaming: Bool = false
    @Published var error: String? = nil

    func loadSuggestions() async {
        do {
            suggestions = try await APIClient.shared.getChatSuggestions()
        } catch {
            // Use default suggestions
            suggestions = [
                "What's the outlook for Indian markets this week?",
                "How is my portfolio performing?",
                "What are FII/DII flows telling us?",
                "Is now a good time to invest?",
                "Which sectors look strong right now?",
            ]
        }
    }

    func send(message: String) async {
        guard !message.trimmingCharacters(in: .whitespaces).isEmpty, !isStreaming else { return }

        messages.append(ChatMessage(role: .user, plain: message, deeper: ""))
        inputText = ""
        isStreaming = true
        Haptic.light()

        messages.append(ChatMessage(role: .assistant, plain: "", deeper: "", isStreaming: true))
        let idx = messages.count - 1

        do {
            let jobId = try await APIClient.shared.sendChat(message: message)

            // Poll until done (max 60s)
            let deadline = Date().addingTimeInterval(60)
            while Date() < deadline {
                try await Task.sleep(nanoseconds: 1_500_000_000) // 1.5s
                let result = try await APIClient.shared.getChatResult(jobId: jobId)
                if result.status == "done" {
                    messages[idx].plain = result.plain ?? ""
                    messages[idx].deeper = result.deeper ?? ""
                    messages[idx].isStreaming = false
                    Haptic.success()
                    break
                } else if result.status == "error" {
                    messages[idx].plain = result.plain ?? "Something went wrong. Please try again."
                    messages[idx].isStreaming = false
                    Haptic.error()
                    break
                }
            }
            // Timeout fallback
            if messages[idx].isStreaming {
                messages[idx].plain = "The response took too long. Please try again."
                messages[idx].isStreaming = false
                Haptic.error()
            }
        } catch {
            messages[idx].plain = "Sorry, something went wrong. Please try again."
            messages[idx].isStreaming = false
            Haptic.error()
        }

        isStreaming = false
    }

    func useSuggestion(_ text: String) {
        inputText = text
        Task { await send(message: text) }
    }
}

// MARK: - Ask View

struct AskView: View {
    @StateObject private var vm = AskViewModel()
    @FocusState private var isInputFocused: Bool
    @State private var scrollToBottom: Bool = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    if vm.messages.isEmpty {
                        emptyState
                    } else {
                        messageList
                    }

                    inputBar
                }
            }
            .navigationTitle("Ask")
            .navigationBarTitleDisplayMode(.large)
        }
        .task { await vm.loadSuggestions() }
    }

    // MARK: - Empty State with Suggestions

    var emptyState: some View {
        ScrollView {
            VStack(spacing: Spacing.xl) {
                Spacer().frame(height: Spacing.xxl)

                VStack(spacing: Spacing.sm) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.brand.opacity(0.8))

                    Text("Your market analyst")
                        .font(AppFont.title())
                        .foregroundStyle(Color.textPrimary)

                    Text("Ask anything about markets, your portfolio, or specific stocks.")
                        .font(AppFont.body())
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, Spacing.xl)

                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Suggested questions")
                        .font(AppFont.caption())
                        .foregroundStyle(Color.textTertiary)
                        .padding(.horizontal, Spacing.lg)

                    ForEach(vm.suggestions, id: \.self) { suggestion in
                        Button {
                            vm.useSuggestion(suggestion)
                            isInputFocused = true
                        } label: {
                            HStack {
                                Text(suggestion)
                                    .font(AppFont.body())
                                    .foregroundStyle(Color.textPrimary)
                                    .multilineTextAlignment(.leading)
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.brand)
                            }
                            .padding(Spacing.md)
                            .background(Color.bgCard)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, Spacing.lg)
                    }
                }

                Spacer()
            }
        }
    }

    // MARK: - Message List

    var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: Spacing.sm) {
                    ForEach(vm.messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                }
                .padding(Spacing.md)
            }
            .onChange(of: vm.messages.count) { _, _ in
                if let last = vm.messages.last {
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
            .onChange(of: vm.messages.last?.plain) { _, _ in
                if let last = vm.messages.last {
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
        }
    }

    // MARK: - Input Bar

    var inputBar: some View {
        VStack(spacing: 0) {
            Divider().background(Color.bgTertiary)

            HStack(alignment: .bottom, spacing: Spacing.sm) {
                TextField("Ask anything...", text: $vm.inputText, axis: .vertical)
                    .font(AppFont.body())
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1...5)
                    .focused($isInputFocused)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.bgCard)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous))
                    .onSubmit { Task { await vm.send(message: vm.inputText) } }

                Button {
                    Task { await vm.send(message: vm.inputText) }
                } label: {
                    Image(systemName: vm.isStreaming ? "stop.circle.fill" : "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(vm.inputText.isEmpty ? Color.textTertiary : Color.brand)
                }
                .disabled(vm.inputText.isEmpty && !vm.isStreaming)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
            .background(Color.bgPrimary)
        }
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ChatMessage
    @State private var showDeeper: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            if message.role == .user { Spacer() }

            if message.role == .assistant {
                Circle()
                    .fill(Color.brand)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Image(systemName: "sparkle")
                            .font(.system(size: 12))
                            .foregroundStyle(.white)
                    )
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: Spacing.sm) {
                // Bubble
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    if message.isStreaming && message.plain.isEmpty {
                        TypingIndicator()
                    } else {
                        Text(message.plain)
                            .font(AppFont.body())
                            .foregroundStyle(message.role == .user ? .white : Color.textPrimary)
                    }
                }
                .padding(Spacing.md)
                .background(message.role == .user ? Color.brand : Color.bgCard)
                .clipShape(
                    RoundedRectangle(
                        cornerRadius: Radius.lg,
                        style: .continuous
                    )
                )
                .appShadow(radius: 4, opacity: 0.04)

                // Dig deeper section
                if message.role == .assistant && !message.deeper.isEmpty {
                    Button {
                        withAnimation(.spring(duration: 0.3)) { showDeeper.toggle() }
                        Haptic.light()
                    } label: {
                        Label(showDeeper ? "Show less" : "Dig deeper", systemImage: showDeeper ? "chevron.up" : "chevron.down")
                            .font(AppFont.caption(12))
                            .foregroundStyle(Color.brand)
                    }
                    .buttonStyle(.plain)

                    if showDeeper {
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text(message.deeper)
                                .font(AppFont.body(14))
                                .foregroundStyle(Color.textSecondary)
                        }
                        .padding(Spacing.md)
                        .background(Color.bgSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                    }
                }
            }
            .frame(maxWidth: UIScreen.main.bounds.width * 0.82, alignment: message.role == .user ? .trailing : .leading)

            if message.role == .assistant { Spacer() }
        }
    }
}

// MARK: - Typing Indicator

struct TypingIndicator: View {
    @State private var phase: Double = 0

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.textTertiary)
                    .frame(width: 7, height: 7)
                    .scaleEffect(phase == Double(i) ? 1.3 : 0.9)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.4).repeatForever().delay(0)) {
                phase = 0
            }
            Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { t in
                withAnimation(.easeInOut(duration: 0.35)) {
                    phase = (phase + 1).truncatingRemainder(dividingBy: 3)
                }
            }
        }
    }
}
