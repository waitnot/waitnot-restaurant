import SwiftUI

extension View {
    func toast(_ toast: Toast?) -> some View {
        overlay(alignment: .top) {
            if let toast {
                ToastView(toast: toast)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .animation(.spring(response: 0.3), value: toast)
                    .padding(.top, 8)
                    .zIndex(999)
            }
        }
    }
}

struct ToastView: View {
    let toast: Toast
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: toast.type == .error ? "xmark.circle.fill" : "checkmark.circle.fill")
            Text(toast.message)
                .font(.subheadline).fontWeight(.medium)
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(toast.type == .error ? Color.red : Color(.darkGray))
        .foregroundColor(.white)
        .cornerRadius(20)
        .shadow(radius: 6)
    }
}
