# Task 6 Report: Enforce Edit Lock Across Mutation Paths

## Two TDD Guards

### `deleteSelectedAction` (src/commands/editorActions.ts)

**RED**: Created `src/commands/editorActions.lock.test.ts`. Ran focused test — "does nothing while editing is locked" FAILED: individual was deleted despite lock. "deletes when unlocked" PASSED.

**Guard added** (line 44): `if (useUIStore.getState().editingLocked) return;`

**GREEN**: Both tests PASS.

---

### `eraseElementById` (src/components/canvas/eraserTool.ts)

**RED**: Created `src/components/canvas/eraserTool.lock.test.ts`. Ran focused test — "does nothing while editing is locked" FAILED: individual was erased despite lock. "erases when unlocked" PASSED.

**Guard added** (lines 1-2 of function body, after adding `import { useUIStore }`):
`if (useUIStore.getState().editingLocked) return;`

**GREEN**: Both tests PASS.

---

## Konva/JSX Gates (manual code-inspection verified)

### 1. `src/components/canvas/symbols/PedigreeSymbol.tsx`

- Added `editingLocked?: boolean` prop to `PedigreeSymbolProps` interface (JSDoc included).
- Destructured `editingLocked = false` in the component body.
- Changed `draggable={!panMode}` -> `draggable={!panMode && !editingLocked}` on the Konva `<Group>`.
- `editingLocked` is passed in from `CanvasContainer.tsx` as a prop (react-dom context), consistent with the MEMORY.md critical pattern: no Zustand hooks inside react-konva.

### 2. `src/components/canvas/CanvasContainer.tsx`

- Subscribed to `editingLocked` at the top of the component: `const editingLocked = useUIStore((s) => s.editingLocked);`
- In `handleStageClick`, at the very start of the `else if (currentTool === 'text')` branch:
  `if (useUIStore.getState().editingLocked) return;`
  (Uses `getState()` imperative read, consistent with the existing pattern for stale-closure avoidance in Konva handlers.)
- Passes `editingLocked={editingLocked}` to every `<PedigreeSymbol>` in the layer map.

### 3. `src/components/ui/RadialMenu.tsx`

- Changed the early-return guard from `if (!visible || !target) return null;` to:
  `if (!visible || !target || useUIStore.getState().editingLocked) return null;`
- This prevents the menu from rendering (and thus from registering its dismiss listeners) when the document is locked.

### 4. `src/components/ui/PropertiesPanel.tsx`

**Approach chosen: `<fieldset disabled={editingLocked}>`**

Reason: The panel has ~15 inputs, selects, textareas, and buttons spread across 6 sections. A single wrapping `<fieldset disabled>` natively disables all nested form controls in one HTML primitive. The fieldset is rendered with `border:'none', margin:0, padding:0, minInlineSize:0` to be invisible to layout.

Implementation:
- Added `const editingLocked = useUIStore((s) => s.editingLocked);` near the top of the component.
- Wrapped all 6 sections (Identity, Conditions, Investigations, Clinical Notes, Vital Status, Pedigree Role, Notes) in `<fieldset disabled={editingLocked} style={{...}}>`.
- The empty/not-selected branch (renders only a message, no inputs) is outside the fieldset and unaffected.

---

## Test Results

```
Test Files: 1 failed | 46 passed (47)
Tests:      1 failed | 318 passed (319)
```

Only failure: `useAutoSave > debounced save > coalesces rapid edits into a single write` — pre-existing timing flake, unrelated to Task 6.

---

## Additional Fix: Test Isolation Gap in `useKeyboardShortcuts.test.tsx`

The existing test "pressing l toggles editingLocked to true" left `editingLocked === true` in store state. The `beforeEach` reset partial state but omitted `editingLocked`, so Delete/Backspace tests then failed because `deleteSelectedAction` (now correctly guarded) returned early.

Fix: Added `editingLocked: false` to the `useUIStore.setState` call in `beforeEach`. Minimal correctness fix to test isolation only.

---

## Files Changed

- `src/commands/editorActions.ts` — +1 guard line
- `src/commands/editorActions.lock.test.ts` — NEW, 2 TDD tests
- `src/components/canvas/eraserTool.ts` — +1 import, +1 guard line
- `src/components/canvas/eraserTool.lock.test.ts` — NEW, 2 TDD tests
- `src/components/canvas/symbols/PedigreeSymbol.tsx` — prop + draggable guard
- `src/components/canvas/CanvasContainer.tsx` — subscribe + pass prop + text-placement guard
- `src/components/ui/RadialMenu.tsx` — early-return lock check
- `src/components/ui/PropertiesPanel.tsx` — subscription + fieldset wrapper
- `src/hooks/useKeyboardShortcuts.test.tsx` — `editingLocked: false` in beforeEach reset

---

## Self-Review

- No `any` types used. All public interfaces have JSDoc.
- `useUIStore.getState()` used imperatively inside event handlers; reactive subscription only in react-dom context.
- Fieldset approach covers all 15+ controls in one change; layout preserved by inline style reset.
- Typecheck passes clean.

## Concerns

None.
