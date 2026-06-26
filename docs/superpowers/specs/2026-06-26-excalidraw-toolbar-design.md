# Excalidraw-style floating toolbar — design

Date: 2026-06-26
Status: Approved, pending implementation plan

## Goal

Rework the floating tool island to align with Excalidraw's toolbar idiom and
fix the underlying interaction model. Specifically:

1. Replace text labels and the hand emoji with consistent icons.
2. Show keyboard-shortcut badges underneath each placeable tool.
3. Turn "add text" into a persistent placement tool (click to drop a text box).
4. Stop the select tool from pan-dragging on empty canvas; instead draw a
   rectangular marquee selection box.
5. Support multi-select via marquee and via modifier+click (logic already
   exists; needs a visual driver).
6. Add sex-specific person placement, a partnership-line tool, and an eraser.

Non-goal (explicitly deferred): a freeform **lasso** tool. Pedigrees are laid
out on a fairly structured grid, so a rectangular marquee covers the large
majority of real selections. The selection system is designed so a lasso can
be added later without rework, but it is out of scope here.

## Current state (what exists today)

- `src/components/ui/islands/ToolIsland.tsx` renders four controls: Select
  (text label), Hand (✋ emoji), `＋ Person`, `＋ Text`. "Add Text" is a
  one-off action, not a persistent tool.
- `src/stores/uiStore.ts` defines `ActiveTool = 'select' | 'pan' | 'addIndividual'`
  and holds `activeTool`, `setActiveTool`, plus selection state: `selectedIds`
  (a `Set<string>`), `select`, `selectMultiple`, `toggleSelection`,
  `clearSelection`.
- `src/components/canvas/CanvasContainer.tsx` sets the Konva `Stage` to
  `draggable` unconditionally, so dragging empty canvas pans. Spacebar-pan,
  middle-mouse-pan, and wheel-scroll/zoom are handled separately and globally.
- Multi-select is already wired to Shift/Cmd+click on symbols via
  `toggleSelection`, but there is no marquee or lasso to drive it.
- No icon library is installed.
- `src/hooks/useKeyboardShortcuts.ts` maps `V` select, `H` pan, `P`
  add-individual, plus the usual Cmd-modified shortcuts.
- There is an existing drag-from-node-to-node link interaction plus a radial
  menu for creating relationships.
- Per project constraint: react-konva cannot render under vitest/jsdom, so
  canvas interaction logic is extracted into plain store-operating modules
  (e.g. `symbolDrag.ts`) and unit-tested there. `svgExport.ts` is a parallel
  renderer used as the testable surface for visual output.

## Design

### 1. Toolbar layout and icons

A single floating pill replaces the current ToolIsland, ordered left to right
with thin dividers between groups:

```
🔒 Lock │ ✋ Hand │ ▸ Select(1) ┊ □ Male(2)  ○ Female(3)  ◇ Unknown(4) ┊ — Partnership(5) │ A Text(6) │ ⌫ Eraser(7)
```

- **Icon source:** add `lucide-react` for lock, hand, pointer (select),
  partnership line, text, and eraser. The three sex tools are hand-authored
  inline SVG that visually match the on-canvas pedigree symbols (outlined
  square = male, circle = female, diamond = unknown), so the toolbar doubles
  as a symbol legend.
- **Shortcut badges:** each placeable tool (Select, Male, Female, Unknown,
  Partnership, Text, Eraser) shows its number (1–7) underneath the icon. Lock
  and Hand are modal helpers and carry no badge (matching Excalidraw).
- **Active state:** reuse the existing `.buttonActive` violet treatment from
  `islands.module.css`.
- Buttons grow from 32×32 to roughly 40×48 to fit icon + badge; styling stays
  in the shared islands CSS so other islands are unaffected.

### 2. Shortcut scheme

Both a number and a mnemonic letter fire each tool. The badge always displays
the number.

| Tool        | Number | Letter |
| ----------- | ------ | ------ |
| Select      | 1      | V      |
| Male        | 2      | M      |
| Female      | 3      | F      |
| Unknown     | 4      | U      |
| Partnership | 5      | R      |
| Text        | 6      | T      |
| Eraser      | 7      | E      |
| Hand        | —      | H      |
| Lock        | —      | (toggle; no single-key default required) |

This extends `useKeyboardShortcuts.ts`. The existing `P` (add-individual)
binding is removed since `addIndividual` is replaced by the three sex tools.

### 3. Interaction model

Core architectural change: **the Stage stops being globally `draggable`**. The
active tool decides what a pointer-down on empty canvas means; panning becomes
one tool's behavior rather than the canvas default.

