import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";

/**
 * Realtime チャンネルの購読状態ハンドラを組み立てる。
 *
 * `.subscribe()` をコールバック無しで呼ぶと、切断もエラーも無言で通り過ぎる。
 * WebSocket はリクエスト単位のエラーを返さないため、購読状態を見ていないと
 * 「イベントが届かなくなったこと」をアプリ側から知る手段が無い。
 *
 * SUBSCRIBED は初回購読時だけでなく、ソケット再接続後の rejoin でも再び通知される
 * （join push の receive フックは resend をまたいで保持される）。
 * そこを再同期の起点にすることで、切断中に取りこぼしたイベントを回収する。
 * 初回購読時にも走るが、これは「初期取得 → 購読開始」のあいだに空く窓を
 * 埋める分なので、余分ではなく必要な 1 回。
 */
export function createSubscribeHandler(
  channelName: string,
  onResync?: () => void
): (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void {
  return (status, err) => {
    if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
      onResync?.();
      return;
    }
    if (
      status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
      status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
    ) {
      // 再接続は supabase-js が自動で行う。ここでは原因追跡のために記録だけ残す
      console.warn(`[realtime] ${channelName}: ${status}`, err);
    }
  };
}
