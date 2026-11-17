# Review set S01 — game and menu states

Status: **awaiting markup**. Actual, unedited Godot captures of game source
`4b44ae9919a4f3a7345883b86166b58dafc9c33b` at 1440 × 900.
This set documents the current UI, including screens that have not yet received
the focused orders-folder refinement. No game appearance changes accompany it.

| Image | State | Useful review areas |
| --- | --- | --- |
| [01](01-main-menu.png) | Main menu | Folder material, title, action hierarchy, background |
| [02](02-multiplayer.png) | Multiplayer setup | Form fields, spacing, buttons, navigation |
| [03](03-naval-purchases.png) | Sea purchase sheet | Ship illustrations, tab, quantities, scrolling |
| [04](04-territory-inspector.png) | Territory details | Inspector placement, text, information density |
| [05](05-combat-movement.png) | Selected combat move | Unit selection, route, legal destinations, action |
| [06](06-battle-ready.png) | Battle before rolling | Combat document, side headings, unit summaries |
| [07](07-dice-and-casualties.png) | Dice result and casualty assignment | Dice, hit feedback, casualty controls |
| [08](08-mobilization.png) | Reinforcement placement | Factory capacity, available units, staged placements |
| [09](09-income.png) | Income / end of turn | Summary, next-power information, empty-space balance |
| [10](10-display-settings.png) | Display-quality menu | Menu styling, selected item, placement |
| [11](11-confirmation.png) | Skip-purchase confirmation | Dialog styling, wording, action emphasis |
| [12](12-world-overview.png) | Global board with orders tucked away | World color, labels, pieces, compact controls |

The menu has no saved campaign in this example. Multiplayer fields are empty
and show placeholders; no host or connection is started. The movement and battle
views use a legal German attack from Holland Belgium into France with four
infantry, two artillery and three tanks. Campaign RNG seed 1940 produces three
attack hits; two French infantry casualties have been selected in image 07.
The displayed dice are the actual settled game animation.

Images 08–09 use a separate temporary campaign: purchase three infantry, two
artillery and one tank, skip both movement phases, stage and place those units at
Western Germany, then reach income through the regular game rules. All campaign
instances use an empty save path, so captures do not read or overwrite saves.

Rendered in Godot 4.7.2, software OpenGL, High detail. Godot popups are embedded
in the game window for full-window capture. These are visual-review references,
not device-performance measurements. Each numbered image is separate for markup;
keep this set unchanged when applying subsequent feedback.
