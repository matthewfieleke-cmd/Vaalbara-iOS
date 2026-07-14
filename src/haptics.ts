/**
 * Native haptic bridge.
 *
 * The production game runs inside WKWebView, where `navigator.vibrate` is not
 * available on iPhone. Swift registers this named message handler and maps the
 * small allowlisted vocabulary onto UIKit feedback generators. In a normal
 * browser this is intentionally a no-op.
 */
export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'phaseTransition';

interface WebKitMessageHandler {
  postMessage(body: string): void;
}

interface NativeWebKit {
  messageHandlers?: {
    haptics?: WebKitMessageHandler;
  };
}

export function playHaptic(kind: HapticKind): void {
  const webkit = (window as typeof window & { webkit?: NativeWebKit }).webkit;
  webkit?.messageHandlers?.haptics?.postMessage(kind);
}
