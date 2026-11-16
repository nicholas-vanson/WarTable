# Tabletop interface artwork

These original raster assets were generated for this project from the approved
WWII tabletop concept in `docs/art-direction/approved-tabletop.png`:

- `orders-folder.png`: blank layered manila folder, paper and soft contact shadow.
- `controls-atlas.png`: paper/brass counter, olive/brass primary face, index tab
  and stained walnut. Atlas regions are selected in Godot without flattening the
  controls into a screenshot.
- `unit-illustrations.png`: 4-by-4 atlas of period ink-and-wash unit illustrations.
- `orders-stationery.png`: refined matte manila and ivory paper for the focused
  orders-folder review, with quieter edges and less saturated color.
- `orders-controls.png`: restrained paper counter, olive action, sepia document
  band and manila category tab. Atlas regions are used by `orders_style.gd`.

The two `orders-*` assets above are original generated artwork based on the same
approved concept. They belong to the current interface sample; the visual
worklist records its review status. Their treatment is scoped to the live orders
folder while other screens await their own passes.

Fonts are **Old Standard TT**, by Alexey Kryukov and the Old Standard Project
Authors, from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/oldstandardtt),
used under the included SIL Open Font License. Original font binaries are
unmodified; see `game/fonts/OldStandardTT-OFL.txt`.

The theme in `game/ui_style.gd` is artwork-backed throughout menus and controls.
`game/global_screen.gd` lays out a live orders document with separate headings,
inventory rows, unit illustrations, costs, draft totals and action controls.
