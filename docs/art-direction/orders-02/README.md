# Preview 1A.2 / 2A.1 — tab title and satellite surface

Status: **in review**. Implements the two positioned comments on the previous
expanded-folder screenshot.

1. The folder tab carries the main **ORDERS** title. Its repeated title on the
   paper is removed; the document starts with the country and controls. The
   folder's configurable title follows this convention at all sizes.
2. The relief has a satellite-style base texture registered from a Blue Marble
   world image. Natural vegetation, desert, rock and ice color is beneath the
   semi-transparent ownership gradient, which remains strongest inside borders.
   Light labels with dark outlines remain readable over the richer base.

[Expanded folder, matching the marked-up view](expanded.png) ·
[Full map with folder tucked away](map.png) ·
[Compact layout](compact.png) · [World overview](world.png)

These are actual, unedited Godot renders. The expanded view uses the same
France theater, 1440 × 900 viewport, expanded folder and 23 IPC purchase draft
as the supplied screenshot. The compact view is 960 × 540. Preview comparisons
should focus on the two requested changes; the wider visual worklist remains
in review.

The satellite source is 4096 × 2048, registered into an 8192 × 3416 board texture.
This is representative geography with adapted coastlines, not an exact survey
or historical 1940 imagery. The source and reproducible processing are documented
in [terrain sources](../../../game/art/terrain/SOURCES.md).

Validation: Godot 4.7.2 import, 166 world visual checks and gameplay/save/LAN smoke
checks pass. Twelve rendered purchase-input checks also pass, including budget
limits, scrolling, resizing, and preserving the draft when tucking/reopening.
Captures use software OpenGL and do not establish target GPU speed.
