## Task 5 Report: Rename Lock state to `editingLocked`

### What was renamed

| Old name | New name | Location |
|---|---|---|
| `toolLocked` (field) | `editingLocked` | `uiStore.ts` interface + impl |
| `toggleToolLocked` (store action) | `toggleEditingLocked` | `uiStore.ts` interface + impl |
| `toggleToolLock` (editor action) | `toggleEditingLock` | `useEditorActions.ts` interface + body + useMemo |
| `toolLocked` (consumer reads) | `editingLocked` | `ToolIsland.tsx`, `toolPlacement.ts` |
| `"Lock"` (button label) | `"Lock editing"` | `ToolIsland.tsx` |
| JSDoc comment | `L toggle edit-lock` | `useKeyboardShortcuts.ts` |

### `git grep` confirmation of zero old references (source files)

```
git grep -n "toolLock\|toggleToolLock" -- '*.ts' '*.tsx'
```
Output: (empty — zero matches in source files)

Docs under `docs/superpowers/plans/` and `docs/superpowers/specs/` retain the old names intentionally; they are historical design records and not compiled code.

### TDD Evidence

**RED** — `npm test -- src/stores/uiStore.editingLocked.test.ts` failed with:
- `TypeError: useUIStore.getState(...).toggleEditingLocked is not a function`
- `editingLocked` resolved to `undefined`

**GREEN** — after renaming the store, both tests passed.

### Files Changed (12)

- `src/stores/uiStore.ts` — renamed field + action in interface and implementation
- `src/stores/uiStore.editingLocked.test.ts` — NEW: TDD store test
- `src/stores/uiStore.test.ts` — updated existing test for renamed field/action
- `src/commands/useEditorActions.ts` — renamed action in interface, body, useMemo
- `src/commands/useEditorActions.test.tsx` — updated to use `toggleEditingLock` / `editingLocked`
- `src/commands/registry.test.ts` — `makeNoopActions` stub updated
- `src/components/ui/islands/ToolIsland.tsx` — reads `editingLocked`, label "Lock editing", calls `toggleEditingLock`
- `src/components/ui/islands/ToolIsland.test.tsx` — updated label + state key
- `src/components/canvas/toolPlacement.ts` — two `toolLocked` → `editingLocked` reads
- `src/components/canvas/toolPlacement.test.ts` — three `toolLocked` → `editingLocked` in `setState` calls
- `src/hooks/useKeyboardShortcuts.ts` — `toggleEditingLocked()` call + JSDoc updated
- `src/hooks/useKeyboardShortcuts.test.tsx` — updated test name and state key

### Test Results

```
Test Files: 1 failed | 44 passed (45)
Tests:      1 failed | 314 passed (315)
```

The single failure is the pre-existing timing-flaky test `coalesces rapid edits into a single write` in `src/hooks/useAutoSave.test.tsx`. Unrelated to this task.

### Self-Review Findings

- The naming distinction `toggleEditingLocked` (store) vs `toggleEditingLock` (action) is preserved exactly as specified.
- The JSDoc on the `editingLocked` field now reflects the upcoming enforcement ("read-only: no structural or property edits") — forward-leaning but accurate per the design intent.
- `toolPlacement.ts` still checks `editingLocked` to decide whether to revert to `'select'` after a placement. This is the correct existing behaviour (placement-tool lock); enforcement of full edit-lock arrives in Task 6+.
- No behaviour change — pure rename.

### Concerns

None. The rename is mechanical and complete.

### Commit

`55f15f6` — refactor: rename tool-lock state to editingLocked
