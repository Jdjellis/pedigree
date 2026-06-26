# Pedigree

[![CI](https://github.com/Jdjellis/pedigree/actions/workflows/ci.yml/badge.svg)](https://github.com/Jdjellis/pedigree/actions/workflows/ci.yml)

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

## Testing & CI

The suite uses [Vitest](https://vitest.dev/) with the jsdom environment and
React Testing Library.

```bash
npm test               # run the suite once
npm run test:watch     # watch mode
npm run test:coverage  # run with a v8 coverage report (text + html + lcov)
npm run typecheck      # tsc project-wide type check, no emit
```

Coverage focuses on application logic — pure utilities (geometry, graph
traversal, layout/respacing), the `.ped`/JSON/SVG I/O codecs, the Zustand
stores, commands, and hooks. Konva canvas-rendering components are exercised
indirectly and excluded from coverage targets.

Every push to `main` and every pull request runs the same four gates in GitHub
Actions (`.github/workflows/ci.yml`): **lint → type-check → test → build**.
Run them locally before pushing with:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Data & privacy

All pedigree data lives **only in your browser** (`localStorage` autosave). Nothing is
sent to a server. Use **Export → JSON** to save a permanent, re-openable copy.

## Status

Active development. See the [issues](https://github.com/Jdjellis/pedigree/issues) for
the current roadmap.
