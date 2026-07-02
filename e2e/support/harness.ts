import { expect, type Page } from '@playwright/test';

/**
 * Shared determinism spine for the end-to-end workflow suite.
 *
 * The three functions here are what make canvas workflows testable without
 * flakiness, and are meant to be reused by every workflow spec (and, later, the
 * canvas-vs-SVG drift check in #130):
 *
 * - `seedFreshStart` fixes the boot state via `addInitScript` so runs never
 *   depend on prior localStorage.
 * - `readPersistedDoc` observes the app through the real autosave document it
 *   already writes — a zero-seam alternative to exposing test hooks in
 *   production code.
 * - `openRadialOnSeed` is the single canvas-coordinate touchpoint; every other
 *   control the tests drive is a real DOM node.
 */

/** localStorage key the app autosaves the document under (see useAutoSave.ts). */
const AUTOSAVE_KEY = 'pedigree-editor-autosave';
/** localStorage flag recording that first-run onboarding has been dismissed. */
const ONBOARDED_KEY = 'pedigree-onboarded';

/** The slice of the persisted document the workflow tests assert against. */
export interface PersistedDoc {
  individuals: Record<string, unknown>;
  partnerships: Record<string, unknown>;
  parentChildLinks: Record<string, unknown>;
}

/**
 * Fix a deterministic fresh-start state BEFORE the app's JS runs: clear any
 * saved document (so the app seeds a single founder) and set the onboarded flag.
 *
 * Setting onboarded matters for determinism: it suppresses the ~600ms radial
 * auto-preview timer in `OnboardingHints`, which would otherwise open the radial
 * menu on its own schedule and race the test's own driving of it.
 *
 * @param page - The Playwright page, before `goto`.
 */
export async function seedFreshStart(page: Page): Promise<void> {
  await page.addInitScript(
    ([autosaveKey, onboardedKey]) => {
      window.localStorage.removeItem(autosaveKey);
      window.localStorage.setItem(onboardedKey, '1');
    },
    [AUTOSAVE_KEY, ONBOARDED_KEY] as const,
  );
}

/**
 * Read and parse the autosave document from localStorage.
 *
 * @param page - The Playwright page.
 * @returns The parsed document, or null when nothing has been persisted yet.
 */
export async function readPersistedDoc(page: Page): Promise<PersistedDoc | null> {
  const raw = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    AUTOSAVE_KEY,
  );
  return raw ? (JSON.parse(raw) as PersistedDoc) : null;
}

/**
 * Open the radial add-menu on the seed founder.
 *
 * On a fresh seed the founder is centred in the viewport, so a trusted pointer
 * move to the canvas centre triggers the proximity-hover that reveals the menu.
 * Two moves (an approach then the centre) so the hover hysteresis registers a
 * real approach rather than a single teleport. Resolves once the menu's buttons
 * have mounted.
 *
 * @param page - The Playwright page, after the founder has been seeded.
 */
export async function openRadialOnSeed(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  const cx = (viewport?.width ?? 1280) / 2;
  const cy = (viewport?.height ?? 800) / 2;
  await page.mouse.move(cx - 40, cy - 40);
  await page.mouse.move(cx, cy);
  await expect(page.getByTitle('Add Partner')).toBeVisible();
}
