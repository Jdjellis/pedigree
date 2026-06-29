# Multi-select bulk editing + twin grouping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the properties panel edit many people at once — bulk-editing categorical fields and uniting existing siblings into a twin group — when more than one individual is selected.

**Architecture:** Purely additive on top of #68. No selection plumbing changes (marquee `selectMultiple` and shift-click `toggleSelection` already populate `uiStore.selectedIds`). Add three batched, single-undo-step store actions and one pure sibship helper, then a new `MultiSelectProperties` react-dom component that `PropertiesPanel` renders when `selectedIds.size > 1`.

**Tech Stack:** React + TypeScript, Zustand (+ zundo `temporal` for undo), react-konva (canvas — untouched here), Vitest + @testing-library/react + jest-dom.

## Global Constraints

- **Never use `any`.** Type-annotate every function signature; JSDoc public functions/components. (CLAUDE.md global prefs)
- **Each bulk operation must be one undo step.** A store action does all its work inside a single `set(...)` call so one zundo entry reverts everything. (spec → Data flow)
- **Store logic is the real test surface.** react-konva cannot render under vitest/jsdom; put validation/merge logic in the store, unit-test it there. Component tests render `<PropertiesPanel />` under jsdom (the `ConnectionProperties.test.tsx` pattern). (memory: react-konva jsdom testing)
- **Bulk-editable fields are exactly:** Identity (gender identity, sex assigned at birth), Vital status (+ cause of death), Adoption (adopted flag), Conditions. Identifying/unique fields (name, DOB, age, notes, proband) are NOT bulk-editable. (spec → Goals/Non-goals)
- **Mixed-value rule:** a control whose selected people disagree shows a "Mixed" state and writes ONLY on an explicit change; untouched controls never write. (spec → Mixed-value semantics)
- **Conventional commits**, one logical change per commit, run tests before committing. (CLAUDE.md)
- Run from the worktree: `/Users/joshuaellis/Documents/Dev/Pedigree/.claude/worktrees/twin-grouping-bulk-edit` (branch `worktree-twin-grouping-bulk-edit`).

---

## File Structure

**Create:**
- `src/utils/sibship.ts` — pure `commonSibshipId(doc, ids)` helper. One responsibility: resolve the shared sibship of a set of individuals.
- `src/utils/sibship.test.ts` — unit tests for the helper.
- `src/components/ui/MultiSelectProperties.tsx` — the multi-select editor component (header, twins section, identity, vital status, adoption, conditions).
- `src/components/ui/MultiSelectProperties.test.tsx` — component tests rendered via `<PropertiesPanel />`.

**Modify:**
- `src/stores/pedigreeStore.ts` — add `updateIndividuals`, `setConditionForIndividuals`, `groupTwins` to the `PedigreeState` interface and the store body.
- `src/stores/pedigreeStore.test.ts` — add unit tests for the three new actions (or a new sibling test file; this plan uses the existing file).
- `src/components/ui/PropertiesPanel.tsx` — add the `selectedIds.size > 1 → <MultiSelectProperties />` dispatch branch and the import.

---

### Task 1: `commonSibshipId` sibship helper

**Files:**
- Create: `src/utils/sibship.ts`
- Test: `src/utils/sibship.test.ts`

**Interfaces:**
- Consumes: `PedigreeDocument` type (`src/types/pedigree.ts`).
- Produces: `commonSibshipId(doc: Pick<PedigreeDocument, 'parentChildLinks'>, ids: string[]): string | null` — used by `groupTwins` (Task 4) and `MultiSelectProperties` (Task 8).

- [ ] **Step 1: Write the failing test**

Create `src/utils/sibship.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { commonSibshipId } from './sibship';
import { RelationshipType } from '../types/enums';
import type { ParentChildRelationship } from '../types/pedigree';

function link(id: string, childId: string, parentPartnershipId: string): ParentChildRelationship {
  return { id, type: RelationshipType.ParentChild, parentPartnershipId, childId, isAdopted: false };
}

function doc(links: ParentChildRelationship[]) {
  return { parentChildLinks: Object.fromEntries(links.map((l) => [l.id, l])) };
}

describe('commonSibshipId', () => {
  it('returns null for fewer than two ids', () => {
    const d = doc([link('l1', 'a', 'u1')]);
    expect(commonSibshipId(d, ['a'])).toBeNull();
    expect(commonSibshipId(d, [])).toBeNull();
  });

  it('returns the shared partnership for two siblings', () => {
    const d = doc([link('l1', 'a', 'u1'), link('l2', 'b', 'u1')]);
    expect(commonSibshipId(d, ['a', 'b'])).toBe('u1');
  });

  it('returns the shared partnership for three siblings (triplets)', () => {
    const d = doc([link('l1', 'a', 'u1'), link('l2', 'b', 'u1'), link('l3', 'c', 'u1')]);
    expect(commonSibshipId(d, ['a', 'b', 'c'])).toBe('u1');
  });

  it('returns null when ids are in different sibships', () => {
    const d = doc([link('l1', 'a', 'u1'), link('l2', 'b', 'u2')]);
    expect(commonSibshipId(d, ['a', 'b'])).toBeNull();
  });

  it('returns null when any id is a founder with no parent links', () => {
    const d = doc([link('l1', 'a', 'u1')]);
    expect(commonSibshipId(d, ['a', 'founder'])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/sibship.test.ts`
Expected: FAIL — `Failed to resolve import "./sibship"` / `commonSibshipId is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/sibship.ts`:

```ts
import type { PedigreeDocument } from '../types/pedigree';

/**
 * Resolve the parent partnership (sibship) shared by every individual in `ids`.
 *
 * An individual's sibship is the `parentPartnershipId` of any parent-child link
 * whose `childId` is that individual. Returns the partnership id common to all
 * given individuals, or `null` when there are fewer than two ids, when any id is
 * a founder with no parent links, or when the ids do not all share a single
 * common sibship. When more than one common sibship exists, the
 * lexicographically-first partnership id is returned for determinism.
 */
export function commonSibshipId(
  doc: Pick<PedigreeDocument, 'parentChildLinks'>,
  ids: string[],
): string | null {
  if (ids.length < 2) return null;
  const links = Object.values(doc.parentChildLinks);
  let common: Set<string> | null = null;
  for (const id of ids) {
    const partnerships = new Set(
      links.filter((l) => l.childId === id).map((l) => l.parentPartnershipId),
    );
    if (partnerships.size === 0) return null;
    common =
      common === null
        ? partnerships
        : new Set([...common].filter((p) => partnerships.has(p)));
    if (common.size === 0) return null;
  }
  if (!common || common.size === 0) return null;
  return [...common].sort()[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/sibship.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/sibship.ts src/utils/sibship.test.ts
git commit -m "feat: add commonSibshipId helper for twin grouping eligibility"
```

