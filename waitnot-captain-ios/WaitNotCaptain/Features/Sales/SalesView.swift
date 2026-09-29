import SwiftUI

struct SalesView: View {
    @ObservedObject var vm: DashboardViewModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Period picker
                Picker("Period", selection: $vm.salesPeriod) {
                    ForEach(SalesPeriod.allCases, id: \.self) { p in
                        Text(p.rawValue).tag(p)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16).padding(.vertical, 10)
                .onChange(of: vm.salesPeriod) { _ in Task { await vm.loadSales() } }

                Divider()

                Group {
                    if vm.isLoadingSales {
                        ProgressView("Computing sales...").frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let data = vm.salesData {
                        ScrollView {
                            VStack(spacing: 16) {
                                // Metric cards
                                LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 12) {
                                    MetricCard(title: "Total Revenue", value: "₹\(Int(data.totalRevenue))", icon: "indianrupeesign.circle.fill", color: .brandRed)
                                    MetricCard(title: "Total Orders", value: "\(data.totalOrders)", icon: "bag.fill", color: .blue)
                                    MetricCard(title: "Cash Revenue", value: "₹\(Int(data.cashRevenue))", icon: "banknote", color: .green)
                                    MetricCard(title: "Online Revenue", value: "₹\(Int(data.onlineRevenue))", icon: "creditcard.fill", color: .purple)
                                }
                                .padding(.horizontal, 16)

                                // Payment split
                                SalesCard(title: "Payment Split") {
                                    HStack(spacing: 20) {
                                        PaySplitRow(label: "Cash", count: data.cashCount, revenue: data.cashRevenue, color: .green)
                                        Divider()
                                        PaySplitRow(label: "Online", count: data.onlineCount, revenue: data.onlineRevenue, color: .purple)
                                    }
                                    .padding(.top, 8)
                                }

                                // Top items
                                if !data.topItems.isEmpty {
                                    SalesCard(title: "Top Items") {
                                        VStack(spacing: 8) {
                                            ForEach(Array(data.topItems.enumerated()), id: \.offset) { idx, item in
                                                HStack {
                                                    Text("\(idx + 1).")
                                                        .font(.caption).foregroundColor(.secondary)
                                                        .frame(width: 20, alignment: .leading)
                                                    Text(item.name)
                                                        .font(.subheadline)
                                                        .lineLimit(1)
                                                    Spacer()
                                                    Text("×\(item.qty)")
                                                        .font(.caption).fontWeight(.semibold)
                                                        .foregroundColor(.secondary)
                                                    Text("₹\(Int(item.revenue))")
                                                        .font(.caption).fontWeight(.bold)
                                                        .foregroundColor(.brandRed)
                                                        .frame(width: 60, alignment: .trailing)
                                                }
                                                if idx < data.topItems.count - 1 { Divider() }
                                            }
                                        }
                                        .padding(.top, 8)
                                    }
                                }

                                // Order type breakdown
                                if !data.typeBreakdown.isEmpty {
                                    SalesCard(title: "Order Types") {
                                        VStack(spacing: 8) {
                                            ForEach(data.typeBreakdown, id: \.type) { row in
                                                HStack {
                                                    Text(row.type).font(.subheadline)
                                                    Spacer()
                                                    Text("\(row.count) orders")
                                                        .font(.caption).foregroundColor(.secondary)
                                                    Text("₹\(Int(row.revenue))")
                                                        .font(.caption).fontWeight(.bold)
                                                        .foregroundColor(.brandRed)
                                                        .frame(width: 70, alignment: .trailing)
                                                }
                                            }
                                        }
                                        .padding(.top, 8)
                                    }
                                }

                                Spacer(minLength: 90)
                            }
                            .padding(.top, 12)
                        }
                    } else {
                        EmptyStateView(icon: "chart.line.uptrend.xyaxis", title: "No Sales Data",
                                       subtitle: "Complete some orders to see analytics.")
                    }
                }
            }
            .navigationTitle("Sales Analytics")
            .navigationBarTitleDisplayMode(.inline)
            .task { await vm.loadSales() }
            .refreshable { await vm.loadSales() }
        }
    }
}

struct MetricCard: View {
    let title: String; let value: String; let icon: String; let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon).font(.title2).foregroundColor(color)
            Text(value).font(.title2).fontWeight(.bold)
            Text(title).font(.caption).foregroundColor(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.05), radius: 4)
    }
}

struct SalesCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content
    var body: some View {
        VStack(alignment: .leading) {
            Text(title).font(.subheadline).fontWeight(.semibold).foregroundColor(.secondary)
            content()
        }
        .padding(14)
        .background(Color(.systemBackground))
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.05), radius: 4)
        .padding(.horizontal, 16)
    }
}

struct PaySplitRow: View {
    let label: String; let count: Int; let revenue: Double; let color: Color
    var body: some View {
        VStack(spacing: 4) {
            Text(label).font(.subheadline).foregroundColor(.secondary)
            Text("₹\(Int(revenue))").font(.title3).fontWeight(.bold).foregroundColor(color)
            Text("\(count) orders").font(.caption).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}
