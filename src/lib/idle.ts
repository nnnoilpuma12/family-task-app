/**
 * ブラウザがアイドルになってからコールバックを実行する。
 * requestIdleCallback 非対応環境では setTimeout にフォールバックする。
 * 返り値の関数を呼ぶとスケジュールをキャンセルできる（実行前のみ有効）。
 */
export function runWhenIdle(callback: () => void): () => void {
  if (
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function"
  ) {
    const handle = window.requestIdleCallback(callback);
    return () => window.cancelIdleCallback(handle);
  }
  const timer = setTimeout(callback, 200);
  return () => clearTimeout(timer);
}