---

### Task 2: `updateIndividuals` batched store action

**Files:**
- Modify: `src/stores/pedigreeStore.ts` (interface near line 164; implementation after `updateIndividual` ~line 306)
- Test: `src/stores/pedigreeStore.test.ts`

**Interfaces:**
- Consumes: existing store `set`, `Individual` type, `usePedigreeStore.temporal` (zundo).
- Produces: `updateIndividuals(ids: string[], patch: Partial<Individual>): void` — used by `MultiSelectProperties` (Tasks 5, 6).

- [ ] **Step 1: Write the failing test**

Append to `src/stores/pedigreeStore.test.ts`:

```ts
describe('updateIndividuals (bulk)', () => {
  it('applies the patch to every listed individual and leaves others untouched', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'a' }));
    store.addIndividual(createDefaultIndividual({ id: 'b' }));
    store.addIndividual(createDefaultIndividual({ id: 'c' }));

    store.updateIndividuals(['a', 'b'], { vitalStatus: VitalStatus.Deceased });

    const doc = usePedigreeStore.getState().document;
    expect(doc.individuals.a.vitalStatus).toBe(VitalStatus.Deceased);
    expect(doc.individuals.b.vitalStatus).toBe(VitalStatus.Deceased);
    expect(doc.individuals.c.vitalStatus).toBe(VitalStatus.Alive);
  });

  it('ignores unknown ids', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'a' }));
    store.updateIndividuals(['a', 'missing'], { genderIdentity: GenderIdentity.Woman });
    expect(usePedigreeStore.getState().document.individuals.a.genderIdentity).toBe(
      GenderIdentity.Woman,
    );
  });

  it('records a single undoable step for the whole batch', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'a' }));
    store.addIndividual(createDefaultIndividual({ id: 'b' }));

    store.updateIndividuals(['a', 'b'], { adopted: true });
    usePedigreeStore.temporal.getState().undo();

    const doc = usePedigreeStore.getState().document;
    expect(doc.individuals.a.adopted).toBeUndefined();
    expect(doc.individuals.b.adopted).toBeUndefined();
  });
});
```

Confirm the imports at the top of `pedigreeStore.test.ts` include `createDefaultIndividual`, `GenderIdentity`, and `VitalStatus`. If `GenderIdentity`/`VitalStatus` are not already imported, add: `import { GenderIdentity, VitalStatus } from '../types/enums';`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/stores/pedigreeStore.test.ts -t "updateIndividuals"`
Expected: FAIL — `store.updateIndividuals is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/stores/pedigreeStore.ts`, add to the `PedigreeState` interface, directly after the `updateIndividual` line (~line 164):

```ts
  /**
   * Apply the same patch to several individuals in one `set` call so the whole
   * bulk edit is a single undo step. Unknown ids are skipped.
   */
  updateIndividuals: (ids: string[], patch: Partial<Individual>) => void;
```

Add the implementation in the store body, directly after the `updateIndividual` action (after its closing `}),` ~line 306):

```ts
      updateIndividuals: (ids, patch) =>
        set((state) => {
          const individuals = { ...state.document.individuals };
          let changed = false;
          for (const id of ids) {
            const existing = individuals[id];
            if (!existing) continue;
            individuals[id] = { ...existing, ...patch };
            changed = true;
          }
          if (!changed) return state;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              individuals,
            },
          };
        }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/stores/pedigreeStore.test.ts -t "updateIndividuals"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/pedigreeStore.ts src/stores/pedigreeStore.test.ts
