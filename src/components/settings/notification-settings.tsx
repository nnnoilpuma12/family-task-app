"use client";

import { Bell, BellOff } from "lucide-react";
import { usePushNotification } from "@/hooks/use-push-notification";

export function NotificationSettings() {
  const { permission, isSubscribed, isSupported, subscribe, unsubscribe } =
    usePushNotification();

  if (!isSupported) {
    return null;
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

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
          disabled={permission === "denied"}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isSubscribed ? "bg-primary" : "bg-gray-300"
          } ${permission === "denied" ? "opacity-50 cursor-not-allowed" : ""}`}
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
