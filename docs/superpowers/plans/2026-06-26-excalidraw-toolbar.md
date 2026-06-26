# Excalidraw-style Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pedigree editor's floating tool island with an Excalidraw-style icon toolbar (lock, hand, select, sex-specific person tools, partnership, text, eraser) and fix the underlying interaction model so the select tool draws a marquee instead of panning.

**Architecture:** The active tool — held in `uiStore` — decides what a pointer-down on empty canvas means, instead of the Konva `Stage` being unconditionally `draggable`. All new pointer logic lives in plain store-operating modules (`toolPlacement.ts`, `marqueeSelection.ts`, `partnershipTool.ts`, `eraserTool.ts`) that are unit-tested against the real Zustand stores, mirroring the existing `symbolDrag.ts` pattern, because react-konva cannot render under jsdom. The `ToolIsland` is plain react-dom HTML/CSS and is tested with `@testing-library/react`.

**Tech Stack:** React 19, TypeScript, Vite, react-konva 19, Zustand 5 (+ zundo temporal), Vitest + jsdom, `@testing-library/react`, `lucide-react` (new), `clsx`.

## Global Constraints

- TypeScript: never use `any`; type-annotate every function signature; JSDoc every exported interface/function. (CLAUDE.md)
- Tests first (TDD): write the failing test, watch it fail, implement minimally, watch it pass, commit. (CLAUDE.md)
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. One logical change per commit. (CLAUDE.md)
- Run `npm test` before every commit; it must pass. (CLAUDE.md)
- Never `import ... from 'konva'` directly — it dupes React and crashes with "Invalid hook call". Use `import type Konva from 'konva'` and `import type { KonvaEventObject } from 'konva/lib/Node'` only. (project memory: konva-import-gotcha)
- react-konva cannot render under vitest/jsdom (no canvas → Stage throws). Extract canvas logic into store-operating modules and unit-test those. (project memory: react-konva-jsdom-testing)
- Any change to on-canvas rendered output must be mirrored in `src/io/svgExport.ts`, the testable parallel renderer. (project memory: svgexport-mirrors-konva) — *No task here changes symbol/label rendering, so no svgExport change is expected; flag it if that turns out false.*
- Zustand subscriptions inside react-konva components silently fail to repaint. Read store state with `useXStore.getState()` inside Konva event handlers; keep reactive `useXStore(selector)` subscriptions in `CanvasContainer` (react-dom). (project memory: react-konva + Zustand)
- `screenToCanvas` expects stage-local coordinates (0,0 = top-left of the `.konvajs-content` stage element), not window coords. (project memory: symbol placement)
- Test command for a single file: `npx vitest run <path>`. Full suite: `npm test`.

---

## File map