git commit -m "feat: add updateIndividuals bulk action (single undo step)"
```

---

### Task 3: `setConditionForIndividuals` batched store action

**Files:**
- Modify: `src/stores/pedigreeStore.ts` (interface + implementation, after `updateIndividuals`)
- Test: `src/stores/pedigreeStore.test.ts`

**Interfaces:**
- Consumes: store `set`, `Individual.conditionIds`.
- Produces: `setConditionForIndividuals(ids: string[], entryId: string, applied: boolean): void` — used by `MultiSelectProperties` (Task 7).

- [ ] **Step 1: Write the failing test**

Append to `src/stores/pedigreeStore.test.ts`:

```ts
describe('setConditionForIndividuals (bulk)', () => {
  it('adds the condition to every individual that lacks it (idempotent for those that have it)', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'a', conditionIds: [] }));
    store.addIndividual(createDefaultIndividual({ id: 'b', conditionIds: ['x'] }));

    store.setConditionForIndividuals(['a', 'b'], 'x', true);

    const doc = usePedigreeStore.getState().document;
    expect(doc.individuals.a.conditionIds).toEqual(['x']);
    expect(doc.individuals.b.conditionIds).toEqual(['x']); // not duplicated
  });

  it('removes the condition from every individual that has it', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'a', conditionIds: ['x', 'y'] }));
    store.addIndividual(createDefaultIndividual({ id: 'b', conditionIds: ['x'] }));

    store.setConditionForIndividuals(['a', 'b'], 'x', false);

    const doc = usePedigreeStore.getState().document;
    expect(doc.individuals.a.conditionIds).toEqual(['y']);
    expect(doc.individuals.b.conditionIds).toEqual([]);
  });

  it('records a single undoable step', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'a', conditionIds: [] }));
    store.addIndividual(createDefaultIndividual({ id: 'b', conditionIds: [] }));

    store.setConditionForIndividuals(['a', 'b'], 'x', true);
    usePedigreeStore.temporal.getState().undo();

    const doc = usePedigreeStore.getState().document;
    expect(doc.individuals.a.conditionIds).toEqual([]);
    expect(doc.individuals.b.conditionIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/stores/pedigreeStore.test.ts -t "setConditionForIndividuals"`
Expected: FAIL — `store.setConditionForIndividuals is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to the `PedigreeState` interface (after the `updateIndividuals` line from Task 2):

```ts
  /**
   * Add or remove a single condition id across several individuals in one `set`
   * call (one undo step). `applied` true adds it to those lacking it; false
   * removes it from those that have it. Unknown ids are skipped.
   */
  setConditionForIndividuals: (
    ids: string[],
    entryId: string,
    applied: boolean,
  ) => void;
```

Add the implementation directly after `updateIndividuals` in the store body:

```ts
      setConditionForIndividuals: (ids, entryId, applied) =>
        set((state) => {
          const individuals = { ...state.document.individuals };
          let changed = false;
          for (const id of ids) {
            const existing = individuals[id];
            if (!existing) continue;
            const current = existing.conditionIds ?? [];
            const has = current.includes(entryId);
            if (applied && !has) {
              individuals[id] = { ...existing, conditionIds: [...current, entryId] };
              changed = true;
            } else if (!applied && has) {
              individuals[id] = {
                ...existing,
                conditionIds: current.filter((c) => c !== entryId),
              };
              changed = true;
            }
          }
          if (!changed) return state;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              individuals,
            },
          };
        }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/stores/pedigreeStore.test.ts -t "setConditionForIndividuals"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/pedigreeStore.ts src/stores/pedigreeStore.test.ts
git commit -m "feat: add setConditionForIndividuals bulk action (single undo step)"
```

---

### Task 4: `groupTwins` store action (create / extend / merge)

**Files:**
- Modify: `src/stores/pedigreeStore.ts` (imports, interface, implementation after `setConditionForIndividuals`)
- Test: `src/stores/pedigreeStore.test.ts`

**Interfaces:**
- Consumes: `commonSibshipId` (Task 1), `generateId` (already imported), `TwinType` enum, `TwinGroup` type.
- Produces: `groupTwins(ids: string[], twinType: TwinType): string | null` — returns the resulting twin-group id, or `null` when the selection is not grouping-eligible. Used by `MultiSelectProperties` (Task 8).

- [ ] **Step 1: Write the failing test**

Append to `src/stores/pedigreeStore.test.ts`:

```ts
describe('groupTwins', () => {
  // Build a sibship: union1 with N children, each wired by a parent-child link.
  function seedSibship(childIds: string[]) {
    const store = usePedigreeStore.getState();
    store.addPartnership({
      id: 'union1',
      type: RelationshipType.Partnership,
      partner1Id: 'p1',
      partner2Id: 'p2',
      childrenIds: childIds,
    });
    for (const id of childIds) {
      store.addIndividual(createDefaultIndividual({ id }));
      store.addParentChildLink({
        id: `link-${id}`,
        type: RelationshipType.ParentChild,
        parentPartnershipId: 'union1',
        childId: id,
        isAdopted: false,
      });
    }
  }

  it('creates a new twin group from two ungrouped siblings', () => {
    seedSibship(['a', 'b']);
    const id = usePedigreeStore.getState().groupTwins(['a', 'b'], TwinType.Dizygotic);
    expect(id).not.toBeNull();
    const tg = usePedigreeStore.getState().document.twinGroups[id as string];
    expect(tg.twinType).toBe(TwinType.Dizygotic);
    expect([...tg.individualIds].sort()).toEqual(['a', 'b']);
    expect(tg.parentPartnershipId).toBe('union1');
  });

  it('groups three siblings as triplets', () => {
    seedSibship(['a', 'b', 'c']);
    const id = usePedigreeStore.getState().groupTwins(['a', 'b', 'c'], TwinType.Monozygotic);
    const tg = usePedigreeStore.getState().document.twinGroups[id as string];
    expect([...tg.individualIds].sort()).toEqual(['a', 'b', 'c']);
  });

  it('extends an existing pair to a triplet, keeping the existing zygosity', () => {
    seedSibship(['a', 'b', 'c']);
    const store = usePedigreeStore.getState();
    store.addTwinGroup({
      id: 'tg1',
      twinType: TwinType.Monozygotic,
      individualIds: ['a', 'b'],
      parentPartnershipId: 'union1',
    });

    const id = store.groupTwins(['b', 'c'], TwinType.Dizygotic);

    expect(id).toBe('tg1'); // merged into existing group
    const tg = usePedigreeStore.getState().document.twinGroups['tg1'];
    expect([...tg.individualIds].sort()).toEqual(['a', 'b', 'c']);
    expect(tg.twinType).toBe(TwinType.Monozygotic); // existing type kept
  });

  it('merges two existing groups into the larger one and removes the smaller', () => {
    seedSibship(['a', 'b', 'c', 'd', 'e']);
    const store = usePedigreeStore.getState();
    store.addTwinGroup({
      id: 'big',
      twinType: TwinType.Monozygotic,
      individualIds: ['a', 'b', 'c'],
      parentPartnershipId: 'union1',
    });
    store.addTwinGroup({
      id: 'small',
      twinType: TwinType.Dizygotic,
      individualIds: ['d', 'e'],
      parentPartnershipId: 'union1',
    });

    const id = store.groupTwins(['a', 'd'], TwinType.Unknown);

    expect(id).toBe('big');
    const groups = usePedigreeStore.getState().document.twinGroups;
    expect(groups['small']).toBeUndefined();
    expect([...groups['big'].individualIds].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(groups['big'].twinType).toBe(TwinType.Monozygotic); // larger group's type wins
  });

  it('returns null and changes nothing when ids span different sibships', () => {
    const store = usePedigreeStore.getState();
    store.addPartnership({ id: 'u1', type: RelationshipType.Partnership, childrenIds: ['a'] });
    store.addPartnership({ id: 'u2', type: RelationshipType.Partnership, childrenIds: ['b'] });
    store.addIndividual(createDefaultIndividual({ id: 'a' }));
    store.addIndividual(createDefaultIndividual({ id: 'b' }));
    store.addParentChildLink({ id: 'la', type: RelationshipType.ParentChild, parentPartnershipId: 'u1', childId: 'a', isAdopted: false });
    store.addParentChildLink({ id: 'lb', type: RelationshipType.ParentChild, parentPartnershipId: 'u2', childId: 'b', isAdopted: false });

    const id = store.groupTwins(['a', 'b'], TwinType.Dizygotic);

    expect(id).toBeNull();
    expect(Object.keys(usePedigreeStore.getState().document.twinGroups)).toHaveLength(0);
  });

  it('records a single undoable step', () => {
    seedSibship(['a', 'b']);
    const store = usePedigreeStore.getState();
    store.groupTwins(['a', 'b'], TwinType.Dizygotic);
    usePedigreeStore.temporal.getState().undo();
    expect(Object.keys(usePedigreeStore.getState().document.twinGroups)).toHaveLength(0);
  });
});
```

Confirm `RelationshipType` and `TwinType` are imported at the top of `pedigreeStore.test.ts`; if not, add `import { RelationshipType, TwinType } from '../types/enums';` (merge with the existing enums import).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/stores/pedigreeStore.test.ts -t "groupTwins"`
Expected: FAIL — `store.groupTwins is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/stores/pedigreeStore.ts`:

Add `TwinType` to the enums import (line ~14-17), so it reads:

```ts
import {
  GenderIdentity,
  VitalStatus,
  TwinType,
} from '../types/enums';
```

Add the sibship-helper import next to the other util imports (after the `constants` import ~line 27):

```ts
import { commonSibshipId } from '../utils/sibship';
```

Add to the `PedigreeState` interface, in the "Twin group actions" block (after `removeTwinGroup` ~line 211):

```ts
  /**
   * Unite the given individuals into a single twin group, in one undo step.
   * All ids must belong to the same sibship (see {@link commonSibshipId}),
   * otherwise this is a no-op returning `null`.
   *
   * - No selected id is already grouped → create a new group with `twinType`.
   * - Some are already grouped → merge all selected ids (and the members of any
   *   touched groups) into one group. The surviving group's zygosity is kept
   *   (the largest touched group wins; ties resolve to the lexicographically-
   *   first group id); `twinType` is used only when creating a fresh group.
   *
   * @returns the resulting twin-group id, or `null` if not grouping-eligible.
   */
  groupTwins: (ids: string[], twinType: TwinType) => string | null;
```

Add the implementation after `removeTwinGroup` in the store body (after its closing `}),` ~line 646):

```ts
      groupTwins: (ids, twinType) => {
        let resultId: string | null = null;
        set((state) => {
          const sibshipId = commonSibshipId(state.document, ids);
          if (!sibshipId) return state;

          const groups = { ...state.document.twinGroups };
          const touched = Object.values(groups).filter((g) =>
            g.individualIds.some((m) => ids.includes(m)),
          );

          const members = new Set<string>(ids);
          for (const g of touched) g.individualIds.forEach((m) => members.add(m));

          // Largest touched group wins; ties resolve to the smallest id.
          const target = touched
            .slice()
            .sort(
              (a, b) =>
                b.individualIds.length - a.individualIds.length ||
                (a.id < b.id ? -1 : 1),
            )[0];

          if (target) {
            for (const g of touched) {
              if (g.id !== target.id) delete groups[g.id];
            }
            groups[target.id] = {
              ...target,
              individualIds: [...members],
              parentPartnershipId: sibshipId,
            };
            resultId = target.id;
          } else {
            const id = generateId();
            groups[id] = {
              id,
              twinType,
              individualIds: [...members],
              parentPartnershipId: sibshipId,
            };
            resultId = id;
          }

          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              twinGroups: groups,
            },
          };
        });
        return resultId;
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/stores/pedigreeStore.test.ts -t "groupTwins"`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/pedigreeStore.ts src/stores/pedigreeStore.test.ts
git commit -m "feat: add groupTwins action (create/extend/merge, single undo step)"
```

