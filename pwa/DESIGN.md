# WarTable design decisions

This document carries the agreed direction forward across machines. The local exercise in this branch is the first milestone.

## Rules and control

The standard mode enforces Axis & Allies Global 1940 Second Edition as written. Explain blocked actions. Apply the official rulebook and errata when implementing additional phases. A future sandbox may add house rules, overrides, and reassignment.

Assign every power to the host, a remote player, or AI during setup. One person can control several powers. Assignments lock at match start. Use the official power turn order. Each player using their own device is the primary experience. Pass-and-play is secondary.

## Asynchronous matches

The host chooses 8 hours, 1 day, 2 days, 1 week, or indefinite for a power's turn. Start a fresh timer as soon as the preceding power finishes, even for consecutive powers with the same player. After a deadline, let an actively playing person continue until they exit or go 15 minutes without a game action. On takeover, notify the player and temporarily lock their controls. AI finishes from the current position, respecting commitments and preserving legal unfinished plans where possible. The player controls their next turn.

Apply match-wide AI settings and difficulty to every computer player, including temporary takeovers. Use prior purchases, movements, and pending plans as evidence of intent. An online match continues when the host closes the app. A later two-device test will add an authoritative game service, persistent match storage and scheduled deadlines. The local milestone uses device storage.

## Standing orders

Start every player with a conservative defense profile. Scramble eligible fighters. Allocate before resolving battles, first to sea zones opposing amphibious assaults, then by defending IPCs at stake, then by sea-zone number. Apply all eligibility and per-base limits. Take the lowest-IPC legal casualties first. Keep room for later player editing of these priorities.

## Playing and reviewing a turn

All players may watch tentative moves, cancellations, and phase changes on the live board. Allow revision throughout purchases, combat movement, noncombat movement and placement. Hold to commit each phase; releasing early preserves the plan. Let the attacker choose battle order wherever the rules permit. The attacker manually assigns their own casualties from scratch. At each eligible round boundary, pause for their decision to continue or retreat.

Publish one shared review after each nation's turn. Include committed moves, battle outcomes, and transitions to and from AI. Everyone can consult previous turns at any time and resume at the first unseen event with “Since my last visit.” The first local exercise uses its last battle as the review boundary.

## Platforms and board

The entire game must be playable on a modern Samsung Galaxy. Phones and tablets are primary, with desktop support desirable. Prefer landscape if only one orientation is practical; retain support for portrait where feasible. The PWA launches in a standalone window after installation.

Use the Staff Map concept: period-inspired colors, cartographic lettering, named territories and boxed tactical symbols at overview scale. Add richer unit illustration and counts at close zoom. Subtle panning parallax is desirable. Keep free rotation and full 3D deferred. Support future player-selectable themes and understated phase treatments, including Situation Map pencil-like routes in combat. Keep game decisions independent of how the map is rendered.

## Project history and research

The earlier Godot work is preserved on GitHub in `backup/2026-11-19-source` and `backup/2026-11-19-android`. TripleA's Java engine is GPLv3. The Global 1940 map and WWII Global Strategy's game assets had no verified license for reuse in our research. This PWA implements its own code, scenario and map artwork.

References: [TripleA engine](https://github.com/triplea-game/triplea), [Global map repository](https://github.com/triplea-maps/world_war_ii_global), [WWII Global Strategy](https://www.wwiiglobalstrategy.com/).
