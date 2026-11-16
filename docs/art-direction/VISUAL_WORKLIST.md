# Visual development worklist

Use [the approved concept](approved-tabletop.png) as the visual target.
Work on one bounded item per pass. Inspect actual Godot captures beside the
reference and leave completed implementations **in review** until the user
accepts their appearance. A passing test suite verifies behavior, not art quality.
Update this document as decisions and feedback arrive.

## 1. Interface, menus and overlays — active

- **1A. Orders folder / purchase document — in review.** Establish the matte
  manila and paper materials, restrained controls, typography, illustrated rows,
  phase/treasury and draft totals. Keep the sheet readable, scrollable,
  collapsible and expandable on desktop and small screens. This is the sample
  to review before applying its treatment elsewhere.
- 1B. Other order documents: movement, battles, casualties, mobilization, income.
- 1C. Compact top information strip, map controls, inspector and ownership key.
- 1D. Main menu, pause/settings, save and multiplayer screens; confirmations,
  errors, tooltips and keyboard focus.

## 2. Board and map — queued

- 2A. One Western Europe reference view: terrain form, relief readability,
  natural color, sea material and border ownership wash.
- 2B. Geographic labels, capital markers, boundaries and sea-zone treatment.
- 2C. Carry the reviewed treatment across all continents and zoom levels.

## 3. Units and structures — queued

- 3A. A small representative set: infantry, tank, artillery and their counts.
- 3B. Country-specific historical silhouettes and faction paint.
- 3C. Air/naval pieces, factories and bases; crowded-territory arrangements.

## 4. Animation and interaction feedback — queued

- 4A. Hover, selection, legal moves, routes and order confirmations.
- 4B. Folder motion, transitions, unit movement, combat and dice feedback.
- 4C. Camera panning/zoom, terrain parallax and reduced-motion behavior.

## 5. Lighting and final integration — queued

- 5A. Warm tabletop light, contact shadows and consistent material response.
- 5B. Screen sizes, touch, text readability and color/accessibility checks.
- 5C. Target-machine performance, quality settings and final visual regression
  captures. Software-rendered clips are not hardware-performance benchmarks.

## Current review: 1A

Aim for the reference's paper document: moderate serif headings, a calm country
line, shaded phase/treasury and totals bands, readable illustrated purchase rows,
thin printed rules and an olive action. Avoid gold/leather-looking folder edges,
stretched beveled controls, text touching the paper edge and cramped counters.

Scope is the live Global 1940 orders folder and its purchase sheet. Board/map,
miniature art, other menus and new animations remain separate work items.

The [first folder review](orders-01/README.md) records the implementation,
actual desktop/compact captures and verification. Review paper warmth, border
weight, heading sizes, row spacing, panel width and controls before carrying this
treatment into item 1B. Keep the current item in review until the user accepts it.
