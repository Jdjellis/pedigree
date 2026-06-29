# Adoption in/out (per-edge line of descent) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user mark an individual as adopted *in* (dashed line of descent to adoptive parents) or adopted *out* (solid line to biological parents), per the verified Bennett 2022 standard — brackets for all adoptions, line style per edge, no arrow.

**Architecture:** Brackets stay a person-level flag (`Individual.adopted`, unchanged). Adoption *direction* becomes a per-edge property: the parent-child link carries `isAdoptive?: boolean` (dashed when adoptive, solid when biological). "In/out" is emergent (in = brackets + dashed edge; out = brackets + solid edge). The properties panel adapts to the selected person's parent-link count (0 → checkbox, 1 → in/out select, 2+ → per-link list). A `migrateAdoption` pass on both load paths upgrades existing data.

**Tech Stack:** React + Vite + TypeScript, react-konva (canvas), Zustand + zundo (state/undo), Vitest + @testing-library/react (tests). `svgExport.ts` is a parallel renderer mirroring Konva and is the canonical render-test surface (react-konva cannot render under jsdom).

**Spec:** `docs/superpowers/specs/2026-06-29-adoption-in-out-design.md`. Related issues: #56 (this), #64 (multi-parentage, deferred), #65 (line selection, deferred).

## Global Constraints

- **No `any`** in TypeScript. Type-annotate every function signature; JSDoc public interfaces.
- **Conventional commits**, one logical change per commit. Run `npm test` before every commit.
- **Mirror every rendering rule in BOTH renderers**: `src/components/connections/ParentChildLine.tsx` (Konva) and `src/io/svgExport.ts` (SVG). svgExport is the test surface.
- **Line style comes only from the edge** (`link.isAdoptive`). Do **not** OR in `child.adopted` (that is what made adopted-out impossible).
- **Brackets** are unchanged — driven by `Individual.adopted` in `PedigreeSymbol.tsx:421` (Konva) and `svgExport.ts:350` (SVG). **No arrow** anywhere (Bennett 2022 Fig 3).
- The store uses **plain immutable spread updates** inside `set((state) => ({...}))` and bumps `metadata.updatedAt` on every mutation. Match that pattern (no immer).

---

## Precursor commit (already staged in the worktree)

Three changes already exist uncommitted in this worktree and form one docs commit; make it first so later commits are clean:

- `docs/references/bennett-2022-nsgc-standardized-pedigree-nomenclature.pdf` (new, the source PDF)
- `docs/bennett-pedigree-standards.md` (§6/§9/§14 corrected to the verified dashed/solid, no-arrow standard)
- `docs/superpowers/specs/2026-06-29-adoption-in-out-design.md` (the approved spec)
- `docs/superpowers/plans/2026-06-29-adoption-in-out.md` (this plan)

```bash
git add docs/references docs/bennett-pedigree-standards.md docs/superpowers/specs/2026-06-29-adoption-in-out-design.md docs/superpowers/plans/2026-06-29-adoption-in-out.md
git commit -m "docs: correct adoption notation to verified Bennett 2022 standard + add source PDF, spec, plan"
```

---

## Task 1: Switch the per-edge adoption field and source line style from it

Replaces the redundant `ParentChildRelationship.isAdopted: boolean` with `isAdoptive?: boolean`, removes the dead `PartnershipRelationship.isAdoptive`, narrows the link `type`, and makes both renderers dash from `isAdoptive` only. This is one atomic unit: the type change forces every read/write site to update together or the project will not compile.

**Files:**
- Modify: `src/types/pedigree.ts:136` (remove dead field), `:145-151` (link shape)
- Modify: `src/components/connections/ParentChildLine.tsx:68,75`
- Modify: `src/io/svgExport.ts:584-588`
- Modify: `src/components/ui/LinkTypePopup.tsx:45-51,69-75`
- Modify: `src/components/ui/RadialMenu.tsx` (9 link literals with `isAdopted: false`)
- Modify: `src/io/pedIO.ts:162-168`
- Test: `src/io/svgExport.clinicalNotation.test.ts:44-77`

