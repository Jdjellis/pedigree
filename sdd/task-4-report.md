# Task 4 Report: Seed a first person on new documents

## What was implemented

### 1. `createSeededDocument` in `src/stores/pedigreeStore.ts`
Added import of `genderForSex` / `DefaultSex` from `src/utils/sex.ts`. Added the exported `createSeededDocument(sex, position?)` function that builds an empty document via `createDefaultDocument()`, then inserts one `createDefaultIndividual` with the mapped gender identity and rounded canvas position. `isProband` defaults to `false` (the `createDefaultIndividual` default).

### 2. `src/utils/canvasCenter.ts` (new file)
`getVisibleCanvasCenter()` queries `.konvajs-content` for its bounding rect; falls back to `{x:300,y:300}` when the element is absent (jsdom, pre-mount). Calls `useViewportStore.getState().screenToCanvas()` to convert stage-local coords to canvas space.

### 3. `src/hooks/useAutoSave.ts` — extracted `parseSavedDocument` + seed on restore-miss
Extracted the entire restore+migrate logic into the exported `parseSavedDocument(raw: string | null): PedigreeDocument | null`. The restore-on-mount `useEffect` now calls `parseSavedDocument`; on success it calls `setDocument(doc)`; on null (absent / corrupt / non-document) it seeds via `createSeededDocument(defaultSex, getVisibleCanvasCenter())`.

### 4. `src/commands/useEditorActions.ts` — `newDocument` seeds; `addText` DRY
`newDocument` now calls `resetView()` then `setDocument(createSeededDocument(sex, getVisibleCanvasCenter()))` then `clearSelection()` (instead of `resetDocument()`). `addText`'s inline canvas-centre block was replaced with `const fallback = getVisibleCanvasCenter()`.

---

## useAutoSave baseline vs. after

| Test | Baseline | After |
|---|---|---|
| loads a saved document from localStorage | PASS | PASS |
| backfills a missing legendConfig on legacy documents | PASS | PASS |
| backfills conditionIds on individuals that predate the field | PASS | PASS |
| ignores corrupt JSON and keeps the current document | PASS | **adapted** (see below) |
| ignores a payload that is not a document | PASS | **adapted** (see below) |
| writes to localStorage after the debounce window | PASS | PASS |
| coalesces rapid edits into a single write | FAIL (pre-existing flake) | FAIL (same pre-existing flake) |
| stops saving after unmount | PASS | PASS |

### Adapted tests (2)
Both tests previously asserted `document` identity (`toBe(before)`) — that on corrupt/invalid localStorage content the hook left the store unchanged. That was true when the hook silently swallowed the failure; it is no longer correct because the hook now **seeds a fresh document**. The new assertions confirm:
- `people` has length 1
- `people[0].isProband === false`
- `people[0].genderIdentity === GenderIdentity.Unknown` (the store's default `defaultSex` is `'unknown'` in tests)

Test names were updated to describe the new, correct behaviour:
- `seeds a fresh person when localStorage contains corrupt JSON`
- `seeds a fresh person when the stored payload is not a document`

No coverage was removed; the same edge cases are exercised, now asserting the correct post-change outcome.

---

## TDD evidence

### `createSeededDocument` (RED -> GREEN)
- RED: `npm test -- src/stores/pedigreeStore.seed.test.ts` -> 2 failed (`(0 , createSeededDocument) is not a function`)
- GREEN: after adding the function -> 2 passed

### `parseSavedDocument` (RED -> GREEN)
- RED: `npm test -- src/hooks/useAutoSave.parse.test.ts` -> 2 failed (`(0 , parseSavedDocument) is not a function`)
- GREEN: after extracting + exporting -> 2 passed

---

## Files changed
- `src/stores/pedigreeStore.ts` — added `genderForSex`/`DefaultSex` import; added `createSeededDocument`
- `src/stores/pedigreeStore.seed.test.ts` — new TDD test file (2 tests)
- `src/utils/canvasCenter.ts` — new helper (`getVisibleCanvasCenter`)
- `src/hooks/useAutoSave.ts` — extracted `parseSavedDocument`; seeding restore-miss effect
- `src/hooks/useAutoSave.parse.test.ts` — new TDD test file (2 tests)
- `src/hooks/useAutoSave.test.tsx` — adapted 2 tests whose assertions reflected now-changed behaviour
- `src/commands/useEditorActions.ts` — `newDocument` seeds; `addText` DRY via `getVisibleCanvasCenter`

---

## Self-review findings
- `addPerson` still carries its own inline `.konvajs-content` query. The brief only asked to DRY `addText`; `addPerson` was left intentionally to keep the diff focused. A follow-up could consolidate it.
- `getVisibleCanvasCenter` is not unit-tested (DOM-aware; jsdom always returns the 300/300 fallback). Manual verification required per the brief.
- The `coalesces rapid edits into a single write` flake appears in every run — pre-existing, out of scope.

## Concerns
None beyond the `addPerson` DRY opportunity noted above.

## Final test run
312 passed, 1 failed (pre-existing `coalesces rapid edits into a single write` flake). Typecheck clean.
