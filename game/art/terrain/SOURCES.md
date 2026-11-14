# Global relief assets

The checked-in PNGs cover the entire existing Global 1940 board. They are
offline runtime assets: no network access, Python, or GIS software is needed to
play the game.

## Elevation provenance and limits

The source is the grayscale `gebco_08_rev_elev_21600x10800.png`, a display raster
derived from the IHO–IOC **GEBCO_08 global terrain grid**. GEBCO data are publicly
available for reuse with attribution. [GEBCO data products](https://www.gebco.net/data-products)

The exact source copy used is pinned to commit
`a3ee496d149f90f897f67b64bb54a494d48b80a7` of
[earth-heightmap-normal-calculator](https://github.com/doleckijakub/earth-heightmap-normal-calculator).
Only its GEBCO raster is used; its program code is not incorporated.

Source SHA-256:
`4a70590d40dd7b9c69b9ab359d1dc4475ce97c1d2d13625223b248364112c699`.

The game board is geographically distorted and has enlarged islands and
playable territories. `tools/build_relief.py` registers the elevation raster to
204 approximate regional longitude/latitude control points. The registration
is piecewise affine, wraps horizontally, and preserves the authoritative game
polygons and adjacency graph. It is a visual adaptation, **not a surveyed DEM
or a replacement for the rules map**. Heights are normalized, exaggerated
display relief; they do not specify measured elevations in meters. The original
8-bit display raster and its registration limit local geographic fidelity.

Terrain color is an original elevation/latitude-based survey-model palette,
independent of ownership. Shadow and relief lighting are computed in Godot.
The PNGs contain no baked lamp shadows or country colors.

## Rebuild

With Python 3 and numpy, scipy and Pillow installed:

```sh
python tools/build_relief.py --source /path/to/gebco_08.png --download
godot --headless --editor --path . --import
```

The downloader verifies the pinned SHA-256 before reading the raster. Without
`--download`, an existing verified source file is used. The 18 MB source is not
required at runtime and is not committed. `registration.json` records territory
order and geographic anchors for reviewing or improving the fit.

`global_height.png` stores normalized relief. `global_geography.png` stores the
natural surface colors. `global_territories.png` is **data**, not color artwork:
R/G encode the territory ID, B encodes normalized distance into its interior,
and A encodes distance from its boundary. Ownership alpha is strongest near
the inside edge and falls to zero toward the center. Runtime palette updates
change control, legal destinations and battle/selection states without altering
the land mesh or gameplay state.

## National miniature assets

`game/unit_miniatures.gd` creates original low-poly tabletop miniatures in Godot,
using shared cached meshes with faction-colored paint. The forms are stylized
equipment references, not externally sourced or museum-accurate model scans.
Each of the nine powers has land, air and naval profiles; UK Pacific and Dutch
forces also have profiles. Land, air and sea groups consolidate at theater zoom;
closer zoom shows separate unit types and their counts. The inspector always
lists the complete forces.

Tank references are Panzer III, T-26, Type 97 Chi-Ha, M2A4, Vickers 6-ton,
Matilda II, M13/40, Vickers Mk VI, Somua S35 and Dutch Vickers Model 1936.
Infantry vary in helmet brim/crest and painted equipment. Aircraft and naval
profiles vary in proportion and configuration. These are a starting asset set;
further equipment-specific sculpting can replace individual cached meshes
without changing the game rules, terrain or stack layout.
