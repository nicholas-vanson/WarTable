# Preview 1A.5 — stacked sheets with vertical tabs

Status: **in review**. Implements the clarified paper-tab markup on
[preview 1A.4](../orders-04/README.md).

All / Land / Air / Sea each belong to a complete cream paper sheet. Its tab is
part of the same textured outline and projects from the left paper edge at the
marked location. Four staggered sheets, thin edges and light contact shadows
show the stack inside the folder. The selected category's page draws on top,
with its tab joined continuously to the visible document.

Tab labels rotate **90° counterclockwise**, reading upward along the sheet.
Native buttons retain mouse, touch, keyboard focus and accessible labels; their
background is supplied by the sheet below. Tabs remain fixed while purchases
scroll and tuck away with the folder. Removing the former internal index column
restores the purchase list's full width.

[Land sheet, matching the marked-up view](expanded.png) ·
[Air sheet selected](air.png) · [Compact layout](compact.png)

These are actual, unedited Godot renders: France theater, 1440 × 900 expanded
view and the same 23 IPC draft; compact view is 960 × 540. The main ORDERS
title, board and ocean keep their previous appearance. The existing approved
stationery supplies all paper texture; there is no new concept image.

Validation: 166 existing world visual checks and 24 rendered input checks pass.
Checks include category switching, bringing the selected sheet forward, tab
projection and separation from controls, compact layout, scrolling, purchase
draft preservation and tucking/reopening. Software rendering verifies the
appearance and interaction here, not target GPU performance.
