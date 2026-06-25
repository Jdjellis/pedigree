# Feedback Round 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address 8 feedback items: legend gender model, toolbar z-index, drag-to-link, radial menu centering, parent gender defaults, proband/consultand arrows, bounded canvas, and generation numbering.

**Architecture:** Changes span UI fixes (CSS), data model updates (LegendEntry), new components (BoundsLayer, DragLinkLayer, LinkTypePopup), and modifications to existing rendering (ProbandArrow, SymbolLabel, RadialMenu). Each task is independent enough to commit separately.

**Tech Stack:** React, TypeScript, react-konva, Zustand, CSS Modules

---

## Task 1: Toolbar sticky positioning

**Files:**
- Modify: `src/components/ui/Toolbar.module.css:1-10`

**Step 1: Fix toolbar CSS**

In `src/components/ui/Toolbar.module.css`, add `position: sticky`, `top: 0`, and `z-index: 50` to `.toolbar`:

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  height: 48px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 50;
}
```

**Step 2: Verify**

Run: `npx tsc -b --noEmit && npx vite build 2>&1 | tail -3`

Start dev server, zoom browser in/out (Cmd+/Cmd-) — toolbar should stay pinned at top.

---

## Task 2: Radial menu centering

**Files:**
- Modify: `src/components/ui/RadialMenu.module.css:48-83`

**Step 1: Replace fixed position classes with centered polar layout**

The current `.top`, `.right`, `.bottom`, `.left` classes position buttons at edges of a 140x140 box. The center of each button should be at a fixed radius from the center. Replace the positioning classes:

```css
/* Positions: top, right, bottom, left — centered at radius from menu center */
.top {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) translate(0px, -48px);
}
.top:hover {
  transform: translate(-50%, -50%) translate(0px, -48px) scale(1.1);
}

.right {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) translate(48px, 0px);
}
.right:hover {
  transform: translate(-50%, -50%) translate(48px, 0px) scale(1.1);
}

.bottom {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) translate(0px, 48px);
}
.bottom:hover {
  transform: translate(-50%, -50%) translate(0px, 48px) scale(1.1);
}

.left {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) translate(-48px, 0px);
}
.left:hover {
  transform: translate(-50%, -50%) translate(-48px, 0px) scale(1.1);
}
```

**Step 2: Verify visually**

Start dev server, hover over a symbol — menu buttons should appear evenly spaced around the node center.

---

## Task 3: Parent gender assumption

**Files:**
- Modify: `src/components/ui/RadialMenu.tsx:63-77`

**Step 1: Set parent genders**

In `handleAddParent`, add `genderIdentity` overrides:

```ts
const parent1 = createDefaultIndividual({
  genderIdentity: GenderIdentity.Man,
  position: {
    x: target.position.x - PARTNER_SPACING / 2,
    y: target.position.y - GENERATION_SPACING,
  },
});
const parent2 = createDefaultIndividual({
  genderIdentity: GenderIdentity.Woman,
  position: {
    x: target.position.x + PARTNER_SPACING / 2,
    y: target.position.y - GENERATION_SPACING,
  },
});
```

This requires adding `import { GenderIdentity } from '../../types/enums'` at the top of RadialMenu.tsx (add to existing imports from enums).

**Step 2: Verify**

Add a person, hover to show radial menu, click "Parent" — left parent should be square (Man), right parent should be circle (Woman).

---

## Task 4: Legend gender model refactor

**Files:**
- Modify: `src/types/pedigree.ts:23-34`
- Modify: `src/components/ui/LegendEditor.tsx`
- Modify: `src/components/ui/PropertiesPanel.tsx`
- Modify: `src/components/ui/LegendOverlay.tsx`
- Modify: `src/components/canvas/LegendLayer.tsx`
- Modify: `src/io/jsonIO.ts` (migration)

**Step 1: Update LegendEntry type**

In `src/types/pedigree.ts`, replace the current LegendEntry:

```ts
export interface LegendEntry {
  id: string;
  quarter: QuarterPosition;
  fillColor: string;
  fillPattern: FillPatternType;
  name: string;
  applicableTo?: 'man' | 'woman';
}
```

Remove `conditionNames` entirely.

**Step 2: Update LegendEditor.tsx**

Replace the `conditionNames` input and gender-specific names toggle with:
- A single "Condition Name" input bound to `entry.name`
- An "Applies to" dropdown: Both / Male only / Female only — bound to `entry.applicableTo`

Remove the `LegendEntryRow` internal state for `showGenderNames`.

Replace the condition name input's value/onChange:
```ts
value={entry.name}
onChange={(e) => onUpdate({ name: e.target.value })}
```

Replace the gender-specific names toggle and fields with:
```tsx
<div className={styles.field}>
  <label className={styles.label}>Applies To</label>
  <select
    className={styles.select}
    value={entry.applicableTo ?? 'both'}
    onChange={(e) =>
      onUpdate({
        applicableTo: e.target.value === 'both' ? undefined : (e.target.value as 'man' | 'woman'),
      })
    }
  >
    <option value="both">Both genders</option>
    <option value="man">Male only</option>
    <option value="woman">Female only</option>
  </select>
