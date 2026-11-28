# WarTable · Western Front

A local, phone-first PWA for a partial German combat turn. On another machine, clone the private repository and switch to `pwa/europe-playtest`. The working application is in `pwa/`. The earlier Godot project and its backups are preserved. The [design record](DESIGN.md) captures the decisions for subsequent milestones.

## Play

[Open or install the current WarTable playtest](https://nicholas-vanson.github.io/WarTable/). Use this stable link in each release announcement.

For a hosted copy use HTTPS, open the playtest in Chrome on the Galaxy, then choose **Install app** or **Add to home screen**. Allow the first load to finish before going offline. Device storage holds the current match, in-progress orders, battle dice and map view. Each browser or install origin has its own local game. GitHub synchronizes development files across machines.

The downloadable archive contains the complete static site. The single-file HTML edition includes the map and game in one file for browsers that open local HTML. Browser policies for local files vary; use the HTTPS edition for home-screen installation.

1. Pan across Europe, pinch to zoom, use the theater overview button, then recenter on the western front.
2. Tap a German infantry (cross) or armor (ellipse) counter. Adjust the quantity and tap an adjacent French destination. Holland Belgium can reach both French targets. Western Germany can reach France.
3. Split the remaining stack for another destination, or add a different type to the same route. Select an order to revise or cancel it. Close and reopen mid-plan to check the save.
4. Hold to commit all attacks. Choose a battle, roll the German attack, then roll French return fire. Dice roll by unit type. Each group settles and shows its hits before the next group rolls. Attack hits are red and defense hits are charcoal. Manually assign German losses. Defenders take the cheapest legal casualties. Between eligible rounds choose to continue or retreat.
5. After the last battle, review the committed actions. Open the field guide to restart.

## Two phones on Wi-Fi

Extract the [host ZIP](https://nicholas-vanson.github.io/WarTable/downloads/WarTable-PWA.zip) on a computer with Node.js 22 or later. From the extracted folder (or from `pwa/` in this source tree), run `node lan-server.mjs`. Open the printed Wi-Fi URL in both phone browsers. In **Multiplayer**, the first player chooses **Host a room** and a side. The second opens the invitation or enters the room code. The host can then **Start match**. Both browsers can return through the room list and **Resume**. See [Wi-Fi setup](WIFI-PLAY.txt) for network and saved-room details.

## Run and distribute

No install or build is required for development:

```sh
cd pwa
python3 -m http.server 8080
```

Open `http://localhost:8080/` on that machine. Service workers require HTTPS or localhost. For rules tests run `node --test tests/*.test.js` in this directory. To package a release, run `python3 tools/package.py /tmp/wartable-release`. Its `site/` directory can be hosted under any HTTPS path. `WarTable-PWA.zip` and `WarTable-Playtest.html` are the release downloads. Bump the cache version in `sw.js` when publishing a revised site.

## Reading the board

Planned attacks group by destination, with an editable order for each origin. The battle picker shows both forces and flags victory cities. The two combat-header columns show the forces rolling this round. Confirming casualties or resolving a round applies both sides’ losses together. In the review, expand a battle round to see losses by side and the recorded dice.

The atlas marks victory cities that are power capitals with an ochre star, and the other victory cities with a green diamond. Each counts as one victory city. See pages 6 and 34 of the [Europe 1940 Second Edition rulebook](https://www.axisandallies.org/files/rules/Axis-Allies-Europe-1940-Second-Edition.pdf).

Tap **Orders** in the center of the bottom bar to hide or reopen the panel. The same bar holds Menu, War Status, Review, and Guide. War Status compares the two sides’ victory cities, income, and forces in the current position. Open **Settings** in the board header to change map and control preferences during play. Drag the grip on the panel’s map-facing edge to resize it. The panel remembers its portrait height and landscape width separately.

In **Guide → Objectives**, expand a geographic objective and choose **Show on map**. Solid green outlines meet the location condition and dashed rust outlines mark unmet conditions. Use Locate to find an individual territory or sea zone. Back to Guide restores the board camera and pending orders.

The turn briefing has one action, **Begin turn**. Open **Guide → Technology** to review advances for all powers or a selected power and read both development charts.

Research opens with **Save for purchases** selected. Hold to skip at no cost, or choose **Fund research**, set the dice, and review the IPC cost, remaining treasury and chance of at least one six before holding to roll.

The border band follows the current controller of each of the four playable territories. Germany uses olive hatching and France uses blue hatching in the opposite direction. Tap a territory to read the controller in the map footer. A capture updates the band when the battle resolves.

Home counters get slightly different positions near each territory’s center in each new exercise. Their arrangement is saved with the local match. Selecting a counter draws a short selection-orange pencil loop. Red pencil arrows start broad at the departing stack and taper to a small point at the incoming counter. Larger stacks leave wider strokes, and long routes have short breaks in the drawing. A new planned arrow draws from its origin and shows a faint broken highlight. Committing the orders darkens the pencil. A red pencil front with ticks facing the attackers extends as units join each origin’s attack and stays on the map until it is canceled or resolved. The combat model pools losses by unit type. When two origins contribute that type, the map distributes its surviving icons proportionally between those approaches.

Tap numbered water to inspect a sea zone and its adjacent zone numbers, including connections beyond the atlas. The dashed dividers and hit areas are original drawings fitted to this coast. The local exercise contains 25 visible zones and supports land combat. Sea-zone numbers and adjacencies follow Global 1940 Second Edition. To regenerate the chart, use Python with Shapely and run `python3 tools/draw-sea-zones.py`. The builder checks shared edges and playable coastal contacts against the project's Global 1940 connection data.

## Staff Map artwork

The survey plate combines original painted material swatches for plains, woodland, uplands and open water with scale-independent printed detail. Coastlines, rail ties, roads, contour lines and settlement blocks render at the current zoom. Painted impressions vary in position, size and angle across the theater. The sea uses the same relief grid as the land to shade the continental shelf and draw depth contours. A narrow shoreline wash follows the registered coast. The plate is self-contained for offline use and uses the same coordinate space as the interactive territories. The roads and town footprints are generalized illustrations.

To rebuild the plate, run `python3 tools/paint-staff-map.py` with Pillow, NumPy, SciPy, ContourPy, Matplotlib, Playwright and Chromium installed. The original AI-generated color swatches, registered geography, hillshade and cropped elevation grid are in `tools/art/`. The detailed plate stores painted terrain in overlapping raster tiles beneath the survey linework. A two-pixel-per-map-unit overview is rendered from that same plate. Close zoom switches to the detailed plate as soon as the screen would enlarge an overview pixel.

The regional contours are in meters and derive from the GMT 6-arc-minute Earth Relief grid (SRTM15+ v2.7). The grid stored here spans 13° W–46° E and 36°–69° N. Rows run north to south and the stored integers represent half meters, matching the source encoding. [GMT data source](https://oceania.generic-mapping-tools.org/server/earth/earth_relief/earth_relief_06m_g.grd) · [Tozer et al., 2019](https://doi.org/10.1029/2019EA000658)

## Rules and map sources

The exercise uses a deliberately arranged position with adjacent land combat only. Infantry attack on 1 and defend on 1–2. Tanks hit on 1–3. Casualties return fire in their round. All retreating attackers withdraw together to one eligible origin. Move legality uses the playable territories' adjacency graph. Physical coastlines and the broader atlas provide geographic context; the four depicted territory outlines are original approximations. Capital treasury, national income, facilities, air and naval rules, noncombat, AI and multiplayer are later scope. This exercise makes no claim to full rules coverage.

- [Europe 1940 Second Edition rulebook](https://axisallies.com/rules/axis-allies-rules-europe1940-second-edition.pdf), especially Combat Move, Conduct Combat, unit profiles, and the Global rules.
- [Europe Second Edition FAQ](https://www.axisandallies.org/files/AA-Europe-1940-2nd-Edition-FAQ.pdf).
- [Global 1940 Second Edition scenario](https://github.com/triplea-maps/world_war_ii_global/blob/master/map/games/ww2global40_2nd_edition.xml), consulted to cross-check territory names and adjacency.
- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) public-domain 1:50m geographic data: land derived from admin polygons, rivers, lakes, and GRAY_50M_SR_W shaded relief. Schematic transport lines are visual context. The original atlas can be rebuilt with `tools/draw-atlas.py DATA_DIR`, Python, Shapely, Pillow and NumPy. Supply the three Natural Earth GeoJSON files as `admin_0_countries.json`, `rivers_lake_centerlines.json`, `lakes.json` and the extracted relief TIFF as `GRAY_50M_SR_W.tif`.

This is an independent research playtest. Its map, symbols and arranged starting forces are original.
