"use client";

import { useState, useEffect, useCallback } from "react";

function getInitialPermission(): NotificationPermission {
  if (typeof window !== "undefined" && "Notification" in window) {
    return Notification.permission;
  }
  return "default";
}

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>(getInitialPermission);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    let cancelled = false;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (!cancelled) setIsSubscribed(!!sub);
      });
    });
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      throw new Error("VAPID_NOT_SET");
    }

    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") throw new Error("PERMISSION_DENIED");

      const reg = await navigator.serviceWorker.ready;
      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
      } catch {
        throw new Error("SUBSCRIBE_FAILED");
      }

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });

      if (!res.ok) {
        await sub.unsubscribe();
        throw new Error("API_FAILED");
      }

      setIsSubscribed(true);
      return true;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;

    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        return;
      }

      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      setIsSubscribed(false);
    } catch {
      // unsubscribe failed, keep current state
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isSupported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

  return { permission, isSubscribed, isSupported, isLoading, subscribe, unsubscribe };
}
