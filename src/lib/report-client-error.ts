export function reportClientError(error: Error & { digest?: string }): void {
  if (typeof window === "undefined") return;
  void fetch("/api/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({
      name: error.name.slice(0, 80),
      digest: error.digest?.slice(0, 120) ?? null,
      path: window.location.pathname.slice(0, 200),
    }),
  }).catch(() => {});
}
