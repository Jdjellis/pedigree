# Auto-spacing: deterministic tidy layout

**Issue:** #55 — "layout spacing still wrong after add/reflow"
**Date:** 2026-06-29
**Status:** Approved (design)

## Problem

Auto-spacing is a patchwork of greedy, one-directional nudges applied per add
operation. The result is path-dependent (depends on the order people were added)
and only ever pushes nodes rightward and only ever re-centres one couple deep.
This produces the four reported failures:

1. **Sibling added beside a partnered person lands *between* the partners.**
   `RadialMenu.tsx` places a new sibling at `target.x + SIBLING_SPACING`
   (blindly rightward). If the target has a partner on that side, the sibling
   lands inside the union.

2. **Adding a child ignores clashes in the child's generation.**
   `addChildViaNewUnion` drops the child at the parent's x and runs only
   `respaceGenerationWithSubtrees`, which pushes right-only and never balances
   or centres. A child landing left of, or between, existing sibships is not
   cleanly separated.

3. **Drag has no constraints and no reaction.**
   `symbolDrag.ts` commits positions directly with zero collision/respace logic.
   A node can be dropped on top of another or inside a partnership.

4. **Siblings fan rightward instead of staying centred under the parent.**
   New siblings append at `maxX + SIBLING_SPACING`, and
   `centerParentsOverChildren` bails out entirely for single-parent unions
   (`respacing.ts` requires both partners present), so a one-parent family never
   re-centres.

The root flaw shared by all four: **there is no primitive that says "a sibship is
an evenly-spaced row centred under its parents, recursively."**

## Goals

- Adding a parent / partner / child / sibling produces a centred, overlap-free
  layout with no manual cleanup for the common cases.
- Each sibship is centred under its parents, at every generation, including
  single-parent unions.
- Dragging a node and dropping it never leaves it overlapping another node or
  sitting inside a partnership; same-generation neighbours adjust to make room.
- The whole operation (insert + relayout) remains a single undo step.
- Layout is **deterministic from the relationship graph** — path-independent and
  idempotent (re-running on a tidy tree is a no-op, no jitter).

## Non-goals

- General pedigree-graph layout with consanguinity loops or a person marrying
  into two families. Multi-union (remarriage) is handled best-effort, not
  fully solved; documented as a known limitation.
