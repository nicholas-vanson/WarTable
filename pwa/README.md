# WarTable · Western Front

A local, phone-first PWA for a partial German combat turn. On another machine, clone the private repository and switch to `pwa/europe-playtest`. The working application is in `pwa/`. The earlier Godot project and its backups are preserved. The [design record](DESIGN.md) captures the decisions for subsequent milestones.

## Play

For a hosted copy use HTTPS, open the playtest in Chrome on the Galaxy, then choose **Install app** or **Add to home screen**. Allow the first load to finish before going offline. Device storage holds the current match, in-progress orders, battle dice and map view. Each browser or install origin has its own local game. GitHub synchronizes development files across machines.

The downloadable archive contains the complete static site. The single-file HTML edition includes the map and game in one file for browsers that open local HTML. Browser policies for local files vary; use the HTTPS edition for home-screen installation.

1. Pan across Europe, pinch to zoom, use the theater overview button, then recenter on the western front.
2. Select Holland Belgium or Western Germany. Choose an adjacent French target and assign infantry and tanks. Holland Belgium can reach both French targets. Western Germany can reach France.
3. Add an order. Select the row to revise or cancel it. Close and reopen mid-plan to check the save.
4. Hold to commit all attacks. Choose a battle, roll, and manually assign German losses. Defenders take the cheapest legal casualties. Between eligible rounds choose to continue or retreat.
5. After the last battle, review the committed actions. Open the field guide to restart.

## Run and distribute

No install or build is required for development:

```sh
cd pwa
python3 -m http.server 8080
```

Open `http://localhost:8080/` on that machine. Service workers require HTTPS or localhost. For rules tests run `node --test tests/*.test.js` in this directory. To package a release, run `python3 tools/package.py /tmp/wartable-release`. Its `site/` directory can be hosted under any HTTPS path. `WarTable-PWA.zip` and `WarTable-Playtest.html` are the release downloads. Bump the cache version in `sw.js` when publishing a revised site.

## Rules and map sources

The exercise uses a deliberately arranged position with adjacent land combat only. Infantry attack on 1 and defend on 1–2. Tanks hit on 1–3. Casualties return fire in their round. All retreating attackers withdraw together to one eligible origin. Move legality uses the playable territories' adjacency graph. Physical coastlines and the broader atlas provide geographic context; the four depicted territory outlines are original approximations. Capital treasury, national income, facilities, air and naval rules, noncombat, AI and multiplayer are later scope. This exercise makes no claim to full rules coverage.

- [Europe 1940 Second Edition rulebook](https://www.axisandallies.org/files/rules/Axis-Allies-Europe-1940-Second-Edition.pdf), especially Combat Move, Conduct Combat, unit profiles, and the Global rules.
- [Europe Second Edition FAQ](https://www.axisandallies.org/files/AA-Europe-1940-2nd-Edition-FAQ.pdf).
- [Global 1940 Second Edition scenario](https://github.com/triplea-maps/world_war_ii_global/blob/master/map/games/ww2global40_2nd_edition.xml), consulted to cross-check territory names and adjacency.
- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) public-domain 1:50m geographic data: land derived from admin polygons, rivers, lakes, and GRAY_50M_SR_W shaded relief. Schematic transport lines are visual context. The original atlas can be rebuilt with `tools/draw-atlas.py DATA_DIR`, Python, Shapely, Pillow and NumPy. Supply the three Natural Earth GeoJSON files as `admin_0_countries.json`, `rivers_lake_centerlines.json`, `lakes.json` and the extracted relief TIFF as `GRAY_50M_SR_W.tif`.

This is an independent research playtest. Its map, symbols and arranged starting forces are original.
