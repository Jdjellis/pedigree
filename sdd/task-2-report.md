## Task 2 Report: Default-sex segmented control

### What was implemented

- **`src/components/ui/islands/DefaultSexControl.tsx`** — A 3-segment control (Male ▢ / Female ● / Unknown ◇) that reads `defaultSex` from `useUIStore` and calls `setDefaultSex` on click. Uses `aria-pressed` for accessibility and `aria-label` for button names. Renders in the react-dom tree, so Zustand subscriptions are safe.
- **`src/components/ui/islands/DefaultSexControl.test.tsx`** — RTL test file (verbatim from brief): two tests covering `aria-pressed` state and store update on click.
- **`src/components/ui/islands/islands.module.css`** — Appended `.sexControl`, `.sexSegment`, `.sexSegment:hover`, and `.sexSegmentActive` styles.
- **`src/components/ui/islands/ToolIsland.tsx`** — Imported `DefaultSexControl` and mounted it at the end of the island, preceded by a `toolDivider` span.

### TDD Evidence

**RED (Step 2):**
```
npm test -- src/components/ui/islands/DefaultSexControl.test.tsx
```
Output: `FAIL` — `Error: Failed to resolve import "./DefaultSexControl" from "..."`. Expected failure because the file did not yet exist.

**GREEN (Step 5):**
```
npm test -- src/components/ui/islands/DefaultSexControl.test.tsx
```
Output: `2 tests passed (73ms)`. Both tests green. A cosmetic `act(...)` warning appears for the `.click()` test — this is the same pattern as `ToolIsland.test.tsx`'s existing click test; it doesn't cause failures.

### Full test suite

`npm test`: **306/307 passed**. The single failure (`useAutoSave > debounced save > coalesces rapid edits into a single write`) is pre-existing and unrelated to this task — no files in `src/hooks/` were touched.

### Typecheck

`npm run typecheck`: clean (no errors).

### Files changed

- Created: `src/components/ui/islands/DefaultSexControl.tsx`
- Created: `src/components/ui/islands/DefaultSexControl.test.tsx`
- Modified: `src/components/ui/islands/islands.module.css` (appended segmented-control styles)
- Modified: `src/components/ui/islands/ToolIsland.tsx` (import + mount at end of island)

### Self-review findings

- `aria-pressed` is set directly to a boolean; browsers/ARIA serialise booleans as `"true"`/`"false"` strings, which matches the test assertions. Correct.
- The `title` prop uses `"New people: ${seg.label}"` for tooltip context; `aria-label` uses only `seg.label` for clean screen-reader button names. Both are correct and non-redundant.
- `SEGMENTS` is a module-level constant — no re-creation on render.
- Styles use `var(--accent, #6b73e1)` fallback matching the project's existing CSS variable convention.

### Concerns

None. The control is functional and accessible. Its final position in the toolbar is deferred to Task 7 per the brief.

### Commit

`aa1c3a1 feat: add always-visible default-sex segmented control`
