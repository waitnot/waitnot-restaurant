import Foundation

// MARK: - API Error
enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingFailed(Error)
    case serverError(Int, String)
    case unauthorized
    case networkError(Error)
    case timeout

    var errorDescription: String? {
        switch self {
        case .invalidURL:        return "Invalid URL"
        case .noData:            return "No data received"
        case .decodingFailed(let e): return "Decode error: \(e.localizedDescription)"
        case .serverError(let code, let msg): return "Server error \(code): \(msg)"
        case .unauthorized:      return "Session expired. Please login again."
        case .networkError(let e): return e.localizedDescription
        case .timeout:           return "Request timed out. Check your connection."
        }
    }
}

// MARK: - API Client
final class APIClient {
    static let shared = APIClient()

    private let baseURL = "https://waitnot-restaurant.onrender.com"
    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)
        decoder = JSONDecoder()
    }

    // MARK: - Generic request
    func request<T: Decodable>(
        _ endpoint: String,
        method: String = "GET",
        body: (any Encodable)? = nil,
        token: String? = nil
    ) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            let encoder = JSONEncoder()
            req.httpBody = try encoder.encode(body)
        }

        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.noData
            }

            if http.statusCode == 401 { throw APIError.unauthorized }

            guard (200..<300).contains(http.statusCode) else {
                let msg = (try? decoder.decode(ErrorResponse.self, from: data))?.error ?? "Unknown error"
                throw APIError.serverError(http.statusCode, msg)
            }

            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingFailed(error)
            }
        } catch let err as URLError where err.code == .timedOut {
            throw APIError.timeout
        } catch let err as APIError {
            throw err
        } catch {
            throw APIError.networkError(error)
        }
    }

    // Fire and forget (no response body needed)
    func requestVoid(
        _ endpoint: String,
        method: String = "POST",
        body: (any Encodable)? = nil,
        token: String? = nil
    ) async throws {
        let _: EmptyResponse = try await request(endpoint, method: method, body: body, token: token)
    }
}

private struct ErrorResponse: Codable { let error: String }
private struct EmptyResponse: Codable {}
