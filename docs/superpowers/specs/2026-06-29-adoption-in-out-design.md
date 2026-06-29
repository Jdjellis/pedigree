# Adoption: biological vs adoptive line of descent (in / out) — design

Date: 2026-06-29
Status: Approved 2026-06-29; pending implementation plan
Issue: #56 (follows #39)
Spawned: #64 (multi-parentage), #65 (connection/line selection + line-specific properties)

## Goal

Let a user distinguish an individual **adopted into** a family from one **adopted
out of** a family, per the verified NSGC/Bennett 2022 standard.

The verified standard (Bennett et al. 2022, Figure 3, p.1242 — see
[`docs/bennett-pedigree-standards.md`](../../bennett-pedigree-standards.md) §9
and the local PDF at
[`docs/references/bennett-2022-nsgc-standardized-pedigree-nomenclature.pdf`](../../references/bennett-2022-nsgc-standardized-pedigree-nomenclature.pdf)):

> "Brackets used for all adoptions. Adoptive and biological parents denoted by
> dashed and solid lines of descent, respectively."

So the notation decomposes into **two orthogonal primitives**:

- **Brackets** — a property of the **person** ("was adopted"). Drawn for *every*
  adoption, even when no parents are charted. Already implemented via
  `Individual.adopted` + `AdoptionBrackets`. **No change to bracket rendering.**
- **Line-of-descent style** — a property of **each parent-child edge**: **dashed**
  to adoptive parents, **solid** to biological parents. This is the new capability.

"Adopted in" and "adopted out" are **not separate symbols** — they are emergent:

- **Adopted in** = brackets + a **dashed** descent line to the (adoptive) parents shown.
- **Adopted out** = brackets + a **solid** descent line to the (biological) parents shown.

There is **no arrow** (issue #56 and the old repo doc were wrong; corrected in
this change — see the standards-doc diff).

## Non-goals (explicitly deferred)

- **Multi-parentage rendering.** Showing *both* a biological couple and an
  adoptive couple for the same child at once. `findParents`
  (`graphTraversal.ts:7`) returns the first parent link and stops, and there is
  no flow to create a second parent link. The data model below is
  forward-compatible (per-edge flag, no later migration), and the editing UX
  degrades to a per-link list when 2+ links exist, but actually creating and
  laying out two parent sets is a separate feature — **issue #64**.
- **Canvas line-of-descent editing.** Clicking a descent line to toggle its
  style. The app is panel-driven and has no line-selection infra; adoption is
  edited through the properties panel only. Proper per-edge selection is
  **issue #65**.
