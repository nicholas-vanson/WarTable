extends SceneTree

const Battle = preload("res://game/battle.gd")
const Session = preload("res://game/session.gd")
const Turn = preload("res://game/turn.gd")
const Scenario = preload("res://game/scenario.gd")
const Main = preload("res://game/main.tscn")
const GlobalTurn = preload("res://game/global_turn.gd")
const GlobalRules = preload("res://game/global_rules.gd")
const ATTACKER = Battle.Seat.ATTACKER
const DEFENDER = Battle.Seat.DEFENDER
const STEP = Battle.Step
const PHASE = Turn.Phase

var _failures := 0


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_battle()
	_test_turn()
	_test_legacy_save()
	_test_global_rules()
	await _test_atlas()
	await _test_global_board()
	await _test_hotseat()
	await _test_network()
	if _failures == 0:
		print("Passed battle rules, both turns, world atlas and touch input, autosave and LAN handoff.")
	quit(0 if _failures == 0 else 1)


func _test_atlas() -> void:
	var ui := Main.instantiate()
	root.add_child(ui)
	ui._session.save_prefix = ""
	ui._open_atlas()
	await process_frame
	await process_frame
	var atlas: Control = ui._atlas._map
	_check(atlas.regions.size() == 332 and not ui._menu.visible, "World atlas opens with every Second Edition zone")
	var france: Vector2 = atlas.regions.France.center
	_check(atlas.region_at(france) == "France" and atlas.region_at(france + Vector2(atlas.extent.x, 0)) == "France", "Land selection wraps across the world seam")
	_check("Germany" in atlas.regions["Western Germany"].links and not atlas.regions["110 Sea Zone"].units.is_empty(), "Atlas retains the opening positions and geographic links")
	atlas.focus("Japan")
	var previous: Vector2 = atlas._center
	atlas._pan(Vector2(-atlas.extent.x * atlas._scale() * 2.0, 0))
	_check(atlas._center.distance_to(previous) < 0.1, "Camera can pan through multiple full rotations")
	atlas.reset_camera()
	var base: Vector2 = atlas.get_global_rect().position
	root.push_input(_touch_event(0, base + atlas.size * 0.48, true), true)
	root.push_input(_touch_event(1, base + atlas.size * 0.52, true), true)
	var drag := InputEventScreenDrag.new()
	drag.index = 1
	drag.position = base + atlas.size * 0.65
	root.push_input(drag, true)
	root.push_input(_touch_event(1, drag.position, false), true)
	root.push_input(_touch_event(0, base + atlas.size * 0.48, false), true)
	_check(atlas._zoom > 1.5 and atlas._selection == "Japan", "Pinching zooms without firing a territory tap")
	ui._atlas._close()
	_check(ui._menu.visible, "Closing the atlas restores the previous screen")
	ui._menu.play_local.pressed.emit()
	ui._open_atlas()
	atlas.focus("Holland Belgium")
	_check(atlas.region_info("Holland Belgium").owner == "French" and ui._atlas._sector.visible, "The atlas reflects the active scenario and links back to its playable board")
	ui._atlas._sector.pressed.emit()
	_check(ui._board.is_visible_in_tree() and ui._region == "low_countries", "View on board returns to the selected territory")
	ui.queue_free()
	await process_frame


func _touch_event(index: int, position: Vector2, down: bool) -> InputEventScreenTouch:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.position = position
	event.pressed = down
	return event


