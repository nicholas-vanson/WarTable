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

The runtime heightfield is **8192 × 3416**, with normalized height packed into
16-bit R/G channels and a separate land mask in B. It uses the full
21600 × 10800 source rather than the first pass's 5400 × 2700 reduction. Colors
and political masks originally used 4096 × 1708. The satellite surface below
now uses an 8192 × 3416 registered texture. Close-up mesh spacing is one world unit,
compared with eight in the first pass; theater spacing is two. Geometry is
view-culled, with bounded high-detail caching and coarser overview tiles.

The game board is geographically distorted and has enlarged islands and
playable territories. `tools/build_relief.py` registers the elevation raster to
204 approximate regional longitude/latitude control points. The registration
is piecewise affine, wraps horizontally, and preserves the authoritative game
polygons and adjacency graph. It is a visual adaptation, **not a surveyed DEM
or a replacement for the rules map**. Heights are normalized, exaggerated
display relief; they do not specify measured elevations in meters. The original
8-bit display raster and its registration limit local geographic fidelity.
Full-source sampling, edge-preserving detail damping and RG16 storage retain
finer slopes while avoiding exaggerated quantization terraces in lowlands.

## Satellite-style surface

`global_surface.png` replaces the pale elevation palette in the live terrain
material. It uses `example/img/earth-blue-marble.jpg` from
[three-globe](https://github.com/vasturiano/three-globe/tree/1e1f4400b80179809f761e632e207d9a3cfc298e),
pinned to commit `1e1f4400b80179809f761e632e207d9a3cfc298e`.
The source is a 4096 × 2048 Blue Marble world texture. The mirror's MIT notice
is included in `BLUE-MARBLE-LICENSE.txt`. Blue Marble imagery credit: NASA.

SHA-256: `228deba2e4b600146bdcb6cfa359b8ead6aacc2b1c13550a29cd82824cfa1c01`.

`tools/build_surface.py` registers this image using the same regional anchors as
the relief. It extends nearby source land colors into water before sampling to
accommodate enlarged islands and distorted coastlines, lifts dark midtones,
blends exposed high ridges toward rock/ice, and supplies a textured blue sea.
The 8K output provides smooth registration; its photographic
detail is limited by the 4K source. It is representative geography, not an exact
satellite survey or a historical photograph of the world in 1940. Source terrain
shading remains in the image; Godot adds the live mesh lighting and shadows.
Country colors are applied afterward by the shader: a broader, stronger wash
fades to transparent in territory centers. Fine diagonal hatching reinforces
the inner boundary band. The hatch is anchored to world coordinates, softens
with pixel footprint, and fades out at overview zoom to avoid moiré. Both wash
and hatching use the live ownership palette, including after captures.
Mipmaps and pixel-footprint slope sampling reduce shimmer at distant zooms.
World overview uses slope lighting without coarse-mesh cast shadows; theater
and close-up views restore the cast shadows (except in Performance mode).

### Ocean color and texture

The ocean remains flat geometry. `ocean_surface()` in `tools/build_surface.py`
bakes a deterministic, illustrative depth field from distance to the playable
coastline. Variable shelf width and multiscale pigment texture blend muted teal
shallows into darker blue basins. A subtle shelf-slope variation connects the
surface to the land's geographic appearance. Noise and distance sampling wrap
horizontally with the board. These are **suggested depths**, not measured GEBCO
bathymetry; the existing source raster contains land elevation only. No extra
water mesh, animated waves, runtime downloads or texture samplers are added.

## Rebuild

With Python 3 and numpy, scipy and Pillow installed:

```sh
python tools/build_relief.py --source /path/to/gebco_08.png --download
python tools/build_surface.py --source /path/to/blue-marble.jpg --elevation-source /path/to/gebco_08.png --download
godot --headless --editor --path . --import
```

The downloader verifies the pinned SHA-256 before reading the raster. Without
`--download`, an existing verified source file is used. The 18 MB source is not
required at runtime and is not committed. `registration.json` records territory
order and geographic anchors for reviewing or improving the fit.

`global_height.png` stores normalized RG16 relief and a B-channel land mask.
CPU ray picking and GPU displacement decode the same channels. A wider overhead
perspective lens and taller physical terrain make pan parallax visible. Surface
normals are evaluated from the high-resolution heightfield at fragment scale.
`global_surface.png` stores the current natural surface colors.
`global_geography.png` retains the earlier procedural palette for comparison.
`global_territories.png` is **data**, not color artwork:
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
