import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var appState: AppState
    @StateObject private var vm: DashboardViewModel

    init() {
        _vm = StateObject(wrappedValue: DashboardViewModel(authStore: AuthStore()))
    }

    var body: some View {
        // Inject real authStore after environment is available
        _DashboardContent(authStore: authStore, appState: appState)
    }
}

// Inner view that can be properly initialized with environment objects
private struct _DashboardContent: View {
    @StateObject private var vm: DashboardViewModel
    let appState: AppState

    init(authStore: AuthStore, appState: AppState) {
        _vm = StateObject(wrappedValue: DashboardViewModel(authStore: authStore))
        self.appState = appState
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $vm.activeTab) {
                TablesView(vm: vm)
                    .tag(DashboardViewModel.Tab.tables)

                RunningOrdersView(vm: vm)
                    .tag(DashboardViewModel.Tab.orders)

                HistoryView(vm: vm)
                    .tag(DashboardViewModel.Tab.history)

                SalesView(vm: vm)
                    .tag(DashboardViewModel.Tab.sales)

                ProfileView(vm: vm)
                    .tag(DashboardViewModel.Tab.profile)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea(edges: .bottom)

            // Custom bottom tab bar
            BottomTabBar(activeTab: $vm.activeTab, badgeCount: vm.totalRunningCount)
        }
        .toast(appState.toast)
        .onAppear { vm.onAppear() }
        .onDisappear { vm.onDisappear() }
        .sheet(item: $vm.selectedTable) { table in
            OrderTakingView(vm: vm, table: table)
        }
    }
}

// MARK: - Bottom Tab Bar
struct BottomTabBar: View {
    @Binding var activeTab: DashboardViewModel.Tab
    let badgeCount: Int

    var body: some View {
        HStack(spacing: 0) {
            ForEach(DashboardViewModel.Tab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { activeTab = tab }
                } label: {
                    VStack(spacing: 4) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: tab.icon)
                                .font(.system(size: 22))
                            if tab == .orders && badgeCount > 0 {
                                Text("\(min(badgeCount, 99))")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(.white)
                                    .padding(3)
                                    .background(Color.brandRed)
                                    .clipShape(Circle())
                                    .offset(x: 8, y: -6)
                            }
                        }
                        Text(tab.label)
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundColor(activeTab == tab ? .brandRed : .secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                }
            }
        }
        .padding(.bottom, 4)
        .background(
            Rectangle()
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: -2)
        )
    }
}

// Make SelectedTable conform to Identifiable for sheet
extension SelectedTable: Identifiable {
    var id: String { label }
}
