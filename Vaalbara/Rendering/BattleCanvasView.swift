import SwiftUI
import UIKit

/// Metal/Core Graphics battle renderer host — port target for render.ts (~2,600 lines).
struct BattleCanvasView: UIViewRepresentable {
    func makeUIView(context: Context) -> BattleCanvasUIView {
        BattleCanvasUIView()
    }

    func updateUIView(_ uiView: BattleCanvasUIView, context: Context) {}
}

final class BattleCanvasUIView: UIView {
    private var displayLink: CADisplayLink?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor(red: 0.06, green: 0.05, blue: 0.08, alpha: 1)
        layer.contentsGravity = .resizeAspectFill
        startDisplayLink()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    deinit { displayLink?.invalidate() }

    private func startDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(drawFrame))
        displayLink?.add(to: .main, forMode: .common)
    }

    @objc private func drawFrame() {
        setNeedsDisplay()
    }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        // Placeholder gradient until render.ts port lands
        let colors = [
            UIColor(red: 0.12, green: 0.08, blue: 0.06, alpha: 1).cgColor,
            UIColor(red: 0.04, green: 0.03, blue: 0.05, alpha: 1).cgColor,
        ] as CFArray
        let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
        ctx.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: bounds.height), options: [])
    }
}