---

### Task 5: `MultiSelectProperties` scaffold, dispatch wiring, header + Identity

**Files:**
- Create: `src/components/ui/MultiSelectProperties.tsx`
- Modify: `src/components/ui/PropertiesPanel.tsx` (add import + dispatch branch ~after line 213)
- Test: `src/components/ui/MultiSelectProperties.test.tsx`

**Interfaces:**
- Consumes: `useUIStore` (`selectedIds`, `editingLocked`), `usePedigreeStore` (`document.individuals`, `updateIndividuals`), `GenderIconButtons`, `SegmentedControl`, `GenderIdentity`/`SexAssignedAtBirth` enums, `styles` from `PropertiesPanel.module.css`.
- Produces: `MultiSelectProperties` React component; a module-local `sharedValue<T>(values: T[]): T | undefined` helper (used by Tasks 6, 7, 8 within the same file).

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/MultiSelectProperties.test.tsx`:

```tsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import {
  usePedigreeStore,
  createDefaultDocument,
  createDefaultIndividual,
} from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { GenderIdentity } from '../../types/enums';
import { PropertiesPanel } from './PropertiesPanel';

function selectPeople(ids: string[]) {
  act(() => {
    useUIStore.setState({
      selectedIds: new Set(ids),
      selectedConnection: null,
      propertiesPanelOpen: true,
    });
  });
}

beforeEach(() => {
  act(() => {
    usePedigreeStore.getState().setDocument(createDefaultDocument());
    useUIStore.setState({
      selectedIds: new Set<string>(),
      selectedConnection: null,
      propertiesPanelOpen: false,
    });
  });
});

describe('MultiSelectProperties — header & identity', () => {
  it('shows a count header when more than one person is selected', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', genderIdentity: GenderIdentity.Man });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', genderIdentity: GenderIdentity.Man });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByText('2 people selected')).toBeInTheDocument();
  });

  it('shows the shared gender as active when all agree', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', genderIdentity: GenderIdentity.Woman });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', genderIdentity: GenderIdentity.Woman });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByRole('button', { name: 'Woman' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows no active gender button when the selection is mixed', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', genderIdentity: GenderIdentity.Man });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', genderIdentity: GenderIdentity.Woman });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByRole('button', { name: 'Man' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Woman' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('writes a gender change to every selected person', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', genderIdentity: GenderIdentity.Man });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', genderIdentity: GenderIdentity.Woman });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Non-binary' }));
    });

    const docAfter = usePedigreeStore.getState().document;
    expect(docAfter.individuals.a.genderIdentity).toBe(GenderIdentity.NonBinary);
    expect(docAfter.individuals.b.genderIdentity).toBe(GenderIdentity.NonBinary);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ui/MultiSelectProperties.test.tsx`
Expected: FAIL — `2 people selected` not found (PropertiesPanel still renders the empty state for `size > 1`).

- [ ] **Step 3: Write minimal implementation**

Create `src/components/ui/MultiSelectProperties.tsx`:

```tsx
import { useMemo } from 'react';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { GenderIdentity, SexAssignedAtBirth } from '../../types/enums';
import { GenderIconButtons } from './GenderIconButtons';
import styles from './PropertiesPanel.module.css';

