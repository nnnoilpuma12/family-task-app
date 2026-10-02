import { toast } from "sonner";

/** 閉じたフォームの入力は失敗トーストの復元操作に保持する。別の入力を勝手に上書きしない。 */
export async function runBackgroundTask(
  action: () => Promise<{ error: unknown | null } | void>,
  restore: () => void,
  message: string
) {
  try {
    const result = await action();
    if (!result?.error) return;
  } catch {
    // 通信例外も通常の API エラーと同じ復元導線へ送る。
  }
  toast.error(message, {
    duration: Infinity,
    action: { label: "入力を復元", onClick: restore },
  });
}