**Create:**
- `src/components/canvas/toolPlacement.ts` — pure placement helpers (sex person + text) operating the stores.
- `src/components/canvas/toolPlacement.test.ts`
- `src/components/canvas/marqueeSelection.ts` — pure marquee geometry (normalize rect, intersect boxes).
- `src/components/canvas/marqueeSelection.test.ts`
- `src/components/canvas/partnershipTool.ts` — create a partnership between two ids.
- `src/components/canvas/partnershipTool.test.ts`
- `src/components/canvas/eraserTool.ts` — delete an element by id (routes to the store's cascading removers).
- `src/components/canvas/eraserTool.test.ts`
- `src/components/ui/islands/ToolButton.tsx` — single toolbar button (icon + optional number badge + active state).
- `src/components/ui/islands/ToolIsland.test.tsx`
- `src/components/ui/islands/toolDefs.tsx` — the ordered tool list (id, label, shortcut number, icon node).

**Modify:**
- `src/stores/uiStore.ts` — extend `ActiveTool`; add `toolLocked` + `partnershipAnchorId` state and actions.
- `src/stores/uiStore.test.ts` — cover the new state.
- `src/commands/useEditorActions.ts` — tool activators for every tool + lock toggle.
- `src/commands/editorActions.test.ts` — cover the new activators (if it tests `useEditorActions`; otherwise add coverage in a new test file noted per-task).
- `src/hooks/useKeyboardShortcuts.ts` — number + letter shortcuts for all tools; remove `p`.
- `src/components/ui/islands/ToolIsland.tsx` — rebuild with icons + badges.
- `src/components/ui/islands/islands.module.css` — toolbar button sizing, badge, divider.
- `src/components/canvas/CanvasContainer.tsx` — per-tool pointer routing: sex placement, marquee, hand-pan, text/partnership/eraser.
- `src/components/canvas/CanvasContainer.module.css` — per-tool cursors via `[data-tool="…"]`.
- `package.json` — add `lucide-react`.

---

# STAGE A — Toolbar shell, tool state, sex placement

Goal: the new tool model compiles, the new icon toolbar renders with badges, keyboard shortcuts switch tools, and clicking empty canvas with Male/Female/Unknown places the correct symbol. No marquee yet (select still pans — fixed in Stage B).

---

### Task A1: Extend tool state in uiStore

**Files:**
- Modify: `src/stores/uiStore.ts:3` (the `ActiveTool` type) and the store body.
- Test: `src/stores/uiStore.test.ts`

**Interfaces:**
- Produces:
  - `type ActiveTool = 'select' | 'hand' | 'male' | 'female' | 'unknown' | 'partnership' | 'text' | 'eraser'`
  - `toolLocked: boolean` (default `false`)
  - `toggleToolLocked: () => void`
  - `partnershipAnchorId: string | null` (default `null`)
  - `setPartnershipAnchor: (id: string | null) => void`
  - existing `setActiveTool: (tool: ActiveTool) => void` (unchanged signature, wider type)

- [ ] **Step 1: Write the failing test**

Append to `src/stores/uiStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore tool state', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeTool: 'select',
      toolLocked: false,
      partnershipAnchorId: null,
    });
  });

  it('switches the active tool to any of the new tool ids', () => {
    useUIStore.getState().setActiveTool('male');
    expect(useUIStore.getState().activeTool).toBe('male');
    useUIStore.getState().setActiveTool('eraser');
    expect(useUIStore.getState().activeTool).toBe('eraser');
  });

  it('toggles the tool lock on and off', () => {
    expect(useUIStore.getState().toolLocked).toBe(false);
    useUIStore.getState().toggleToolLocked();
    expect(useUIStore.getState().toolLocked).toBe(true);
    useUIStore.getState().toggleToolLocked();
    expect(useUIStore.getState().toolLocked).toBe(false);
  });

  it('sets and clears the partnership anchor', () => {
    useUIStore.getState().setPartnershipAnchor('ind-1');
    expect(useUIStore.getState().partnershipAnchorId).toBe('ind-1');
    useUIStore.getState().setPartnershipAnchor(null);
    expect(useUIStore.getState().partnershipAnchorId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/uiStore.test.ts`
Expected: FAIL — `toggleToolLocked`/`setPartnershipAnchor` are not functions, and TS errors on `'male'` not assignable to `ActiveTool`.

- [ ] **Step 3: Implement**

In `src/stores/uiStore.ts` change line 3:

```ts
export type ActiveTool =
  | 'select'
  | 'hand'
  | 'male'
  | 'female'
  | 'unknown'
  | 'partnership'
  | 'text'
  | 'eraser';
```

In the `UIState` interface, after `activeTool: ActiveTool;` (line 38) add:

```ts
  /** Whether placement tools stay active after one use (Excalidraw "lock"). */
  toolLocked: boolean;
  /**
   * The first individual clicked while the partnership tool is active, awaiting
   * a second click to complete the union. `null` when no anchor is pending.
   */
  partnershipAnchorId: string | null;
```

In the same interface, after `setActiveTool: (tool: ActiveTool) => void;` (line 78) add:

```ts
  /** Toggle whether placement tools stay active after use. */
  toggleToolLocked: () => void;
  /** Set or clear the pending partnership anchor individual. */
  setPartnershipAnchor: (id: string | null) => void;
```

In the store body, after `activeTool: 'select',` (line 127) add:

```ts
  toolLocked: false,
  partnershipAnchorId: null,
```

After the `setActiveTool` implementation (line 230) add:

```ts
  toggleToolLocked: () =>
    set((state) => ({ toolLocked: !state.toolLocked })),

  setPartnershipAnchor: (id) => set({ partnershipAnchorId: id }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/uiStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/uiStore.ts src/stores/uiStore.test.ts
git commit -m "feat: extend uiStore with new tool ids, lock, and partnership anchor"
```

---

### Task A2: Tool placement module (sex person)

**Files:**
- Create: `src/components/canvas/toolPlacement.ts`
- Test: `src/components/canvas/toolPlacement.test.ts`

**Interfaces:**
- Consumes: `useUIStore` (`activeTool`, `toolLocked`, `setActiveTool`, `select`), `usePedigreeStore` (`addIndividual`), `createDefaultIndividual`, `GenderIdentity`.
- Produces:
  - `genderForTool(tool: ActiveTool): GenderIdentity | null` — `'male'→Man`, `'female'→Woman`, `'unknown'→Unknown`, else `null`.
  - `placePersonAt(tool: ActiveTool, position: { x: number; y: number }): string | null` — creates an individual of that sex at the rounded canvas position, selects it, reverts the tool to `'select'` unless `toolLocked`, and returns the new id (or `null` if `tool` is not a person tool).

- [ ] **Step 1: Write the failing test**

Create `src/components/canvas/toolPlacement.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { GenderIdentity } from '../../types/enums';
import { genderForTool, placePersonAt } from './toolPlacement';

describe('toolPlacement — sex person', () => {
  beforeEach(() => {
    usePedigreeStore.getState().resetDocument();
    useUIStore.setState({
      activeTool: 'male',
      toolLocked: false,
      selectedIds: new Set(),
    });
  });

  it('maps tool ids to gender identities', () => {
    expect(genderForTool('male')).toBe(GenderIdentity.Man);
    expect(genderForTool('female')).toBe(GenderIdentity.Woman);
    expect(genderForTool('unknown')).toBe(GenderIdentity.Unknown);
    expect(genderForTool('select')).toBeNull();
  });

  it('places a person of the right sex at the rounded position and selects it', () => {
    const id = placePersonAt('female', { x: 120.6, y: 80.2 });
    expect(id).not.toBeNull();
    const ind = usePedigreeStore.getState().document.individuals[id as string];
    expect(ind.genderIdentity).toBe(GenderIdentity.Woman);
    expect(ind.position).toEqual({ x: 121, y: 80 });
    expect(useUIStore.getState().selectedIds.has(id as string)).toBe(true);
  });

  it('reverts to select after placing when not locked', () => {
    placePersonAt('male', { x: 0, y: 0 });
    expect(useUIStore.getState().activeTool).toBe('select');
  });

  it('keeps the tool active after placing when locked', () => {
    useUIStore.setState({ toolLocked: true });
    placePersonAt('male', { x: 0, y: 0 });
    expect(useUIStore.getState().activeTool).toBe('male');
  });

  it('returns null and places nothing for a non-person tool', () => {
    const id = placePersonAt('select', { x: 0, y: 0 });
    expect(id).toBeNull();
    expect(Object.keys(usePedigreeStore.getState().document.individuals)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/canvas/toolPlacement.test.ts`
Expected: FAIL — module `./toolPlacement` does not exist.

- [ ] **Step 3: Implement**

Create `src/components/canvas/toolPlacement.ts`:

```ts
import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { useUIStore, type ActiveTool } from '../../stores/uiStore';
import { GenderIdentity } from '../../types/enums';

/**
 * Map a placement tool id to the gender identity it creates. Returns `null`
 * for any tool that is not a person-placement tool.
 */
export function genderForTool(tool: ActiveTool): GenderIdentity | null {
  switch (tool) {
    case 'male':
      return GenderIdentity.Man;
    case 'female':
      return GenderIdentity.Woman;
    case 'unknown':
      return GenderIdentity.Unknown;
    default:
      return null;
  }
}

/**
 * Place a new individual of the tool's sex at the given CANVAS-space position
 * (already converted from stage-local coords by the caller via `screenToCanvas`).
 * Coordinates are rounded to integers. Selects the new individual and reverts
 * the active tool to `'select'` unless the toolbar lock is engaged.
 *
 * @returns the new individual's id, or `null` when `tool` is not a person tool.
 */
export function placePersonAt(
  tool: ActiveTool,
  position: { x: number; y: number },
): string | null {
  const genderIdentity = genderForTool(tool);
  if (genderIdentity === null) return null;

  const individual = createDefaultIndividual({
    genderIdentity,
    position: { x: Math.round(position.x), y: Math.round(position.y) },
  });
  usePedigreeStore.getState().addIndividual(individual);

  const ui = useUIStore.getState();
  ui.select(individual.id);
  if (!ui.toolLocked) ui.setActiveTool('select');

  return individual.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/canvas/toolPlacement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/toolPlacement.ts src/components/canvas/toolPlacement.test.ts
git commit -m "feat: add sex-specific person placement module"
```

---

### Task A3: Editor action activators for every tool

**Files:**
- Modify: `src/commands/useEditorActions.ts` (the `EditorActions` interface lines 19-72 and the implementations lines 193-203 + the returned object lines 208-230).
- Test: `src/commands/useEditorActions.test.tsx` (create — renders the hook).

**Interfaces:**
- Consumes: `useUIStore` (`setActiveTool`, `toggleToolLocked`).
- Produces (on the `EditorActions` object): `selectTool()`, `handTool()`, `maleTool()`, `femaleTool()`, `unknownTool()`, `partnershipTool()`, `textTool()`, `eraserTool()`, `toggleToolLock()`. Removes `addPersonTool`.

- [ ] **Step 1: Write the failing test**

Create `src/commands/useEditorActions.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEditorActions } from './useEditorActions';
import { useUIStore } from '../stores/uiStore';

describe('useEditorActions tool activators', () => {
  beforeEach(() => {
    useUIStore.setState({ activeTool: 'select', toolLocked: false });
  });

  it('activates each tool', () => {
    const { result } = renderHook(() => useEditorActions());
    result.current.handTool();
    expect(useUIStore.getState().activeTool).toBe('hand');
    result.current.maleTool();
    expect(useUIStore.getState().activeTool).toBe('male');
    result.current.femaleTool();
    expect(useUIStore.getState().activeTool).toBe('female');
    result.current.unknownTool();
    expect(useUIStore.getState().activeTool).toBe('unknown');
    result.current.partnershipTool();
    expect(useUIStore.getState().activeTool).toBe('partnership');
    result.current.textTool();
    expect(useUIStore.getState().activeTool).toBe('text');
    result.current.eraserTool();
    expect(useUIStore.getState().activeTool).toBe('eraser');
    result.current.selectTool();
    expect(useUIStore.getState().activeTool).toBe('select');
  });

  it('toggles the tool lock', () => {
    const { result } = renderHook(() => useEditorActions());
    result.current.toggleToolLock();
    expect(useUIStore.getState().toolLocked).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/commands/useEditorActions.test.tsx`
Expected: FAIL — `maleTool` etc. are not functions.

- [ ] **Step 3: Implement**

In `src/commands/useEditorActions.ts`:

Replace the three tool docs/methods in the `EditorActions` interface (lines 66-71, `selectTool`/`handTool`/`addPersonTool`) with:

```ts
  /** Activate the select pointer tool. */
  selectTool: () => void;
  /** Activate the pan (hand) tool. */
  handTool: () => void;
  /** Activate the add-male (square) placement tool. */
  maleTool: () => void;
  /** Activate the add-female (circle) placement tool. */
  femaleTool: () => void;
  /** Activate the add-unknown-sex (diamond) placement tool. */
  unknownTool: () => void;
  /** Activate the partnership-line tool. */
  partnershipTool: () => void;
  /** Activate the text placement tool. */
  textTool: () => void;
  /** Activate the eraser tool. */
  eraserTool: () => void;
  /** Toggle whether placement tools stay active after use. */
  toggleToolLock: () => void;
```

Replace the implementations (lines 193-203, `selectTool`/`handTool`/`addPersonTool`) with:

```ts
  const selectTool = (): void => {
    useUIStore.getState().setActiveTool('select');
  };

  const handTool = (): void => {
    useUIStore.getState().setActiveTool('hand');
  };

  const maleTool = (): void => {
    useUIStore.getState().setActiveTool('male');
  };

  const femaleTool = (): void => {
    useUIStore.getState().setActiveTool('female');
  };

  const unknownTool = (): void => {
    useUIStore.getState().setActiveTool('unknown');
  };

  const partnershipTool = (): void => {
    useUIStore.getState().setActiveTool('partnership');
  };

  const textTool = (): void => {
    useUIStore.getState().setActiveTool('text');
  };

  const eraserTool = (): void => {
    useUIStore.getState().setActiveTool('eraser');
  };

  const toggleToolLock = (): void => {
    useUIStore.getState().toggleToolLocked();
  };
```

In the returned object (lines 208-230), remove `addPersonTool,` and add after `handTool,`:

```ts
      maleTool,
      femaleTool,
      unknownTool,
      partnershipTool,
      textTool,
      eraserTool,
      toggleToolLock,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/commands/useEditorActions.test.tsx`
Expected: PASS.

> Note: `addPersonTool` is now removed. If `npx vitest run` or `npm run build` reports other references (e.g. the ⌘K command registry), update them to `maleTool` in Task A6's build check. The `addPerson`/`addPersonAt`/`addText` *actions* are unchanged and still used by the command palette.

- [ ] **Step 5: Commit**

```bash
git add src/commands/useEditorActions.ts src/commands/useEditorActions.test.tsx
git commit -m "feat: add editor-action activators for all toolbar tools"
```

---

### Task A4: Keyboard shortcuts for all tools

**Files:**
- Modify: `src/hooks/useKeyboardShortcuts.ts` (the non-modifier `switch` at lines 86-126 and the JSDoc at lines 16-22).
- Test: `src/hooks/useKeyboardShortcuts.test.tsx` (create).

**Interfaces:**
- Consumes: `useUIStore.getState().setActiveTool`, `useUIStore.getState().toggleToolLocked`.
- Produces: key handlers — `1/v`→select, `2/m`→male, `3/f`→female, `4/u`→unknown, `5/r`→partnership, `6/t`→text, `7/e`→eraser, `h`→hand, `l`→toggle lock.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useKeyboardShortcuts.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useUIStore } from '../stores/uiStore';

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