**Interfaces:**
- Produces: `interface ParentChildRelationship { id: string; type: RelationshipType.ParentChild; parentPartnershipId: string; childId: string; isAdoptive?: boolean; }` — consumed by Tasks 2, 3, 4.
- `PartnershipRelationship` loses `isAdoptive`.

- [ ] **Step 1: Update the SVG adoption tests (TDD)**

In `src/io/svgExport.clinicalNotation.test.ts`, change `makeFamily()` so the two links no longer set `isAdopted` (delete lines 49 and 56, i.e. the `isAdopted: false,` line inside each of `l1` and `l2`), then replace the whole `describe('SVG export — adoption notation', …)` block (lines 61-77) with:

```ts
describe('SVG export — adoption notation', () => {
  it('draws brackets and a DASHED descent for an adopted-IN child', () => {
    const doc = makeFamily();
    doc.individuals.c1 = { ...doc.individuals.c1, adopted: true };
    doc.parentChildLinks.l1 = { ...doc.parentChildLinks.l1, isAdoptive: true };

    const svg = buildPedigreeSvg(doc, 'Adopted in');

    // Brackets around the adopted symbol (left + right polylines).
    expect((svg.match(/<polyline/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Adoptive line of descent is dashed.
    expect(svg).toContain(`stroke-dasharray="${DASH_PATTERN.join(' ')}"`);
  });

  it('draws brackets and a SOLID descent for an adopted-OUT child', () => {
    const doc = makeFamily();
    doc.individuals.c1 = { ...doc.individuals.c1, adopted: true };
    doc.parentChildLinks.l1 = { ...doc.parentChildLinks.l1, isAdoptive: false };

    const svg = buildPedigreeSvg(doc, 'Adopted out');

    // Brackets are still drawn (brackets = "was adopted", any direction).
    expect((svg.match(/<polyline/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Biological line of descent is solid → no dash array in the export.
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('does not draw brackets when nobody is adopted', () => {
    const svg = buildPedigreeSvg(makeFamily(), 'No adoption');
    expect(svg).not.toContain('<polyline');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- svgExport.clinicalNotation`
Expected: FAIL — TypeScript error that `isAdoptive` does not exist on `ParentChildRelationship` (and the adopted-out test would fail on the dash assertion).

- [ ] **Step 3: Change the data model**

In `src/types/pedigree.ts`, remove the dead partnership field — delete line 136:

```ts
  isAdoptive?: boolean;
```

(the one inside `PartnershipRelationship`), and replace the `ParentChildRelationship` interface (lines 145-151) with:

```ts
export interface ParentChildRelationship {
  id: string;
  type: RelationshipType.ParentChild;
  parentPartnershipId: string;
  childId: string;
  /**
   * Line-of-descent style for this edge, per NSGC/Bennett: `true` → adoptive
   * parents (dashed line), `false`/absent → biological parents (solid line).
   * Brackets around the child are separate ({@link Individual.adopted}).
   */
  isAdoptive?: boolean;
}
```

- [ ] **Step 4: Source the line style from `isAdoptive` in both renderers**

In `src/components/connections/ParentChildLine.tsx`, replace the `isAdopted` computation and its use (lines 64-75 — the comment block plus `const isAdopted = …` and `dash={isAdopted ? …}`) with:

```ts
    // Dash the line of descent only for an adoptive (non-biological) edge, per
    // NSGC/Bennett. Brackets on the child are handled separately in the symbol.
    lines.push(
      <Line
        key={`drop-${child.id}`}
        points={childDrops[i]}
        stroke={LINE_COLOR}
        strokeWidth={LINE_WIDTH}
        dash={link?.isAdoptive ? DASH_PATTERN : undefined}
      />,
    );
```

In `src/io/svgExport.ts`, replace lines 584-588 (the comment, the `const isAdopted = …`, and the `parts.push(line(...))`) with:

```ts
    // Mirror ParentChildLine.tsx: dash only an adoptive (non-biological) edge.
    parts.push(line(x1, y1, x2, y2, link?.isAdoptive ?? false));
```

- [ ] **Step 5: Update the link creators**

