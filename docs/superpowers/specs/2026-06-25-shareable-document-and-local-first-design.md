# Design: "Shareable document" hardening + local-first polish

**Date:** 2026-06-25
**Status:** Approved
**Author:** Joshua Ellis (with Claude)

## Context

Pedigree is a client-side Vite + React + `react-konva` pedigree editor. Its target
user is a **genetic counselor / clinical geneticist**; the headline scenario is
**"produce a clean shareable document"** (a pedigree polished enough for a report or
to share with a colleague). The app will be hosted on Vercel for remote testing.

A UX review (browser-verified) found that the *editor* is clinically literate but the
*document it exports* is not yet shareable: the export captures the raw editing
viewport (grid, bounds guide, and selection halo baked in; relatives silently cropped),
"SVG" is a raster wrapped in `<svg>`, and the title is permanently "Untitled Pedigree".
Several should-fix rough edges (triple legend, `prompt()` for notes, no empty-state,
radial-menu/label overlap) also undercut polish.

## Design north star

Model behavior and chrome on **Excalidraw**: local-first ("your data lives in your
browser"), calm minimal aesthetic, canvas-centric. **But the pedigree symbols stay
clinically precise and standardized** — no hand-drawn/sketchy rendering of medical
symbols. "Excalidraw feel" = chrome + behavior only.

Scope this round: all must-fixes + should-fixes + local-first behavior + light visual
polish. The full floating-island UI restyle is deferred to a tracked follow-up issue.

## Work items (GitHub issues)

### Must-fix
1. **Export the document, not the viewport.** Before `toDataURL`, temporarily hide the
   grid, bounds, and selection layers; compute content bounds via `computeBounds`
   (`src/utils/boundsCalculation.ts`); capture exactly that rect (`toDataURL({x,y,width,
   height})`). Restore layers + redraw afterward. Fixes baked-in chrome **and** silent
   cropping for PNG + PDF in one change. *Files:* `src/io/pngExport.ts`,
   `src/io/pdfExport.ts`, a shared `cleanExport` helper, named Konva layers in
   `src/components/canvas/CanvasContainer.tsx`.
2. **True vector SVG export.** Render the pedigree from the data model to real SVG
   primitives: symbols (circle/square/diamond/triangle), connection lines, deceased
   slash, proband arrow, labels, quarter-shading via SVG `<pattern>`/`<clipPath>`, and
   the legend/key. Output must be crisp at any scale/print. *Files:* rewrite
   `src/io/svgExport.ts` (model-driven, no Konva rasterization). Reuse geometry from
   `src/utils/geometry.ts` / `symbolClip.ts` where possible.
3. **Editable title + Document details.** Click-to-edit document title in the toolbar; a
   small "Document details" popover for author / institution / reference condition
   (date auto from `updatedAt`). Feeds the PDF header and export filenames. *Files:*
   `src/components/ui/Toolbar.tsx`, new `DocumentDetails` component, metadata setters in
   `src/stores/pedigreeStore.ts`.

### Should-fix
4. **Consolidate to one legend.** The canvas "Key" is the one that exports — keep it.
   Replace the redundant bottom-left HTML overlay's duplicate condition listing with a
   single "Edit Legend" button. *Files:* `src/components/ui/LegendOverlay.tsx`,
   `src/components/canvas/LegendLayer.tsx`.
5. **Inline clinical notes.** Replace the native `prompt()` "+ Add Note" with an inline
   textarea in the Properties panel. *Files:* `src/components/ui/PropertiesPanel.tsx`.
6. **Empty-state onboarding.** A calm ghost hint on the blank canvas ("Click + Person to
   start · hover a symbol for relatives"). Hidden once any individual exists. *Files:*
   `src/components/canvas/CanvasContainer.tsx` or a new overlay component.
7. **Radial menu / label overlap.** Offset the menu (or the "Child" item) so it no longer
   collides with the symbol's name label. *Files:* `src/components/ui/RadialMenu.tsx`.

### Behavior + polish
8. **Local-first UX.** A subtle "Saved locally" status that surfaces "export to keep",
   plus a one-time note that data lives only in this browser. Builds on existing
   `src/hooks/useAutoSave.ts` (expose a last-saved signal). *Files:* `useAutoSave.ts`,
   a small status indicator in `Toolbar.tsx`.
9. **Light visual alignment.** Shift accent toward Excalidraw indigo and soften
   surfaces/radii via CSS variables only (low-risk). *Files:* `src/index.css` (token
   values), minimal component CSS. Done **last**.

### Deferred (filed, not implemented now)
10. **Full Excalidraw-style floating-island UI** — centered floating toolbar, floating
    property island, command palette. Separate later pass.

## Execution strategy

- **Setup:** `git init` → initial commit → create **public** `Jdjellis/pedigree` →
  push → file issues #1–#10.
- **Implementation in waves** (shared hotspot = `pedigreeStore`, so parallelize only
  disjoint file sets):
  - **Wave 1 (parallel):** #1+#2 export pipeline (owns `io/`) · #4 legend · #7 radial
    menu · #6 empty-state.
  - **Wave 2 (parallel):** #3+#8 document identity (owns `Toolbar` + doc-details +
    metadata store) · #5 inline notes (owns `PropertiesPanel`).
  - **Wave 3:** #9 visual polish (CSS vars only), last.
- **Per issue:** implement, add/update a test where it makes sense (TDD preference),
  land as a conventional commit referencing the issue. Verify the meaningful ones in the
  live browser — especially the export: re-run the actual export and confirm grid /
  bounds / selection are gone and nothing is cropped.

## Testing approach

- Unit: `computeBounds` already testable; add tests for the SVG serializer (snapshot of
  generated SVG for a small fixture pedigree) and metadata setters.
- Manual/browser: drive the running app, build a small pedigree, export PNG/PDF/SVG,
  verify clean output and no cropping at various zoom levels.

## Out of scope

- Backend / accounts / cloud sync (intentionally local-first, like Excalidraw).
- Full UI restyle (issue #10, deferred).
- Deep clinical-standards audit (e.g., single-condition full-fill vs quarter — noted
  separately, not in this round).
