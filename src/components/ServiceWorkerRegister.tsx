"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ServiceWorkerRegister() {
  const pathname = usePathname();
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service Worker registration failed silently
      });
    }
  }, []);

  useEffect(() => {
    if (pathname !== "/" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({ type: "CACHE_HOME" });
    }).catch(() => {});
  }, [pathname]);

  return null;
}