In `src/components/ui/LinkTypePopup.tsx`: in `createParentChild` (the `link` object around lines 45-51) delete the `isAdopted: false,` line. In `createAdoption` (lines 69-75) change the link to:

```ts
    const link: ParentChildRelationship = {
      id: generateId(),
      type: RelationshipType.ParentChild,
      parentPartnershipId: partnershipId,
      childId: targetId,
      isAdoptive: true,
    };
```

In `src/components/ui/RadialMenu.tsx`: every parent-child link literal currently ends with `isAdopted: false,` (9 occurrences). Delete each `isAdopted: false,` line (the new field is optional and defaults to biological/solid). Verify none remain:

```bash
grep -rn "isAdopted" src/components/ui/RadialMenu.tsx   # expect no output
```

In `src/io/pedIO.ts` (lines 162-168), delete the `isAdopted: false,` line from the constructed link.

- [ ] **Step 6: Sweep remaining `isAdopted` references in tests and code**

```bash
grep -rn "isAdopted" src   # find every remaining reference
```

For each hit in a test/factory: a literal `isAdopted: false,` → delete the line; `isAdopted: true` → `isAdoptive: true`. There should be no non-test `isAdopted` left. (Known test files that build links: `svgExport.test.ts`, `pedIO.test.ts`, `pedigreeStore.test.ts`, `graphTraversal.test.ts`, `twinOperations.test.ts`, `respacing.test.ts`, `markAsTwins.test.ts`.) Re-run the grep until it returns nothing.

- [ ] **Step 7: Run the full test suite + typecheck**

Run: `npm test`
Expected: PASS (all suites green).
Run: `npm run build` (or `npx tsc --noEmit` if defined)
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/types/pedigree.ts src/components/connections/ParentChildLine.tsx src/io/svgExport.ts src/components/ui/LinkTypePopup.tsx src/components/ui/RadialMenu.tsx src/io/pedIO.ts src/io/svgExport.clinicalNotation.test.ts
git add -u src   # pick up swept test files
git commit -m "feat(adoption): replace link.isAdopted with per-edge isAdoptive; dash only adoptive descent"
```

---

## Task 2: Migration `migrateAdoption` wired into both load paths

Upgrades legacy documents on load. The two load paths diverge (`useAutoSave.parseSavedDocument` parses raw and never calls `deserializeDocument`), so the migration is called from both.

**Files:**
- Modify: `src/io/jsonIO.ts` (add + export `migrateAdoption`, call it in `deserializeDocument`)
- Modify: `src/hooks/useAutoSave.ts` (call it in `parseSavedDocument`)
- Test: `src/io/jsonIO.test.ts`

**Interfaces:**
- Produces: `export function migrateAdoption(doc: PedigreeDocument): PedigreeDocument` — mutates in place and returns the same doc; idempotent.

- [ ] **Step 1: Write the failing migration test**

Add to `src/io/jsonIO.test.ts`:

```ts
import { migrateAdoption } from './jsonIO';
import { RelationshipType } from '../types/enums';

describe('migrateAdoption', () => {
  it('maps legacy link.isAdopted and type=Adoption to isAdoptive', () => {
    const doc = makeDocument();
    // legacy adoptive link, expressed the old two ways
    (doc.parentChildLinks as Record<string, unknown>).legacy = {
      id: 'legacy',
      type: 'adoption',
      parentPartnershipId: 'p1',
      childId: 'kid',
      isAdopted: true,
    };

    migrateAdoption(doc);

    const link = doc.parentChildLinks.legacy as Record<string, unknown>;
    expect(link.isAdoptive).toBe(true);
    expect(link.type).toBe(RelationshipType.ParentChild);
    expect('isAdopted' in link).toBe(false);
  });

  it('dashes the parent link of a legacy individual.adopted person (adopted-in)', () => {
    const doc = makeDocument();
    const kidId = Object.keys(doc.individuals)[0];
    doc.individuals[kidId] = { ...doc.individuals[kidId], adopted: true };
    const linkId = generateLinkFor(doc, kidId); // ensure a parent link exists

    migrateAdoption(doc);

    expect(doc.parentChildLinks[linkId].isAdoptive).toBe(true);
  });

  it('is idempotent', () => {
    const doc = makeDocument();
    const once = JSON.stringify(migrateAdoption(doc));
    const twice = JSON.stringify(migrateAdoption(doc));
    expect(twice).toBe(once);
  });
});
```

> Implementer note: `makeDocument()` already exists at `src/io/jsonIO.test.ts:52`. If it does not contain an individual with a parent link, add a minimal `dad`/`kid` + partnership + link to it (mirror `makeFamily()` in `svgExport.clinicalNotation.test.ts:15-58`) and replace the `generateLinkFor` placeholder with that link's literal id. Do not leave `generateLinkFor` in the committed test — inline the known id.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- jsonIO`
Expected: FAIL — `migrateAdoption` is not exported.

