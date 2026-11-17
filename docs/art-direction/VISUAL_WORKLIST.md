# Visual development worklist

Use [the approved concept](approved-tabletop.png) as the visual target.
Work on one bounded item per pass. Inspect actual Godot captures beside the
reference and leave completed implementations **in review** until the user
accepts their appearance. A passing test suite verifies behavior, not art quality.
Update this document as decisions and feedback arrive.

## Actual-game markup workflow

**Annotated feedback received successfully.** The user returned the actual
expanded-folder screenshot with two numbered, positioned comments. Apply those
comments directly to the game and provide matching Godot captures for the next
review. The user wants built-in image markup inside Codex desktop.

We can consume these annotations. Automatic delivery into the native annotation
viewer remains unverified: earlier file embeds and the image-generation result
formatter did not expose a usable image card. Do not claim those methods enable
markup, or regenerate screenshots to manufacture a concept card. Preserve the
game's pixels and provide the actual PNG for the attachment route the user used.

1. Render the changed component in Godot and provide the actual PNG in the chat.
   Label the item, preview
   revision, game commit and viewport. Include context and a closer view when
   needed; show relevant states rather than only the default screen.
2. Receive the user's built-in image annotations and comments and map their
   locations to the matching game capture. Record actionable feedback here.
   Do not substitute an external editor or numbered-note workflow unless the
   user asks for that fallback. If the client still lacks native markup, state
   that limitation instead of claiming the review format is working.
3. Apply that feedback to the real game code, assets and layout, then run the
   relevant behavior checks and render the same view again for comparison.
4. Post the next numbered preview and describe the visible changes. Preserve
   prior captures and keep the item in review until the user accepts it.

Review images must show the game as implemented. Keep concept artwork separate
and label it as concept artwork. Do not paint proposed fixes onto a screenshot
and present that as an implemented game change. Still images establish appearance;
use actual game clips when the review depends on motion or interaction.

The initial screenshot set is **1A.1**, captured from game commit `c1d44f7`:
[desktop context](orders-01/desktop.png) and
[expanded folder](orders-01/expanded.png), both 1440 × 900. These are saved
Godot renders from the completed 1A implementation pass.

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

## 2. Board and map — first color sample in review

- 2A. One Western Europe reference view (satellite color requested now): terrain form, relief readability,
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

### Applied feedback — preview 1A.2 / 2A.1

The user explicitly extended this pass to board color as well as the folder:

- At (64.6%, 5.6%): make the folder tab the main title location and remove the
  duplicate title on the sheet. Use this convention for future titled folders.
- At (33.6%, 68.4%): replace the washed-out map color with a satellite-style
  base on the 3D terrain, representative of real geography. Apply country-color
  gradients over that surface.

The current implementation uses one scalable tab title, the country heading
on the document, and a registered Blue Marble base under the existing ownership
wash. Review [the matching captures](orders-02/README.md) before further styling.

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
