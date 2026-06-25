# Feedback Round 1 — Design Document

## Items Addressed

1. Legend gender model: conditions applicable to specific gender(s)
2. Toolbar disappearing on zoom
3. Linking existing persons via drag-to-connect
4. Radial menu centering
5. Parent gender assumption (male left, female right)
6. Proband/Consultand arrow annotations
7. Bounded printable canvas with auto-expand + snap to paper ratios
8. Generation roman numerals + individual numbering

---

## A. Quick Fixes

### A1. Toolbar disappearing on zoom
- Add `position: sticky; top: 0; z-index: 50` to `.toolbar` in `Toolbar.module.css`
- Ensures toolbar stays visible during browser zoom or scroll

### A2. Radial menu centering
- The menu items (Parent, Partner, Child, Sibling) are positioned at fixed CSS offsets, not polar coordinates
- Fix: position each option using `transform: translate()` with polar math (90-degree intervals centered on the node)
- Verify the screenPos calculation accounts for symbol center correctly

### A3. Parent gender assumption
- In `RadialMenu.tsx` `handleAddParent`: set parent1 (left) to `GenderIdentity.Man`, parent2 (right) to `GenderIdentity.Woman`
- Currently both default to `GenderIdentity.Unknown`

---

## B. Legend Gender Model

### Current
```ts
conditionNames: { default: string; man?: string; woman?: string }
```

### New
```ts
interface LegendEntry {
  id: string;
  quarter: QuarterPosition;
  fillColor: string;
  fillPattern: FillPatternType;
  name: string;
  applicableTo?: 'man' | 'woman';  // omit = both genders
}
```

### Behavior
- Properties Panel: only show checkboxes for conditions matching the individual's gender (or no restriction)
- Legend Editor: replace gender-specific name inputs with a single "Applies to" dropdown (Both / Male only / Female only)
- Canvas/HTML legends: display condition name with optional "(M)" or "(F)" suffix when gender-restricted

### Files affected
- `src/types/pedigree.ts` — change LegendEntry interface
- `src/components/ui/LegendEditor.tsx` — replace gender name UI with applicableTo dropdown
- `src/components/ui/PropertiesPanel.tsx` — filter checkboxes by gender
- `src/components/ui/LegendOverlay.tsx` — update label display
- `src/components/canvas/LegendLayer.tsx` — update label display

---

## C. Proband/Consultand Arrows

### Current
- `ProbandArrow.tsx`: simple Konva Arrow at bottom-left, only for `isProband`
- `isConsultand` has no visual representation

### New
- Rename to `IndicatorArrow.tsx` (or keep and extend)
- Consultand: small arrow pointing upper-right, positioned outside bottom-left of symbol, offset by ~5px from symbol edge
- Proband: same arrow + Konva `Text` with "P" to the left of the arrow
- If both `isProband` and `isConsultand` are true, show proband (it implies consultand)

### Rendering order
```
if (isProband) → arrow + "P" label
else if (isConsultand) → arrow only
```

### Files affected
- `src/components/canvas/symbols/ProbandArrow.tsx` — rewrite with new positioning + text
- `src/components/canvas/symbols/PedigreeSymbol.tsx` — pass `isConsultand` to the arrow component

---

## D. Bounded Canvas + Generation Numbering

### D1. Bounded printable canvas

A visible `Rect` on the canvas representing the printable area:
- Auto-expands to fit all individuals with 80px padding on all sides
- Snaps to the nearest standard paper aspect ratio (A4 landscape 1.414:1 or Letter landscape 1.294:1)
- Light gray border, no fill (transparent)
- Rendered in a dedicated `BoundsLayer` behind the grid
- Legend repositioned to bottom-left of this rectangle (locked to bounds, not free-floating)
- Recalculated whenever individuals are added/moved/removed

### Bounds calculation
```
1. Find bounding box of all individuals (min/max x and y)
2. Add padding (80px each side)
3. Compute aspect ratio
4. Snap to nearest paper ratio by expanding the shorter dimension
5. Center the content within the snapped bounds
```

### D2. Generation numbering

**Roman numerals on left edge:**
- A new `GenerationLabels` component in the bounds layer
- For each unique generation number, render a `Text` with the roman numeral (I, II, III...)
- Positioned at `x = bounds.left - 30`, `y = generationY` (vertically centered on that generation row)

**Individual numbering under symbols:**
- In `SymbolLabel.tsx`, prepend the individual number as the first line
- Number is computed by sorting all individuals in the same generation by x-position
- Stored as a computed value, not persisted (derived from position + generation)

### Label order under each symbol (top to bottom)
1. Individual number (e.g., "3")
2. Display name
3. Age / deceased age
4. Sex assigned at birth annotation
5. Clinical conditions

### Files affected
- `src/components/canvas/BoundsLayer.tsx` — NEW: renders printable boundary rect + generation numerals
- `src/components/canvas/CanvasContainer.tsx` — compute bounds, render BoundsLayer, pass data
- `src/components/canvas/symbols/SymbolLabel.tsx` — add individual number as first line
- `src/components/canvas/LegendLayer.tsx` — position legend relative to bounds bottom-left

---

## E. Drag-to-Link Existing Persons

### Interaction flow
1. User holds Alt/Option and drags from a symbol
2. A dashed line follows the cursor from the source symbol
3. When cursor enters another symbol, it highlights as a drop target
4. On release over a valid target, a popup menu appears with relationship types:
   - Partnership
   - Consanguinity
   - Parent-Child (source is parent)
   - Parent-Child (target is parent)
   - Adoption
   - Twin Group (only if both are in the same generation)
5. User selects a type, relationship is created

### Implementation
- **DragLink state** in uiStore: `{ active: boolean, sourceId: string | null, cursorPos: {x, y} }`
- **DragLinkLayer** in canvas: renders the dashed line from source to cursor during drag
- **PedigreeSymbol.tsx**: on Alt+dragStart, enter link mode instead of move mode. On mouseEnter of another symbol during link mode, highlight it.
- **LinkTypePopup**: HTML overlay that appears at drop position with relationship type options
- **Store actions**: reuse existing `addPartnership`, `addParentChildLink`, `addChildToPartnership`

### Files affected
- `src/stores/uiStore.ts` — add dragLink state + actions
- `src/components/canvas/DragLinkLayer.tsx` — NEW: renders dashed connecting line during drag
- `src/components/canvas/symbols/PedigreeSymbol.tsx` — detect Alt+drag, handle drop targets
- `src/components/ui/LinkTypePopup.tsx` — NEW: popup for selecting relationship type
- `src/components/canvas/CanvasContainer.tsx` — render DragLinkLayer, pass dragLink state

---

## Implementation Priority

1. Quick fixes (A1-A3) — low risk, immediate UX improvement
2. Legend gender model (B) — data model change, do early
3. Proband/Consultand arrows (C) — visual, self-contained
4. Generation numbering (D2) — requires generation tracking
5. Bounded canvas (D1) — depends on generation data being correct
6. Drag-to-link (E) — most complex, do last
