import { readFileSync } from 'node:fs';
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Never descend into git worktrees (created under .claude/worktrees/ during
    // isolated sessions). They are full repo copies, so without this Vitest
    // would discover and re-run every test a second time from the worktree.
    exclude: [...configDefaults.exclude, '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Focus coverage on application logic; exclude generated/config files,
      // type-only modules, and the app entrypoint that just mounts React.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**',
      ],
      // Modest per-area floors that ratchet coverage on the pure-logic layers
      // (utils/stores/commands) and a few key I/O modules. These are set a few
      // points below current coverage so they catch regressions without being
      // brittle. Glob thresholds are checked against the aggregate of matching
      // files, so a single low-coverage file (e.g. the canvas-2d-dependent
      // fillPatterns.ts, which cannot run under jsdom) does not trip the floor.
      // Deliberately NOT applied to react-konva canvas components, which cannot
      // render under vitest/jsdom (see docs/architecture-reference.md).
      thresholds: {
        'src/utils/**': {
          statements: 88,
          branches: 85,
          functions: 92,
          lines: 88,
        },
        'src/stores/**': {
          statements: 84,
          branches: 88,
          functions: 78,
          lines: 84,
        },
        'src/commands/**': {
          statements: 90,
          branches: 82,
          functions: 55,
          lines: 90,
        },
        'src/io/jsonIO.ts': {
          branches: 82,
        },
        'src/io/pedIO.ts': {
          statements: 90,
          functions: 90,
          lines: 90,
        },
        'src/io/svgExport.ts': {
          statements: 90,
          branches: 80,
          functions: 90,
          lines: 90,
        },
        'src/io/captureClean.ts': {
          statements: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
});
