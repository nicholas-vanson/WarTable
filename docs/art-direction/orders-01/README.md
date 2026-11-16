# 1A — Orders folder / purchase document

Status: **in review**. This is a first focused implementation, not an accepted
final interface. Compare the folder with the right-hand document in the
[approved concept](../approved-tabletop.png). The board and other visual groups
remain queued in the [worklist](../VISUAL_WORKLIST.md).

## Actual Godot captures

- [Desktop purchase document](desktop.png), 1440 × 900.
- [Expanded folder](expanded.png), 1440 × 900.
- [Compact document](compact.png), 960 × 540.
- [Compact scrolled unit list](scrolled.png), 960 × 540.

These are unedited application renders in Godot 4.7.2, using software OpenGL.
The draft was entered through native mouse input: three infantry, two artillery
and one tank, costing 23 IPC and leaving 7. It was not committed to a campaign.

## Changes to review

- Matte manila card and ivory paper replace the gold-looking folder surface.
- Content begins inside the front sheet; serif headings have a clearer size
  hierarchy. The short-screen view combines the orders and country heading.
- Muted paper bands hold the phase/treasury and separate draft/remaining totals.
- Thin printed paper counters, category tabs, clearer unit rows and a restrained
  olive action replace the heavier beveled controls.
- A visible scroll thumb makes additional unit types discoverable. Totals and
  the action stay below the scroll area; the folder stays against the right edge.
- Tuck, reopen, expand and restore controls retain their behavior and draft.

## Verification

The visual suite passes 166 checks, including a regression check for category
changes after resizing. Gameplay, save and LAN smoke checks also pass. A separate
rendered input review passes 12 checks covering draft entry,
unchanged treasury before confirmation, purchase affordability, native wheel
scrolling, compact placement, and tucking/reopening without losing the draft.
This establishes behavior and captures the appearance; visual acceptance remains
with the user. Hardware performance and a real phone have not been tested here.
