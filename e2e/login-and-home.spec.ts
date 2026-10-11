import { expect, test } from "@playwright/test";

test("seeded user signs in and can reopen cached household data offline", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("test@example.com");
  await page.getByLabel("パスワード").fill("password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3005/");
  await expect(page.getByRole("tab", { name: "買い物" })).toBeVisible();
  await expect(page.getByRole("button", { name: "タスクを追加" })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => !!(await caches.match("/")))).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("family-task:rq-cache");
    if (!raw) return false;
    const cache = JSON.parse(raw);
    return cache.clientState.queries.some((query: { queryKey: unknown[] }) => query.queryKey[0] === "categories");
  })).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("tab", { name: "買い物" })).toBeVisible();
});

test("offline navigation uses the pre-cached fallback", async ({ page, context }) => {
  await page.goto("/login");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const cachedPage = await page.evaluate(async () => (await caches.match("/offline.html"))?.text());
  expect(cachedPage).toContain("オフラインです");
  await context.setOffline(true);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "オフラインです" })).toBeVisible();
});