describe('useKeyboardShortcuts tool switching', () => {
  beforeEach(() => {
    useUIStore.setState({ activeTool: 'select', toolLocked: false });
    renderHook(() => useKeyboardShortcuts());
  });

  it.each([
    ['1', 'select'],
    ['2', 'male'],
    ['3', 'female'],
    ['4', 'unknown'],
    ['5', 'partnership'],
    ['6', 'text'],
    ['7', 'eraser'],
    ['m', 'male'],
    ['f', 'female'],
    ['u', 'unknown'],
    ['r', 'partnership'],
    ['t', 'text'],
    ['e', 'eraser'],
    ['h', 'hand'],
    ['v', 'select'],
  ] as const)('key %s activates %s', (key, tool) => {
    useUIStore.setState({ activeTool: 'hand' });
    press(key);
    expect(useUIStore.getState().activeTool).toBe(tool);
  });

  it('toggles lock with l', () => {
    press('l');
    expect(useUIStore.getState().toolLocked).toBe(true);
  });
});
```

> Note: each `renderHook` call adds a listener; `beforeEach` re-rendering is fine because each handler reads/writes the same store. If duplicate listeners cause flakiness, switch to a single `renderHook` in a `beforeAll`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useKeyboardShortcuts.test.tsx`
Expected: FAIL — pressing `2` does not change the tool to `male`.

- [ ] **Step 3: Implement**

In `src/hooks/useKeyboardShortcuts.ts`, replace the `case 'v'`, `case 'h'`, and `case 'p'` blocks (lines 87-101) with:

```ts
        case '1':
        case 'v': {
          e.preventDefault();
          useUIStore.getState().setActiveTool('select');
          return;
        }
        case 'h': {
          e.preventDefault();
          useUIStore.getState().setActiveTool('hand');
          return;
        }
        case '2':
        case 'm': {
          e.preventDefault();
          useUIStore.getState().setActiveTool('male');
          return;
        }
        case '3':
        case 'f': {
          e.preventDefault();
          useUIStore.getState().setActiveTool('female');
          return;
        }
        case '4':
        case 'u': {
          e.preventDefault();
          useUIStore.getState().setActiveTool('unknown');
          return;
        }
        case '5':
        case 'r': {
          e.preventDefault();
          useUIStore.getState().setActiveTool('partnership');
          return;
        }
        case '6':
        case 't': {
          e.preventDefault();
          useUIStore.getState().setActiveTool('text');
          return;
        }
        case '7':
        case 'e': {
          e.preventDefault();
          useUIStore.getState().setActiveTool('eraser');
          return;
        }
        case 'l': {
          e.preventDefault();
          useUIStore.getState().toggleToolLocked();
          return;
        }
```

Update the JSDoc block (lines 16-22) to list the new bindings:

```ts
 * - 1/V select, 2/M male, 3/F female, 4/U unknown, 5/R partnership,
 *   6/T text, 7/E eraser, H hand, L toggle tool-lock
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useKeyboardShortcuts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/hooks/useKeyboardShortcuts.test.tsx
git commit -m "feat: add number and letter tool shortcuts"
```

---

### Task A5: Rebuild ToolIsland with icons and badges

**Files:**
- Add dependency: `package.json` (`lucide-react`).
- Create: `src/components/ui/islands/toolDefs.tsx`
- Create: `src/components/ui/islands/ToolButton.tsx`
- Modify: `src/components/ui/islands/ToolIsland.tsx`
- Modify: `src/components/ui/islands/islands.module.css`
- Test: `src/components/ui/islands/ToolIsland.test.tsx`

**Interfaces:**
- Consumes: `useUIStore` (`activeTool`, `toolLocked`), `useEditorActions` (all tool activators + `toggleToolLock`).
- Produces:
  - `toolDefs.tsx`: `interface ToolDef { id: ActiveTool; label: string; shortcut: string; icon: React.ReactNode; }` and `const PLACEMENT_TOOLS: ToolDef[]` in display order: select(1), male(2), female(3), unknown(4), partnership(5), text(6), eraser(7). Plus exported `SquareIcon`, `CircleIcon`, `DiamondIcon` (inline SVG sex symbols).
  - `ToolButton.tsx`: `function ToolButton(props: { label: string; shortcut?: string; icon: React.ReactNode; active: boolean; onClick: () => void }): React.JSX.Element`.

- [ ] **Step 1: Add the dependency**

Run:

```bash
npm install lucide-react
```

Expected: `package.json` gains `"lucide-react"` under dependencies; lockfile updates.

- [ ] **Step 2: Write the failing test**