func _test_global_rules() -> void:
	var game := GlobalTurn.new(func(): return 1)
	_check(game.board.size() == 332 and game.power() == "Germans", "Global starts on the complete board with Germany")
	_check(game.treasury.British == 28 and game.treasury.UK_Pacific == 17 and game.units_at("Holland Belgium").armour == 3, "Opening treasuries and units match the Global setup")
	_check(game.purchase({}).is_empty(), "Germany can begin combat movement")
	var west := game.routes("Western Germany", {"infantry": 1})
	_check(west.has("France") and not west.has("United Kingdom") and not west.has("Germany"), "Combat infantry stay on land and enter hostile territories")
	var aircraft := game.routes("Western Germany", {"fighter": 1})
	_check(aircraft.has("110 Sea Zone") and aircraft.has("United Kingdom"), "Aircraft can cross water and require a return route")
	_check(not GlobalRules.canal_open(game.start_owners, game.diplomacy, "Germans", "destroyer", "91 Sea Zone", "92 Sea Zone") and GlobalRules.canal_open(game.start_owners, game.diplomacy, "Germans", "submarine", "91 Sea Zone", "92 Sea Zone"), "Gibraltar blocks enemy surface ships but allows submarines")
	var attack := {"path": west.France.path, "units": {"infantry": 1}}
	_check(not game.commit_moves([{"path": ["Western Germany", "France"], "units": {"infantry": 99}}]).is_empty() and game.units_at("Western Germany").infantry == 3, "Invalid batches leave the opening position intact")
	_check(game.commit_moves([attack]).is_empty() and game.pending() == ["France"], "World routes commit into an actual territorial battle")
	game.start_battle("France")
	var result := game.roll()
	_check(result.hits == 1 and game.fight.stage == "defender_losses", "Global attack passes to defender casualty selection")
	_check(not game.apply_losses({99: 1}) and game.apply_losses({0: 1}), "Only present defending units can take hits")
	game.roll()
	_check(game.apply_losses({0: 1}) and game.phase == GlobalTurn.Phase.NONCOMBAT, "Defenders return fire and the world board updates")
	_check(game.commit_moves([]).is_empty() and game.mobilize([]).is_empty(), "Remaining Global phases commit")
	game.collect()
	_check(game.power() == "Russians", "Germany hands off to the Soviet Union")
	for i in range(1, GlobalRules.ORDER.size()):
		_check(game.power() == GlobalRules.ORDER[i], "The Global power order is stable")
		game.purchase({})
		game.commit_moves([])
		game.commit_moves([])
		game.mobilize([])
		game.collect()
	_check(game.round == 2 and game.power() == "Germans", "France closes the Global round")
	var crossing := GlobalTurn.new()
	crossing.turn = 5
	crossing._begin_turn()
	crossing.purchase({})
	crossing.commit_moves([])
	crossing.board["109 Sea Zone"].units = [["British", "transport", 1]]
	var fleet := crossing.crossings("United Kingdom", {"infantry": 1}, [])
	_check(not fleet.is_empty() and crossing.crossings("United Kingdom", {"artillery": 1, "armour": 1}, []).is_empty(), "A transport can carry one heavier unit only alongside infantry")
	if not fleet.is_empty():
		var destination: String = fleet.keys()[0]
		var order: Dictionary = fleet[destination]
		_check(crossing.commit_moves([order]).is_empty() and crossing.units_at(destination).get("infantry", 0) > 0, "Committing a transport route unloads troops onto the world board")


func _test_global_board() -> void:
	var ui := Main.instantiate()
	root.add_child(ui)
	ui._menu.play_global.pressed.emit()
	var screen: Control = ui._global
	screen.save_path = ""
	await process_frame
	_check(screen.visible and screen._map._campaign, "Main menu opens the world as the live board")
	screen._finish_purchase()
	screen._map._select("Western Germany")
	screen._change_units(1, "infantry")
	screen._map._select("France")
	_check(screen._action.text == "Queue move" and screen._route.path[-1] == "France", "Tapping on the world board drafts the route")
	screen._primary()
	screen._primary()
	_check(screen.game.pending() == ["France"] and screen._map._battle_zones == ["France"], "Committing orders makes a battle on the same map")
	ui.queue_free()
	await process_frame