- **"Adopted by relative" special layout** (Bennett's third example). The data
  model expresses it (solid bio edge + adoptive edge), but no dedicated layout.
- **Arrow notation.** Rejected as non-standard.

## Current state (what exists today)

Adoption is **triple-booked**, with overlap and dead code:

- `Individual.adopted?: boolean` (`pedigree.ts:119`) — the real driver. Drives
  brackets (`PedigreeSymbol.tsx:421`) and, OR'd with the link flag, the dashed
  descent line.
- `ParentChildRelationship.isAdopted: boolean` (`pedigree.ts:150`) — redundant.
  Created as `false` everywhere (RadialMenu ×9, LinkTypePopup parent-child)
  except the LinkTypePopup "Adoption" button, which sets it `true` **and** sets
  `individual.adopted = true`.
- `PartnershipRelationship.isAdoptive?: boolean` (`pedigree.ts:136`) — **dead**;
  declared, never read anywhere.

Line-style logic appears twice and must stay mirrored (per project memory, Konva
is not jsdom-testable, so `svgExport` is the real test surface):

- `ParentChildLine.tsx:68` — `const isAdopted = (link?.isAdopted ?? false) || (child.adopted ?? false); … dash={isAdopted ? DASH_PATTERN : undefined}`
- `svgExport.ts:586` — same OR, feeding `line(x1, y1, x2, y2, isAdopted)`.

Editing surfaces:

- `PropertiesPanel.tsx:677-690` — a single "Adopted" checkbox writing only
  `individual.adopted` (never touches any link).
- `LinkTypePopup.tsx:59-81` — "Adoption" button creates a single-parent union +
  link with `isAdopted: true` and sets `individual.adopted = true`.

Two load paths, which **diverge** (relevant to migration):

- `useAutoSave.ts:18` — `JSON.parse(raw)` → `setDocument(doc)`. **Bypasses**
  `jsonIO.deserializeDocument`, so IO-layer migrations do *not* run on autosave
  restore (the primary path for returning users).
- `jsonIO.deserializeDocument` (`jsonIO.ts:37`) — used by file import; already
  hosts a legacy `conditionIds` migration.

## Design

### 1. Data model (`src/types/pedigree.ts`)

- **`Individual.adopted?: boolean`** — unchanged. Single source of truth for
  brackets.
- **`ParentChildRelationship`** — replace `isAdopted: boolean` with
  **`isAdoptive?: boolean`**:
  - `true` → this line of descent is to **adoptive** parents → **dashed**.
  - `false` / `undefined` → **biological** parents → **solid**.
  - Narrow `type` to `RelationshipType.ParentChild` for all parent-child links
    (line style now comes from `isAdoptive`, not from a discriminated `type`).
    `RelationshipType.Adoption` remains defined in `enums.ts` for back-compat
    with serialized docs but is no longer written.
- **`PartnershipRelationship.isAdoptive`** — **removed** (dead).

### 2. Rendering (mirror in both renderers)

- **Brackets** — unchanged in `PedigreeSymbol.tsx:421` (Konva) and
  `svgExport.ts:350` (SVG): drawn when `individual.adopted`.
- **Descent line style** — sourced **only** from the edge:
  - `ParentChildLine.tsx:68` → `dash={link?.isAdoptive ? DASH_PATTERN : undefined}`.
  - `svgExport.ts:586` → `line(x1, y1, x2, y2, link?.isAdoptive ?? false)`.
  - Removing the `|| child.adopted` term is what makes **adopted-out** (brackets
    + `isAdoptive: false`) render with a **solid** line. The migration (below)
    preserves existing adopted-in individuals' dashed lines.

### 3. Editing UX — properties panel adapts to parent-link count

In `PropertiesPanel.tsx`, replace the single "Adopted" checkbox with a control
that keys off how many parent links the selected individual has (looked up by
`childId`):

| Parent links | Control | Writes |
|---|---|---|
| **0** | "Adopted" checkbox (brackets only) | `individual.adopted` |
| **1** | 3-way select: *Not adopted / Adopted in (dashed, adoptive) / Adopted out (solid, biological)* | `individual.adopted` + that link's `isAdoptive` |
| **2+** | Per-relationship list: one row per parent couple (labelled by the partners' display names / fallback ids), each a *Biological (solid) / Adoptive (dashed)* toggle; plus an individual-level "Adopted" (brackets) checkbox | each `link.isAdoptive` independently |

Derived current value for the 1-link select:

- none: `!individual.adopted`
- in: `individual.adopted && link.isAdoptive`
- out: `individual.adopted && !link.isAdoptive`

The 2+ branch is the honest both-families UX; the 1-link select is its collapsed
form. **Decision (2026-06-29): build the 2+ per-link list now.** It is unreachable
until multi-parentage (#64) lets a child gain a second parent link, but it adds no
extra data and is unit-testable in isolation, so building it now means the panel
is complete the moment #64 lands.

### 4. Store action (`src/stores/pedigreeStore.ts`)

Add a single action so each user change is **one undo step** (zundo):

```ts
setAdoption(individualId: string, mode: 'none' | 'in' | 'out'): void
```

- Sets `individual.adopted` (`true` for in/out, cleared for none).
- Looks up the individual's parent link(s); sets `isAdoptive` (`true` for in,
  `false` for out). With 0 links it only sets `adopted` (brackets). With 2+ links
  the per-link toggles use a thinner action (e.g. `setLinkAdoptive(linkId, bool)`)
  rather than `setAdoption`.

### 5. Link / radial creation

- `LinkTypePopup.tsx` "Adoption" button → set the new link's `isAdoptive: true`
  (adopted-in / dashed) and `individual.adopted = true`. (Behaviour unchanged for
  the user; field rename only.)
- `RadialMenu.tsx` (×9 link creations) → drop `isAdopted: false` (now optional;
  omit, meaning biological/solid).

### 6. Migration (`migrateAdoption(doc)` — pure, idempotent)

Live in the IO/persistence layer and called from **both** load paths so autosave
restore is covered:

1. For each `parentChildLink`: if legacy `isAdopted === true` **or**
   `type === RelationshipType.Adoption` → set `isAdoptive = true`; delete
   `isAdopted`; set `type = ParentChild`.
2. For each `individual` with `adopted === true` → set `isAdoptive = true` on its
   parent link(s) found by `childId`. This preserves the current dashed
   appearance of individuals marked adopted via the old properties-panel checkbox
   (legacy `adopted: true` ⇒ adopted-**in**), matching #56's stated migration
   intent.
3. Delete any `PartnershipRelationship.isAdoptive` (dead field).

Call sites:

- `jsonIO.deserializeDocument` — wrap its return through `migrateAdoption` (file
  import).
- `useAutoSave` restore (`useAutoSave.ts:18`) — `parse → migrateAdoption →
  setDocument` (autosave restore).

Decision: call from these two IO/load sites, **not** from `setDocument` — keeps
the store free of IO/migration concerns and matches where the existing
`conditionIds` migration lives.

### 7. PED I/O (`src/io/pedIO.ts:167`)

`.ped` has no adoption concept; the import constructs default links. Replace the
defaulted `isAdopted: false` with the field omitted (biological/solid). No PED
semantics change.

## Testing (TDD; `svgExport` is the canonical render-test surface)

- **Migration** (`migrateAdoption`): legacy `link.isAdopted: true` → `isAdoptive:
  true`; legacy `type: Adoption` → `isAdoptive: true` + `type: ParentChild`;
  `individual.adopted: true` with a parent link → that link `isAdoptive: true`;
  dead `partnership.isAdoptive` dropped. Idempotent on a second pass.
- **Render via SVG**:
  - adopted-in (`adopted: true`, link `isAdoptive: true`) → brackets **and**
    dashed descent line.
  - adopted-out (`adopted: true`, link `isAdoptive: false`) → brackets **and**
    **solid** descent line.
  - not adopted → no brackets, solid line.
- **Store** `setAdoption`: the three transitions set `individual.adopted` +
  `link.isAdoptive` correctly and as a single undo step.

## Files touched

- `src/types/pedigree.ts` — `ParentChildRelationship.isAdopted` → `isAdoptive?`;
  remove `PartnershipRelationship.isAdoptive`; narrow link `type`.
- `src/stores/pedigreeStore.ts` — `setAdoption`, `setLinkAdoptive`.
- `src/components/connections/ParentChildLine.tsx` — dash from `link.isAdoptive`.
- `src/components/ui/PropertiesPanel.tsx` — adaptive adoption control.
- `src/components/ui/LinkTypePopup.tsx` — `isAdoptive: true` on the Adoption link.
- `src/components/ui/RadialMenu.tsx` — drop `isAdopted: false`.
- `src/io/svgExport.ts` — descent-line style from `link.isAdoptive`.
- `src/io/jsonIO.ts` — `migrateAdoption` + call in `deserializeDocument`.
- `src/hooks/useAutoSave.ts` — run `migrateAdoption` before `setDocument`.
- `src/io/pedIO.ts` — drop defaulted `isAdopted`.
- `docs/bennett-pedigree-standards.md` — already corrected in this change.
- Tests: `src/io/svgExport*.test.ts`, `src/stores/pedigreeStore.test.ts`,
  a `migrateAdoption` test (new), plus any `isAdopted` references in existing
  tests updated to `isAdoptive`.