Create `src/components/ui/islands/ToolIsland.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ToolIsland } from './ToolIsland';
import { useUIStore } from '../../../stores/uiStore';

describe('ToolIsland', () => {
  beforeEach(() => {
    cleanup();
    useUIStore.setState({ activeTool: 'select', toolLocked: false });
  });

  it('renders a button for each tool plus lock and hand', () => {
    render(<ToolIsland />);
    for (const label of [
      'Lock', 'Hand', 'Select', 'Add male', 'Add female',
      'Add unknown sex', 'Partnership', 'Text', 'Eraser',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the active tool pressed', () => {
    useUIStore.setState({ activeTool: 'male' });
    render(<ToolIsland />);
    expect(screen.getByRole('button', { name: 'Add male' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('activates a tool on click', () => {
    render(<ToolIsland />);
    screen.getByRole('button', { name: 'Add female' }).click();
    expect(useUIStore.getState().activeTool).toBe('female');
  });

  it('reflects the lock toggle state', () => {
    useUIStore.setState({ toolLocked: true });
    render(<ToolIsland />);
    expect(screen.getByRole('button', { name: 'Lock' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/ui/islands/ToolIsland.test.tsx`
Expected: FAIL — buttons named `Add male` etc. don't exist yet.

- [ ] **Step 4: Implement the sex-symbol icons and tool defs**

Create `src/components/ui/islands/toolDefs.tsx`:

```tsx
import { MousePointer2, Minus, Type, Eraser } from 'lucide-react';
import type { ActiveTool } from '../../../stores/uiStore';

/** A single placeable tool's display metadata. */
export interface ToolDef {
  id: ActiveTool;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}

/** Outlined square — the pedigree symbol for a male individual. */
export function SquareIcon(): React.JSX.Element {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
      <rect x="1.5" y="1.5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Outlined circle — the pedigree symbol for a female individual. */
export function CircleIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Outlined diamond — the pedigree symbol for unknown sex. */
export function DiamondIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="4.5" y="4.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(45 9 9)" />
    </svg>
  );
}

/** Placeable tools, in toolbar display order, with their number shortcuts. */
export const PLACEMENT_TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: '1', icon: <MousePointer2 size={19} /> },
  { id: 'male', label: 'Add male', shortcut: '2', icon: <SquareIcon /> },
  { id: 'female', label: 'Add female', shortcut: '3', icon: <CircleIcon /> },
  { id: 'unknown', label: 'Add unknown sex', shortcut: '4', icon: <DiamondIcon /> },
  { id: 'partnership', label: 'Partnership', shortcut: '5', icon: <Minus size={19} /> },
  { id: 'text', label: 'Text', shortcut: '6', icon: <Type size={19} /> },
  { id: 'eraser', label: 'Eraser', shortcut: '7', icon: <Eraser size={19} /> },
];
```

- [ ] **Step 5: Implement the ToolButton**

Create `src/components/ui/islands/ToolButton.tsx`:

```tsx
import clsx from 'clsx';
import styles from './islands.module.css';

/** Props for {@link ToolButton}. */
export interface ToolButtonProps {
  /** Accessible label (also the tooltip text). */
  label: string;
  /** Shortcut number shown as a badge; omit for modal helpers (lock/hand). */
  shortcut?: string;
  /** Icon node to render. */
  icon: React.ReactNode;
  /** Whether this tool/toggle is currently active. */
  active: boolean;
  /** Click handler. */
  onClick: () => void;
}

/**
 * A single floating-toolbar button: an icon, an optional shortcut badge, and an
 * active (violet) state. Lives in the react-dom tree, so reactive store reads
 * are safe in the parent that renders it.
 */
export function ToolButton({
  label,
  shortcut,
  icon,
  active,
  onClick,
}: ToolButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={clsx(styles.toolButton, active && styles.buttonActive)}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
    >
      <span className={styles.toolIcon} aria-hidden="true">
        {icon}
      </span>
      {shortcut && <span className={styles.toolBadge} aria-hidden="true">{shortcut}</span>}
    </button>
  );
}
```

- [ ] **Step 6: Rebuild ToolIsland**

Replace the entire body of `src/components/ui/islands/ToolIsland.tsx`:

```tsx
import { Lock, Hand } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useEditorActions } from '../../../commands/useEditorActions';
import { Island } from './Island';
import { ToolButton } from './ToolButton';
import { PLACEMENT_TOOLS } from './toolDefs';
import styles from './islands.module.css';

/**
 * Floating tool-selection island: lock and hand helpers, then the placeable
 * tools (select, male, female, unknown, partnership, text, eraser) with number
 * shortcut badges. Reads `activeTool`/`toolLocked` reactively — safe here
 * because this component lives in the react-dom tree (not inside react-konva).
 */
export function ToolIsland(): React.JSX.Element {
  const activeTool = useUIStore((s) => s.activeTool);
  const toolLocked = useUIStore((s) => s.toolLocked);
  const actions = useEditorActions();

  const activators: Record<string, () => void> = {
    select: actions.selectTool,
    male: actions.maleTool,
    female: actions.femaleTool,
    unknown: actions.unknownTool,
    partnership: actions.partnershipTool,
    text: actions.textTool,
    eraser: actions.eraserTool,
  };

  return (
    <Island aria-label="Tools">
      <ToolButton
        label="Lock"
        icon={<Lock size={18} />}
        active={toolLocked}
        onClick={actions.toggleToolLock}
      />
      <span className={styles.toolDivider} aria-hidden="true" />
      <ToolButton
        label="Hand"
        icon={<Hand size={19} />}
        active={activeTool === 'hand'}
        onClick={actions.handTool}
      />
      {PLACEMENT_TOOLS.map((tool, i) => (
        <span key={tool.id} style={{ display: 'contents' }}>
          {(tool.id === 'male' || tool.id === 'partnership' || tool.id === 'text') && (
            <span className={styles.toolDivider} aria-hidden="true" />
          )}
          <ToolButton
            label={tool.label}
            shortcut={tool.shortcut}
            icon={tool.icon}
            active={activeTool === tool.id}
            onClick={activators[tool.id]}
          />
        </span>
      ))}
    </Island>
  );
}
```

- [ ] **Step 7: Add toolbar styles**

Append to `src/components/ui/islands/islands.module.css`:

```css
/** Vertical tool button: icon on top, shortcut badge underneath. */
.toolButton {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 40px;
  height: 48px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  transition: background-color 0.1s;
  position: relative;
}

.toolButton:hover {
  background: rgba(0, 0, 0, 0.06);
}

.toolButton:active {
  background: rgba(0, 0, 0, 0.1);
}

.toolIcon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
}

.toolBadge {
  font-size: 11px;
  line-height: 12px;
  color: var(--color-text-secondary);
}

.toolButton.buttonActive .toolBadge {
  color: var(--color-primary);
}

/** Thin vertical divider between tool groups. */
.toolDivider {
  width: 1px;
  align-self: stretch;
  margin: 6px 2px;
  background: var(--color-border, rgba(0, 0, 0, 0.1));
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/components/ui/islands/ToolIsland.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/components/ui/islands/
git commit -m "feat: rebuild ToolIsland with icons and shortcut badges"
```

---

### Task A6: Wire sex placement into the canvas + green build

**Files:**
- Modify: `src/components/canvas/CanvasContainer.tsx` (the `handleStageClick` callback lines 246-277; `data-tool` already present).
- Modify: `src/components/canvas/CanvasContainer.module.css` (per-tool cursors).

**Interfaces:**
- Consumes: `placePersonAt` from `./toolPlacement` (note: `CanvasContainer.tsx` is in `src/components/canvas/`, so the import is `'./toolPlacement'`), `genderForTool`.

- [ ] **Step 1: Replace the placement branch in handleStageClick**

In `src/components/canvas/CanvasContainer.tsx` add to the imports near line 23:

```ts
import { placePersonAt, genderForTool } from './toolPlacement';
```

Replace the body of `handleStageClick` (lines 246-277) with:

```ts
    const handleStageClick = useCallback(
      (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (!clickedOnEmpty) return;

        // Read activeTool via getState() to avoid stale-closure issues —
        // consistent with the existing pattern in this file (no Zustand hook
        // subscriptions inside react-konva handlers).
        const currentTool = useUIStore.getState().activeTool;

        if (genderForTool(currentTool) !== null) {
          const stage = stageRef.current;
          if (!stage) return;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          const canvasPos = useViewportStore.getState().screenToCanvas(pointer);
          placePersonAt(currentTool, canvasPos);
        } else if (currentTool === 'select') {
          clearSelection();
        }
      },
      [clearSelection],
    );
```

> `createDefaultIndividual` is no longer used directly in this file's placement branch. Leave its import if other code in the file uses it; if `npm run build` flags it as unused, remove it from the line-15 import.

- [ ] **Step 2: Add per-tool cursors**

Append to `src/components/canvas/CanvasContainer.module.css`:

```css
.container[data-tool='male'],
.container[data-tool='female'],
.container[data-tool='unknown'],
.container[data-tool='text'] {
  cursor: crosshair;
}

.container[data-tool='hand'] {
  cursor: grab;
}

.container[data-tool='eraser'] {
  cursor: cell;
}
```

- [ ] **Step 3: Verify the whole build and suite are green**

Run: `npm run build`
Expected: PASS (no TypeScript errors). If it reports a dangling reference to the removed `'pan'` / `'addIndividual'` / `addPersonTool`, fix each call site to the new id (`'hand'` / a sex tool / `maleTool`), then re-run.

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/CanvasContainer.tsx src/components/canvas/CanvasContainer.module.css
git commit -m "feat: place sex-specific symbols on canvas click"
```

---

# STAGE B — Selection/tool-routing refactor + marquee

Goal: the Stage no longer pans by default; the hand tool (and space/middle-mouse) pan; the select tool drags a rectangular marquee that multi-selects.

---

### Task B1: Marquee geometry module

**Files:**
- Create: `src/components/canvas/marqueeSelection.ts`
- Test: `src/components/canvas/marqueeSelection.test.ts`

**Interfaces:**
- Produces:
  - `interface Rect { x: number; y: number; width: number; height: number }`
  - `interface NodeBox { id: string; x: number; y: number; width: number; height: number }` (`x,y` = top-left, canvas space)
  - `marqueeRect(start: { x: number; y: number }, current: { x: number; y: number }): Rect` — normalizes two corner points into a positive-size rect.
  - `idsIntersectingMarquee(rect: Rect, boxes: NodeBox[]): string[]` — ids whose box overlaps `rect` (touching edges counts as overlap).

- [ ] **Step 1: Write the failing test**

Create `src/components/canvas/marqueeSelection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { marqueeRect, idsIntersectingMarquee } from './marqueeSelection';

describe('marqueeRect', () => {
  it('normalizes a bottom-right drag', () => {
    expect(marqueeRect({ x: 10, y: 20 }, { x: 40, y: 60 })).toEqual({
      x: 10, y: 20, width: 30, height: 40,
    });
  });

  it('normalizes a top-left drag into a positive-size rect', () => {
    expect(marqueeRect({ x: 40, y: 60 }, { x: 10, y: 20 })).toEqual({
      x: 10, y: 20, width: 30, height: 40,
    });
  });
});

