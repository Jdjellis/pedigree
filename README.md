# Pedigree

A local-first, opinionated **genetic pedigree mapping tool**. Build clinical family
pedigrees on an infinite canvas with standardized symbols, condition shading, and
export to shareable documents — all in your browser, no account required.

Think Excalidraw, but purpose-built for genetic counselors and clinical geneticists.

## Features

- **Standardized symbols** — square / circle / diamond / triangle by gender identity
  (NSGC 2022), sex-assigned-at-birth annotations, deceased slash, proband arrow.
- **Relationships** — partnerships, consanguinity, separation, twins (MZ/DZ), adoption,
  parent–child sibship lines.
- **Conditions & legend** — quarter-shading with a configurable key, gender filters,
  genetic test results (positive / negative / VUS / pending).
- **Local-first** — your work autosaves to your browser. Export to keep a permanent copy.
- **Export** — PNG, PDF (A4 with header), SVG, and `.ped` for interop; JSON for full
  fidelity.
- **Undo / redo**, zoom & pan, keyboard shortcuts.

## Tech

React 19 · TypeScript · Vite · `react-konva` (HTML5 canvas) · Zustand (+ zundo for
undo/redo). No backend — a pure client-side SPA.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run lint
```

## Data & privacy

All pedigree data lives **only in your browser** (`localStorage` autosave). Nothing is
sent to a server. Use **Export → JSON** to save a permanent, re-openable copy.

## Status

Active development. See the [issues](https://github.com/Jdjellis/pedigree/issues) for
the current roadmap.
