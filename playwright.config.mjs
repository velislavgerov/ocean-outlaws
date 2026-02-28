import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:1234",
    headless: true,
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader"],
    },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 1234",
    url: "http://127.0.0.1:1234",
    reuseExistingServer: true,
    timeout: 20000,
  },
});
