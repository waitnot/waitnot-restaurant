import Foundation

extension String {
    /// Parse ISO8601 date string and format it
    func formattedDate() -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: self) {
            let f = DateFormatter()
            f.dateFormat = "dd/MM/yyyy HH:mm"
            return f.string(from: date)
        }
        return self
    }

    func timeOnly() -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: self) {
            let f = DateFormatter()
            f.dateFormat = "HH:mm"
            return f.string(from: date)
        }
        return ""
    }
}

extension Date {
    static func startOfToday() -> Date {
        Calendar.current.startOfDay(for: Date())
    }
    static func daysAgo(_ n: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: -n, to: Date()) ?? Date()
    }
    static func startOfMonth() -> Date {
        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month], from: Date())
        return cal.date(from: comps) ?? Date()
    }
}
