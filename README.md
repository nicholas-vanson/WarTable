# Crossroads Command

An unofficial, independently built WWII strategy game prototype. **0.9 makes the wraparound world board playable in local pass-and-play.** The seven-territory Germany–France scenario is available locally and over the same Wi-Fi network.

## Play 0.9 on Windows

Open `dist/CrossroadsCommand-0.9.exe` on an x64 Windows PC. Choose **Play Global 1940** for the world game. **New Western Europe game** opens the Germany–France scenario. In that scenario, hold both Paris and Berlin when you collect income to win. Select either city above the map to focus the board on it.

1. **Purchase.** The Treasury, Draft cost and After purchase boxes update as you change quantities. Purchased units wait off the board until mobilization.
2. **Combat move.** Select units from a friendly stack or use the quantity controls, then select a highlighted destination and queue the move. For a two-space tank move, choose the desired route in the destination list. Dashed arrows show the current preview. Solid arrows show queued moves, with the number of committed units at the destination. You can remove them individually before committing.
3. **Conduct combat.** Choose a pending battle on the map. Both forces appear in the battle overlay, grouped by their hit thresholds. Red attack dice and charcoal defense dice launch by unit group, bounce and collide, then settle on the recorded results. Checkmarks and unit icons identify hits and their source. Up to 24 dice appear per roll and the log keeps every result. Select casualties on the map or in the overlay. Marked defenders still return fire. Surviving attackers can roll another round or retreat together through a legal entry territory. Empty enemy territory is captured during movement.
4. **Noncombat move.** Redeploy unused units through friendly territories. Newly captured territory can receive units.
5. **Mobilize.** Select any eligible factory and assign units within its remaining capacity. Planned stacks carry a `+` count on the map. Return to a factory and use `−` to free units for reassignment. Once all units are assigned, commit them together.
6. **Collect income.** Review production by territory and collect IPCs. If you control both victory cities, the match ends. Otherwise, hand off the turn. Rounds advance after France finishes.

Click land or water to inspect regions. Use the wheel or the zoom buttons to zoom. When zoomed in, drag the map to pan or click the inset overview to jump to a sector. Select the percentage button to fit the whole map again. Select **Hide orders** for a wider map. The map footer exposes the current action for movement plans, battle rolls and losses, and prepared mobilization.

Optional skips for purchases, movement and empty mobilization require confirmation. **Keep playing** is the default choice in the dialog.

For two devices on the same Wi-Fi:

1. Open the same build on both devices and choose **Multiplayer**. The host selects **Host a new game as Germany** and shares the host's Wi-Fi IP address and eight-character invite code.
2. France enters those details and selects **Join game**. If several addresses appear, use the one listed for the host's Wi-Fi adapter in Windows network settings.
3. The game prompts the current decision maker, including the defending side during the other player's turn. France can reconnect with the same invite while the host keeps the game open.

Hosting uses UDP port `41740`. If Windows prompts for local access, allow it on the private network. A guest Wi-Fi network that isolates devices can prevent joining.

The game autosaves each accepted order, including dice and pending casualty decisions. Existing saves keep the five-territory scenario and replay their recorded results. 0.7 writes to separate save files, so the previous executable can still use its own saves. **Continue local game** and **Resume hosted game** use separate save slots. A resumed host gets a fresh invite code. Uncommitted purchases, movement and mobilization plans are local drafts.

## Play 0.9 on Android

