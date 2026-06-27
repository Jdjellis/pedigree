## Task 3 Report: Radial menu uses the default sex

### What was implemented

1. **Exported helper `createRelativeIndividual`** added to `src/components/ui/RadialMenu.tsx` above the component. It takes a `DefaultSex` and a `Partial<Individual>` overrides object, and returns `createDefaultIndividual({ genderIdentity: genderForSex(sex), ...overrides })`. Exported so it is directly importable by the test without rendering the Konva-adjacent component.

2. **New imports**: `Individual` type from `../../types/pedigree`, and `genderForSex`/`DefaultSex` from `../../utils/sex`.

3. **`defaultSex` store subscription** added to `RadialMenu` component: `const defaultSex = useUIStore((s) => s.defaultSex);`

4. **Three handlers wired**: `handleAddPartner`, `handleAddChild`, and `handleAddSibling` now call `createRelativeIndividual(defaultSex, { ... })` instead of `createDefaultIndividual({ ... })`. `defaultSex` added to each handler's `useCallback` dependency array.

5. **`handleAddParent` left unchanged** — still explicitly creates `GenderIdentity.Man` + `GenderIdentity.Woman` pair.

6. **Test file created**: `src/components/ui/RadialMenu.defaultSex.test.tsx` — 2 tests, no component rendering.

### TDD Evidence

**RED** (before helper was added):
```
npm test -- src/components/ui/RadialMenu.defaultSex.test.tsx
  x createRelativeIndividual > applies the default sex as the gender identity  FAIL
    -> (0 , createRelativeIndividual) is not a function
  x createRelativeIndividual > passes through position/generation overrides     FAIL
    -> (0 , createRelativeIndividual) is not a function
  Test Files  1 failed (1) | Tests  2 failed (2)
```

**GREEN** (after implementation):
```
npm test -- src/components/ui/RadialMenu.defaultSex.test.tsx
  check createRelativeIndividual > applies the default sex as the gender identity
  check createRelativeIndividual > passes through position/generation overrides
  Test Files  1 passed (1) | Tests  2 passed (2)
```

### Full suite results

- `npm run typecheck`: clean (exit 0, no output)
- `npm test`: 41 passed, 1 pre-existing failure (`useAutoSave > coalesces rapid edits into a single write` in `src/hooks/useAutoSave.test.tsx`) confirmed pre-existing by stashing and running that test against the prior commit — identical failure.
- New test file: 2/2 pass.

### Files changed

- `src/components/ui/RadialMenu.tsx` — added `createRelativeIndividual` helper (exported), new imports, `defaultSex` store read, three handler call-site replacements, three `useCallback` dep array updates.
- `src/components/ui/RadialMenu.defaultSex.test.tsx` — new test file (2 tests).

### Self-review findings

- The `GenderIdentity` import was already present in the original file (used by `handleAddParent`). The new code does not re-import it — no duplication.
- `createDefaultIndividual` is still imported from pedigreeStore, still used by `handleAddParent` directly, and also called transitively by `createRelativeIndividual`. No dead imports.
- The spread order `{ genderIdentity: genderForSex(sex), ...overrides }` means overrides can override genderIdentity — which is intentional (caller has full control).
- `handleAddParent` correctly remains unchanged: still produces hardcoded Man + Woman pair.
- All three modified handlers have `defaultSex` in their `useCallback` dep arrays.

### Concerns

None. The pre-existing `useAutoSave` timer-based flaky test is unrelated and was failing before this branch's changes.
