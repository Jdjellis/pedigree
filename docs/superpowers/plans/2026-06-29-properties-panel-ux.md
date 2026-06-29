# Properties Panel UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five dropdown controls in the Properties Panel with direct-click equivalents (icon button grid, segmented controls, colour swatches, quarter grid), reducing interaction cost for genetic counsellors.

**Architecture:** Two new pure presentational components (`SegmentedControl`, `GenderIconButtons`) live alongside `PropertiesPanel`; they receive props and fire callbacks, touching no stores themselves. The remaining changes (colour swatches, quarter grid) are inline JSX/CSS additions directly inside `PropertiesPanel`.

**Tech Stack:** React 19 + TypeScript, CSS Modules, Vitest 3 + `@testing-library/react` 16, `fireEvent` for click simulation (no `user-event` installed).

## Global Constraints

- Never `import ... from 'konva'` directly — it duplicates React and crashes with "Invalid hook call". (Not relevant to this plan but noted for awareness.)
- All Zustand subscriptions must live in `CanvasContainer.tsx` or other react-dom components. `PropertiesPanel` is react-dom, so Zustand usage there is fine.
- Never use `any` in TypeScript.
- Test command: `npm test` (runs `vitest run`).
- CSS custom properties in use: `--color-surface`, `--color-border`, `--color-primary`, `--color-text`, `--color-text-secondary`, `--color-danger`, `--radius-sm`, `--radius-md`.

---

### Task 1: `SegmentedControl` component

**Files:**
- Create: `src/components/ui/SegmentedControl.tsx`
- Create: `src/components/ui/SegmentedControl.module.css`
- Create: `src/components/ui/SegmentedControl.test.tsx`