</div>
```

Also update `handleAdd` to use `name` instead of `conditionNames`:
```ts
addLegendEntry({
  id: generateId(),
  quarter: availableQuarter.value,
  fillColor: DEFAULT_CONDITION_COLORS[colorIdx],
  fillPattern: 'solid',
  name: 'New Condition',
});
```

**Step 3: Update PropertiesPanel.tsx**

Replace `getConditionLabel` with simple `entry.name`. Filter legend entries by gender applicability:

```ts
const applicableEntries = legendConfig.entries.filter((entry) => {
  if (!entry.applicableTo) return true; // applies to both
  if (entry.applicableTo === 'man' && individual.genderIdentity === GenderIdentity.Man) return true;
  if (entry.applicableTo === 'woman' && individual.genderIdentity === GenderIdentity.Woman) return true;
  return false;
});
```

Then iterate `applicableEntries` instead of `legendConfig.entries` for the checkboxes. Use `entry.name` for the label.

**Step 4: Update LegendOverlay.tsx**

Replace `entry.conditionNames.default` with `entry.name`. Optionally append `(M)` or `(F)` suffix:

```ts
const label = entry.name + (entry.applicableTo === 'man' ? ' (M)' : entry.applicableTo === 'woman' ? ' (F)' : '');
```

**Step 5: Update LegendLayer.tsx**

Same change — replace `entry.conditionNames.default` with `entry.name` (with optional suffix).

**Step 6: Update jsonIO.ts migration**

In the migration section of `deserializeDocument`, handle old `conditionNames` format:
```ts
// Migrate old conditionNames to name
for (const entry of result.legendConfig.entries) {
  const e = entry as any;
  if (e.conditionNames && !e.name) {
    e.name = e.conditionNames.default;
    delete e.conditionNames;
  }
}
```

**Step 7: Verify**

Run: `npx tsc -b --noEmit && npx eslint .`

Dev server: open Legend Editor, add a condition, set "Applies to: Female only", add a person as Man — that condition should NOT appear in their checkboxes. Change to Woman — it should appear.

---

## Task 5: Proband/Consultand arrows

**Files:**
- Modify: `src/components/canvas/symbols/ProbandArrow.tsx`
- Modify: `src/components/canvas/symbols/PedigreeSymbol.tsx:315-316`

**Step 1: Rewrite ProbandArrow.tsx**

```tsx
import React from 'react';
import { Arrow, Text } from 'react-konva';
import { SYMBOL_COLOR, LABEL_FONT_FAMILY } from '../../../utils/constants';

export interface ProbandArrowProps {
  size: number;
  isProband: boolean;
  isConsultand: boolean;
}