- [ ] **Step 3: Implement `migrateAdoption` in `src/io/jsonIO.ts`**

Add (export it; place near the other migration logic):

```ts
/**
 * SUNSET (pre-launch shim — delete before launch, see #66): a one-off upgrade of
 * legacy adoption data to the per-edge model. We have no external users; this only
 * upgrades our own localStorage + saved files, which self-heal on first load+save.
 * Do NOT grow this into a versioned migration chain.
 *
 * Mutates `doc` in place and returns it. Idempotent.
 *
 * - Legacy `link.isAdopted === true` or `link.type === 'adoption'` ⇒ `isAdoptive: true`.
 * - Legacy `individual.adopted === true` ⇒ that person's parent link(s) become
 *   adoptive (the old properties-panel checkbox only ever meant adopted-IN/dashed).
 * - Drops the dead `partnership.isAdoptive` field.
 */
export function migrateAdoption(doc: PedigreeDocument): PedigreeDocument {
  for (const link of Object.values(doc.parentChildLinks)) {
    const legacy = link as ParentChildRelationship & { isAdopted?: boolean };
    if (legacy.isAdopted === true || (legacy.type as RelationshipType) === RelationshipType.Adoption) {
      legacy.isAdoptive = true;
    }
    delete legacy.isAdopted;
    legacy.type = RelationshipType.ParentChild;
  }

  for (const ind of Object.values(doc.individuals)) {
    if (ind.adopted !== true) continue;
    for (const link of Object.values(doc.parentChildLinks)) {
      if (link.childId === ind.id) link.isAdoptive = true;
    }
  }

  for (const partnership of Object.values(doc.partnerships)) {
    delete (partnership as { isAdoptive?: boolean }).isAdoptive;
  }

  return doc;
}
```

Ensure `ParentChildRelationship` and `RelationshipType` are imported in `jsonIO.ts` (add to the existing imports if missing). Then, in `deserializeDocument`, wrap the document it returns: find its final `return <doc>;` and change it to `return migrateAdoption(<doc>);` (use the actual variable name returned there).

- [ ] **Step 4: Call it on the autosave path**

In `src/hooks/useAutoSave.ts`, import it (`import { migrateAdoption } from '../io/jsonIO';`) and change the end of `parseSavedDocument` from `return doc as PedigreeDocument;` to:

```ts
    return migrateAdoption(doc as PedigreeDocument);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- jsonIO`
Expected: PASS.
Run: `npm test`
Expected: PASS (no regressions; `useAutoSave` tests, if present, still green).

- [ ] **Step 6: Commit**

```bash
git add src/io/jsonIO.ts src/hooks/useAutoSave.ts src/io/jsonIO.test.ts
git commit -m "feat(adoption): migrate legacy adoption data to per-edge isAdoptive on both load paths"
```

---

## Task 3: Store actions `setAdoption` and `setLinkAdoptive`

One undo step per user change (zundo wraps the store). `setAdoption` drives the single-family in/out control; `setLinkAdoptive` drives one row of the multi-family list.

**Files:**
- Modify: `src/stores/pedigreeStore.ts` (interface block ~164-243; action impls near `updateIndividual` ~286)
- Test: `src/stores/pedigreeStore.test.ts`

**Interfaces:**
- Produces: `setAdoption(individualId: string, mode: 'none' | 'in' | 'out'): void` and `setLinkAdoptive(linkId: string, isAdoptive: boolean): void` — consumed by Task 4.