func _test_battle() -> void:
	var rolls := [2, 2, 2, 1, 6, 6, 6, 3]
	var battle := Battle.new(func(): return rolls.pop_front())
	_check(not battle.submit(DEFENDER, 0, "commit", [2, 1, 0]).is_empty(), "Wrong seat rejected")
	_check(not battle.submit(ATTACKER, 0, "commit", [2.0, 1, 0]).is_empty(), "Non-integer rejected")
	_check(not battle.submit(ATTACKER, 0, "commit", [0, 0, 0]).is_empty(), "Empty deployment rejected")
	_check(not battle.submit(ATTACKER, 0, "commit", [5, 0, 0]).is_empty(), "Deployment above reserve rejected")
	_check(battle.submit(ATTACKER, 0, "commit", [2, 1, 0]).is_empty(), "Commit accepted")
	_check(battle.snapshot().step == STEP.ATTACK_ROLL and rolls.size() == 8, "Opening a battle does not roll")
	_check(not battle.submit(DEFENDER, 1, "roll", []).is_empty(), "Defense cannot roll the attack")
	_check(Battle.formation([2, 1, 0], true) == {1: [1, 0, 0], 2: [1, 1, 0]}, "Formation separates supported infantry")
	_check(battle.submit(ATTACKER, 1, "roll", []).is_empty(), "Attack rolls on command")
	_check(battle.snapshot().step == STEP.DEFENDER_LOSSES and battle.snapshot().hits_due == 2, "One infantry gets support and one does not")
	_check(battle.snapshot().volley.dice.map(func(die): return die.target) == [2, 1, 2], "Faces are recorded with their individual hit thresholds")
	_check(not battle.submit(DEFENDER, 0, "losses", [1, 1, 0]).is_empty(), "Stale revision rejected")
	_check(not battle.submit(DEFENDER, 2, "losses", [1, 0, 0]).is_empty(), "Too few casualties rejected")
	_check(not battle.submit(DEFENDER, 2, "losses", [0, 2, 0]).is_empty(), "Unavailable casualty rejected")
	_check(battle.submit(DEFENDER, 2, "losses", [1, 1, 0]).is_empty(), "Mark defender casualties")
	_check(battle.snapshot().step == STEP.DEFENSE_ROLL and rolls.size() == 5, "Marking casualties does not roll return fire")
	_check(battle.submit(DEFENDER, 3, "roll", []).is_empty(), "Defense rolls on command")
	_check(rolls.is_empty() and battle.snapshot().hits_due == 2, "All five defenders roll, including the marked units")
	_check(battle.submit(ATTACKER, 4, "losses", [1, 1, 0]).is_empty(), "Apply both forces' losses")
	_check(battle.snapshot().attackers == [1, 0, 0] and battle.snapshot().defenders == [2, 0, 1], "Exact loss counts")
	_check(battle.submit(ATTACKER, 5, "retreat", []).is_empty(), "Retreat accepted")
	_check(battle.snapshot().reserve == [3, 1, 1] and not battle.snapshot().captured, "Retreat restores surviving units to the reserve")
	var snapshot := battle.snapshot()
	snapshot.reserve[0] = 100
	_check(battle.snapshot().reserve[0] == 3, "Snapshots cannot mutate host state")

	var all_hits := Battle.new(func(): return 1)
	all_hits.submit(ATTACKER, 0, "commit", [3, 1, 1])
	all_hits.submit(ATTACKER, 1, "roll", [])
	all_hits.submit(DEFENDER, 2, "losses", [3, 1, 1])
	all_hits.submit(DEFENDER, 3, "roll", [])
	all_hits.submit(ATTACKER, 4, "losses", [3, 1, 1])
	_check(all_hits.snapshot().step == STEP.FINISHED and not all_hits.snapshot().captured, "Mutual destruction leaves defender in control")

	var capture_rolls := [1, 1, 1, 1, 1, 1, 1, 6, 6, 6, 6, 6]
	var capture := Battle.new(func(): return capture_rolls.pop_front())
	capture.submit(ATTACKER, 0, "commit", [4, 2, 1])
	capture.submit(ATTACKER, 1, "roll", [])
	_check(capture.snapshot().hits_due == 5, "Excess hits capped at available defenders")
	capture.submit(DEFENDER, 2, "losses", [3, 1, 1])
	capture.submit(DEFENDER, 3, "roll", [])
	_check(capture.snapshot().step == STEP.FINISHED and capture.snapshot().captured, "Surviving ground units capture")

	var misses := Battle.new(func(): return 6)
	misses.submit(ATTACKER, 0, "commit", [1, 0, 0])
	misses.submit(ATTACKER, 1, "roll", [])
	_check(misses.snapshot().step == STEP.DEFENSE_ROLL, "A missed attack still needs a separate defense roll")
	misses.submit(DEFENDER, 2, "roll", [])
	_check(misses.snapshot().step == STEP.DECIDE, "Zero hits skip casualty selections")
	misses.submit(ATTACKER, 3, "roll", [])
	_check(misses.snapshot().round == 2, "Pressing the attack rolls a new round")


