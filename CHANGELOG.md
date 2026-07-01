# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- MIT `LICENSE`.
- SEO, Open Graph, and Twitter card metadata plus JSON-LD `SoftwareApplication`
  structured data in `index.html`.
- App favicon (`public/favicon.svg`) and social card (`public/og-image.svg`),
  replacing the default Vite icon.
- Clinical-use disclaimer in the README and in the in-app privacy popover.

### Fixed
- The eraser tool no longer deletes the last remaining individual, which left an
  empty canvas with no way to add a new person. Erasing stops at the final
  individual, matching the existing guard on keyboard delete (issue #103).
- Erasing a person no longer leaves a stranded connector. A union left with no
  partners and a single child (e.g. after erasing a sole parent) is now pruned
  instead of rendering a descent stub hanging above a lone symbol; a bare sibship
  bar is still kept for two or more orphaned siblings (issue #104).
- **Add Child** on an individual who belongs to more than one union no longer
  silently attaches the child to whichever union happened to be first in
  iteration order. When 2+ unions exist, a union picker now prompts for which
  union the child belongs to (issue #97).

## [0.1.0] — Unreleased

First public release candidate. **Pedigree Canvas** — a local-first clinical
pedigree drawing tool with NSGC 2022 standardised symbols, relationship lines
(partnerships, consanguinity, twins, adoption, sibships), condition shading with
a configurable legend, test-result annotations, and export to PDF, PNG, SVG,
`.ped`, and JSON.