- [ ] **Step 1: Write failing store tests**

Add to `src/stores/pedigreeStore.test.ts` (mirror the existing reset-in-beforeEach style at lines 17-18):

```ts
import { createDefaultDocument, createDefaultIndividual } from './pedigreeStore';
import { RelationshipType } from '../types/enums';

function seedChildWithParents() {
  const doc = createDefaultDocument();
  doc.individuals.kid = createDefaultIndividual({ id: 'kid', generation: 1 });
  doc.partnerships.u1 = {
    id: 'u1', type: RelationshipType.Partnership,
    partner1Id: 'kid', partner2Id: 'kid', childrenIds: ['kid'],
  };
  doc.parentChildLinks.l1 = {
    id: 'l1', type: RelationshipType.ParentChild,
    parentPartnershipId: 'u1', childId: 'kid',
  };
  usePedigreeStore.getState().setDocument(doc);
  usePedigreeStore.temporal.getState().clear();
}

describe('setAdoption', () => {
  it("'in' sets adopted + dashes the parent link", () => {
    seedChildWithParents();
    usePedigreeStore.getState().setAdoption('kid', 'in');
    const s = usePedigreeStore.getState().document;
    expect(s.individuals.kid.adopted).toBe(true);
    expect(s.parentChildLinks.l1.isAdoptive).toBe(true);
  });

  it("'out' sets adopted + keeps the parent link solid", () => {
    seedChildWithParents();
    usePedigreeStore.getState().setAdoption('kid', 'out');
    const s = usePedigreeStore.getState().document;
    expect(s.individuals.kid.adopted).toBe(true);
    expect(s.parentChildLinks.l1.isAdoptive).toBe(false);
  });

  it("'none' clears both, in a single undo step", () => {
    seedChildWithParents();
    usePedigreeStore.getState().setAdoption('kid', 'in');
    usePedigreeStore.getState().setAdoption('kid', 'none');
    const cleared = usePedigreeStore.getState().document;
    expect(cleared.individuals.kid.adopted).toBeUndefined();
    expect(cleared.parentChildLinks.l1.isAdoptive).toBeUndefined();

    usePedigreeStore.temporal.getState().undo();
    const afterUndo = usePedigreeStore.getState().document;
    expect(afterUndo.individuals.kid.adopted).toBe(true);
    expect(afterUndo.parentChildLinks.l1.isAdoptive).toBe(true);
  });
});

describe('setLinkAdoptive', () => {
  it('toggles a single link without touching the individual', () => {
    seedChildWithParents();
    usePedigreeStore.getState().setLinkAdoptive('l1', true);
    const s = usePedigreeStore.getState().document;
    expect(s.parentChildLinks.l1.isAdoptive).toBe(true);
    expect(s.individuals.kid.adopted).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- pedigreeStore`
Expected: FAIL — `setAdoption` / `setLinkAdoptive` are not functions.

- [ ] **Step 3: Declare the actions in the store interface**

In `src/stores/pedigreeStore.ts`, in the actions interface (near `updateIndividual` at line 164), add:

```ts
  setAdoption: (individualId: string, mode: 'none' | 'in' | 'out') => void;
  setLinkAdoptive: (linkId: string, isAdoptive: boolean) => void;
```

- [ ] **Step 4: Implement the actions**

Add right after the `updateIndividual` implementation (after line 286):

