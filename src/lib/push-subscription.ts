export async function removeCurrentPushSubscription(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  // Sign-out requires the authenticated session to remove the server row.
  // Revoke the browser endpoint even if the server cannot be reached.
  let serverError: Error | null = null;
  try {
    const response = await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    if (!response.ok) serverError = new Error("購読の削除に失敗しました");
  } catch {
    serverError = new Error("購読の削除に失敗しました");
  }

  const removed = await subscription.unsubscribe();
  if (!removed) throw new Error("ブラウザの購読解除に失敗しました");
  if (serverError) throw serverError;
}