export const ProbandArrow: React.FC<ProbandArrowProps> = React.memo(
  ({ size, isProband, isConsultand }) => {
    if (!isProband && !isConsultand) return null;

    const half = size / 2;
    const offset = 8;
    const arrowLen = 14;

    // Arrow starts below-left of symbol, points upper-right
    const startX = -(half + offset + arrowLen);
    const startY = half + offset + arrowLen;
    const endX = -(half + offset);
    const endY = half + offset;

    return (
      <>
        <Arrow
          points={[startX, startY, endX, endY]}
          pointerLength={7}
          pointerWidth={7}
          fill={SYMBOL_COLOR}
          stroke={SYMBOL_COLOR}
          strokeWidth={1.5}
        />
        {isProband && (
          <Text
            x={startX - 12}
            y={startY - 6}
            text="P"
            fontSize={11}
            fontFamily={LABEL_FONT_FAMILY}
            fontStyle="bold"
            fill={SYMBOL_COLOR}
          />
        )}
      </>
    );
  },
);

ProbandArrow.displayName = 'ProbandArrow';
```

**Step 2: Update PedigreeSymbol.tsx**

Replace the proband arrow rendering (around line 315-316):

```tsx
{/* Proband / Consultand arrow */}
<ProbandArrow
  size={SYMBOL_SIZE}
  isProband={individual.isProband}
  isConsultand={individual.isConsultand ?? false}
/>
```

Remove the old conditional `{individual.isProband && <ProbandArrow size={SYMBOL_SIZE} />}`.

**Step 3: Verify**

Dev server: select a person, check "Proband" — arrow with "P" should appear at bottom-left. Uncheck proband, check "Consultand" — arrow without "P". Both checked — shows proband (with P).

---

## Task 6: Generation numbering in SymbolLabel

**Files:**
- Modify: `src/components/canvas/symbols/SymbolLabel.tsx`
- Modify: `src/components/canvas/symbols/PedigreeSymbol.tsx` (pass individualNumber prop)
- Modify: `src/components/canvas/CanvasContainer.tsx` (compute individual numbers)

**Step 1: Add individualNumber prop to SymbolLabel**

In `SymbolLabel.tsx`, add an `individualNumber` prop and render it as the first line:

```tsx
export interface SymbolLabelProps {
  individual: Individual;
  individualNumber?: number;
}

