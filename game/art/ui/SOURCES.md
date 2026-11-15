# Tabletop interface artwork

These original raster assets were generated for this project from the approved
WWII tabletop concept in `docs/art-direction/approved-tabletop.png`:

- `orders-folder.png`: blank layered manila folder, paper and soft contact shadow.
- `controls-atlas.png`: paper/brass counter, olive/brass primary face, index tab
  and stained walnut. Atlas regions are selected in Godot without flattening the
  controls into a screenshot.
- `unit-illustrations.png`: 4-by-4 atlas of period ink-and-wash unit illustrations.

Fonts are **Old Standard TT**, by Alexey Kryukov and the Old Standard Project
Authors, from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/oldstandardtt),
used under the included SIL Open Font License. Original font binaries are
unmodified; see `game/fonts/OldStandardTT-OFL.txt`.

The theme in `game/ui_style.gd` is artwork-backed throughout menus and controls.
`game/global_screen.gd` lays out a live orders document with separate headings,
inventory rows, unit illustrations, costs, draft totals and action controls.