/**
 * Returns the value shared by every element, or `undefined` when the array is
 * empty or its elements disagree (a "mixed" selection).
 */
export function sharedValue<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  const [first, ...rest] = values;
  return rest.every((v) => v === first) ? first : undefined;
}

/**
 * Properties editor shown when more than one individual is selected. Edits the
 * agreed bulk-eligible fields across the whole selection; controls whose people
 * disagree render a "Mixed" state and write only on an explicit change. It is a
 * react-dom component, so Zustand subscriptions are safe here.
 */
export function MultiSelectProperties() {
  const selectedIds = useUIStore((s) => s.selectedIds);
  const editingLocked = useUIStore((s) => s.editingLocked);
  const individuals = usePedigreeStore((s) => s.document.individuals);
  const updateIndividuals = usePedigreeStore((s) => s.updateIndividuals);

  const ids = useMemo(
    () => Array.from(selectedIds).filter((id) => individuals[id]),
    [selectedIds, individuals],
  );
  const people = ids.map((id) => individuals[id]);

  if (people.length < 2) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>Select an individual to edit their properties</div>
      </div>
    );
  }

  const genderValue = sharedValue(people.map((p) => p.genderIdentity));
  const saabValue = sharedValue(people.map((p) => p.sexAssignedAtBirth ?? ''));

  return (
    <div className={styles.panel}>
      <fieldset
        disabled={editingLocked}
        style={{ border: 'none', margin: 0, padding: 0, minInlineSize: 0 }}
      >
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{people.length} people selected</div>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Identity</div>

          <div className={styles.field}>
            <label className={styles.label}>Gender Identity</label>
            {/* A value not in the enum renders no active button — our "Mixed" state. */}
            <GenderIconButtons
              value={genderValue ?? ('' as GenderIdentity)}
              onChange={(v) => updateIndividuals(ids, { genderIdentity: v })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Sex Assigned at Birth</label>
            <select
              className={styles.select}
              value={saabValue ?? ''}
              onChange={(e) =>
                updateIndividuals(ids, {
                  sexAssignedAtBirth: (e.target.value || undefined) as
                    | SexAssignedAtBirth
                    | undefined,
                })
              }
            >
              <option value="">{saabValue === undefined ? 'Mixed' : 'Not specified'}</option>
              <option value={SexAssignedAtBirth.AMAB}>AMAB</option>
              <option value={SexAssignedAtBirth.AFAB}>AFAB</option>
              <option value={SexAssignedAtBirth.UAAB}>UAAB</option>
            </select>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
```

In `src/components/ui/PropertiesPanel.tsx`, add the import alongside the other UI imports (near line 11, next to `ConnectionProperties`):

```ts
import { MultiSelectProperties } from './MultiSelectProperties';
```

Add the dispatch branch directly after the `selectedConnection` branch (after line 213):

```ts
  if (selectedIds.size > 1) {
    return <MultiSelectProperties />;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ui/MultiSelectProperties.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/MultiSelectProperties.tsx src/components/ui/MultiSelectProperties.test.tsx src/components/ui/PropertiesPanel.tsx
git commit -m "feat: multi-select properties panel with bulk identity editing"
```

---

### Task 6: Vital status (+ cause of death) and Adoption sections

**Files:**
- Modify: `src/components/ui/MultiSelectProperties.tsx`
- Test: `src/components/ui/MultiSelectProperties.test.tsx`

**Interfaces:**
- Consumes: `sharedValue` (Task 5), `SegmentedControl`, `VitalStatus` enum, `updateIndividuals`.
- Produces: vital-status + adoption UI inside `MultiSelectProperties` (no new exports).

- [ ] **Step 1: Write the failing test**

Append to `src/components/ui/MultiSelectProperties.test.tsx`:

```tsx
import { VitalStatus } from '../../types/enums';

describe('MultiSelectProperties — vital status & adoption', () => {
  it('sets vital status on every selected person', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a' });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b' });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Deceased' })));

    const after = usePedigreeStore.getState().document;
    expect(after.individuals.a.vitalStatus).toBe(VitalStatus.Deceased);
    expect(after.individuals.b.vitalStatus).toBe(VitalStatus.Deceased);
  });

  it('shows the cause-of-death field only when every selected person is deceased', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', vitalStatus: VitalStatus.Deceased });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', vitalStatus: VitalStatus.Alive });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    const { rerender } = render(<PropertiesPanel />);
    expect(screen.queryByPlaceholderText(/Cause of death|Mixed/i)).not.toBeInTheDocument();

    act(() => {
      usePedigreeStore.getState().updateIndividuals(['b'], { vitalStatus: VitalStatus.Deceased });
    });
    rerender(<PropertiesPanel />);
    expect(screen.getByLabelText('Cause of Death')).toBeInTheDocument();
  });

  it('renders the adopted checkbox as indeterminate when the selection is mixed', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', adopted: true });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b' });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByRole('checkbox', { name: 'Adopted' })).toBePartiallyChecked();
  });

  it('marks all selected adopted when toggled from mixed', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', adopted: true });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b' });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    act(() => fireEvent.click(screen.getByRole('checkbox', { name: 'Adopted' })));

    const after = usePedigreeStore.getState().document;
    expect(after.individuals.a.adopted).toBe(true);
    expect(after.individuals.b.adopted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ui/MultiSelectProperties.test.tsx -t "vital status & adoption"`
Expected: FAIL — `Deceased` button / `Adopted` checkbox not found.

- [ ] **Step 3: Write minimal implementation**

In `src/components/ui/MultiSelectProperties.tsx`, extend the imports:

```ts
import { GenderIdentity, SexAssignedAtBirth, VitalStatus } from '../../types/enums';
import { GenderIconButtons } from './GenderIconButtons';
import { SegmentedControl } from './SegmentedControl';
```

Add a module-level options constant (after the imports, before the component):

```ts
const VITAL_STATUS_OPTIONS: { value: VitalStatus; label: string }[] = [
  { value: VitalStatus.Alive, label: 'Alive' },
  { value: VitalStatus.Deceased, label: 'Deceased' },
  { value: VitalStatus.Stillborn, label: 'Stillborn' },
];
```

Inside the component, after the `saabValue` line, add derived values:

```ts
  const vitalValue = sharedValue(people.map((p) => p.vitalStatus));
  const allDeceased = people.every((p) => p.vitalStatus === VitalStatus.Deceased);
  const causeShared = sharedValue(people.map((p) => p.causeOfDeath ?? ''));
  const allAdopted = people.every((p) => p.adopted === true);
  const anyAdopted = people.some((p) => p.adopted === true);
  const adoptedMixed = anyAdopted && !allAdopted;
```

Add these two sections inside the `<fieldset>`, after the Identity `</div>` section and before the closing `</fieldset>`:

```tsx
        <div className={styles.divider} />

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Vital Status</div>
          <div className={styles.field}>
            <label className={styles.label}>Status</label>
            {/* A value not in the options renders no active segment — "Mixed". */}
            <SegmentedControl
              options={VITAL_STATUS_OPTIONS}
              value={vitalValue ?? ('' as VitalStatus)}
              onChange={(v) => updateIndividuals(ids, { vitalStatus: v })}
              ariaLabel="Vital status"
            />
          </div>
          {allDeceased && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="bulk-cause-of-death">
                Cause of Death
              </label>
              <input
                id="bulk-cause-of-death"
                className={styles.input}
                value={causeShared ?? ''}
                onChange={(e) =>
                  updateIndividuals(ids, { causeOfDeath: e.target.value || undefined })
                }
                placeholder={causeShared === undefined ? 'Mixed — type to set all' : 'Cause of death'}
              />
            </div>
          )}
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Adoption</div>
          <div className={styles.field}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={allAdopted}
                ref={(el) => {
                  if (el) el.indeterminate = adoptedMixed;
                }}
                onChange={() => updateIndividuals(ids, { adopted: allAdopted ? undefined : true })}
              />
              Adopted
            </label>
          </div>
        </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ui/MultiSelectProperties.test.tsx -t "vital status & adoption"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/MultiSelectProperties.tsx src/components/ui/MultiSelectProperties.test.tsx