func _test_turn() -> void:
	var rolls := [1, 1, 1, 1, 1, 1, 6, 6, 6, 6, 6, 6, 6, 6, 6]
	var turn := Turn.new(1, func(): return rolls.pop_front(), false)
	_reject(turn, "purchase", {"counts": [0, 0, 3]}, "Purchase cannot exceed the treasury")
	_reject(turn, "purchase", {"counts": [4, 3, 0]}, "Purchase cannot exceed factory capacity")
	_order(turn, "purchase", {"counts": [2, 0, 1]})
	_check(turn.snapshot().treasury == [2, 14] and turn.snapshot().reinforcements == [2, 0, 1], "Purchases debit IPCs and stay off-board")
	var legal := Turn.legal_routes(turn.snapshot().regions, 0, true, "west_germany", true)
	_check({"to": "west_germany", "via": "low_countries"} in legal, "Tank can blitz an empty territory and return")
	_check(not {"to": "south_france", "via": "north_france"} in legal, "Tank cannot pass through enemy units")
	var empty_factory: Dictionary = turn.snapshot().regions
	empty_factory.north_france.units = [0, 0, 0]
	_check(not {"to": "south_france", "via": "north_france"} in Turn.legal_routes(empty_factory, 0, true, "west_germany", true), "An empty enemy factory blocks a blitz")
	var first := _move("west_germany", "north_france", [3, 2, 0])
	_reject(turn, "moves", {"orders": [first, _move("west_germany", "south_france", [2, 0, 0])]}, "Batch cannot spend the same units twice")
	_reject(turn, "moves", {"orders": [_move("west_germany", "north_france", [1, 0, 1], "low_countries")]}, "Infantry cannot join a two-space tank move")
	_order(turn, "moves", {"orders": [
		first, _move("central_europe", "north_france", [0, 0, 1], "west_germany"),
		_move("west_germany", "west_germany", [0, 0, 1], "low_countries"),
		_move("west_germany", "south_france", [1, 0, 0]),
	]})
	_check(turn.snapshot().phase == PHASE.COMBAT and turn.snapshot().battles.size() == 2, "Combat moves queue separate battles")
	_check(turn.snapshot().regions.low_countries.owner == 0, "Blitz captures the intermediate territory")
	_order(turn, "fight", {"zone": "north_france"})
	_order(turn, "roll")
	var view := turn.snapshot()
	_check(view.actor == 1 and view.combat.hits_due == 5 and view.battles.north_france.entries == ["west_germany"], "Combined attack caps hits and passes casualty choice to France")
	_check(not turn.submit(0, view.revision, "losses", {"counts": [3, 1, 1]}).is_empty(), "Attacker cannot choose defender losses")
	_order(turn, "losses", {"counts": [3, 1, 1]})
	_order(turn, "roll")
	_check(turn.snapshot().regions.north_france.owner == 0 and turn.snapshot().regions.north_france.units == [3, 2, 1], "Surviving attackers capture the territory")
	_order(turn, "fight", {"zone": "south_france"})
	_order(turn, "roll")
	_order(turn, "roll")
	_reject(turn, "retreat", {"zone": "north_france"}, "Retreat must use an original entry")
	_order(turn, "retreat", {"zone": "west_germany"})
	_check(turn.snapshot().phase == PHASE.NONCOMBAT and rolls.is_empty(), "Retreat ends the final battle after both sides fire")
	_reject(turn, "moves", {"orders": [_move("west_germany", "north_france", [1, 0, 0])]}, "A retreated unit cannot move again")
	_reject(turn, "moves", {"orders": [_move("west_germany", "central_europe", [0, 0, 1])]}, "A tank that blitzed back cannot move again")
	_order(turn, "moves", {"orders": [_move("central_europe", "west_germany", [2, 0, 0])]})
	_check(turn.snapshot().regions.west_germany.units == [3, 0, 1], "Unused infantry can redeploy")
	var home := {"zone": "west_germany", "counts": [1, 0, 1]}
	_reject(turn, "mobilize", {"placements": [home, {"zone": "north_france", "counts": [1, 0, 0]}]}, "An ineligible factory rejects the entire batch")
	_reject(turn, "mobilize", {"placements": [home]}, "A partial plan cannot advance to income")
	_reject(turn, "place", home, "Legacy placement commands cannot lock a factory during play")
	_order(turn, "mobilize", {"placements": [home, {"zone": "central_europe", "counts": [1, 0, 0]}]})
	_check(turn.snapshot().events.size() == 2 and turn.snapshot().phase == PHASE.INCOME, "A single order places both factories and advances")
	_order(turn, "collect")
	_check(turn.snapshot().phase == PHASE.PURCHASE and turn.snapshot().seat == 1 and turn.snapshot().treasury == [14, 14], "Income adds captured value and hands the turn to France")
	_order(turn, "purchase", {"counts": [0, 0, 0]})
	_order(turn, "moves", {"orders": []})
	_order(turn, "moves", {"orders": []})
	_order(turn, "mobilize", {"placements": []})
	_order(turn, "collect")
	_check(turn.snapshot().round == 2 and turn.snapshot().seat == 0 and turn.snapshot().capacity.north_france == 3, "Both turns advance the round and unlock the captured factory")
	_check(not turn.submit(0, 0, "purchase", {"counts": [0, 0, 0]}).is_empty(), "Stale commands cannot mutate the board")
	var production := Turn.new(2)
	_order(production, "purchase", {"counts": [4, 0, 0]})
	_order(production, "moves", {"orders": []})
	_order(production, "moves", {"orders": []})
	_reject(production, "mobilize", {"placements": [{"zone": "west_germany", "counts": [4, 0, 0]}]}, "Each minor factory has three slots even when the pool has more units")


