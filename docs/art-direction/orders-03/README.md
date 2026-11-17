# Preview 1A.3 / 2A.2 — side tabs, ocean and ownership

Status: **in review**. Implements the three positioned comments on
[preview 1A.2 / 2A.1](../orders-02/README.md).

1. All / Land / Air / Sea are paper index leaves along the folder's left side.
   The active leaf projects farther and has a printed underline. Categories
   remain reachable while the purchase list scrolls, follow the folder's tuck
   animation, and hide outside the purchase phase. Native buttons retain
   keyboard focus and labels.
2. The ocean has a flat, textured color surface. Muted teal shelves blend into
   deeper blue basins according to distance from land and an illustrative depth
   field. Fine and broad pigment variation connects it to the land's imagery.
3. Country ownership uses a broader, stronger gradient with fine diagonal
   hatching inside borders. The central terrain remains visible. Hatching
   follows the map while panning and fades out at world overview zoom.

[Expanded folder, matching the marked-up view](expanded.png) ·
[Unobstructed map](map.png) · [Compact layout](compact.png) ·
[World overview](world.png)

These are actual, unedited Godot renders. The expanded view uses the France
theater, 1440 × 900 viewport, and 23 IPC purchase draft from the annotated image.
The compact view is 960 × 540. The single ORDERS title remains on the main tab.

The satellite land pixels are unchanged from the previous pass; only ocean
pixels changed in the baked surface. Ocean depths are illustrative, not a
survey. The ocean adds no geometry or extra runtime texture sampler. See
[terrain sources](../../../game/art/terrain/SOURCES.md) for the reproducible bake.

Validation: Godot 4.7.2 import, 166 world visual checks and gameplay/save/LAN
smoke checks pass. Twenty rendered interaction checks pass, including native
clicks on protruding category tabs, draft preservation, scrolling, compact
bounds, tucking/reopening and purchase-phase visibility. Captures use software
OpenGL and do not establish target GPU performance.