Open `dist/CrossroadsCommand-0.9.apk` on an ARM64 phone or tablet running Android 7.0 or later. The APK uses the same test certificate as 0.7 and 0.8. Tap **Update** or **Install**. If Android prompts, open **Settings**, enable **Allow from this source** for the file manager, then return to finish installation. [Android installation help](https://support.google.com/pixelphone/answer/7391672)

Drag to pan, pinch to zoom and tap units or territories. **Orders** opens the phase controls over the map. The drawer collapses on movement phases, and the footer carries queue and commit actions. For a Western Europe same-Wi-Fi test, use 0.9 on both devices.

## Play the world board

**Play Global 1940** starts or resumes a local match on the full 332-space board. The opening placements and initial relationships come from the Global 1940 Second Edition data. Turn order is Germany, Soviet Union, Japan, United States, China, United Kingdom, Italy, ANZAC and France. The United Kingdom has one turn and separate Europe and Pacific treasuries. [TripleA scenario data](https://github.com/triplea-maps/world_war_ii_global/blob/master/map/games/ww2global40_2nd_edition.xml), [Second Edition rulebook](https://renegadegamestudios.com/axis-allies-1940-europe-second-edition/)

Tap a friendly territory or fleet, select units, and tap a highlighted destination. Queue each move before committing the phase. **Sea crossing** offers direct transport orders for selected land units where the route is clear. **Land** in Noncombat shows surviving air missions that need a landing site. **Inspect** shows the live garrison, production, and links. The map and autosave update on accepted orders.

Global 1940 is an opening-play prototype. It supports land, air and sea routes, base range bonuses, canals, tank and mechanized blitzing, limited declarations, uncontested crossings, basic battle rounds, production and income. Global LAN, victory, national objectives, detailed diplomacy, combat transport escorts and loading across turns, carrier task forces, strategic bombing, AAA fire, and specialized submarine and amphibious combat remain pending.

The world table uses the ambientCG Wood049 color, normal and roughness maps under a warm moving lamp. Close-zoom 3D landmarks use ambientCG Ground030 with a shadow-casting light. Both materials are CC0. [Wood049](https://ambientcg.com/view?id=Wood049), [Ground030](https://ambientcg.com/view?id=Ground030)

## Explore the 1940 world map

Open **Explore the 1940 world map** from the title screen or **World map** during a match. Pan continuously east or west, use **Jump to…** to reach a theater, and zoom in to reveal territory names, production, and 3D landmarks. Tap a region to highlight its connected regions and open **Details** for its garrison, owner and links. **View on board** returns to a playable territory when the atlas is opened during a Western Europe match.

The standalone atlas shows the 1940 opening positions. If opened from a Western Europe match, its seven playable regions reflect that match. [TripleA map data](https://github.com/triplea-maps/world_war_ii_global/tree/master/map)

## Rules and product boundaries

- **Edition.** The publisher's Second Edition Europe and Pacific books, the Global overrides, and applicable setup corrections are the reference. Use Global setup and political rules when they override the standalone versions. Treat optional research and house rules as separate settings after the core campaign works. [Europe rulebook download](https://renegadegamestudios.com/axis-allies-1940-europe-second-edition/), [Pacific rulebook download](https://renegadegamestudios.com/axis-allies-1940-pacific-second-edition/), [setup charts and FAQs](https://www.axisandallies.org/resources-downloads/)
- **Fidelity.** Implement standard dice and preserve who chooses each action, including out-of-turn defense. Record each rule interpretation against its source and a test. Use TripleA's Global module as a comparison case for rule and UX questions. [TripleA Global module](https://github.com/triplea-maps/world_war_ii_global), [TripleA player guide](https://triplea-game.org/user-guide/rule-book)
- **Western Europe scenario.** The seven-region land links follow the matching territories in TripleA's Global 1940 Second Edition data. The map geometry, two-country opening forces, production values, sea boundaries, and Paris–Berlin victory rule are scenario-specific. [TripleA Global 1940 Second Edition data](https://github.com/triplea-maps/world_war_ii_global/blob/master/map/games/ww2global40_2nd_edition.xml)
- **Presentation.** Use original map art, tokens, names for the product, and in-game explanations. Keep territory adjacency, income, unit profiles and starting forces in scenario data separate from the art. [U.S. Copyright Office guidance on games](https://www.copyright.gov/register/tx-games.html)
- **Platforms.** Use Godot and GDScript for a shared Windows and Android project. The Windows test build is an unsigned executable. The Android preset targets ARM64 and enables networking. Export an APK after setting up the Android build tools and verify it on a phone. [Godot Windows export](https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_windows.html), [Godot Android export](https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_android.html)
- **Multiplayer.** Start with two seats over private Wi-Fi. The host owns the rules, validates commands and rolls the dice. The campaign should support two to six players with a player able to control several distinct powers. For cross-home play, add private invite rooms using a hosted relay or server over an authenticated, encrypted connection. [Godot multiplayer networking](https://docs.godotengine.org/en/4.7/tutorials/networking/high_level_multiplayer.html)

## Milestones

| Milestone | Acceptance check |
| --- | --- |
| **0.1 Land battle** | Two seats can complete a fight with infantry, artillery and tanks. Artillery support, return fire, casualties, retreat and control work. Both players see the same dice and outcome. |
| **0.2 Interactive board** | The sector map has zoom, pan, selectable regions, on-map unit stacks, an attack route preview and animated movement and losses. Both seats play the drill from the board. |
| **0.3 Complete turn on a small map** | Both players can complete the land turn sequence. A saved game can resume at a pending decision. The UI highlights legal destinations and explains rejected orders. |
| **Global opening** | An independently drawn, zoomable map has verified land and sea connections and a checked starting order of battle. A scripted opening round tests the nine powers, the UK's two treasuries, diplomacy, air landing, and naval and amphibious combat. |
| **Campaign and private remote play** | An end-to-end game applies national objectives, capital capture and liberation, and theater-specific victory timing. Two to six players can finish, resume, and reconnect to a private game. |

Prioritize next-turn and casualty prompts, visible income breakdowns, reversible planning before orders are committed, and short explanations next to the decision they affect. Add a first-turn walkthrough once the phase flow is stable.

## Build and test

Open `project.godot` in Godot **4.7.2 Standard** with the matching export templates. Run the main scene to develop. With the Windows console editor on `PATH` or substituted by its full path, run these commands from the project root:

```powershell
godot --headless --editor --path . --import
godot --headless --path . --script res://tests/smoke.gd
godot --headless --path . --script res://tests/visual_world.gd
New-Item -ItemType Directory -Force dist | Out-Null
godot --headless --path . --export-release 'Windows Desktop' 'dist/CrossroadsCommand-0.9.exe'
```

The smoke test checks both turns, movement and factory restrictions, the coastal blitz route, map controls, victory, save compatibility, and two ENet peers on localhost. The network portion requires localhost UDP access. For a device check, use two devices on the same private Wi-Fi and have France leave and rejoin during casualty selection.

### Global tabletop renderer

**Play Global 1940** and the world atlas use the same full-board 3D relief renderer.
The camera looks straight down; the 8K RG16 heightfield, directional lighting, shadows and perspective
produce depth while panning. Ownership is a transparent wash near the inside of
each territory boundary, fading toward its natural terrain center. The slim top
strip shows the current round, phase, power and treasury. The paper orders folder
has collapse and maximize controls; its edge tab reopens it. The interface uses
actual folder, brass, painted-metal and unit-illustration artwork, with Old
Standard TT serif lettering. The approved reference is retained in
[the art direction guide](docs/art-direction/README.md).

National armies use faction-painted procedural tabletop miniatures. At theater
zoom, forces consolidate by power and land/air/sea domain; zoom closer for separate
unit types and counts. The inspector always lists complete forces. These original
stylized sculpts can be refined individually without changing the rules. The world
terrain uses a GEBCO-derived raster registered to the existing, deliberately
distorted playable board; it is not survey-grade geography. See
[terrain sources and rebuilding](game/art/terrain/SOURCES.md).

The visual suite checks projection/picking across continents, ownership changes,
every power's unit meshes, horizontal wraparound and the folder at desktop and
small-screen sizes. For real-render captures on a graphical desktop:

```sh
godot --path . --script res://tests/visual_world.gd -- --capture-dir /absolute/output/path
```

GPU and actual Android-device performance should be checked on the target device.
The renderer uses view-culling, shared meshes and coarser terrain at world overview
to reduce work. Close-ups use up to 64 times the first pass’s triangle density.
All runtime terrain assets are included; no terrain downloads or
Python dependencies are required to run the game.

The small **☰** display menu selects High detail (default), Balanced or Performance.
Performance reduces geometry and disables cast shadows while keeping the same
terrain data, overhead camera, political overlays and material artwork. The
choice is stored locally in `user://display.cfg`.

The `-- --touch-layout` argument enables the Android layout in a desktop window. To regenerate `game/global_1940.json`, run `python tools/import_global_map.py <source-directory> game/global_1940.json` with the TripleA map’s `centers.txt`, `polygons.txt`, `map.properties` and `ww2global40_2nd_edition.xml` in the source directory.

For an Android test build, set the Java and Android SDK paths in the editor and use **Export With Debug** with the Android preset. Use a release signing key and verify real-device touch, networking and background/reconnect behavior before distributing it beyond the test group.

- `game/scenario.gd` defines opening forces, factory capacities, income and land adjacency.
- `game/turn.gd` validates phase orders and records accepted commands for replay and resume.
- `game/battle.gd` resolves land combat.
- `game/session.gd` handles player seats, autosave and authoritative snapshots.
- `game/map_data.gd` defines the chart geometry, points of interest and stack placement.
- `game/board.gd` renders the board and translates map input into region and stack selections.
- `game/board_dice.gd` renders and animates the accepted rolls in 3D over the board.
- `game/main.gd` connects the board to orders, local planning and the battle log.
- `game/start_menu.gd` presents the title screen and multiplayer menu.

The executable includes the Godot and third-party notices in its main menu. [Godot Engine license](https://godotengine.org/license/)

## Board terrain

The built-in ImageGen tool generated `game/art/western-relief.png`. The board clips the texture to the hand-drawn land polygons and tints territory control independently.

```text
Create one game texture asset for Crossroads Command, a WWII European tabletop strategy game. This is a new, original orthographic painted shaded relief texture. The user's reference screenshots are inspiration for the tactile painted terrain relief and scale of strategy maps only. An overhead view of temperate Western European land surface, full bleed with zero horizon, 3:2 landscape. Show rolling river valleys and fields in north and center, subtly darker wooded hills, then recognizable raised chains of gray alpine crags and ridges across the lower-right, and smaller Pyrenean mountains in lower-left. Soft northwest top-light, atlas-like shading with realistic rock structure and fine tree canopy grain, subtle variety of texture, subdued olive brown and pale gray in a compressed midtone contrast range. Almost continuous varied land mass, including at the edges: it's going to be applied as low-opacity shading on a separately drawn political map. No sea or lakes, coastlines, labels, symbols, flags, UI, contour outlines, hard grids, settlements, writing, frame, vignette, watermark, units or vehicles.
```

## Title screen art

The built-in ImageGen tool generated `game/art/map-room.png` using this prompt.

```text
Use case: historical-scene. Asset type: title-screen backdrop for Crossroads Command, an original tabletop strategy game set in Western Europe in 1940. Create a widescreen cinematic photograph of a wartime planning room, seen from slightly above the edge of a large dark wooden map table. The right two thirds show a large folded topographic chart of Western Europe and the English Channel, a few miniature tanks and wooden troop markers, a brass compass, a straightedge, and a warm shaded task lamp at upper right. The left third falls into deep slate-blue shadow and stays visually quiet for a game menu overlay. Restrained palette of ink blue, aged parchment and warm brass, realistic tactile materials, rich but clear contrast. Keep the map and pieces as the dominant subject. No people, readable text, UI, flags, political symbols, logos or watermark.
```