func _test_legacy_save() -> void:
	var turn := Turn.new(57, Callable(), false)
	_order(turn, "purchase", {"counts": [0, 0, 0]})
	_order(turn, "moves", {"orders": [_move("west_germany", "north_france", [1, 1, 0])]})
	_order(turn, "fight", {"zone": "north_france"})
	var legacy := turn.record()
	legacy.version = 1
	_order(turn, "roll")
	if turn.snapshot().combat.step == STEP.DEFENSE_ROLL:
		_order(turn, "roll")
	var restored := Turn.restore(legacy)
	_check(restored != null and restored.snapshot() == turn.snapshot(), "Earlier autosaves reproduce their automatic rolls")
	var prior := Turn.restore({"version": 2, "seed": 12, "orders": [
		{"command": "purchase", "payload": {"counts": [2, 0, 0]}},
		{"command": "moves", "payload": {"orders": []}},
		{"command": "moves", "payload": {"orders": []}},
		{"command": "place", "payload": {"zone": "west_germany", "counts": [1, 0, 0]}},
	]})
	_check(prior != null and prior.snapshot().reinforcements == [1, 0, 0], "A 0.5 save keeps units that were already placed")
	if prior != null:
		_order(prior, "mobilize", {"placements": [{"zone": "central_europe", "counts": [1, 0, 0]}]})
		_check(Turn.restore(prior.record()).snapshot() == prior.snapshot(), "Upgraded placement history can be saved and resumed")


func _move(origin: String, target: String, counts: Array, via := "") -> Dictionary:
	return {"from": origin, "to": target, "via": via, "counts": counts}


func _order(turn: RefCounted, command: String, payload: Dictionary = {}) -> void:
	var state: Dictionary = turn.snapshot()
	var error: String = turn.submit(state.actor, state.revision, command, payload)
	_check(error.is_empty(), "%s accepted (%s)" % [command, error])


func _reject(turn: RefCounted, command: String, payload: Dictionary, label: String) -> void:
	var state: Dictionary = turn.snapshot()
	_check(not turn.submit(state.actor, state.revision, command, payload).is_empty() and turn.snapshot() == state, label)


