import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the end-to-end workflow suite.
 *
 * These tests drive the real react-konva canvas in a browser — the one surface
 * that cannot render under vitest/jsdom (see `docs/architecture-reference.md`).
 * They are deliberately separate from the vitest unit suite (`npm test`), which
 * owns pure-logic coverage.
 *
 * Determinism is the design goal, so:
 * - a single Chromium project with a fixed viewport (no device-pixel drift),
 * - `retries: 0` — a flake should surface, never be masked by a silent re-run,
 * - assertions poll observable state (the persisted autosave document) rather
 *   than sleeping on timers.
 *
 * The browser binary is preinstalled in CI (`PLAYWRIGHT_BROWSERS_PATH`); locally
 * run `npx playwright install chromium` once.
 */
export default defineConfig({
  testDir: './e2e',
  // One workflow spec today; keep parallelism on so the suite scales cleanly.
  fullyParallel: true,
  // Fail the run if a `test.only` is committed by accident.
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://localhost:4179',
    // Fixed viewport so the seed person lands at a known screen point and the
    // canvas coordinate math stays stable across machines.
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  // Boot the Vite dev server for the run on a dedicated, strict port. A private
  // port (not the default 5173) avoids colliding with a dev server the user is
  // already running in another worktree, and `--strictPort` makes Vite fail
  // loudly on a collision instead of silently drifting to the next port — which
  // would otherwise leave Playwright polling a URL nothing is serving until it
  // times out. Reuse locally for fast iteration; always start clean in CI.
  webServer: {
    command: 'npm run dev -- --port 4179 --strictPort',
    url: 'http://localhost:4179',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
