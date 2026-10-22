import UIKit
import UniformTypeIdentifiers

// Takes a photo shared from another app's share sheet and opens Tuck on it.
// The extension runs in its own sandbox, so it copies the photo into the app
// group's folder, which the app can read too, and opens the app with the
// copy's name: <scheme>://share?file=<name>.
class ShareViewController: UIViewController {
  // Also named in src/photos/sharedPhoto.ts and the Android share activity.
  private static let folderName = "shared-photos"

  override func viewDidLoad() {
    super.viewDidLoad()
    let spinner = UIActivityIndicatorView(style: .large)
    spinner.color = .white
    spinner.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(spinner)
    NSLayoutConstraint.activate([
      spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor),
    ])
    spinner.startAnimating()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    Task { await share() }
  }

  private func share() async {
    do {
      guard let provider = imageProvider() else { throw ShareError.noImage }
      let name = try await copyImage(from: provider)
      guard let url = appURL(file: name) else { throw ShareError.noApp }
      openApp(url)
      extensionContext?.completeRequest(returningItems: nil)
    } catch {
      NSLog("Couldn't share the photo with Tuck: \(error)")
      extensionContext?.cancelRequest(withError: error)
    }
  }

  private func imageProvider() -> NSItemProvider? {
    let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
    return items.lazy
      .flatMap { $0.attachments ?? [] }
      .first { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }
  }

  // Replaces the last photo shared, which the app deletes once it's read it
  // but may not have if it couldn't open.
  private func copyImage(from provider: NSItemProvider) async throws -> String {
    guard
      let group = Bundle.main.object(forInfoDictionaryKey: "HostAppGroup") as? String,
      let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: group)
    else { throw ShareError.noAppGroup }
    let folder = container.appendingPathComponent(Self.folderName, isDirectory: true)
    try? FileManager.default.removeItem(at: folder)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

    return try await withCheckedThrowingContinuation { continuation in
      // The file only exists until the handler returns, so it's copied here.
      _ = provider.loadFileRepresentation(for: .image) { file, _, error in
        guard let file else {
          continuation.resume(throwing: error ?? ShareError.noImage)
          return
        }
        let ext = file.pathExtension.isEmpty ? "jpg" : file.pathExtension
        let name = "\(UUID().uuidString).\(ext)"
        do {
          try FileManager.default.copyItem(at: file, to: folder.appendingPathComponent(name))
          continuation.resume(returning: name)
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private func appURL(file: String) -> URL? {
    guard let scheme = Bundle.main.object(forInfoDictionaryKey: "HostAppScheme") as? String
    else { return nil }
    var components = URLComponents()
    components.scheme = scheme
    components.host = "share"
    components.queryItems = [URLQueryItem(name: "file", value: file)]
    return components.url
  }

  // Extensions can't open their app through UIKit's API, but the application
  // object further up the responder chain can.
  private func openApp(_ url: URL) {
    var responder: UIResponder? = self
    while let current = responder {
      if let application = current as? UIApplication {
        application.open(url, options: [:], completionHandler: nil)
        return
      }
      responder = current.next
    }
  }

  private enum ShareError: Error {
    case noImage
    case noAppGroup
    case noApp
  }
}
