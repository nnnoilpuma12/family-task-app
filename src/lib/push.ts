/**
 * プッシュ通知ヘルパー (fire-and-forget)
 */

export function sendPushNotification(params: {
  title: string;
  body: string;
  householdId: string;
}): void {
  fetch("/api/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: params.title,
      body: params.body,
      householdId: params.householdId,
    }),
  }).catch(() => {});
}
