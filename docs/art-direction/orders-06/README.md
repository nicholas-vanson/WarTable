# Preview 1A.6 — illustrated controls

Status: **in review**. Continues the [stacked-paper review](../orders-05/README.md).

The folder and its neighboring map controls now use original illustrated
hardware from the same warm material family as the stationery:

- Brass tuck/reopen arrows and distinct expand/restore arrows.
- Raised brass add/subtract pieces on the existing paper counter faces.
- Antique magnifiers for zoom and inspection, a compass for theaters, a gear
  for display quality, and a brass return arrow beside Back.
- Shared discard/add/remove artwork for queued orders and mobilization.

These are transparent raster assets selected from `game/art/ui/utility-icons.png`,
not font characters. `game/ui_art.gd` supplies consistent sizing and interaction
states. Labels, quantities and actions remain native UI with tooltips and
accessible names. Disabled actions fade; hover/pressed states tint the artwork;
registration corners show keyboard focus. Labeled controls reserve space for
the icon as well as the text.

[Expanded purchase sheet](expanded.png) · [Air sheet / disabled controls](air.png) ·
[Compact layout](compact.png) · [Folder tucked away](map.png) ·
[Keyboard focus](keyboard-focus.png)

These are actual unedited Godot captures. Expanded views are 1440 × 900, in
the France theater with the same 23 IPC draft used for earlier previews. The
compact view is 960 × 540. The generated atlas is source artwork; these captures
show that artwork integrated into the running game.

Validation: 166 existing world visual checks, 33 rendered interaction/layout
checks, and the gameplay/save/touch/LAN smoke suite pass. Rendered checks cover
quantity edits, disabled purchases, tab switching, scrolling, draft preservation,
tuck/reopen, expand/restore, keyboard activation, zoom, theater/settings menus,
and returning to the main menu. Captures use Godot 4.7.2 with software OpenGL;
they do not establish Android-device performance.

The [art direction](../README.md) and [worklist](../VISUAL_WORKLIST.md) now require
this asset-building approach for subsequent interface work. The current Android
APK (0.9.1-test.1) predates this source/preview pass.
