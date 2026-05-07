/**
 * Offscreen Document 内 Worker のエントリポイント。
 * Phase 7 で本実装予定。現時点では postMessage の最小スケルトンのみ。
 *
 * メッセージ type 別の処理は Phase 7 で applySnsProfile を呼ぶ実装に差し替える。
 */

self.addEventListener('message', (e: MessageEvent) => {
  // Phase 7: 受信メッセージを type で分岐し processor を呼ぶ
  // 現状は echo back のみ
  self.postMessage({ type: 'ack', received: e.data });
});
