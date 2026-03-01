"use client";

import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { usePushNotification } from "@/hooks/use-push-notification";

export function NotificationSettings() {
  const { permission, isSubscribed, isSupported, isLoading, subscribe, unsubscribe } =
    usePushNotification();

  if (!isSupported) {
    return null;
  }

  const handleToggle = async () => {
    if (isLoading) return;
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      switch (message) {
        case "VAPID_NOT_SET":
          toast.error("プッシュ通知の設定に問題があります");
          break;
        case "PERMISSION_DENIED":
          toast.error("通知の許可が必要です。ブラウザの設定を確認してください");
          break;
        case "SUBSCRIBE_FAILED":
          toast.error("通知の登録に失敗しました");
          break;
        case "API_FAILED":
          toast.error("サーバーへの登録に失敗しました");
          break;
        default:
          toast.error("通知の設定に失敗しました");
      }
    }
  };

  const isDisabled = permission === "denied" || isLoading;

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3">プッシュ通知</h2>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <Bell size={20} className="text-primary" />
          ) : (
            <BellOff size={20} className="text-gray-400" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {isSubscribed ? "通知ON" : "通知OFF"}
            </p>
            <p className="text-xs text-gray-500">
              {permission === "denied"
                ? "ブラウザの設定で通知がブロックされています"
                : "タスクの追加・完了時に通知を受け取ります"}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={isDisabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isSubscribed ? "bg-primary" : "bg-gray-300"
          } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              isSubscribed ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
