import SwiftUI

struct SplashView: View {
    @State private var isActive = false
    @State private var opacity = 0.5
    @State private var scale = 0.8

    var body: some View {
        ZStack {
            Color.brand.ignoresSafeArea()
            
            VStack(spacing: 20) {
                BraidedLogo(size: 80, color: .white)
                    .scaleEffect(scale)
                    .opacity(opacity)
                
                VStack(spacing: 8) {
                    Text("STOQK")
                        .font(AppFont.display(36))
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .tracking(4)
                    
                    Text("AI-NATIVE INVESTING")
                        .font(AppFont.caption(12))
                        .fontWeight(.semibold)
                        .foregroundStyle(.white.opacity(0.7))
                        .tracking(2)
                }
                .offset(y: 10)
                .opacity(opacity)
            }
        }
        .onAppear {
            withAnimation(.easeIn(duration: 0.8)) {
                self.opacity = 1.0
                self.scale = 1.0
            }
        }
    }
}

#Preview {
    SplashView()
}
