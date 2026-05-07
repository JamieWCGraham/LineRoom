import Foundation
import StoreKit

@main
struct CheckStoreKit {
    static func main() async {
        let ids = ["com.phasespace.lineroom.pro.monthly"]

        do {
            let products = try await Product.products(for: ids)

            if products.isEmpty {
                print("No products returned.")
            } else {
                for product in products {
                    print("\(product.id) | \(product.displayName) | \(product.displayPrice)")
                }
            }
        } catch {
            print("StoreKit lookup failed: \(error)")
        }
    }
}