git commit -m "feat: bulk vital status, cause of death, and adoption editing"
```

---

### Task 7: Conditions section (tri-state, gender-aware)

**Files:**
- Modify: `src/components/ui/MultiSelectProperties.tsx`
- Test: `src/components/ui/MultiSelectProperties.test.tsx`

**Interfaces:**
- Consumes: `usePedigreeStore` (`document.legendConfig`, `setConditionForIndividuals`), `LegendEntry`/`Individual` types, `GenderIdentity`.
- Produces: conditions UI inside `MultiSelectProperties`; a module-local `conditionAppliesTo(entry, person)` helper.

- [ ] **Step 1: Write the failing test**

Append to `src/components/ui/MultiSelectProperties.test.tsx`:

```tsx
import type { LegendEntry } from '../../types/pedigree';

function entry(id: string, name: string, applicableTo?: 'man' | 'woman'): LegendEntry {
  return { id, quarter: 'topLeft', fillColor: '#c00', fillPattern: 'solid', name, applicableTo };
}

describe('MultiSelectProperties — conditions', () => {
  it('checks the condition when all selected people have it', () => {
    const doc = createDefaultDocument();
    doc.legendConfig.entries = [entry('x', 'Cancer')];
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', conditionIds: ['x'] });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', conditionIds: ['x'] });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByRole('checkbox', { name: /Cancer/ })).toBeChecked();
  });

  it('shows an indeterminate condition checkbox when only some have it', () => {
    const doc = createDefaultDocument();
    doc.legendConfig.entries = [entry('x', 'Cancer')];
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', conditionIds: ['x'] });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', conditionIds: [] });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByRole('checkbox', { name: /Cancer/ })).toBePartiallyChecked();
  });

  it('applies the condition to all when toggled from indeterminate', () => {
    const doc = createDefaultDocument();
    doc.legendConfig.entries = [entry('x', 'Cancer')];
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', conditionIds: ['x'] });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', conditionIds: [] });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    act(() => fireEvent.click(screen.getByRole('checkbox', { name: /Cancer/ })));

    const after = usePedigreeStore.getState().document;
    expect(after.individuals.a.conditionIds).toContain('x');
    expect(after.individuals.b.conditionIds).toContain('x');
  });

  it('only writes a gender-specific condition to applicable people', () => {
    const doc = createDefaultDocument();
    doc.legendConfig.entries = [entry('brca', 'BRCA (women)', 'woman')];
    doc.individuals['w'] = createDefaultIndividual({ id: 'w', genderIdentity: GenderIdentity.Woman, conditionIds: [] });
    doc.individuals['m'] = createDefaultIndividual({ id: 'm', genderIdentity: GenderIdentity.Man, conditionIds: [] });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['w', 'm']);

    render(<PropertiesPanel />);
    act(() => fireEvent.click(screen.getByRole('checkbox', { name: /BRCA/ })));

    const after = usePedigreeStore.getState().document;
    expect(after.individuals.w.conditionIds).toContain('brca');
    expect(after.individuals.m.conditionIds).not.toContain('brca');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ui/MultiSelectProperties.test.tsx -t "conditions"`
Expected: FAIL — `Cancer` checkbox not found.

- [ ] **Step 3: Write minimal implementation**

In `src/components/ui/MultiSelectProperties.tsx`, extend imports and types:

```ts
import type { Individual, LegendEntry } from '../../types/pedigree';
```

Add `setConditionForIndividuals` and `legendConfig` subscriptions inside the component, next to the other store reads:

```ts
  const legendConfig = usePedigreeStore((s) => s.document.legendConfig);
  const setConditionForIndividuals = usePedigreeStore((s) => s.setConditionForIndividuals);
```

Add a module-level helper (after `sharedValue`):

```ts
/** Whether a legend entry applies to a person, honouring its gender restriction. */
function conditionAppliesTo(entry: LegendEntry, person: Individual): boolean {
  if (!entry.applicableTo) return true;
  if (entry.applicableTo === 'man') return person.genderIdentity === GenderIdentity.Man;
  return person.genderIdentity === GenderIdentity.Woman;
}
```

Inside the component, compute the applicable entries (after the adoption-derived values):

```ts
  const applicableEntries = legendConfig.entries.filter((entry) =>
    people.some((p) => conditionAppliesTo(entry, p)),
  );
```

Add this section inside the `<fieldset>`, after the Adoption section:

```tsx
        <div className={styles.divider} />

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Conditions</div>
          {applicableEntries.length === 0 ? (
            <p className={styles.hint}>
              {legendConfig.entries.length === 0
                ? 'No conditions defined. Use the Legend editor to add conditions.'
                : 'No conditions apply to the selected people.'}
            </p>
          ) : (
            applicableEntries.map((entry) => {
              const applicableIds = ids.filter((id) =>
                conditionAppliesTo(entry, individuals[id]),
              );
              const allHave =
                applicableIds.length > 0 &&
                applicableIds.every((id) =>
                  (individuals[id].conditionIds ?? []).includes(entry.id),
                );
              const anyHave = applicableIds.some((id) =>
                (individuals[id].conditionIds ?? []).includes(entry.id),
              );
              const mixed = anyHave && !allHave;
              return (
                <div key={entry.id} className={styles.field}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={allHave}
                      ref={(el) => {
                        if (el) el.indeterminate = mixed;
                      }}
                      onChange={() =>
                        setConditionForIndividuals(applicableIds, entry.id, !allHave)
                      }
                    />
                    <span
                      className={styles.conditionSwatch}
                      style={{ backgroundColor: entry.fillColor }}
                    />
                    {entry.name}
                  </label>
                </div>
              );
            })
          )}
        </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ui/MultiSelectProperties.test.tsx -t "conditions"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/MultiSelectProperties.tsx src/components/ui/MultiSelectProperties.test.tsx
git commit -m "feat: bulk condition editing with tri-state, gender-aware checkboxes"
```

---

### Task 8: Twins grouping section

**Files:**
- Modify: `src/components/ui/MultiSelectProperties.tsx`
- Test: `src/components/ui/MultiSelectProperties.test.tsx`

**Interfaces:**
- Consumes: `commonSibshipId` (Task 1), `groupTwins` (Task 4), `usePedigreeStore` (`document.parentChildLinks`, `document.twinGroups`), `TwinType` enum, `styles.addButton`.
- Produces: twins UI inside `MultiSelectProperties` (no new exports).

- [ ] **Step 1: Write the failing test**

Append to `src/components/ui/MultiSelectProperties.test.tsx`:

```tsx
import { RelationshipType, TwinType } from '../../types/enums';
import type { ParentChildRelationship, PartnershipRelationship } from '../../types/pedigree';

function siblingDoc(childIds: string[]) {
  const doc = createDefaultDocument();
  const union: PartnershipRelationship = {
    id: 'union1',
    type: RelationshipType.Partnership,
    partner1Id: 'p1',
    partner2Id: 'p2',
    childrenIds: childIds,
  };
  doc.partnerships['union1'] = union;
  for (const id of childIds) {
    doc.individuals[id] = createDefaultIndividual({ id });
    const link: ParentChildRelationship = {
      id: `link-${id}`,
      type: RelationshipType.ParentChild,
      parentPartnershipId: 'union1',
      childId: id,
      isAdopted: false,
    };
    doc.parentChildLinks[link.id] = link;
  }
  return doc;
}

describe('MultiSelectProperties — twins', () => {
  it('hides the twins section when the selection is not one sibship', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a' });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b' }); // founders, no shared sibship
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.queryByText('Twins')).not.toBeInTheDocument();
  });

  it('offers the three zygosity buttons for two ungrouped siblings', () => {
    act(() => usePedigreeStore.getState().setDocument(siblingDoc(['a', 'b'])));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByRole('button', { name: /Group as MZ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Group as DZ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Group as Unknown/ })).toBeInTheDocument();
  });

  it('creates a twin group when a zygosity button is clicked', () => {
    act(() => usePedigreeStore.getState().setDocument(siblingDoc(['a', 'b'])));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    act(() => fireEvent.click(screen.getByRole('button', { name: /Group as DZ/ })));

    const groups = Object.values(usePedigreeStore.getState().document.twinGroups);
    expect(groups).toHaveLength(1);
    expect(groups[0].twinType).toBe(TwinType.Dizygotic);
    expect([...groups[0].individualIds].sort()).toEqual(['a', 'b']);
  });

  it('offers add-to-existing when one selected sibling is already grouped, and merges', () => {
    const doc = siblingDoc(['a', 'b', 'c']);
    doc.twinGroups['tg1'] = {
      id: 'tg1',
      twinType: TwinType.Monozygotic,
      individualIds: ['a', 'b'],
      parentPartnershipId: 'union1',
    };
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['b', 'c']);

    render(<PropertiesPanel />);
    const addButton = screen.getByRole('button', { name: /Add to existing twin group/ });
    act(() => fireEvent.click(addButton));

    const tg = usePedigreeStore.getState().document.twinGroups['tg1'];
    expect([...tg.individualIds].sort()).toEqual(['a', 'b', 'c']);
    expect(tg.twinType).toBe(TwinType.Monozygotic);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ui/MultiSelectProperties.test.tsx -t "twins"`
Expected: FAIL — `Group as MZ` button not found.

- [ ] **Step 3: Write minimal implementation**

In `src/components/ui/MultiSelectProperties.tsx`, extend imports:

```ts
import { GenderIdentity, SexAssignedAtBirth, VitalStatus, TwinType } from '../../types/enums';
import { commonSibshipId } from '../../utils/sibship';
```

Add store subscriptions inside the component:

```ts
  const parentChildLinks = usePedigreeStore((s) => s.document.parentChildLinks);
  const twinGroups = usePedigreeStore((s) => s.document.twinGroups);
  const groupTwins = usePedigreeStore((s) => s.groupTwins);
```

Add a label map at module level (after `VITAL_STATUS_OPTIONS`):

```ts
const ZYGOSITY_LABELS: Record<TwinType, string> = {
  [TwinType.Monozygotic]: 'MZ',
  [TwinType.Dizygotic]: 'DZ',
  [TwinType.Unknown]: 'Unknown',
};
```

Compute twin eligibility inside the component (after `applicableEntries`):

```ts
  const sibshipId = commonSibshipId({ parentChildLinks }, ids);
  const touchedGroups = Object.values(twinGroups).filter((g) =>
    g.individualIds.some((m) => ids.includes(m)),
  );
  // Existing group whose zygosity would survive a merge (largest, stable tiebreak).
  const survivingGroup = touchedGroups
    .slice()
    .sort(
      (a, b) =>
        b.individualIds.length - a.individualIds.length || (a.id < b.id ? -1 : 1),
    )[0];
```

Add the Twins section as the FIRST section inside the `<fieldset>`, immediately after the count-header section and before its following `<div className={styles.divider} />`:

```tsx
        {sibshipId && (
          <>
            <div className={styles.divider} />
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Twins</div>
              {survivingGroup ? (
                <>
                  <p className={styles.hint}>
                    Existing group zygosity: {ZYGOSITY_LABELS[survivingGroup.twinType]}
                  </p>
                  <button
                    className={styles.addButton}
                    onClick={() => groupTwins(ids, survivingGroup.twinType)}
                  >
                    Add to existing twin group
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={styles.addButton}
                    onClick={() => groupTwins(ids, TwinType.Monozygotic)}
                  >
                    Group as MZ twins
                  </button>
                  <button
                    className={styles.addButton}
                    onClick={() => groupTwins(ids, TwinType.Dizygotic)}
                  >
                    Group as DZ twins
                  </button>
                  <button
                    className={styles.addButton}
                    onClick={() => groupTwins(ids, TwinType.Unknown)}
                  >
                    Group as Unknown twins
                  </button>
                </>
              )}
            </div>
          </>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ui/MultiSelectProperties.test.tsx -t "twins"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/MultiSelectProperties.tsx src/components/ui/MultiSelectProperties.test.tsx
git commit -m "feat: group existing siblings as twins from the multi-select panel"
```

---

### Task 9: Full verification (suite, typecheck, lint, manual smoke)

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all suites green, including the new `sibship`, `pedigreeStore`, and `MultiSelectProperties` tests.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run build`
Expected: `tsc -b` succeeds (no type errors) and the Vite build completes.

Run: `npm run lint`
Expected: no errors. (If ESLint flags the `('' as GenderIdentity)` / `('' as VitalStatus)` "mixed-state" casts, keep them — they are intentional and localized; do not introduce `any`.)

- [ ] **Step 3: Manual smoke test in the running app**

Run: `npm run dev` and open the app. Build a small family (a couple with 3+ children). Then verify, per the canvas-verification approach (trusted clicks; canvas shapes have no DOM):

1. **Multi-select:** marquee-drag across two siblings, or shift-click each. The panel shows "N people selected" with Identity / Vital Status / Adoption / Conditions.
2. **Mixed state:** select two people of different genders → no gender button active; select one alive + one deceased → Vital Status shows no active segment and the Cause of Death field is hidden.
3. **Bulk write:** set Vital Status → Deceased for both; confirm both symbols update and a *single* ⌘Z reverts both.
4. **Conditions:** with a legend condition defined, select several people; the checkbox is indeterminate when only some are affected; clicking applies it to all; a gender-specific condition only writes to applicable people.
5. **Twin grouping:** select 2+ siblings of one union → Twins section offers Group as MZ/DZ/Unknown; click one and confirm a twin connector is drawn. Select that pair plus a third sibling → "Add to existing twin group" appears; click and confirm the connector now spans all three with the original zygosity. Confirm one ⌘Z reverts the grouping.
6. **Ineligibility:** select two people from different sibships (or a founder) → no Twins section.

- [ ] **Step 4: Commit (only if any fixups were needed)**

```bash
git add -A
git commit -m "test: verify multi-select bulk edit + twin grouping end to end"
```

---

## Self-Review

**1. Spec coverage**

| Spec item | Task |
| --- | --- |
| Dispatch branch for `selectedIds.size > 1` | Task 5 |
| Bulk Identity (gender, SAAB) | Task 5 |
| Bulk Vital status (+ cause of death when all deceased) | Task 6 |
| Bulk Adoption flag | Task 6 |
| Bulk Conditions (tri-state, gender-aware) | Task 7 |
| Mixed-value + write-on-change-only | Tasks 5–7 (sentinel values, indeterminate refs, change-only handlers) |
| Twin grouping eligibility (same sibship, N≥2) | Tasks 1, 8 |
| Pick zygosity in the action | Task 8 |
| Merge into one group, existing type kept, larger-wins tiebreak | Task 4 |
| Single undo step per operation | Tasks 2, 3, 4 (each one `set`) |
| Store logic is the test surface | Tasks 1–4 unit tests |
| Non-goals excluded (name/DOB/age/notes/proband, no new gestures) | Not implemented by design |

No gaps.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Every code step contains complete code; every test step contains real assertions. ✓

**3. Type consistency:**
- `commonSibshipId(doc: Pick<PedigreeDocument,'parentChildLinks'>, ids: string[]): string | null` — defined Task 1; called in Task 4 as `commonSibshipId(state.document, ids)` (PedigreeDocument satisfies the Pick) and in Task 8 as `commonSibshipId({ parentChildLinks }, ids)`. ✓
- `updateIndividuals(ids, patch)`, `setConditionForIndividuals(ids, entryId, applied)`, `groupTwins(ids, twinType): string | null` — defined Tasks 2–4; consumed Tasks 5–8 with matching arity/types. ✓
- `sharedValue<T>` and `conditionAppliesTo` — defined and used within `MultiSelectProperties.tsx`. ✓
- `survivingGroup.twinType` passed to `groupTwins` is `TwinType`; merge ignores it and keeps the existing type (Task 4), consistent with the "Add to existing" label. ✓
