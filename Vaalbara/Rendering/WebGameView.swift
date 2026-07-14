import Foundation
import SwiftUI
import UIKit
import WebKit

/// Hosts the complete production web game while the native screens are ported.
struct WebGameView: UIViewRepresentable {
    private static let hapticHandlerName = "haptics"

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.mediaTypesRequiringUserActionForPlayback = [.audio]
        configuration.setURLSchemeHandler(
            WebBundleSchemeHandler(),
            forURLScheme: WebBundleSchemeHandler.scheme
        )
        configuration.userContentController.add(
            context.coordinator,
            name: Self.hapticHandlerName
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.bounces = false
        // The page handles safe areas itself (viewport-fit=cover + CSS env()).
        // Left on .automatic, iOS nudges the content down by the status-bar
        // inset *after* first paint — a race that page load speed decides, so
        // warm launches lay out differently from cold ones and the boot →
        // cinematic handoff visibly shifts. Freeze it.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator

        guard let indexURL = URL(string: "\(WebBundleSchemeHandler.scheme)://app/index.html") else {
            webView.loadHTMLString(
                "<html><body style='background:#000;color:#fff;font-family:-apple-system;padding:2rem'>Vaalbara could not start.</body></html>",
                baseURL: nil
            )
            return webView
        }

        webView.load(URLRequest(url: indexURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: hapticHandlerName
        )
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard
                message.name == WebGameView.hapticHandlerName,
                message.frameInfo.isMainFrame,
                let kind = message.body as? String
            else {
                return
            }

            switch kind {
            case "light":
                HapticsService.light()
            case "medium":
                HapticsService.medium()
            case "heavy":
                HapticsService.heavy()
            case "success":
                HapticsService.success()
            case "warning":
                HapticsService.warning()
            case "phaseTransition":
                HapticsService.phaseTransition()
            default:
                break
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if url.scheme == WebBundleSchemeHandler.scheme {
                decisionHandler(.allow)
                return
            }

            if url.scheme == "https" || url.scheme == "http" {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }
    }
}

/// Serves the web bundle through one same-origin custom scheme. Loading it via
/// `file://` makes each image an opaque origin, which taints the game's canvas
/// and prevents sprite processing with `getImageData`.
private final class WebBundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "vaalbara-game"

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard
            let requestURL = urlSchemeTask.request.url,
            let root = Bundle.main.resourceURL?.appendingPathComponent("WebApp", isDirectory: true)
        else {
            urlSchemeTask.didFailWithError(WebBundleError.resourceNotFound)
            return
        }

        let relativePath = requestURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let fileURL = root.appendingPathComponent(relativePath).standardizedFileURL

        guard
            fileURL.path.hasPrefix(root.standardizedFileURL.path + "/"),
            let data = try? Data(contentsOf: fileURL)
        else {
            urlSchemeTask.didFailWithError(WebBundleError.resourceNotFound)
            return
        }

        let mimeType = Self.mimeType(for: fileURL.pathExtension)
        guard let response = HTTPURLResponse(
            url: requestURL,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Access-Control-Allow-Origin": "*",
                "Content-Length": String(data.count),
                "Content-Type": Self.isText(fileURL.pathExtension)
                    ? "\(mimeType); charset=utf-8"
                    : mimeType,
            ]
        ) else {
            urlSchemeTask.didFailWithError(WebBundleError.resourceNotFound)
            return
        }
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func mimeType(for fileExtension: String) -> String {
        switch fileExtension.lowercased() {
        case "html": return "text/html"
        case "css": return "text/css"
        case "js": return "application/javascript"
        case "json": return "application/json"
        case "webmanifest": return "application/manifest+json"
        case "png": return "image/png"
        case "webp": return "image/webp"
        default: return "application/octet-stream"
        }
    }

    private static func isText(_ fileExtension: String) -> Bool {
        ["html", "css", "js", "json", "webmanifest"].contains(fileExtension.lowercased())
    }
}

private enum WebBundleError: Error {
    case resourceNotFound
}
