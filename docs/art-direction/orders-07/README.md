# Preview 1A.7 — clean buttons and loose sheets

Status: **in review**. Responds to the button-shape and paper-stack feedback
following the [S01 menu/state captures](../states-01/README.md).

Rectangular controls now use new paper and olive material faces with straight
sides, small rounded corners and restrained borders. Their nine-slice edges
retain the same dimensions at different widths; only the center tiles. Shared
skins cover counters, primary actions, menu buttons and text-entry fields.
Focus registration corners also retain their shape on long controls.

The orders folder has an empty manila backing with four separate textured
sheets above it. Varied offsets and slight clockwise/counterclockwise rotations
replace the uniform staircase. Each sheet keeps its pose when another is selected.
The selected page moves to the front of the stack, and its live document rotates
with it. Each projecting paper tab, its vertical text and its native hit area
follow that page's transform. Increased inner margins keep controls on the paper.

[Land selected](expanded.png) · [Air selected](air.png) ·
[Sea selected](sea.png) · [Return to Land](land-returned.png) ·
[Compact Land](compact.png) · [Compact Air](compact-air.png) ·
[Mobilization / long controls](mobilization.png) ·
[Main menu](main-menu.png) · [Multiplayer fields and buttons](multiplayer.png)

All images are actual, unedited Godot renders. Orders captures use the same
France view and 23 IPC draft as earlier reviews; placement uses the regular
campaign rules to reach mobilization. Desktop captures are 1440 × 900; compact
captures are 960 × 540. No player saves are read or written by the capture scripts.

Validation: 178 world visual checks pass, including native clicks on all four
rotated tabs, selected-sheet ordering, matching document/tab angles and action
containment within each paper sheet. The 27 rendered interaction/layout checks
pass for quantity edits, category changes, expansion/restoration, compact
scrolling, tucking/reopening and draft preservation. The final captures also
switch categories through native mouse events. Gameplay, save, touch and LAN
smoke checks pass without script or polygon-drawing errors. Godot 4.7.2 with software OpenGL
was used; target-device performance is not measured by these previews.