export const SymbolLabel: React.FC<SymbolLabelProps> = React.memo(
  ({ individual, individualNumber }) => {
    const lines = useMemo(() => {
      const result: string[] = [];

      // Line 1: individual number within generation
      if (individualNumber != null) {
        result.push(`${individualNumber}`);
      }

      // Line 2: display name
      if (individual.displayName) {
        result.push(individual.displayName);
      }
      // ... rest unchanged
```

**Step 2: Compute individual numbers in CanvasContainer**

In `CanvasContainer.tsx`, after the `individualsList` computation, compute per-individual numbering:

```ts
const individualNumbers = useMemo(() => {
  const numbers = new Map<string, number>();
  // Group by generation
  const genGroups = new Map<number, Individual[]>();
  for (const ind of individualsList) {
    const gen = ind.generation ?? 0;
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(ind);
  }
  // Sort each group by x position and assign numbers
  for (const [, group] of genGroups) {
    group.sort((a, b) => a.position.x - b.position.x);
    group.forEach((ind, idx) => {
      numbers.set(ind.id, idx + 1);
    });
  }
  return numbers;
}, [individualsList]);
```

Pass to PedigreeSymbol: `individualNumber={individualNumbers.get(individual.id)}`

**Step 3: Update PedigreeSymbol props and pass through**

Add `individualNumber?: number` to `PedigreeSymbolProps`. Pass it to `<SymbolLabel individual={individual} individualNumber={individualNumber} />`.

**Step 4: Verify**

Add multiple people in different generations. The numbers under each symbol should reflect left-to-right ordering within their generation.

---

## Task 7: Bounded canvas with generation labels

**Files:**
- Create: `src/components/canvas/BoundsLayer.tsx`
- Modify: `src/components/canvas/CanvasContainer.tsx`
- Modify: `src/components/canvas/LegendLayer.tsx` (position relative to bounds)
- Create: `src/utils/boundsCalculation.ts`

**Step 1: Create bounds calculation utility**

Create `src/utils/boundsCalculation.ts`:

```ts
import type { Individual, Position } from '../types/pedigree';

export interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PADDING = 80;
const A4_LANDSCAPE_RATIO = 297 / 210; // ~1.414
const LETTER_LANDSCAPE_RATIO = 11 / 8.5; // ~1.294

export function computeBounds(individuals: Individual[]): CanvasBounds | null {
  if (individuals.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const ind of individuals) {
    minX = Math.min(minX, ind.position.x);
    minY = Math.min(minY, ind.position.y);
    maxX = Math.max(maxX, ind.position.x);
    maxY = Math.max(maxY, ind.position.y);
  }

  // Add padding
  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  let width = maxX - minX;
  let height = maxY - minY;

  // Minimum size
  width = Math.max(width, 400);
  height = Math.max(height, 300);

  // Snap to nearest paper ratio
  const currentRatio = width / height;
  const a4Diff = Math.abs(currentRatio - A4_LANDSCAPE_RATIO);
  const letterDiff = Math.abs(currentRatio - LETTER_LANDSCAPE_RATIO);
  const targetRatio = a4Diff < letterDiff ? A4_LANDSCAPE_RATIO : LETTER_LANDSCAPE_RATIO;

  if (currentRatio < targetRatio) {
    // Too tall, expand width
    width = height * targetRatio;
  } else {
    // Too wide, expand height
    height = width / targetRatio;
  }

  // Center content within expanded bounds
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  };
}

export function toRomanNumeral(num: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  let n = num + 1; // generations are 0-indexed, display as 1-indexed
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) {
      result += syms[i];
      n -= vals[i];
    }
  }
  return result;
}
```

**Step 2: Create BoundsLayer.tsx**

Create `src/components/canvas/BoundsLayer.tsx`:

```tsx
import React from 'react';
import { Rect, Text } from 'react-konva';
import type { CanvasBounds } from '../../utils/boundsCalculation';
import type { Individual } from '../../types/pedigree';
import { toRomanNumeral } from '../../utils/boundsCalculation';
import { LABEL_FONT_FAMILY, LABEL_COLOR } from '../../utils/constants';

interface BoundsLayerProps {
  bounds: CanvasBounds | null;
  individuals: Individual[];
}

export const BoundsLayer: React.FC<BoundsLayerProps> = React.memo(
  ({ bounds, individuals }) => {
    if (!bounds) return null;

    // Compute generation Y positions
    const genYMap = new Map<number, number[]>();
    for (const ind of individuals) {
      const gen = ind.generation ?? 0;
      if (!genYMap.has(gen)) genYMap.set(gen, []);
      genYMap.get(gen)!.push(ind.position.y);
    }

    const genLabels: { gen: number; y: number }[] = [];
    for (const [gen, ys] of genYMap) {
      const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
      genLabels.push({ gen, y: avgY });
    }
    genLabels.sort((a, b) => a.gen - b.gen);

    return (
      <>
        <Rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          stroke="#cccccc"
          strokeWidth={1}
          dash={[6, 4]}
          listening={false}
        />
        {genLabels.map(({ gen, y }) => (
          <Text
            key={`gen-${gen}`}
            x={bounds.x + 10}
            y={y - 7}
            text={toRomanNumeral(gen)}
            fontSize={14}
            fontFamily={LABEL_FONT_FAMILY}
            fontStyle="bold"
            fill={LABEL_COLOR}
            listening={false}
          />
        ))}
      </>
    );
  },
);

BoundsLayer.displayName = 'BoundsLayer';
```

**Step 3: Integrate into CanvasContainer**

In `CanvasContainer.tsx`:
- Import `computeBounds` and `BoundsLayer`
- Compute bounds from individuals: `const bounds = useMemo(() => computeBounds(individualsList), [individualsList]);`
- Render `<BoundsLayer bounds={bounds} individuals={individualsList} />` in the GridLayer's Layer (or a new Layer before the grid)

**Step 4: Update LegendLayer position**

In `LegendLayer.tsx`, accept an optional `bounds` prop. When bounds exist, position the legend at `bounds.x + 10, bounds.y + bounds.height - contentHeight - 10` instead of using `legendConfig.position`.

**Step 5: Verify**

Add individuals in multiple generations. A dashed rectangle should appear around the content. Roman numerals (I, II, etc.) should appear on the left edge. The legend should sit at the bottom-left of the rectangle.

---

## Task 8: Drag-to-link existing persons

**Files:**
- Modify: `src/stores/uiStore.ts`
- Create: `src/components/canvas/DragLinkLayer.tsx`
- Create: `src/components/ui/LinkTypePopup.tsx`
- Create: `src/components/ui/LinkTypePopup.module.css`
- Modify: `src/components/canvas/symbols/PedigreeSymbol.tsx`
- Modify: `src/components/canvas/CanvasContainer.tsx`
- Modify: `src/App.tsx`

**Step 1: Add dragLink state to uiStore**

In `src/stores/uiStore.ts`, add:

```ts
// In UIState interface:
dragLink: {
  active: boolean;
  sourceId: string | null;
  targetId: string | null;
  cursorPos: { x: number; y: number };
};
linkPopup: {
  visible: boolean;
  sourceId: string | null;
  targetId: string | null;
  screenPosition: { x: number; y: number };
};

startDragLink: (sourceId: string) => void;
updateDragLinkCursor: (pos: { x: number; y: number }) => void;
setDragLinkTarget: (targetId: string | null) => void;
endDragLink: () => void;
showLinkPopup: (sourceId: string, targetId: string, screenPos: { x: number; y: number }) => void;
hideLinkPopup: () => void;
```

Add initial state and actions in the store implementation.

**Step 2: Create DragLinkLayer.tsx**

A Konva `Line` (dashed) from source individual's position to cursor position, rendered during drag.

**Step 3: Create LinkTypePopup.tsx**

HTML overlay popup showing relationship type options:
- Partnership
- Consanguinity
- Parent-Child (source → target)
- Parent-Child (target → source)
- Adoption

On selection, creates the relationship using existing store actions and closes the popup.

**Step 4: Modify PedigreeSymbol.tsx for Alt+drag**

In the drag handlers:
- `onDragStart`: check if Alt key held. If yes, call `startDragLink(individual.id)` and prevent the default move behavior by cancelling the drag.
- `onMouseEnter`: if dragLink is active, call `setDragLinkTarget(individual.id)` to highlight this symbol as a drop target.
- `onMouseUp`: if dragLink is active and this is a valid target, call `showLinkPopup`.

**Step 5: Integrate in CanvasContainer and App**

- CanvasContainer: subscribe to `dragLink` state, render `DragLinkLayer`, track mouse position during drag
- App.tsx: render `LinkTypePopup`

**Step 6: Verify**

Create two individuals. Hold Alt and drag from one to the other. A dashed line should follow the cursor. On release, a popup appears with relationship type options. Select "Partnership" — a line should connect them.

---

## Verification Checklist (after all tasks)

Run: `npx tsc -b --noEmit && npx eslint . && npx vite build 2>&1 | tail -3`

Dev server functional tests:
- [ ] Toolbar stays visible when browser zoom changes
- [ ] Radial menu buttons are evenly spaced around the node center
- [ ] Creating parents assigns Man (left) and Woman (right) by default
- [ ] Legend entries have "Applies to" dropdown; gender-restricted entries only show for matching individuals
- [ ] Proband shows arrow + "P"; Consultand shows arrow only
- [ ] Individual numbers appear under each symbol (1, 2, 3 per generation)
- [ ] Generation roman numerals appear on left edge of canvas
- [ ] Bounded rectangle auto-expands around content with paper aspect ratio
- [ ] Legend sits at bottom-left of the bounded rectangle
- [ ] Alt+drag from one person to another shows link line, popup offers relationship types
- [ ] Zero console errors
