# Preview 1A.4 / 2A.3 — paper index and quieter water

Status: **in review**. Implements the three positioned comments on
[preview 1A.3 / 2A.2](../orders-03/README.md).

1. Ocean detail is quieter and irregular across the full board. The depth
   gradient, shelf widths and palette are retained. Randomly phased, gently
   warped detail replaces evenly spaced noise cells, and the repeating ground
   grain no longer contributes to water color.
2. All / Land / Air / Sea now form an index within the existing cream paper
   margin. The active sheet has a subtle cut edge joining the document; all
   labels use its continuous paper grain. There are no manila tabs projecting
   outside the folder. The purchase list is inset beside the index and scrolls
   independently. Compact unit illustrations leave room for the controls.
3. ORDERS is left-aligned within the main tab, scaled from 13–19 px according
   to folder height. It remains the single panel title.

[Expanded folder, matching the marked-up view](expanded.png) ·
[Unobstructed map](map.png) · [Compact layout](compact.png) ·
[World overview](world.png)

These are actual, unedited Godot renders. The expanded view uses the France
theater, 1440 × 900 viewport and 23 IPC purchase draft from the annotation.
The compact view is 960 × 540. All land pixels and ownership styling are
unchanged from the previous pass.

Ocean depth remains illustrative rather than surveyed. The new detail is baked
into the existing surface texture and adds no geometry or runtime sampler.
See [terrain sources](../../../game/art/terrain/SOURCES.md) for its construction.

Validation: Godot 4.7.2 import, 166 world visual checks and gameplay/save/LAN
smoke checks pass. Twenty-two rendered interaction checks pass, including
category clicks, index containment, separation from the purchase controls,
scrolling, draft preservation, compact bounds and tucking/reopening. Final
captures also check the smaller unit-name type and illustration spacing.
Software-rendered previews do not establish target GPU performance.
