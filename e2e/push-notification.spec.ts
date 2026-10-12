import { expect, test as base, type BrowserContext } from "@playwright/test";

// Notification permission in service workers requires a regular profile;
// Playwright's default isolated context is an incognito profile.
const test = base.extend<{ notificationContext: BrowserContext }>({
  notificationContext: async ({ playwright, baseURL }, runWithContext) => {
    const context = await playwright.chromium.launchPersistentContext("", {
      channel: "chromium", headless: true, baseURL,
    });
    try {
      await runWithContext(context);
    } finally {
      await context.close();
    }
  },
});

test("push uses a decoded avatar and falls back when the image is missing", async ({ notificationContext: context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  const origin = new URL(baseURL).origin;
  await context.grantPermissions(["notifications"], { origin });
  const page = await context.newPage();
  // This public page needs neither a database fixture nor a signed-in account.
  await page.goto("/offline.html");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  const worker = context.serviceWorkers().find((worker) => worker.url() === `${origin}/sw.js`);
  if (!worker) throw new Error("Service worker not found");
  // Observe the native API's successful completion without replacing its work.
  await worker.evaluate(`(() => {
    self.notificationTestResults = [];
    const show = self.registration.showNotification.bind(self.registration);
    self.registration.showNotification = async (title, options) => {
      await show(title, options);
      self.notificationTestResults.push({ title, icon: options.icon });
    };
  })()`);

  try {
    for (const [title, icon, expectedIcon] of [
      ["プロフィール画像テスト", "/notification-avatars/cat.png?v=1", /^data:image\/png;base64,/],
      ["画像取得失敗テスト", "/notification-avatars/missing.png", /\/icon-192x192\.png\?v=3$/],
    ] as const) {
      // Construct the event locally; no push-service subscription or household
      // delivery is needed. Synthetic events need their own waitUntil bridge.
      const payload = JSON.stringify({ title, body: "タスクが追加されました", icon, url: "/" });
      const actualIcon = await worker.evaluate(`(async () => {
        const pending = [];
        const event = new PushEvent("push", { data: ${JSON.stringify(payload)} });
        Object.defineProperty(event, "waitUntil", { value: promise => pending.push(promise) });
        self.dispatchEvent(event);
        await Promise.all(pending);
        return self.notificationTestResults.find(notification => notification.title === ${JSON.stringify(title)})?.icon;
      })()`);
      expect(actualIcon).toMatch(expectedIcon);
    }
  } finally {
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      for (const notification of await registration.getNotifications()) notification.close();
    });
  }
});