describe('idsIntersectingMarquee', () => {
  const boxes = [
    { id: 'a', x: 0, y: 0, width: 40, height: 40 },
    { id: 'b', x: 100, y: 100, width: 40, height: 40 },
    { id: 'c', x: 200, y: 0, width: 40, height: 40 },
  ];

  it('returns ids whose box overlaps the rect', () => {
    const rect = { x: -10, y: -10, width: 130, height: 130 };
    expect(idsIntersectingMarquee(rect, boxes).sort()).toEqual(['a', 'b']);
  });

  it('returns empty when nothing overlaps', () => {
    expect(idsIntersectingMarquee({ x: 500, y: 500, width: 10, height: 10 }, boxes)).toEqual([]);
  });

  it('counts edge-touching as overlap', () => {
    // rect right edge at x=0 touches box 'a' left edge at x=0
    expect(idsIntersectingMarquee({ x: -10, y: 0, width: 10, height: 40 }, boxes)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/canvas/marqueeSelection.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/components/canvas/marqueeSelection.ts`:

```ts
/** An axis-aligned rectangle in canvas space (top-left origin). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A selectable node's bounding box in canvas space (top-left origin). */
export interface NodeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Normalize two drag-corner points into a positive-size rectangle, regardless
 * of drag direction.
 */
export function marqueeRect(
  start: { x: number; y: number },
  current: { x: number; y: number },
): Rect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

/**
 * Return the ids of every box that overlaps `rect`. Edge-touching counts as
 * overlap (inclusive bounds), matching Excalidraw's marquee behavior.
 */
export function idsIntersectingMarquee(rect: Rect, boxes: NodeBox[]): string[] {
  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;
  return boxes
    .filter((box) => {
      const boxRight = box.x + box.width;
      const boxBottom = box.y + box.height;
      return (
        box.x <= rectRight &&
        boxRight >= rect.x &&
        box.y <= rectBottom &&
        boxBottom >= rect.y
      );
    })
    .map((box) => box.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/canvas/marqueeSelection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/marqueeSelection.ts src/components/canvas/marqueeSelection.test.ts
git commit -m "feat: add marquee selection geometry module"
```

---

### Task B2: Route panning + marquee through the active tool

**Files:**
- Modify: `src/components/canvas/CanvasContainer.tsx` — the `isDraggable` constant (line 302), the `PedigreeSymbol` `panMode` prop (line 397), and add marquee pointer handlers + a marquee `<Rect>` in the `selection` layer (line 410).

**Interfaces:**
- Consumes: `marqueeRect`, `idsIntersectingMarquee`, `NodeBox` from `./marqueeSelection`; `SYMBOL_SIZE` from `../../utils/constants`; `Rect as KonvaRect` via react-konva.

> Konva pointer wiring cannot be unit-tested under jsdom; the geometry it relies on is covered by Task B1. Verify this task manually via the dev server (see Step 5).

- [ ] **Step 1: Make panning tool-gated**

In `src/components/canvas/CanvasContainer.tsx`, replace the `isDraggable` constant and its comment (lines 299-302) with:

```ts
    // Pan by dragging only when the hand tool is active or space is held. In
    // every other tool, dragging empty canvas is free for marquee / placement.
    const isDraggable = activeTool === 'hand' || isSpaceHeld;
```

Update the `PedigreeSymbol` `panMode` prop (line 397) so symbol dragging is also suspended under the hand tool:

```tsx
                  panMode={isSpaceHeld || activeTool === 'hand'}
```

- [ ] **Step 2: Add marquee state and handlers**

Add `Rect` to the react-konva import (line 10):

```ts
import { Stage, Layer, Rect } from 'react-konva';
```

Add imports near line 23:

```ts
import {
  marqueeRect,
  idsIntersectingMarquee,
  type NodeBox,
} from './marqueeSelection';
import { SYMBOL_SIZE } from '../../utils/constants';
```

Add marquee component state near the other `useState` hooks (after line 50):

```ts
    // Marquee drag in canvas space (select tool only); null when not dragging.
    const [marquee, setMarquee] = useState<
      { start: { x: number; y: number }; current: { x: number; y: number } } | null
    >(null);
```

Add these handlers near the other stage handlers (after `handleStageMouseUp`, ~line 297):

```ts
    const handleMarqueeDown = useCallback(
      (e: KonvaEventObject<MouseEvent>) => {
        if (useUIStore.getState().activeTool !== 'select') return;
        if (e.target !== e.target.getStage()) return; // only on empty canvas
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const pos = useViewportStore.getState().screenToCanvas(pointer);
        setMarquee({ start: pos, current: pos });
      },
      [],
    );

    const handleMarqueeMove = useCallback(() => {
      setMarquee((prev) => {
        if (!prev) return prev;
        const stage = stageRef.current;
        if (!stage) return prev;
        const pointer = stage.getPointerPosition();
        if (!pointer) return prev;
        const pos = useViewportStore.getState().screenToCanvas(pointer);
        return { ...prev, current: pos };
      });
    }, []);

    const handleMarqueeUp = useCallback(() => {
      setMarquee((prev) => {
        if (!prev) return null;
        const rect = marqueeRect(prev.start, prev.current);
        // Build node boxes in canvas space. Individual `position` is the symbol
        // CENTRE, so expand by half SYMBOL_SIZE. (Verify against PedigreeSymbol's
        // Group offset if selections feel misaligned.)
        const half = SYMBOL_SIZE / 2;
        const boxes: NodeBox[] = Object.values(
          usePedigreeStore.getState().document.individuals,
        ).map((ind) => ({
          id: ind.id,
          x: ind.position.x - half,
          y: ind.position.y - half,
          width: SYMBOL_SIZE,
          height: SYMBOL_SIZE,
        }));
        const ids = idsIntersectingMarquee(rect, boxes);
        const ui = useUIStore.getState();
        if (ids.length > 0) ui.selectMultiple(ids);
        else ui.clearSelection();
        return null;
      });
    }, []);
```

- [ ] **Step 3: Wire the handlers and draw the marquee rect**

On the `<Stage>` element (lines 352-369), add three props alongside the existing handlers:

```tsx
            onMouseDown={handleMarqueeDown}
            onMouseMove={(e) => {
              handleStageMouseMove(e);
              handleMarqueeMove();
            }}
            onMouseUp={() => {
              handleStageMouseUp();
              handleMarqueeUp();
            }}
```

Remove the now-duplicated standalone `onMouseMove={handleStageMouseMove}` and `onMouseUp={handleStageMouseUp}` props from the Stage so each event has a single handler.

Replace the empty selection layer (`<Layer name="selection" />`, line 410) with a marquee-drawing layer:

```tsx
            <Layer name="selection" listening={false}>
              {marquee && (
                <Rect
                  {...marqueeRect(marquee.start, marquee.current)}
                  fill="rgba(105, 101, 219, 0.12)"
                  stroke="#6965db"
                  strokeWidth={1}
                />
              )}
            </Layer>
```

- [ ] **Step 4: Verify build + suite**

Run: `npm run build`
Expected: PASS.

Run: `npm test`
Expected: PASS (no new unit tests here; existing suites still green).

- [ ] **Step 5: Manual verification (dev server)**

Run: `npm run dev`, then in the preview:
- With the Select tool, drag across empty canvas → a violet selection rectangle appears and, on release, every symbol it touched shows the selected outline.
- Drag a single symbol → it still moves; click a symbol → it selects; Shift+click another → both selected.
- Switch to the Hand tool (or hold Space) → dragging empty canvas pans. Middle-mouse drag and wheel/Cmd-wheel still pan/zoom under any tool.

Capture a screenshot of an active marquee for the PR.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/CanvasContainer.tsx
git commit -m "feat: marquee-select on drag; pan only with hand tool or space"
```

---

# STAGE C — Text, partnership, and eraser tools

---

### Task C1: Text placement tool

**Files:**
- Modify: `src/components/canvas/toolPlacement.ts` — add `placeTextAt`.
- Modify: `src/components/canvas/toolPlacement.test.ts` — cover it.
- Modify: `src/components/canvas/CanvasContainer.tsx` — handle `'text'` in `handleStageClick`.

**Interfaces:**
- Consumes: `usePedigreeStore.addTextAnnotation`, `useUIStore.startEditingAnnotation`, `generateId`, `ANNOTATION_DEFAULT_FONT_SIZE`, `ANNOTATION_PLACEHOLDER_TEXT`.
- Produces: `placeTextAt(position: { x: number; y: number }): string` — creates an empty-placeholder text annotation at the rounded position, opens it in inline edit mode, reverts the tool to `'select'` unless locked, and returns the new annotation id.

- [ ] **Step 1: Write the failing test**

Append to `src/components/canvas/toolPlacement.test.ts`:

```ts
import { placeTextAt } from './toolPlacement';
import { ANNOTATION_PLACEHOLDER_TEXT } from '../../utils/constants';

describe('toolPlacement — text', () => {
  beforeEach(() => {
    usePedigreeStore.getState().resetDocument();
    useUIStore.setState({ activeTool: 'text', toolLocked: false });
  });

  it('places a placeholder annotation at the rounded position and edits it', () => {
    const id = placeTextAt({ x: 50.7, y: 30.2 });
    const ann = usePedigreeStore.getState().document.textAnnotations[id];
    expect(ann.text).toBe(ANNOTATION_PLACEHOLDER_TEXT);
    expect(ann.position).toEqual({ x: 51, y: 30 });
    expect(useUIStore.getState().editingAnnotationId).toBe(id);
  });

  it('reverts to select after placing when not locked', () => {
    placeTextAt({ x: 0, y: 0 });
    expect(useUIStore.getState().activeTool).toBe('select');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/canvas/toolPlacement.test.ts`
Expected: FAIL — `placeTextAt` is not exported.

- [ ] **Step 3: Implement**

Append to `src/components/canvas/toolPlacement.ts`:

```ts
import { generateId } from '../../utils/idGenerator';
import {
  ANNOTATION_DEFAULT_FONT_SIZE,
  ANNOTATION_PLACEHOLDER_TEXT,
} from '../../utils/constants';

/**
 * Place an empty-placeholder text annotation at the given CANVAS-space position
 * (rounded to integers), open it straight into inline edit mode, and revert the
 * active tool to `'select'` unless the toolbar lock is engaged.
 *
 * @returns the new annotation's id.
 */
export function placeTextAt(position: { x: number; y: number }): string {
  const annotation = {
    id: generateId(),
    text: ANNOTATION_PLACEHOLDER_TEXT,
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    fontSize: ANNOTATION_DEFAULT_FONT_SIZE,
  };
  usePedigreeStore.getState().addTextAnnotation(annotation);

  const ui = useUIStore.getState();
  ui.startEditingAnnotation(annotation.id);
  if (!ui.toolLocked) ui.setActiveTool('select');

  return annotation.id;
}
```

> Move the two new `import` lines to the top of the file with the other imports — JS hoists them, but keep imports grouped per project style.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/canvas/toolPlacement.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into the canvas**

In `src/components/canvas/CanvasContainer.tsx`, update the import to include `placeTextAt`:

```ts
import { placePersonAt, genderForTool, placeTextAt } from './toolPlacement';
```

In `handleStageClick`, add a branch before the `else if (currentTool === 'select')`:

```ts
        } else if (currentTool === 'text') {
          const stage = stageRef.current;
          if (!stage) return;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          const canvasPos = useViewportStore.getState().screenToCanvas(pointer);
          placeTextAt(canvasPos);
```

- [ ] **Step 6: Verify build + suite**

Run: `npm run build` then `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/canvas/toolPlacement.ts src/components/canvas/toolPlacement.test.ts src/components/canvas/CanvasContainer.tsx
git commit -m "feat: add text placement tool"
```

---

### Task C2: Partnership-line tool

**Files:**
- Create: `src/components/canvas/partnershipTool.ts`
- Test: `src/components/canvas/partnershipTool.test.ts`
- Modify: `src/components/canvas/symbols/PedigreeSymbol.tsx` — in `handleClick` (lines 251-264), route clicks to the anchor flow when the partnership tool is active.

**Interfaces:**
- Consumes: `usePedigreeStore.addPartnership`, `generateId`, `RelationshipType.Partnership`, `useUIStore` (`partnershipAnchorId`, `setPartnershipAnchor`).
- Produces:
  - `createPartnershipBetween(partner1Id: string, partner2Id: string): string` — adds a `RelationshipType.Partnership` between the two ids (mirrors `LinkTypePopup`), returns the new partnership id.
  - `handlePartnershipClick(individualId: string): void` — anchor flow: first click sets the anchor; second click on a *different* individual creates the partnership and clears the anchor; clicking the same individual twice clears the anchor.

- [ ] **Step 1: Write the failing test**

Create `src/components/canvas/partnershipTool.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { RelationshipType } from '../../types/enums';
import { createPartnershipBetween, handlePartnershipClick } from './partnershipTool';

function seedTwo(): void {
  const store = usePedigreeStore.getState();
  store.resetDocument();
  store.addIndividual(createDefaultIndividual({ id: 'a', position: { x: 0, y: 0 } }));
  store.addIndividual(createDefaultIndividual({ id: 'b', position: { x: 100, y: 0 } }));
  useUIStore.setState({ partnershipAnchorId: null });
}

describe('createPartnershipBetween', () => {
  beforeEach(seedTwo);

  it('creates a partnership relationship between two individuals', () => {
    const id = createPartnershipBetween('a', 'b');
    const p = usePedigreeStore.getState().document.partnerships[id];
    expect(p.partner1Id).toBe('a');
    expect(p.partner2Id).toBe('b');
    expect(p.type).toBe(RelationshipType.Partnership);
    expect(p.childrenIds).toEqual([]);
  });
});

describe('handlePartnershipClick anchor flow', () => {
  beforeEach(seedTwo);

  it('sets the anchor on the first click', () => {
    handlePartnershipClick('a');
    expect(useUIStore.getState().partnershipAnchorId).toBe('a');
    expect(Object.keys(usePedigreeStore.getState().document.partnerships)).toHaveLength(0);
  });

  it('creates the partnership and clears the anchor on the second click', () => {
    handlePartnershipClick('a');
    handlePartnershipClick('b');
    expect(useUIStore.getState().partnershipAnchorId).toBeNull();
    expect(Object.keys(usePedigreeStore.getState().document.partnerships)).toHaveLength(1);
  });

  it('clicking the same individual twice cancels the anchor', () => {
    handlePartnershipClick('a');
    handlePartnershipClick('a');
    expect(useUIStore.getState().partnershipAnchorId).toBeNull();
    expect(Object.keys(usePedigreeStore.getState().document.partnerships)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/canvas/partnershipTool.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/components/canvas/partnershipTool.ts`:

```ts
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { RelationshipType } from '../../types/enums';
import { generateId } from '../../utils/idGenerator';
import type { PartnershipRelationship } from '../../types/pedigree';

/**
 * Create a partnership union between two individuals and add it to the store.
 * Mirrors the relationship built by the drag-link `LinkTypePopup`, so both
 * entry paths produce identical document state.
 *
 * @returns the new partnership's id.
 */
export function createPartnershipBetween(
  partner1Id: string,
  partner2Id: string,
): string {
  const partnership: PartnershipRelationship = {
    id: generateId(),
    type: RelationshipType.Partnership,
    partner1Id,
    partner2Id,
    childrenIds: [],
  };
  usePedigreeStore.getState().addPartnership(partnership);
  return partnership.id;
}

/**
 * Drive the two-click partnership tool. The first click on an individual sets
 * the pending anchor; a second click on a different individual creates the
 * partnership and clears the anchor; clicking the same individual again cancels.
 */
export function handlePartnershipClick(individualId: string): void {
  const ui = useUIStore.getState();
  const anchor = ui.partnershipAnchorId;
  if (anchor === null) {
    ui.setPartnershipAnchor(individualId);
    return;
  }
  if (anchor === individualId) {
    ui.setPartnershipAnchor(null);
    return;
  }
  createPartnershipBetween(anchor, individualId);
  ui.setPartnershipAnchor(null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/canvas/partnershipTool.test.ts`
Expected: PASS.

- [ ] **Step 5: Route symbol clicks to the tool**

In `src/components/canvas/symbols/PedigreeSymbol.tsx`, add an import near the top:

```ts
import { handlePartnershipClick } from '../partnershipTool';
import { eraseElementById } from '../eraserTool';
```

> `eraseElementById` is created in Task C3; if implementing C2 strictly before C3, add only the `handlePartnershipClick` import now and add the eraser import in C3 Step 5.

Replace the body of `handleClick` (lines 251-264) with:

```ts
    const handleClick = useCallback(
      (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
        e.cancelBubble = true;
        const ui = useUIStore.getState();
        const tool = ui.activeTool;

        if (tool === 'partnership') {
          ui.hideRadialMenu();
          handlePartnershipClick(individual.id);
          return;
        }
        if (tool === 'eraser') {
          ui.hideRadialMenu();
          eraseElementById(individual.id);
          return;
        }

        const { select, toggleSelection, hideRadialMenu } = ui;
        hideRadialMenu();
        const evt = e.evt;
        if ('shiftKey' in evt && (evt.shiftKey || evt.metaKey || evt.ctrlKey)) {
          toggleSelection(individual.id);
        } else {
          select(individual.id);
        }
      },
      [individual.id],
    );
```

- [ ] **Step 6: Verify build + suite**

Run: `npm run build` then `npm test`
Expected: PASS. (If C3 is not yet done and you deferred the eraser import, temporarily omit the `eraser` branch too, then restore it in C3.)

- [ ] **Step 7: Manual verification (dev server)**

With the Partnership tool active, click one symbol then another → a partnership line connects them (rendered by the existing `ConnectionsLayer`). Press Escape mid-flow → anchor clears (Escape handling added in Task C4).

- [ ] **Step 8: Commit**

```bash
git add src/components/canvas/partnershipTool.ts src/components/canvas/partnershipTool.test.ts src/components/canvas/symbols/PedigreeSymbol.tsx
git commit -m "feat: add click-A-then-B partnership tool"
```

---

### Task C3: Eraser tool

**Files:**
- Create: `src/components/canvas/eraserTool.ts`
- Test: `src/components/canvas/eraserTool.test.ts`
- Modify: `src/components/canvas/symbols/PedigreeSymbol.tsx` — eraser branch already added in C2 Step 5 (ensure the `eraseElementById` import is present).

**Interfaces:**
- Consumes: `usePedigreeStore` (`document`, `removeIndividual`, `removeTextAnnotation`, `removePartnership`).
- Produces: `eraseElementById(id: string): void` — removes the element with `id`, routing to the right remover: text annotation → `removeTextAnnotation`; partnership → `removePartnership`; otherwise → `removeIndividual` (which already cascades partnerships, parent-child links, and twin-group membership).

> The "cascade" lives in the store's `removeIndividual` (see `pedigreeStore.ts:246-311`), so this module only routes by entity type. Undo restores a deletion as one step.

- [ ] **Step 1: Write the failing test**

Create `src/components/canvas/eraserTool.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { RelationshipType } from '../../types/enums';
import type { PartnershipRelationship } from '../../types/pedigree';
import { eraseElementById } from './eraserTool';

describe('eraseElementById', () => {
  beforeEach(() => {
    usePedigreeStore.getState().resetDocument();
  });

  it('removes a text annotation', () => {
    const store = usePedigreeStore.getState();
    store.addTextAnnotation({ id: 't1', text: 'hi', position: { x: 0, y: 0 }, fontSize: 16 });
    eraseElementById('t1');
    expect(usePedigreeStore.getState().document.textAnnotations.t1).toBeUndefined();
  });

  it('removes a partnership directly', () => {
    const store = usePedigreeStore.getState();
    const p: PartnershipRelationship = {
      id: 'p1', type: RelationshipType.Partnership,
      partner1Id: 'a', partner2Id: 'b', childrenIds: [],
    };
    store.addPartnership(p);
    eraseElementById('p1');
    expect(usePedigreeStore.getState().document.partnerships.p1).toBeUndefined();
  });

  it('removes an individual and cascades its partnership', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'a', position: { x: 0, y: 0 } }));
    store.addIndividual(createDefaultIndividual({ id: 'b', position: { x: 50, y: 0 } }));
    store.addPartnership({
      id: 'p1', type: RelationshipType.Partnership,
      partner1Id: 'a', partner2Id: 'b', childrenIds: [],
    });
    eraseElementById('a');
    const doc = usePedigreeStore.getState().document;
    expect(doc.individuals.a).toBeUndefined();
    expect(doc.partnerships.p1).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/canvas/eraserTool.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/components/canvas/eraserTool.ts`:

```ts
import { usePedigreeStore } from '../../stores/pedigreeStore';

/**
 * Delete the document element with the given id, routing to the correct remover
 * by entity type: text annotation, partnership, or individual. Removing an
 * individual cascades to its partnerships, parent-child links, and twin-group
 * membership (handled inside the store). A no-op if `id` matches nothing.
 */
export function eraseElementById(id: string): void {
  const store = usePedigreeStore.getState();
  const { textAnnotations, partnerships } = store.document;
  if (textAnnotations[id]) {
    store.removeTextAnnotation(id);
  } else if (partnerships[id]) {
    store.removePartnership(id);
  } else {
    store.removeIndividual(id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/canvas/eraserTool.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm the symbol eraser branch is wired**

Confirm `src/components/canvas/symbols/PedigreeSymbol.tsx` imports `eraseElementById` and the `tool === 'eraser'` branch from C2 Step 5 is present. If you deferred it in C2, add the import and branch now.

- [ ] **Step 6: Drag-to-erase on the canvas**

Single-click erase already works (the C2 symbol branch). Drag-erase reuses each
symbol's existing hover detection: while the eraser button is held, entering a
symbol erases it. Thread one boolean prop down to `PedigreeSymbol`.

In `src/components/canvas/CanvasContainer.tsx`, add component state near the
other `useState` hooks:

```ts
    // True while the eraser is held down for a drag-erase swath.
    const [isErasing, setIsErasing] = useState(false);
```

Replace the Stage `onMouseDown` wiring added in Task B2 with:

```tsx
            onMouseDown={(e) => {
              handleMarqueeDown(e);
              if (useUIStore.getState().activeTool === 'eraser') setIsErasing(true);
            }}
```

Replace the Stage `onMouseUp` wiring added in Task B2 with (it keeps the
drag-link end + marquee finish and adds the erase-drag stop):

```tsx
            onMouseUp={() => {
              handleStageMouseUp();
              handleMarqueeUp();
              setIsErasing(false);
            }}
```

Add a `mouseup` safety net so releasing the button off-canvas still stops the
erase drag — add to the existing middle-mouse `useEffect`'s `window` listeners,
or add a tiny dedicated effect:

```ts
    useEffect(() => {
      const stop = () => setIsErasing(false);
      window.addEventListener('mouseup', stop);
      return () => window.removeEventListener('mouseup', stop);
    }, []);
```

Pass the flag to each symbol — update the `<PedigreeSymbol … />` JSX (~line 397):

```tsx
                  eraseOnHover={isErasing}
```

In `src/components/canvas/symbols/PedigreeSymbol.tsx`, add `eraseOnHover?: boolean`
to the component's props interface (default `false` in the destructure, beside
`panMode = false`). In `handleMouseEnter`, immediately after the `panMode` guard
(~line 268), add:

```ts
      if (eraseOnHover && useUIStore.getState().activeTool === 'eraser') {
        eraseElementById(individual.id);
        return;
      }
```

Add `eraseOnHover` to `handleMouseEnter`'s dependency array.

> Single-click erase is the primary, unit-tested path. If the drag-erase prop
> threading proves fiddly under review, ship single-click erase alone in this
> task and open a follow-up issue for drag-erase — state that explicitly in the
> PR rather than committing half-wired code.

- [ ] **Step 7: Verify build + suite**

Run: `npm run build` then `npm test`
Expected: PASS.

- [ ] **Step 8: Manual verification (dev server)**

With the Eraser tool, click a symbol → it and its connections disappear; Cmd+Z restores them. Hold and drag across several → each is erased as the pointer enters it (if drag-erase shipped).

- [ ] **Step 9: Commit**

```bash
git add src/components/canvas/eraserTool.ts src/components/canvas/eraserTool.test.ts src/components/canvas/symbols/PedigreeSymbol.tsx src/components/canvas/CanvasContainer.tsx
git commit -m "feat: add eraser tool with click and drag delete"
```

---

### Task C4: Escape handling + cursor feedback for new tools

**Files:**
- Modify: `src/hooks/useKeyboardShortcuts.ts` — extend the `Escape` case (lines 107-117) to clear a pending partnership anchor first.
- Test: `src/hooks/useKeyboardShortcuts.test.tsx` — cover Escape clearing the anchor.

**Interfaces:**
- Consumes: `useUIStore` (`partnershipAnchorId`, `setPartnershipAnchor`).

- [ ] **Step 1: Write the failing test**

Append to `src/hooks/useKeyboardShortcuts.test.tsx`:

```tsx
it('Escape clears a pending partnership anchor before clearing selection', () => {
  useUIStore.setState({ partnershipAnchorId: 'a' });
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(useUIStore.getState().partnershipAnchorId).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useKeyboardShortcuts.test.tsx`
Expected: FAIL — anchor stays `'a'`.

- [ ] **Step 3: Implement**

In `src/hooks/useKeyboardShortcuts.ts`, replace the `case 'Escape'` block (lines 107-117) with:

```ts
        case 'Escape': {
          const ui = useUIStore.getState();
          if (ui.activeModal) {
            ui.closeModal();
          } else if (ui.partnershipAnchorId) {
            ui.setPartnershipAnchor(null);
          } else if (ui.radialMenu.visible) {
            ui.hideRadialMenu();
          } else {
            ui.clearSelection();
          }
          return;
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useKeyboardShortcuts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add a partnership cursor**

Append to `src/components/canvas/CanvasContainer.module.css`:

```css
.container[data-tool='partnership'] {
  cursor: crosshair;
}
```

- [ ] **Step 6: Verify build + suite**

Run: `npm run build` then `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/hooks/useKeyboardShortcuts.test.tsx src/components/canvas/CanvasContainer.module.css
git commit -m "feat: clear partnership anchor on Escape; partnership cursor"
```

---

## Final verification

- [ ] Run `npm test` — all suites pass.
- [ ] Run `npm run build` — no TypeScript errors.
- [ ] Run `npm run lint` — clean.
- [ ] Manual dev-server pass over the success criteria below.

## Success criteria (from the spec)

- Toolbar shows lock, hand, select, male, female, unknown, partnership, text, eraser with icons; placeable tools show number badges 1–7; lock and hand show none.
- Number and letter shortcuts both switch tools; `L` toggles lock; badge shows the number.
- Select tool drags a marquee (never pans); marquee and Shift/Cmd+click both multi-select.
- Hand tool, spacebar, middle-mouse, wheel, and Cmd-wheel pan/zoom all still work.
- Male/Female/Unknown and Text place at the click point; Lock keeps the tool active after placement.
- Partnership tool creates a partnership via click-A-then-click-B using the same logic as the drag-link; drag-link and radial menu still work.
- Eraser deletes on click (and drag-across if shipped), cascading person deletions to connections; undo restores.
- Extracted modules (`toolPlacement`, `marqueeSelection`, `partnershipTool`, `eraserTool`) and `ToolIsland` have passing unit tests.
