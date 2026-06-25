# Floating-Island UI Revamp — Design

**Issue:** [#10 — Full Excalidraw-style floating-island UI overhaul](https://github.com/Jdjellis/pedigree/issues/10)
**Date:** 2026-06-25
**Status:** Approved design. This pass is design-only; implementation is broken into phases (see §7).

## Purpose

Replace the current full-width top toolbar + docked properties panel with an
Excalidraw-style **floating-island** UI: a full-bleed canvas with discrete,
rounded, softly-shadowed control islands overlaid at the screen corners and
center. The goal is the Excalidraw onboarding/working *feel* the user values,
expressed in a **calm clinical voice** (restrained color, crisp type, no
hand-drawn whimsy in working chrome) appropriate for genetic counselors.

## Direction decisions (locked during brainstorming)

- **Scope of this pass:** design only. Produce this spec, then phase the work.
- **Visual voice:** adopt Excalidraw's island *structure* (islands, soft
  shadows, rounded chrome) with a professional/clinical tone. Hand-drawn accents
  appear **only** in the empty-state onboarding hints, never in working chrome.
- **Top-right:** a primary **Export** button (Excalidraw's "Share" slot, which
  has no equivalent — Pedigree is deliberately browser-local) plus the
  **properties-panel toggle**.
- **Document identity:** the editable **title** and **"Saved locally"** status
  move into the top-left **Menu island** (Excalidraw's scene-name location).
- **Tool island:** minimal and clinical — **Select · Hand · Add Person** — not a
  per-gender split. A contextual gender sub-picker is *reserved* for a later
  phase (designed-for, not built now).

## 1. Layout map

```
┌─────────────────────────────────────────────────────────────────┐
│ [☰ Menu]            ┌── Tool Island ──┐         [Export] [▥ Panel]│
│  title+saved        │ ▙ Select  ✋ Hand │                          │
│                     │   ＋ Add Person  │                          │
│                     └──────────────────┘                          │
│                                                                   │
│                          ✕  PEDIGREE          ← (empty state only)│
│                    "Saved only in this browser…"                  │
│                       Open · Import · Help                        │
│                                                                   │
│ ┌── zoom ──┐ ┌─ history ─┐                          ┌─ help ─┐    │
│ │ − 100% + │ │  ↩   ↪    │                          │   ?    │    │
│ └──────────┘ └───────────┘                          └────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

Every island is `position: absolute` over a **full-bleed canvas**. The canvas
no longer reflows when panels open or close.

## 2. Islands & contents

| Island | Position | Contents |
|---|---|---|
| **Menu** | top-left | ☰ button → dropdown: New, Open, Import, Export, Legend, Document details, (Preferences later). Editable **title** + **"Saved locally"** status sit beside/below the ☰. |
| **Tools** | top-center | Select · Hand · Add Person (+ reserved gender sub-picker, later phase). Hotkeys `V` / `H` / `P`. |
| **Actions** | top-right | **Export** primary button + **Properties panel toggle** (▥). |
| **Zoom** | bottom-left | − / % / + / Fit. |
| **History** | bottom-left (right of zoom) | Undo ↩ / Redo ↪. |
| **Help** | bottom-right | ? → keyboard-shortcuts overlay. |
| **Properties** | right, floating | The existing panel, now an island floating **over** the canvas, toggled from top-right. |

## 3. Add-node journeys (UX model)

Two distinct, intentionally-coexisting journeys (canvas-tool convention):

- **Manual placement** — the **Add Person** tool. Pick it, click the canvas, a
  default node drops; refine attributes in the properties panel. Intent: *"put a
  standalone person here."*
- **Relational building** — the existing **radial menu** on a node:
  *add partner / add child / add parent*. Intent: *"add someone related to this
  person."* This is the **primary** pedigree-building flow (counselors build
  outward from a proband), and is preserved as-is.

The main tool island stays at three modes. Gender is one clinical attribute
among many (affected status, deceased, carrier…), so it is set in properties /
via the reserved sub-picker, not split into the toolbar.

## 4. Empty-state onboarding

Shown only when the document has **zero individuals** (extends today's
`EmptyStateHint`):

- Centered **Pedigree logo/wordmark** + the existing "saved only in this
  browser" reassurance text.
- Quick links: **Open · Import · Help** (with shortcut hints).
- **Hand-pointing hint arrows** with labels pointing at the real islands:
  *"Menu, export, settings"* → top-left; *"Pick a tool & add your first
  person"* → tool island; *"Zoom & history"* → bottom-left; *"Shortcuts &
  help"* → bottom-right.
- The entire onboarding layer disappears once the first individual exists.

The hand-drawn arrow/label style is the **only** place whimsy appears.

## 5. Behavior changes

- **Canvas → full-bleed.** `App.tsx` layout flattens: the flex row that
  currently shrinks the canvas is removed; the canvas fills the viewport and
  islands overlay it absolutely.
- **Properties panel → floating + toggleable.** No longer reflows the canvas;
  opens over it from the top-right toggle. Still auto-opens on selection
  (behavior preserved; toggle adds explicit show/hide).
- **Top bar removed.** `Toolbar.tsx` is decomposed into the Menu, Tools, and
  Actions islands.

## 6. Visual language (clinical voice)

Reuse the existing CSS variables (violet accent + surfaces already aligned in
prior commits). Island chrome: white/surface background, existing `--radius`
rounding, soft shadow, hairline border. No hand-drawn font in working chrome.
The hand-drawn arrows are confined to the onboarding layer.

## 7. Architecture / files

- `App.tsx` / `App.module.css` — flatten layout to a full-bleed canvas with
  absolute island slots.
- **New** `src/components/ui/islands/` — `MenuIsland`, `ToolIsland`,
  `ActionsIsland`, `ZoomIsland`, `HistoryIsland`, `HelpIsland`, split out of
  `Toolbar.tsx` (currently 400+ lines doing too much; the bar ceases to exist).
- **New** shared `Island.module.css` (or shared tokens) for consistent chrome.
- `PropertiesPanel` — restyle as a floating island; add toggle wiring in
  `uiStore` (a `propertiesPanelOpen` toggle action; the flag already exists).
- `EmptyStateHint` — extend into the onboarding layer with hint arrows + quick
  links.
- **New** `ShortcutsOverlay` — the `?` help dialog (lists existing
  `useKeyboardShortcuts` bindings).

### Konva/Zustand constraint (project gotcha)

Any new canvas-affecting state must respect the project rule: Zustand
subscriptions inside react-konva components silently fail. Subscriptions stay
lifted to `CanvasContainer` (react-dom); islands are plain react-dom components
and may subscribe normally.

## 8. Phasing

1. **Layout foundation** — full-bleed canvas + island scaffold; relocate
   existing controls into islands (no new features). Lowest risk, highest
   visual payoff (~80% of the Excalidraw feel).
2. **Empty-state onboarding** — logo, hint arrows, quick links.
3. **Menu + Actions polish** — dropdown menu, title/save relocation, Export CTA.
4. **Help / shortcuts overlay** (`?`).
5. **Command palette (`⌘K`)** — separate feature carried over from #10; its own
   spec/plan when reached.
6. **Reserved/optional** — gender sub-picker; expanded keyboard affordances.

Each phase becomes its own implementation plan.

## 9. Testing

- Component tests per island: renders the correct actions/labels; toggle wiring
  (e.g. properties panel open/close); empty-state shows/hides on individual
  count.
- Manual preview-verify pass per phase: islands position correctly at all four
  corners + center, canvas stays full-bleed (does not resize when panels
  toggle), onboarding appears at zero individuals and clears after the first.

## Out of scope

- Live collaboration / sharing (Pedigree is intentionally browser-local).
- Backend or persistence changes.
- New clinical data model or symbol changes.
- Reworking the radial-menu relationship flow (preserved as-is).