**Interfaces:**
- Produces: `SegmentedControl<T extends string>({ options, value, onChange })` used by Tasks 3.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/SegmentedControl.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('SegmentedControl', () => {
  it('renders all option labels', () => {
    render(<SegmentedControl options={OPTIONS} value="a" onChange={() => {}} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('sets aria-pressed=true only on the active option', () => {
    render(<SegmentedControl options={OPTIONS} value="b" onChange={() => {}} />);
    expect(screen.getByText('Beta').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Alpha').closest('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Gamma').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the clicked option value', () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText('Gamma'));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('does not call onChange when the active option is clicked', () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText('Alpha'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose SegmentedControl
```

Expected: FAIL — "Cannot find module './SegmentedControl'"

- [ ] **Step 3: Create the CSS module**

Create `src/components/ui/SegmentedControl.module.css`:

```css
.segmented {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.segment {
  flex: 1;
  padding: 5px 6px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  color: var(--color-text);
  background: var(--color-surface);
  border: none;
  border-right: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.segment:last-child {
  border-right: none;
}

.segment:hover:not(.segmentActive) {
  background: color-mix(in srgb, var(--color-border) 50%, transparent);
}

.segmentActive {
  background: var(--color-primary);
  color: white;
}
```

- [ ] **Step 4: Create the component**

Create `src/components/ui/SegmentedControl.tsx`:

```tsx
import styles from './SegmentedControl.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className={styles.segmented} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.segment} ${opt.value === value ? styles.segmentActive : ''}`}
          aria-pressed={opt.value === value}
          onClick={() => {
            if (opt.value !== value) onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --reporter=verbose SegmentedControl
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/SegmentedControl.tsx src/components/ui/SegmentedControl.module.css src/components/ui/SegmentedControl.test.tsx
git commit -m "feat: add SegmentedControl component with tests"
```

---

### Task 2: `GenderIconButtons` component

**Files:**
- Create: `src/components/ui/GenderIconButtons.tsx`
- Create: `src/components/ui/GenderIconButtons.module.css`
- Create: `src/components/ui/GenderIconButtons.test.tsx`

**Interfaces:**
- Consumes: `GenderIdentity` enum from `../../types/enums`
- Produces: `GenderIconButtons({ value, onChange })` used by Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/GenderIconButtons.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GenderIconButtons } from './GenderIconButtons';
import { GenderIdentity } from '../../types/enums';

describe('GenderIconButtons', () => {
  it('renders a button for each gender identity option', () => {
    render(<GenderIconButtons value={GenderIdentity.Unknown} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Man' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Woman' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Non-binary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unknown' })).toBeInTheDocument();
  });

  it('marks the active option with aria-pressed=true', () => {
    render(<GenderIconButtons value={GenderIdentity.Woman} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Woman' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Man' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the clicked GenderIdentity value', () => {
    const onChange = vi.fn();
    render(<GenderIconButtons value={GenderIdentity.Unknown} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Non-binary' }));
    expect(onChange).toHaveBeenCalledWith(GenderIdentity.NonBinary);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose GenderIconButtons
```

Expected: FAIL — "Cannot find module './GenderIconButtons'"

- [ ] **Step 3: Create the CSS module**

Create `src/components/ui/GenderIconButtons.module.css`:

```css
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.iconButton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.1s, color 0.1s;
  color: var(--color-text-secondary);
}

.iconButton:hover:not(.iconButtonActive) {
  border-color: var(--color-text-secondary);
  color: var(--color-text);
}

.iconButtonActive {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.iconLabel {
  font-size: 11px;
  font-weight: 500;
}
```

- [ ] **Step 4: Create the component**

Create `src/components/ui/GenderIconButtons.tsx`:

```tsx
import type { ReactElement } from 'react';
import { GenderIdentity } from '../../types/enums';
import styles from './GenderIconButtons.module.css';

const SYMBOL_SIZE = 26;

function SquareSymbol() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="3" y="3" width="22" height="22" rx="1" stroke="currentColor" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

function CircleSymbol() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

function DiamondSymbol() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 28 28" aria-hidden="true">
      <polygon points="14,3 25,14 14,25 3,14" stroke="currentColor" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

function UnknownSymbol() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="3" y="3" width="22" height="22" rx="1" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="4 3" />
    </svg>
  );
}

interface GenderOption {
  value: GenderIdentity;
  label: string;
  Symbol: () => ReactElement;
}

const GENDER_OPTIONS: GenderOption[] = [
  { value: GenderIdentity.Man, label: 'Man', Symbol: SquareSymbol },
  { value: GenderIdentity.Woman, label: 'Woman', Symbol: CircleSymbol },
  { value: GenderIdentity.NonBinary, label: 'Non-binary', Symbol: DiamondSymbol },
  { value: GenderIdentity.Unknown, label: 'Unknown', Symbol: UnknownSymbol },
];

interface GenderIconButtonsProps {
  value: GenderIdentity;
  onChange: (value: GenderIdentity) => void;
}

export function GenderIconButtons({ value, onChange }: GenderIconButtonsProps) {
  return (
    <div className={styles.grid} role="group" aria-label="Gender identity">
      {GENDER_OPTIONS.map(({ value: opt, label, Symbol }) => (
        <button
          key={opt}
          type="button"
          className={`${styles.iconButton} ${opt === value ? styles.iconButtonActive : ''}`}
          aria-pressed={opt === value}
          aria-label={label}
          onClick={() => onChange(opt)}
        >
          <Symbol />
          <span className={styles.iconLabel}>{label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --reporter=verbose GenderIconButtons
```

Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/GenderIconButtons.tsx src/components/ui/GenderIconButtons.module.css src/components/ui/GenderIconButtons.test.tsx
git commit -m "feat: add GenderIconButtons component with pedigree SVG symbols"
```

---

### Task 3: Wire segmented controls — Vital Status + Pedigree Role

**Files:**
- Modify: `src/components/ui/PropertiesPanel.tsx`

**Interfaces:**
- Consumes: `SegmentedControl` from Task 1, `VitalStatus` enum

- [ ] **Step 1: Add constants and replace Vital Status select**

In `PropertiesPanel.tsx`, add the import and constants near the top of the file (after existing imports):

```tsx
import { SegmentedControl } from './SegmentedControl';
```

Add these constants directly above the `PropertiesPanel` function:

```tsx
const VITAL_STATUS_OPTIONS: { value: VitalStatus; label: string }[] = [
  { value: VitalStatus.Alive, label: 'Alive' },
  { value: VitalStatus.Deceased, label: 'Deceased' },
  { value: VitalStatus.Stillborn, label: 'Stillborn' },
];

type RoleValue = 'none' | 'proband' | 'consultand';

const ROLE_OPTIONS: { value: RoleValue; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'proband', label: 'Proband' },
  { value: 'consultand', label: 'Consultand' },
];
```

In the JSX, find the Vital Status section and replace the `<div className={styles.field}>` containing the `Status` label + `<select>` with:

```tsx
<div className={styles.field}>
  <label className={styles.label}>Status</label>
  <SegmentedControl
    options={VITAL_STATUS_OPTIONS}
    value={individual.vitalStatus}
    onChange={(v) => update({ vitalStatus: v })}
  />
</div>
```

- [ ] **Step 2: Replace Pedigree Role select**

In the JSX, find the Pedigree Role section and replace the `<div className={styles.field}>` containing the `Role` label + `<select>` with:

```tsx
<div className={styles.field}>
  <label className={styles.label}>Role</label>
  <SegmentedControl
    options={ROLE_OPTIONS}
    value={
      individual.isProband
        ? 'proband'
        : individual.isConsultand
          ? 'consultand'
          : 'none'
    }
    onChange={(v) =>
      update({
        isProband: v === 'proband',
        isConsultand: v === 'consultand',
      })
    }
  />
</div>
```

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
npm test
```

Expected: All previously passing tests still pass.

- [ ] **Step 4: Manually verify in the browser**

Start the dev server (`npm run dev`). Select an individual. Confirm:
- Vital Status shows three bordered buttons (Alive / Deceased / Stillborn); the active one is filled with the primary colour.
- Clicking Deceased makes that button active and reveals the Cause of Death input below.
- Pedigree Role shows three buttons (None / Proband / Consultand); clicking each toggles correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PropertiesPanel.tsx
git commit -m "feat: replace Vital Status and Pedigree Role dropdowns with segmented controls"
```

---

### Task 4: Wire Gender Identity icon buttons

**Files:**
- Modify: `src/components/ui/PropertiesPanel.tsx`

**Interfaces:**
- Consumes: `GenderIconButtons` from Task 2

- [ ] **Step 1: Import and replace the Gender Identity select**

Add the import at the top of `PropertiesPanel.tsx`:

```tsx
import { GenderIconButtons } from './GenderIconButtons';
```

In the JSX, find the Identity section. Replace the `<div className={styles.field}>` containing the `Gender Identity` label + `<select>` with:

```tsx
<div className={styles.field}>
  <label className={styles.label}>Gender Identity</label>
  <GenderIconButtons
    value={individual.genderIdentity}
    onChange={(v) => update({ genderIdentity: v })}
  />
</div>
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 3: Manually verify in the browser**

Select an individual. Confirm:
- The Gender Identity field shows a 2×2 grid of icon buttons: square (Man), circle (Woman), diamond (Non-binary), dashed-square (Unknown).
- The currently-set identity has a primary-colour border.
- Clicking each button updates the symbol on the canvas immediately (since `genderIdentity` drives symbol shape).
- The SAAB `<select>` directly below is unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/PropertiesPanel.tsx
git commit -m "feat: replace Gender Identity dropdown with pedigree symbol icon buttons"
```

---

### Task 5: Colour swatch picker in Add Condition form

**Files:**
- Modify: `src/components/ui/PropertiesPanel.tsx`
- Modify: `src/components/ui/PropertiesPanel.module.css`

**Interfaces:**
- Consumes: `COLOR_OPTIONS` (already imported from `./legendOptions`); shape `{ value: string; label: string }[]`

- [ ] **Step 1: Add CSS for swatch row**

Append to `PropertiesPanel.module.css`:

```css
/* ── Add Condition: colour swatches ───────────────── */
.swatchRow {
  display: flex;
  gap: 8px;
  align-items: center;
}

.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  outline: 2px solid transparent;
  outline-offset: 2px;
  cursor: pointer;
  transition: outline-color 0.1s;
  padding: 0;
  flex-shrink: 0;
}

.swatchActive {
  outline-color: var(--color-primary);
}
```

- [ ] **Step 2: Replace the colour select in the Add Condition form**

In `PropertiesPanel.tsx`, find the Add Condition form block (inside `{addingCondition ? ...}`). Locate the `<div className={styles.field}>` with the `Color` label and its `<select>`. Replace it with:

```tsx
<div className={styles.field}>
  <label className={styles.label}>Color</label>
  <div className={styles.swatchRow}>
    {COLOR_OPTIONS.map((c) => (
      <button
        key={c.value}
        type="button"
        className={`${styles.swatch} ${conditionColor === c.value ? styles.swatchActive : ''}`}
        style={{ backgroundColor: c.value }}
        aria-label={c.label}
        aria-pressed={conditionColor === c.value}
        onClick={() => setConditionColor(c.value)}
      />
    ))}
  </div>
</div>
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Manually verify in the browser**

Click "+ Add Condition" in the panel. Confirm:
- Four coloured circles appear (black, red, green, blue).
- The initially selected swatch has a primary-colour ring.
- Clicking each swatch highlights it and clears the ring from the previous one.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PropertiesPanel.tsx src/components/ui/PropertiesPanel.module.css
git commit -m "feat: replace condition colour dropdown with visual swatch picker"
```

---

### Task 6: Quarter selector grid in Add Condition form

**Files:**
- Modify: `src/components/ui/PropertiesPanel.tsx`
- Modify: `src/components/ui/PropertiesPanel.module.css`

**Interfaces:**
- Consumes: `QUARTER_OPTIONS` (already imported from `./legendOptions`); shape `{ value: QuarterPosition; label: string }[]`

- [ ] **Step 1: Add CSS for the quarter grid**

Append to `PropertiesPanel.module.css`:

```css
/* ── Add Condition: quarter grid ─────────────────── */
.quarterField {
  display: flex;
  align-items: center;
  gap: 10px;
}

.quarterGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 3px;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

.quarterCell {
  border-radius: 3px;
  background: var(--color-border);
  border: none;
  cursor: pointer;
  transition: background 0.1s;
}

.quarterCell:hover:not(.quarterCellActive) {
  background: color-mix(in srgb, var(--color-text-secondary) 40%, transparent);
}

.quarterCellActive {
  background: var(--color-primary);
}

.quarterLabel {
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}
```

- [ ] **Step 2: Add a spatial render order constant and replace the quarter select**

In `PropertiesPanel.tsx`, add this constant directly above the `PropertiesPanel` function (alongside the existing `QUARTER_LABELS` constant):

```tsx
// Render order matches the 2×2 CSS grid: TL → TR → BL → BR (left-to-right, top-to-bottom)
const QUARTER_GRID_ORDER: QuarterPosition[] = [
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
];
```

In the Add Condition form, locate the `<div className={styles.field}>` with the `Quarter` label and its `<select>`. Replace it entirely with:

```tsx
<div className={styles.field}>
  <label className={styles.label}>Quarter</label>
  <div className={styles.quarterField}>
    <div className={styles.quarterGrid} role="group" aria-label="Symbol quarter">
      {QUARTER_GRID_ORDER.map((q) => {
        const option = QUARTER_OPTIONS.find((o) => o.value === q)!;
        return (
          <button
            key={q}
            type="button"
            className={`${styles.quarterCell} ${conditionQuarter === q ? styles.quarterCellActive : ''}`}
            aria-label={option.label}
            aria-pressed={conditionQuarter === q}
            onClick={() => setConditionQuarter(q)}
          />
        );
      })}
    </div>
    <span className={styles.quarterLabel}>
      {QUARTER_OPTIONS.find((o) => o.value === conditionQuarter)?.label}
    </span>
  </div>
</div>
```

The `<span>` alongside the grid shows the name of the currently selected quarter (e.g. "Top-Left"), so the spatial layout and the text label are both present.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Manually verify in the browser**

Click "+ Add Condition". Confirm:
- A 2×2 grid of small cells appears where the Quarter dropdown was.
- The initially selected cell (top-right, matching `QUARTER_OPTIONS[0].value`) is highlighted in the primary colour.
- Clicking any cell highlights it, clears the previous, and the text label beside the grid updates accordingly.
- The quarter chosen here is correctly applied when the condition is submitted.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PropertiesPanel.tsx src/components/ui/PropertiesPanel.module.css
git commit -m "feat: replace condition quarter dropdown with spatial 2×2 grid selector"
```