- Cross-*generation* overlap resolution on drag (drag respaces only the dropped
  node's generation, per the agreed scope).
- Manual-position pinning. Per decision, **auto-layout wins**: each structural
  add re-tidies the affected family from its structure; a prior manual drag
  within that family is recomputed by the next add to it.

## Design

### Coordinate model

Layout computes **x only**. `y` continues to be derived from `generation`
(`generation × GENERATION_SPACING` offset from the family anchor, as set today in
`RadialMenu.tsx`). The whole problem is therefore a 1-D horizontal packing
problem, matching the altitude of the existing `respacing.ts` module.

### The blood tree

The recursive unit is the **blood tree** rooted at the affected family's
founder. Married-in partners (in-laws) are not blood descendants; they ride
along beside their spouse. This is exactly the split `collectDescendants`
already models (it walks children through partnerships but excludes partners
married into the line).

### New module: `src/utils/treeLayout.ts` (pure)

A two-pass tidy-tree (Reingold–Tilford reduced to 1-D):

**Pass 1 — measure (post-order).** For each union with children:
1. Recursively lay out each child's subtree. Each subtree reports
   `{ center, leftExtent, rightExtent }` where the extents are the min/max node
   *center* x within that subtree.
2. Place sibling subtrees left-to-right so that
   `nextBlock.leftExtent ≥ prevBlock.rightExtent + SIBLING_SPACING`. Leaf
   siblings (no descendants) have `leftExtent === rightExtent === center`, so
   adjacent leaves end up exactly `SIBLING_SPACING` apart — matching today's
   look.
3. `sibshipCenter = (firstChildCenter + lastChildCenter) / 2`.
4. Seat the union's partners centred on `sibshipCenter`: two partners at
   `sibshipCenter ∓ PARTNER_SPACING / 2`; a sole parent at `sibshipCenter`;
   a 0-partner (parentless) sibship has no partners and is centred on its own
   children's centroid. Preserve each couple's existing left/right order (don't
   flip partners).
5. The union's subtree extent spans both the partners and the children blocks.

**Pass 2 — assign (pre-order).** Walk down assigning absolute x from relative
offsets, then translate the entire result so the **layout root keeps its current
x** (the canvas does not jump on relayout). "Root x" means: for a founder
individual, that individual's pre-layout x; for a parentless-sibship root, the
pre-layout centroid of the sibship's children. The single translation that
satisfies this is applied to every moved node.

**Consequences (by construction):**
- One tree packs into disjoint horizontal intervals → no cross-sibship overlap
  (fixes #2).
- Every sibship is centred under its parents at every level, including the
  sole-parent case (fixes #4).
- A newly added sibling just re-packs its row, so which side it was seeded on no
  longer matters (fixes #1).
- Same structure → same layout, always (path-independent, idempotent).

**Helpers (each unit-tested in isolation):**
- `findLayoutRoot(doc, nodeId): string` — walk parent links upward to the
  founder of the connected blood family containing `nodeId`. For a parentless
  sibship, the root is the sibship itself (anchor on its centroid).
- `placeSiblingBlocks(childLayouts, siblingSpacing): Placed[]` — the edge-gap
  packing of pass-1 step 2.
- `centerCoupleOver(sibshipCenter, partners, partnerSpacing): Record<id, number>`
  — pass-1 step 4.
- `layoutUnionSubtree(...)` — the recursion; returns member offsets + extents.
- `computeTreeLayout(individuals, partnerships, parentChildLinks, rootId,
  spacing): Record<id, number>` — top-level; returns id → new x for every node
  in the rooted blood tree plus the in-law partners attached to it. Only nodes
  whose x actually changes are returned (so callers can detect no-ops).

### Store wiring (`src/stores/pedigreeStore.ts`)

One orchestration helper:

```
relayoutFamily(individuals, partnerships, parentChildLinks, anchorId)
  → Record<string, Individual>   // new individuals map with moves applied
```

It resolves `findLayoutRoot(anchorId)`, runs `computeTreeLayout`, and applies the
moves via the existing `applyMoves`. Every add operation
(`addParentsForChild`, `addPartnerToIndividual`, `addChildToFamily`,
`addSiblingViaNewUnion`, `addChildViaNewUnion`, `addParentsToParentlessUnion`)
inserts the new node(s) and then calls `relayoutFamily` **inside the same
`set(...)`** so insert + relayout collapse into one zundo history entry.

`RadialMenu.tsx` initial-x computation becomes a seed only (it still sets
`generation` and `y`); the tidy pass owns final x. The seed placement logic
simplifies accordingly (no more side guessing for siblings).

### Drag — respace on drop (`src/utils/respacing.ts` + `symbolDrag.ts`)

New pure function:

```
respaceAfterDrag(individuals, partnerships, draggedId, minSpacing)
  → Record<string, number>   // id → new x for neighbours pushed aside
```

- Anchor the dropped node at the position the user left it.
- Group the dropped node's generation into **rigid couple-blocks** via union-find
  (extracted from `makeRoomForPartner`'s existing block logic into a shared
  `groupGenerationIntoBlocks` helper).
- Push only the blocks that overlap the dropped node **outward** — blocks to the
  left move further left, blocks to the right move further right — until every
  gap is ≥ `minSpacing`. Each pushed block carries its subtree
  (`collectDescendants`) so families don't tear.

Result: dropping on top of someone separates them (Image 4); dropping inside a
union pushes the *whole couple* aside rather than splitting it (Image 3).

Wired into the drag commit (`commitSymbolDrag` / a store action
`commitDragWithRespace`) so the dropped position and the neighbour respace land
in one tracked update — preserving the existing "whole drag is one undo step"
invariant.

### Retired

Subsumed by the tidy pass and removed, with scenario-specific tests migrated to
the new functions:
- `makeRoomForPartner` (block-grouping logic extracted, not lost)
- `computeParentClearanceShift`
- `centerParentsOverChildren`
- `respaceGenerationWithSubtrees`

Kept and reused: `collectDescendants`, `respaceRow`, and the extracted
`groupGenerationIntoBlocks` helper.

## Testing (TDD)

Red → green on the pure helpers first, then store-integration tests, then drag.

**Pure `treeLayout.ts`:**
- `placeSiblingBlocks`: leaves end exactly `SIBLING_SPACING` apart; subtrees with
  width are separated by their extents + spacing; empty / single inputs.
- `centerCoupleOver`: two partners, sole parent, preserves partner order, no-op
  when already centred.
- `findLayoutRoot`: walks to founder; parentless sibship returns itself;
  married-in branch resolves to the blood founder.
- `computeTreeLayout`: idempotent (tidy tree in → no moves out); root x
  preserved; even vs odd child counts; child subtrees carried; centring
  propagates up two+ generations.

**Pure `respacing.ts`:**
- `groupGenerationIntoBlocks`: couples grouped, singletons alone.
- `respaceAfterDrag`: drop-on-top separates to `minSpacing`; drop-in-union pushes
  whole couple aside (not split); already-clear neighbours untouched; pushed
  block carries its subtree; pushes both directions.

**Store integration — one per scenario + edges:**
- S1: sibling added to a partnered person ends outside the union, sibship
  centred. Mirror case (partner on the left).
- S1b: sibling of a person who has parents *and* a partner — stays in the
  parented sibship and clears the partner.
- S2: child added where the generation already holds a cousin sibship — no
  overlap; both sibships centred under their own parents.
- S4: add siblings repeatedly — row stays centred under the parent (single and
  couple), existing siblings shift left; sole-parent case included.
- Invariants: every add + relayout is a single undo step; relayout of an
  already-tidy family is a no-op.
- S3 (drag): drop a node onto another → separated; drop into a union → couple
  parts, node seated; whole drag remains one undo step.

## Open risks / notes

- Multi-union (remarriage) layout is best-effort: each union's sibship is laid
  out and placed adjacently under the shared blood parent, in-laws flanking. Not
  covered by dedicated scenario tests; documented limitation.
- Anchoring on the layout root keeps the canvas stable but means a large family
  re-tidy can move many nodes at once on a single add. Accepted per the
  "auto-layout wins" decision.
