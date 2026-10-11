import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3005",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3005",
    url: "http://127.0.0.1:3005/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