Behavior on **pointer-down over empty canvas**, by tool:

- **Select (default):** begin a rectangular marquee. On release, select every
  node whose bounding box intersects the marquee rectangle. Dragging a node
  still moves it (existing `symbolDrag` behavior); clicking a node still
  selects it; Shift/Cmd+click still toggles via `toggleSelection`; clicking
  empty canvas clears the selection.
- **Hand:** pan by dragging anywhere (sets Stage `draggable` while active).
- **Male / Female / Unknown:** crosshair cursor; click places a node of that
  sex at the click point. Replaces the old "spawn at canvas center"
  `addIndividual` flow; placement position comes from the click location
  (converted via `screenToCanvas`).
- **Text:** crosshair cursor; click places an empty text box already in inline
  edit mode.
- **Partnership:** click node A (it highlights as the pending anchor), then
  click node B to create the partnership using the same create-partnership
  logic the drag-link uses. Esc cancels the pending anchor. The existing
  drag-link and radial menu remain untouched — the tool is an additional,
  more discoverable path.
- **Eraser:** eraser cursor; click or drag-across deletes elements under the
  pointer. Deleting a person cascades to its connections (partnerships,
  parent-child links); undo is the safety net.

**Preserved globally regardless of active tool:** spacebar-pan,
middle-mouse-pan, and wheel-scroll / Cmd-wheel-zoom. No existing pan gesture is
lost.

**Lock** toggles "keep tool active after use":

- Off (default): after one placement, placement tools (Male/Female/Unknown,
  Text) revert to Select — Excalidraw's default.
- On: the active tool stays selected, for placing several in a row.

### 4. State changes

- `ActiveTool` becomes
  `'select' | 'hand' | 'male' | 'female' | 'unknown' | 'partnership' | 'text' | 'eraser'`.
  (`'pan'` is renamed to `'hand'`; `'addIndividual'` is removed.)
- Add `toolLocked: boolean` to `uiStore` with a toggle action.
- Add transient state for an in-progress marquee (start/current point) and for
  a pending partnership anchor (node id or null). These may live in `uiStore`
  or component-local state as appropriate; marquee math itself lives in an
  extracted module (below).

### 5. Architecture and testing

Per the react-konva/jsdom constraint, new pointer logic is extracted into plain
store-operating modules and unit-tested, mirroring `symbolDrag.ts`:

- `marqueeSelection.ts` — given a marquee rectangle and node bounding boxes,
  return the set of intersecting node ids.
- `toolPlacement.ts` — given a click point and active tool, produce the new
  node/text creation (position via `screenToCanvas`) and the post-placement
  tool state (revert to Select unless `toolLocked`).
- `eraserCascade.ts` — given a target element id, return the full set of
  entities to delete (the element plus cascaded connections).

`ToolIsland` is plain HTML/CSS (react-dom), so it is tested with
`@testing-library/react`. Any change to on-canvas rendered output is mirrored
in `svgExport.ts` per existing convention. TDD throughout: tests for the
extracted modules and the toolbar are written before implementation.

## Implementation staging

The spec is implemented in three focused stages, each landing as its own PR:

- **Stage A — Toolbar shell:** new icon-based ToolIsland (lucide-react +
  inline symbol SVGs), shortcut badges, expanded `ActiveTool` type,
  `toolLocked` state, and updated `useKeyboardShortcuts`. No canvas behavior
  change yet beyond wiring the new tool ids.
- **Stage B — Selection/tool-routing refactor:** remove unconditional Stage
  `draggable`; route empty-canvas pointer events through the active tool; add
  Hand-tool panning and the rectangular marquee (with `marqueeSelection.ts`).
- **Stage C — Placement tools:** sex-specific person placement and the text
  placement tool (`toolPlacement.ts`), the partnership-line tool, and the
  eraser with cascade (`eraserCascade.ts`).

## Success criteria

- Toolbar matches the agreed layout with icons and number badges; lock and
  hand have no badge.
- Number and letter shortcuts both switch tools; badge shows the number.
- Select tool draws a marquee on empty-canvas drag and never pans; marquee and
  Shift/Cmd+click both produce multi-selection.
- All prior pan/zoom gestures (Hand, spacebar, middle-mouse, wheel, Cmd-wheel)
  still work.
- Male/Female/Unknown and Text place at the click point; Lock controls whether
  the tool stays active after placement.
- Partnership tool creates a partnership via click-A-then-click-B using the
  existing create logic; drag-link and radial menu still work.
- Eraser deletes on click and drag-across, cascading person deletions to their
  connections; undo restores.
- Extracted logic modules and the toolbar component have unit tests; tests pass.