func _test_hotseat() -> void:
	var ui := Main.instantiate()
	root.add_child(ui)
	ui._session.save_prefix = "user://turn-smoke-%d" % Time.get_ticks_usec()
	_check(ui._menu.visible and not ui._board.is_visible_in_tree(), "The game opens on a dedicated main menu")
	ui._menu.multiplayer_button.pressed.emit()
	_check(ui._menu.host_game.is_visible_in_tree() and not ui._menu.play_local.is_visible_in_tree(), "Multiplayer has a dedicated menu page")
	ui._menu._back.pressed.emit()
	ui._menu.play_local.pressed.emit()
	await process_frame
	await process_frame
	var board: Control = ui._board
	var seed_probe := RandomNumberGenerator.new()
	for seed in 64:
		seed_probe.seed = seed
		if seed_probe.randi_range(1, 6) == 1 and seed_probe.randi_range(1, 6) <= 2:
			ui._session._turn._rng.seed = seed
			break
	_check(ui._board.is_visible_in_tree() and not ui._menu.visible and ui._session.view.phase == PHASE.PURCHASE, "Local play opens the board at purchase")
	_check(not ui._apply_button.has_theme_stylebox_override("normal"), "Skipping purchases has secondary styling")
	ui._apply_button.pressed.emit()
	_check(is_instance_valid(ui._skip_dialog) and ui._session.view.revision == 0, "Skip waits for confirmation")
	ui._skip_dialog.canceled.emit()
	await process_frame
	await process_frame
	ui._plus[0].pressed.emit()
	_check(ui._purchase_values[0].text == "14 IPC" and ui._purchase_values[1].text == "3 IPC" and ui._purchase_values[2].text == "11 IPC", "Purchase boxes update live")
	_check(ui._apply_button.text == "Buy 1 unit · 3 IPC" and ui._summary_values[0].text == "0 IPC", "Draft price is separate from actual spending")
	ui._apply_button.pressed.emit()
	_check(ui._wallet_values[0].text == "11 IPC" and ui._summary_values[0].text == "3 IPC" and ui._summary_values[2].text == "1", "The ledger updates after the purchase is accepted")
	_check(ui._phase_labels[0].text.begins_with("✓") and ui._phase_labels[1].text.begins_with("2"), "Phase bar marks the previous and current phases")
	for zone in Scenario.LAND:
		for seat in [0, 1]:
			for i in Battle.UNITS.size():
				_check(board._region_at(board._token_rect(zone, seat, i).get_center()) == zone, "%s stack fits within its territory" % zone)
	board.zoom_by(1.22)
	_click_map(board, board._token_rect("west_germany", 0, 0).get_center())
	_check(ui._draft == [1, 0, 0], "A zoomed map click selects the source stack")
	board.reset_camera()
	_click_map(board, Vector2(349, 49))
	_check(ui._region == "north_sea" and ui._route.is_empty(), "Sea zones remain inspectable")
	_click_map(board, Vector2(489, 378))
	_check(ui._route.get("to") == "north_france" and ui._session.view.revision == 1, "A map click previews a legal route without advancing")
	_check(ui._finish_move_button.disabled, "A draft must be queued or cleared before committing")
	ui._toggle_orders_panel()
	_check(ui._quick_action.visible and ui._quick_action.text == "Queue 1 unit", "A map preview can be queued with Orders hidden")
	ui._quick_action.pressed.emit()
	ui._toggle_orders_panel()
	_check(ui._plans.size() == 1 and ui._session.view.regions.west_germany.units[0] == 4 and ui._finish_move_button.text == "Commit 1 unit" and ui._summary_values[1].text == "0", "Queued counts and committed counts stay distinct")
	ui._remove_move(0)
	_check(ui._plans.is_empty() and ui._finish_move_button.text == "Skip combat moves", "Removing an order restores the queue total")
	ui._finish_moves()
	_check(is_instance_valid(ui._skip_dialog) and ui._session.view.phase == PHASE.COMBAT_MOVE, "Skipping combat moves also asks for confirmation")
	ui._skip_dialog.canceled.emit()
	await process_frame
	await process_frame
	_click_map(board, board._token_rect("west_germany", 0, 0).get_center())
	_click_map(board, Vector2(489, 378))
	ui._apply_button.pressed.emit()
	ui._finish_moves()
	_check(ui._session.view.phase == PHASE.COMBAT and board._effects.size() == 1 and ui._summary_values[1].text == "1", "Commit moves the units and updates the ledger")
	ui._fight("north_france")
	_check(ui._session.view.combat.step == STEP.ATTACK_ROLL and ui._dice._faces.is_empty(), "The board opens combat with no roll yet")
	var before_roll_size: Vector2 = board.size
	ui._actions.get_child(0).pressed.emit()
	_check(ui._dice.rolling and ui._dice._faces.size() == 1, "Clicking Roll animates the actual dice")
	_check(await _until(func(): return not ui._dice.rolling), "Dice settle before the next decision")
	_check(is_equal_approx(board.size.y, before_roll_size.y), "Rolling dice does not take space from the map")
	var face: int = ui._dice._faces[0].face
	var die_normal: Vector3 = ui._dice._bodies[0].basis * ui._dice.NORMALS[face - 1]
	_check(die_normal.dot(Vector3.BACK) > 0.90, "The authoritative face points toward the camera")
	_check(ui._session.view.combat.step == STEP.DEFENDER_LOSSES, "A successful attack opens defender casualty selection")
	_click_map(board, board._token_rect("north_france", 1, 0).get_center())
	_check(ui._draft == [1, 0, 0] and not ui._apply_button.disabled, "Clicking the defending stack assigns a casualty")
	ui._apply_button.pressed.emit()
	_check(ui._session.view.combat.step == STEP.DEFENSE_ROLL, "Assigning losses exposes the defense roll button")
	ui._actions.get_child(0).pressed.emit()
	_check(await _until(func(): return not ui._dice.rolling), "Defense dice settle before selecting losses")
	_check(ui._session.view.combat.step == STEP.ATTACKER_LOSSES and ui._battle_loss_buttons.size() == 1 and ui._battle_loss_buttons[0].unit == 0, "The strip offers only present units as casualties")
	var snapshot: Dictionary = ui._session.view
	_check(not snapshot.combat.is_empty(), "Combat reaches a player decision")
	ui._session.leave()
	_check(ui._menu.resume_local.is_visible_in_tree() and board._effects.is_empty(), "Autosave is available on the main menu")
	ui._menu.resume_local.pressed.emit()
	_check(ui._session.view == snapshot, "Resume restores the same dice and pending combat decision")
	ui._battle_loss_buttons[0].button.pressed.emit()
	ui._apply_button.pressed.emit()
	ui._finish_moves()
	await _confirm_skip(ui, PHASE.MOBILIZE)
	var before_placement: Dictionary = ui._session.view
	ui._choose_territory("west_germany")
	ui._plus[0].pressed.emit()
	ui._choose_territory("central_europe")
	_check(ui._session.view == before_placement and ui._placements.west_germany[0] == 1, "Assigning units never changes the authoritative board")
	ui._choose_territory("west_germany")
	ui._minus[0].pressed.emit()
	_check(ui._mobilize_button.disabled, "Freeing a planned unit disables commit")
	ui._choose_territory("central_europe")
	ui._plus[0].pressed.emit()
	_check(ui._placement_available[0].text == "0 unassigned", "Placement availability excludes the current factory draft")
	ui._mobilize_button.pressed.emit()
	_check(ui._session.view.phase == PHASE.INCOME and ui._session.view.regions.central_europe.units[0] == 3, "The revised assignment is the only one committed")
	var save: String = ui._session._save_path(Session.Mode.HOTSEAT)
	ui._session.leave()
	ui._menu.play_local.pressed.emit()
	ui._apply_button.pressed.emit()
	await _confirm_skip(ui, PHASE.COMBAT_MOVE)
	ui._finish_moves()
	await _confirm_skip(ui, PHASE.NONCOMBAT)
	ui._finish_moves()
	await _confirm_skip(ui, PHASE.MOBILIZE)
	ui._actions.get_child(0).pressed.emit()
	await _confirm_skip(ui, PHASE.INCOME)
	ui._session.leave()
	ui._menu.play_local.pressed.emit()
	var front: Dictionary = ui._session.view.regions
	_check(front.size() == 7 and front.has("normandy_bordeaux") and front.has("greater_south_germany"), "New games use the expanded front")
	var routes := Turn.legal_routes(front, 0, true, "west_germany", true)
	_check({"to": "normandy_bordeaux", "via": "low_countries"} in routes and not {"to": "south_france", "via": ""} in routes, "Expanded front uses the coastal blitz and removes the direct southern attack")
	var rolls := [1, 1, 1, 1, 1, 6, 6, 6, 6, 6]
	ui._session._turn._roller = func(): return rolls.pop_front()
	ui._session.act("purchase", {"counts": [0, 0, 0]})
	ui._session.act("moves", {"orders": [_move("west_germany", "north_france", [3, 1, 1])]})
	ui._session.act("fight", {"zone": "north_france"})
	ui._session.act("roll")
	_check(await _until(func(): return not ui._dice.rolling), "Attack dice settle before the final volley")
	ui._session.act("losses", {"counts": [3, 1, 1]})
	ui._session.act("roll")
	_check(ui._session.view.phase == PHASE.NONCOMBAT and ui._board_view.combat.defenders == [3, 1, 1], "The firing line remains visible as the final roll animates")
	_check(await _until(func(): return not ui._dice.rolling) and ui._board_view.phase == PHASE.NONCOMBAT, "The board shows the captured territory once the dice settle")
	ui._session.act("moves", {"orders": []})
	ui._session.act("mobilize", {"placements": []})
	_check(ui._session.view.winner == -1 and "claim victory" in ui._actions.get_child(0).text, "Both cities are held before income, with victory still pending")
	ui._actions.get_child(0).pressed.emit()
	_check(ui._session.view.phase == PHASE.COMPLETE and ui._session.view.winner == 0 and not ui._session.controls_active(), "Collecting income while holding both cities completes the match")
	ui._session.leave()
	DirAccess.remove_absolute(save)
	ui.queue_free()