```ts
      setAdoption: (individualId, mode) =>
        set((state) => {
          const ind = state.document.individuals[individualId];
          if (!ind) return state;
          const adopted = mode === 'none' ? undefined : true;
          const isAdoptive =
            mode === 'in' ? true : mode === 'out' ? false : undefined;
          const links: Record<string, ParentChildRelationship> = {
            ...state.document.parentChildLinks,
          };
          for (const [lid, link] of Object.entries(links)) {
            if (link.childId === individualId) {
              links[lid] = { ...link, isAdoptive };
            }
          }
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              individuals: {
                ...state.document.individuals,
                [individualId]: { ...ind, adopted },
              },
              parentChildLinks: links,
            },
          };
        }),

      setLinkAdoptive: (linkId, isAdoptive) =>
        set((state) => {
          const link = state.document.parentChildLinks[linkId];
          if (!link) return state;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              parentChildLinks: {
                ...state.document.parentChildLinks,
                [linkId]: { ...link, isAdoptive },
              },
            },
          };
        }),
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- pedigreeStore`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores/pedigreeStore.ts src/stores/pedigreeStore.test.ts
git commit -m "feat(adoption): add setAdoption and setLinkAdoptive store actions"
```

---

## Task 4: Adaptive adoption control in the properties panel

Replaces the single "Adopted" checkbox with a control that keys off the selected person's parent-link count: 0 → checkbox, 1 → in/out segmented control, 2+ → per-link biological/adoptive list. Pure read-logic is extracted to a tested helper module; the JSX is thin.

**Files:**
- Create: `src/utils/adoption.ts`, `src/utils/adoption.test.ts`
- Modify: `src/components/ui/PropertiesPanel.tsx` (imports; subscriptions ~67-74; the adoption field block 677-690)

**Interfaces:**
- Consumes: `setAdoption`, `setLinkAdoptive` (Task 3); `ParentChildRelationship` (Task 1).
- Produces (helpers): `parentLinksForChild`, `adoptionModeForLink`, `parentCoupleLabel`, type `AdoptionMode`.

- [ ] **Step 1: Write failing helper tests**

Create `src/utils/adoption.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parentLinksForChild, adoptionModeForLink, parentCoupleLabel } from './adoption';
import { createDefaultDocument, createDefaultIndividual } from '../stores/pedigreeStore';
import { RelationshipType } from '../types/enums';
import type { ParentChildRelationship } from '../types/pedigree';

const link = (over: Partial<ParentChildRelationship>): ParentChildRelationship => ({
  id: 'l', type: RelationshipType.ParentChild, parentPartnershipId: 'u', childId: 'kid', ...over,
});

describe('parentLinksForChild', () => {
  it('returns every link whose childId matches', () => {
    const links = { a: link({ id: 'a' }), b: link({ id: 'b', childId: 'other' }) };
    expect(parentLinksForChild(links, 'kid').map((l) => l.id)).toEqual(['a']);
  });
});

describe('adoptionModeForLink', () => {
  it('none when not adopted', () => {
    expect(adoptionModeForLink(false, link({ isAdoptive: true }))).toBe('none');
  });
  it('in when adopted and link is adoptive', () => {
    expect(adoptionModeForLink(true, link({ isAdoptive: true }))).toBe('in');
  });
  it('out when adopted and link is biological', () => {
    expect(adoptionModeForLink(true, link({ isAdoptive: false }))).toBe('out');
  });
});

