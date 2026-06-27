## Task 1 Report: Sex→gender mapping helper + `defaultSex` UI state

### What was implemented

**New files:**
- `src/utils/sex.ts` — exports `type DefaultSex = 'male' | 'female' | 'unknown'` and `genderForSex(sex: DefaultSex): GenderIdentity` with exhaustive switch and JSDoc.
- `src/utils/sex.test.ts` — single test covering all three mappings.
- `src/stores/uiStore.defaultSex.test.ts` — two tests: default value + setter mutation.

**Modified file:**
- `src/stores/uiStore.ts` — added `import type { DefaultSex }` at top; added `defaultSex: DefaultSex` field (with JSDoc) and `setDefaultSex: (sex: DefaultSex) => void` action (with JSDoc) to the `UIState` interface; added `defaultSex: 'unknown'` to the initial state and `setDefaultSex: (defaultSex) => set({ defaultSex })` to the implementation, both placed immediately after their `activeTool`/`setActiveTool` counterparts.

### Test results

`npm run typecheck`: 0 errors.

`npm test` (full suite): 304 passed, 1 pre-existing failure in `src/hooks/useAutoSave.test.tsx > debounced save > coalesces rapid edits into a single write`. Confirmed pre-existing by stashing my changes and re-running — same failure on the baseline commit.

### TDD evidence

**RED — sex helper:**
Command: `npm test -- src/utils/sex.test.ts`
Output: `Error: Failed to resolve import "./sex"` — file did not exist yet. Expected.

**GREEN — sex helper:**
Command: `npm test -- src/utils/sex.test.ts` (after creating `sex.ts`)
Output: `1 passed` in 529ms.

**RED — store field:**
Command: `npm test -- src/stores/uiStore.defaultSex.test.ts`
Output: `TypeError: useUIStore.getState(...).setDefaultSex is not a function` (2 tests failed). Expected.

**GREEN — store field:**
Command: `npm test -- src/stores/uiStore.defaultSex.test.ts` (after modifying `uiStore.ts`)
Output: `2 passed` in 515ms.

### Files changed (commit 17ef98c)

- `src/utils/sex.ts` (new)
- `src/utils/sex.test.ts` (new)
- `src/stores/uiStore.defaultSex.test.ts` (new)
- `src/stores/uiStore.ts` (modified — 4 additions)

### Self-review findings

- **Completeness:** All brief-specified exports present (`DefaultSex`, `genderForSex`, `defaultSex`, `setDefaultSex`). Default value is `'unknown'` as required.
- **Quality:** No `any` usage. All signatures fully typed. JSDoc on public interfaces. Switch is exhaustive; TypeScript will error if `DefaultSex` grows without updating the switch.
- **YAGNI:** No extra exports or state beyond what Task 1 specifies.
- **Test hygiene:** `beforeEach` resets store to `'unknown'` before each store test, preventing state bleed. Tests are named descriptively. Test file is co-located with the store, not in a separate `__tests__` directory (consistent with existing test pattern in the repo).

### Concerns

One pre-existing flaky timer test (`useAutoSave > debounced save > coalesces rapid edits`) fails inconsistently (fake-timer issue). Not introduced by Task 1, not blocking.
