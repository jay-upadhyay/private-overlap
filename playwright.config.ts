import { defineConfig, devices } from '@playwright/test';

// BASE_URL points the suite at a deployed site (for example the live Pages URL).
// Without it, tests run against a local preview served under a subpath, like GitHub Pages.
const liveUrl = process.env.BASE_URL;
const localUrl = 'http://localhost:4173/private-overlap/';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: liveUrl ?? localUrl,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: liveUrl
    ? undefined
    : {
        command: 'npx vite preview --port 4173 --strictPort --base /private-overlap/',
        url: localUrl,
        reuseExistingServer: !process.env.CI,
      },
});
