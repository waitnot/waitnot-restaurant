import XCTest
@testable import WaitNotCaptain

@MainActor
final class AuthStoreTests: XCTestCase {

    func testInitialStateIsNotAuthenticated() {
        let store = AuthStore()
        // Fresh store with no keychain data should not be authenticated
        XCTAssertFalse(store.isAuthenticated)
        XCTAssertNil(store.token)
        XCTAssertNil(store.staff)
    }

    func testClearRemovesSession() async {
        let store = AuthStore()
        store.clear()
        XCTAssertFalse(store.isAuthenticated)
        XCTAssertNil(store.token)
        XCTAssertNil(store.staff)
    }

    func testCurrentRestaurantIdNilWhenNotLoggedIn() {
        let store = AuthStore()
        XCTAssertNil(store.currentRestaurantId)
    }
}