describe('parentCoupleLabel', () => {
  it('labels the couple by display names', () => {
    const doc = createDefaultDocument();
    doc.individuals.dad = createDefaultIndividual({ id: 'dad', displayName: 'Dad' });
    doc.individuals.mum = createDefaultIndividual({ id: 'mum', displayName: 'Mum' });
    doc.partnerships.u = {
      id: 'u', type: RelationshipType.Partnership,
      partner1Id: 'dad', partner2Id: 'mum', childrenIds: ['kid'],
    };
    expect(parentCoupleLabel(doc, link({ parentPartnershipId: 'u' }))).toBe('Dad & Mum');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- adoption`
Expected: FAIL — `./adoption` module not found.

- [ ] **Step 3: Implement the helpers**

Create `src/utils/adoption.ts`:

```ts
import type { ParentChildRelationship, PedigreeDocument } from '../types/pedigree';

export type AdoptionMode = 'none' | 'in' | 'out';

/** Every parent-child link whose child is `childId`. */
export function parentLinksForChild(
  links: Record<string, ParentChildRelationship>,
  childId: string,
): ParentChildRelationship[] {
  return Object.values(links).filter((l) => l.childId === childId);
}

/** Collapse (adopted flag, one parent link) into the in/out/none UI mode. */
export function adoptionModeForLink(
  adopted: boolean | undefined,
  link: ParentChildRelationship | undefined,
): AdoptionMode {
  if (!adopted) return 'none';
  return link?.isAdoptive ? 'in' : 'out';
}

/** Human label for a link's parent couple, e.g. "Dad & Mum" (ids as fallback). */
export function parentCoupleLabel(
  doc: PedigreeDocument,
  link: ParentChildRelationship,
): string {
  const p = doc.partnerships[link.parentPartnershipId];
  const name = (id?: string): string =>
    (id && doc.individuals[id]?.displayName) || id || '?';
  if (!p) return 'Parents';
  const a = name(p.partner1Id);
  const b = p.partner2Id && p.partner2Id !== p.partner1Id ? name(p.partner2Id) : null;
  return b ? `${a} & ${b}` : a;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- adoption`
Expected: PASS.

- [ ] **Step 5: Wire the panel JSX**

In `src/components/ui/PropertiesPanel.tsx`:

(a) Add subscriptions and actions near lines 67-74:

```ts
  const partnerships = usePedigreeStore((s) => s.document.partnerships);
  const parentChildLinks = usePedigreeStore((s) => s.document.parentChildLinks);
  const setAdoption = usePedigreeStore((s) => s.setAdoption);
  const setLinkAdoptive = usePedigreeStore((s) => s.setLinkAdoptive);
```

(b) Add imports near the existing util imports:

```ts
import {
  parentLinksForChild,
  adoptionModeForLink,
  parentCoupleLabel,
  type AdoptionMode,
} from '../../utils/adoption';
```

(c) Define options beside the other `*_OPTIONS` constants (module scope):

```ts
const ADOPTION_OPTIONS: { value: AdoptionMode; label: string }[] = [
  { value: 'none', label: 'Not adopted' },
  { value: 'in', label: 'Adopted in' },
  { value: 'out', label: 'Adopted out' },
];
```

(d) Replace the adoption field block (lines 677-690 — the `<div className={styles.field}>` containing the "Adopted" checkbox and its hint) with, where `selectedId`/`individual` are already in scope:

```tsx
        {(() => {
          const childLinks = individual && selectedId
            ? parentLinksForChild(parentChildLinks, selectedId)
            : [];

          if (childLinks.length >= 2) {
            return (
              <div className={styles.field}>
                <label className={styles.label}>Adoption</label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={individual?.adopted ?? false}
                    onChange={(e) => update({ adopted: e.target.checked || undefined })}
                  />
                  Adopted (brackets)
                </label>
                {childLinks.map((link) => (
                  <div key={link.id} className={styles.field}>
                    <label className={styles.label}>{parentCoupleLabel({ ...{ individuals, partnerships } } as never, link)}</label>
                    <SegmentedControl
                      options={[
                        { value: 'biological', label: 'Biological' },
                        { value: 'adoptive', label: 'Adoptive' },
                      ]}
                      value={link.isAdoptive ? 'adoptive' : 'biological'}
                      onChange={(v) => setLinkAdoptive(link.id, v === 'adoptive')}
                      ariaLabel={`Line of descent for ${parentCoupleLabel({ ...{ individuals, partnerships } } as never, link)}`}
                    />
                  </div>
                ))}
              </div>
            );
          }

          if (childLinks.length === 1) {
            const mode = adoptionModeForLink(individual?.adopted, childLinks[0]);
            return (
              <div className={styles.field}>
                <label className={styles.label}>Adoption</label>
                <SegmentedControl
                  options={ADOPTION_OPTIONS}
                  value={mode}
                  onChange={(v) => selectedId && setAdoption(selectedId, v)}
                  ariaLabel="Adoption status"
                />
                <p className={styles.hint}>
                  In = dashed line to adoptive parents; Out = solid line to
                  biological parents. Both draw the symbol in brackets.
                </p>
              </div>
            );
          }

          return (
            <div className={styles.field}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={individual?.adopted ?? false}
                  onChange={(e) => update({ adopted: e.target.checked || undefined })}
                />
                Adopted
              </label>
              <p className={styles.hint}>
                Draws the symbol in brackets. Add parents to mark the line of
                descent adopted-in (dashed) or adopted-out (solid).
              </p>
            </div>
          );
        })()}
```

> Implementer note: `parentCoupleLabel` takes the full `PedigreeDocument`. The panel does not hold the whole doc, only `individuals` + `partnerships` slices. Either (preferred) subscribe to the doc once via `const doc = usePedigreeStore((s) => s.document);` and pass `doc` to `parentCoupleLabel(doc, link)` — replacing the `{ ...{ individuals, partnerships } } as never` shim above with `doc` and dropping the `as never` — or change `parentCoupleLabel`'s signature to take `{ individuals, partnerships }`. Do **not** ship the `as never` cast (it violates the no-`any`/clean-types rule); it is only shorthand here.

- [ ] **Step 6: Verify build + add a panel render test**

Run: `npm run build`
Expected: no type errors (and the `as never` shim is gone).

Add a focused RTL test (mirror the existing `src/components/ui/*.test.tsx` setup) that seeds the store with a selected child that has one parent link and asserts the in/out segmented control renders (e.g. `screen.getByLabelText('Adoption status')` and a button with name `Adopted in`). Run: `npm test -- PropertiesPanel`. Expected: PASS.

- [ ] **Step 7: Manual canvas check (Konva is untestable in jsdom)**

Run the app (`npm run dev`), create a child with parents, select the child, choose **Adopted in** → descent line dashes + brackets appear; choose **Adopted out** → line goes solid, brackets remain. Confirms the Konva path matches the SVG tests.

- [ ] **Step 8: Commit**

```bash
git add src/utils/adoption.ts src/utils/adoption.test.ts src/components/ui/PropertiesPanel.tsx
git commit -m "feat(adoption): adaptive in/out + per-link adoption control in properties panel"
```

---

## Task 5: Mark adoption-out implemented in the standards doc

Tidy the gap analysis now that the feature exists.

**Files:**
- Modify: `docs/bennett-pedigree-standards.md` (§14)

- [ ] **Step 1: Move the gap to implemented**

In §14, delete the "**Adoption-out / per-edge line style**" bullet from *Gaps / Not yet modelled*, and under *Implemented ✓* update the adoption line to read:

```markdown
- Parent-child and adoption links; adopted individuals are drawn in square brackets (`Individual.adopted`, `AdoptionBrackets`), and each line of descent is **dashed for adoptive** parents / **solid for biological** parents via `ParentChildRelationship.isAdoptive` (adopted-in vs adopted-out). Showing both families for one child at once is deferred to multi-parentage (#64).
```

- [ ] **Step 2: Commit**

```bash
git add docs/bennett-pedigree-standards.md
git commit -m "docs: mark adoption-out as implemented in gap analysis"
```

---

## Self-Review

**1. Spec coverage**
- Data model (`isAdoptive`, remove dead field, narrow type) → Task 1. ✓
- Rendering from edge in both renderers, no arrow → Task 1 (Steps 1, 4). ✓
- Migration on both load paths → Task 2. ✓
- Store actions, one undo step → Task 3. ✓
- Adaptive panel (0/1/2+), build 2+ now → Task 4. ✓
- PED default → Task 1, Step 5. ✓
- Standards doc → precursor (correction already done) + Task 5 (gap→implemented). ✓
- Tests on svgExport surface → Task 1; migration/store/helper/panel tests → Tasks 2-4. ✓

**2. Placeholder scan:** the only intentional under-specification is the `generateLinkFor`/`as never` shorthands, each immediately followed by an explicit "do not ship this; do X instead" implementer note with the concrete replacement. No bare TODO/TBD remains.

**3. Type consistency:** `isAdoptive?: boolean` (Task 1) is read identically in `ParentChildLine`, `svgExport`, `migrateAdoption`, `setAdoption`/`setLinkAdoptive`, and `adoptionModeForLink`. `AdoptionMode = 'none'|'in'|'out'` is shared between the store action signature (Task 3) and `ADOPTION_OPTIONS`/`adoptionModeForLink` (Task 4). `setAdoption(individualId, mode)` and `setLinkAdoptive(linkId, isAdoptive)` signatures match between declaration (Task 3 Step 3), impl (Step 4), and call sites (Task 4 Step 5).