func _confirm_skip(ui: Control, next_phase: int) -> void:
	_check(is_instance_valid(ui._skip_dialog), "Optional phase opens a confirmation")
	if not is_instance_valid(ui._skip_dialog):
		return
	ui._skip_dialog.confirmed.emit()
	_check(ui._session.view.phase == next_phase, "Confirming advances to the expected phase")
	await process_frame
	await process_frame


func _click_map(board: Control, point: Vector2) -> void:
	var event := InputEventMouseButton.new()
	event.position = board._origin() + point * board._scale()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = true
	board._gui_input(event)
	event.pressed = false
	board._gui_input(event)


func _test_network() -> void:
	var host := _add_session("Host")
	var guest := _add_session("Guest")
	host.save_prefix = ""
	var probe := UDPServer.new()
	if probe.listen(0, "127.0.0.1") != OK:
		_check(false, "Can bind a loopback UDP socket")
		return
	var port := probe.get_local_port()
	probe.stop()
	if not host.host(port, "127.0.0.1").is_empty():
		_check(false, "Host can listen on loopback")
		return
	host._turn._roller = func(): return 1
	var wrong_code: String = "00000000" if host.invite != "00000000" else "FFFFFFFF"
	_check(guest.join("127.0.0.1", wrong_code, port).is_empty(), "Begin join with wrong code")
	_check(await _until(func(): return guest.mode == Session.Mode.MENU), "Wrong invite returns guest to menu")
	_check("incorrect" in guest.status and not host.controls_active(), "Wrong invite grants no control")
	var code: String = host.invite
	_check(guest.join("127.0.0.1", code, port).is_empty(), "Begin valid join")
	if not await _until(func(): return guest.mode == Session.Mode.GUEST and not guest.view.is_empty()):
		_check(false, "Guest receives the initial snapshot")
		return
	_check(host.controls_active() and not guest.controls_active(), "Only Germany can purchase first")
	host.act("purchase", {"counts": [0, 0, 0]})
	host.act("moves", {"orders": [_move("west_germany", "north_france", [1, 0, 0])]})
	host.act("fight", {"zone": "north_france"})
	host.act("roll")
	_check(await _until(func(): return guest.view.get("actor") == 1), "Host attack passes the decision to France")
	_check(guest.controls_active() and not host.controls_active(), "Only France can select defender casualties")
	guest.leave()
	_check(await _until(func(): return host._guest_id == 0), "Host frees disconnected guest seat")
	guest.join("127.0.0.1", code, port)
	if not await _until(func(): return guest.view.get("actor") == 1):
		_check(false, "Guest can rejoin at the same battle decision")
		return
	guest.act("losses", {"counts": [0, 0, 0]})
	_check(await _until(func(): return not guest.awaiting_response), "Host replies to invalid guest order")
	_check(host.view.revision == 4 and guest.view.revision == 4, "Invalid guest order leaves both views unchanged")
	guest.act("losses", {"counts": [1, 0, 0]})
	_check(await _until(func(): return guest.view.combat.get("step") == STEP.DEFENSE_ROLL), "France must roll defense separately")
	guest.act("roll")
	_check(await _until(func(): return guest.view.combat.get("step") == STEP.ATTACKER_LOSSES), "Guest casualty choices reach host")
	_check(host.view.last_roll == guest.view.last_roll and guest.view.last_roll.seat == 1, "Both clients receive identical defense dice")
	host.act("losses", {"counts": [1, 0, 0]})
	host.act("moves", {"orders": []})
	host.act("mobilize", {"placements": []})
	host.act("collect")
	_check(await _until(func(): return guest.view.seat == 1), "Germany can finish all phases and hand off to France")
	guest.act("purchase", {"counts": [0, 1, 0]})
	_check(await _until(func(): return guest.view.phase == PHASE.COMBAT_MOVE), "France can purchase during their own turn")
	_check(host.view == guest.view and guest.view.treasury == [23, 10], "Host and guest share the same post-handoff state")
	guest.act("moves", {"orders": [_move("north_france", "west_germany", [1, 0, 0])]})
	_check(await _until(func(): return guest.view.phase == PHASE.COMBAT), "France can launch a counterattack")
	guest.act("fight", {"zone": "west_germany"})
	_check(await _until(func(): return guest.view.combat.get("step") == STEP.ATTACK_ROLL), "The counterattack waits for France to roll")
	guest.act("roll")
	_check(await _until(func(): return guest.view.combat.get("step") == STEP.DEFENDER_LOSSES), "Both players receive the counterattack dice")
	_check(host.controls_active() and not guest.controls_active(), "Germany chooses defender losses on France’s turn")
	host.act("losses", {"counts": [1, 0, 0]})
	host.act("roll")
	_check(await _until(func(): return guest.view.combat.get("step") == STEP.ATTACKER_LOSSES), "France receives the counterattack casualties")
	guest.act("losses", {"counts": [1, 0, 0]})
	_check(await _until(func(): return guest.view.phase == PHASE.NONCOMBAT), "France finishes combat")
	host.leave()
	_check(await _until(func(): return guest.mode == Session.Mode.MENU), "Guest returns to menu when host ends session")


func _add_session(branch_name: String) -> Node:
	var branch := Node.new()
	branch.name = branch_name
	root.add_child(branch)
	set_multiplayer(MultiplayerAPI.create_default_interface(), branch.get_path())
	var session := Session.new()
	session.name = "Session"
	branch.add_child(session)
	return session


func _until(condition: Callable) -> bool:
	var deadline := Time.get_ticks_msec() + 2000
	while not condition.call() and Time.get_ticks_msec() < deadline:
		await process_frame
	return condition.call()


func _check(passed: bool, message: String) -> void:
	if not passed:
		_failures += 1
		push_error("FAILED: " + message)
