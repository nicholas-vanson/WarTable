extends RefCounted
## Authoritative rules for the Western Europe land scenario.

const Battle = preload("res://game/battle.gd")
const Scenario = preload("res://game/scenario.gd")
const SAVE_VERSION := 4
const LOG_LIMIT := 80
enum Phase { PURCHASE, COMBAT_MOVE, COMBAT, NONCOMBAT, MOBILIZE, INCOME, COMPLETE }

var _regions: Dictionary
var _expanded: bool
var _winner := -1
var _treasury: Array = Scenario.STARTING_TREASURY.duplicate()
var _phase := Phase.PURCHASE
var _seat := 0
var _round := 1
var _revision := 0
var _unused := {}
var _capacity := {}
var _reinforcements: Array = Scenario.EMPTY.duplicate()
var _spent := 0
var _combat_committed: Array = Scenario.EMPTY.duplicate()
var _battles := {}
var _active_zone := ""
var _battle: RefCounted
var _last_roll := {}
var _log: Array[String] = []
var _events: Array[Dictionary] = []
var _rng := RandomNumberGenerator.new()
var _roller: Callable
var _history: Array = []
var _replaying := false


func _init(seed_value: Variant = null, roller := Callable(), expanded := true) -> void:
	_expanded = expanded
	_regions = Scenario.starting_regions(expanded)
	if seed_value == null:
		_rng.randomize()
	else:
		_rng.seed = seed_value
	_roller = roller if roller.is_valid() else _rng.randi_range.bind(1, 6)
	_start_turn()


func snapshot() -> Dictionary:
	var combat: Dictionary = {} if _battle == null else _battle.snapshot()
	var log := _log.duplicate()
	if not combat.is_empty():
		log.append_array(combat.log.slice(1))
	return {
		"revision": _revision, "phase": _phase, "seat": _seat, "actor": _actor(),
		"expanded": _expanded, "winner": _winner,
		"round": _round, "regions": _regions.duplicate(true), "treasury": _treasury.duplicate(),
		"available": _unused.duplicate(true), "capacity": _capacity.duplicate(),
		"spent": _spent, "combat_committed": _combat_committed.duplicate(),
		"reinforcements": _reinforcements.duplicate(), "battles": _battles.duplicate(true),
		"active_zone": _active_zone, "combat": combat, "log": log, "events": _events.duplicate(true),
		"last_roll": _last_roll.duplicate(true),
	}


func record() -> Dictionary:
	return {"version": SAVE_VERSION, "expanded": _expanded, "seed": _rng.seed, "orders": _history.duplicate(true)}


static func restore(data: Variant) -> RefCounted:
	if not data is Dictionary or data.get("version") not in [1, 2, 3, SAVE_VERSION]:
		return null
	if not data.get("seed") is int or not data.get("orders") is Array:
		return null
	if data.version == SAVE_VERSION and not data.get("expanded") is bool:
		return null
	var turn := new(data.seed, Callable(), data.version == SAVE_VERSION and data.get("expanded") == true)
	turn._replaying = true
	var legacy: bool = data.version == 1
	for order in data.orders:
		if not order is Dictionary or not order.get("command") is String or not order.get("payload") is Dictionary:
			return null
		var command: String = "roll" if legacy and order.command == "continue" else order.command
		if not turn.submit(turn._actor(), turn._revision, command, order.payload).is_empty():
			return null
		# Version 1 rolled automatically. Reproduce those exact rolls before replaying its next order.
		if legacy:
			while turn._battle != null and turn._battle.snapshot().step in [Battle.Step.ATTACK_ROLL, Battle.Step.DEFENSE_ROLL]:
				if not turn.submit(turn._actor(), turn._revision, "roll", {}).is_empty():
					return null
	turn._replaying = false
	return turn


func submit(seat: int, revision: int, command: String, payload: Dictionary) -> String:
	if revision != _revision:
		return "The board has advanced. Review the current phase."
	if seat != _actor():
		return "The other player has the current decision."
	var previous_events := _events
	_events = []
	var reason := _apply(command, payload)
	if not reason.is_empty():
		_events = previous_events
		return reason
	_revision += 1
	_history.append({"command": command, "payload": payload.duplicate(true)})
	return ""


func _apply(command: String, payload: Dictionary) -> String:
	match _phase:
		Phase.PURCHASE:
			if command == "purchase":
				return _purchase(payload.get("counts"))
		Phase.COMBAT_MOVE, Phase.NONCOMBAT:
			if command == "moves":
				return _move(payload.get("orders"))
		Phase.COMBAT:
			return _conduct_combat(command, payload)
		Phase.MOBILIZE:
			if command == "mobilize":
				return _mobilize(payload.get("placements"))
			if _replaying and command == "place":
				return _mobilize([{"zone": payload.get("zone"), "counts": payload.get("counts")}], false)
			if _replaying and command == "finish_placement":
				return _mobilize([])
		Phase.INCOME:
			if command == "collect":
				var income := income_for(_regions, _seat)
				_treasury[_seat] += income
				_note("%s collects %d IPC. Treasury %d IPC." % [Scenario.SIDES[_seat], income, _treasury[_seat]])
				if _expanded and _holds_objectives():
					_winner = _seat
					_phase = Phase.COMPLETE
					_note("%s wins by holding Paris and Berlin." % Scenario.SIDES[_seat])
					return ""
				if _seat == 1:
					_round += 1
				_seat = 1 - _seat
				_start_turn()
				return ""
	return "That order is unavailable in this phase."


func _actor() -> int:
	if _phase == Phase.COMPLETE:
		return -1
	if _battle != null and Battle.active_seat(_battle.snapshot().step) == Battle.Seat.DEFENDER:
		return 1 - _seat
	return _seat


func _holds_objectives() -> bool:
	for zone in Scenario.OBJECTIVES:
		if _regions[zone].owner != _seat:
			return false
	return true


func _start_turn() -> void:
	_phase = Phase.PURCHASE
	_spent = 0
	_combat_committed = Scenario.EMPTY.duplicate()
	_last_roll = {}
	_unused.clear()
	_capacity.clear()
	for zone in _regions:
		if _regions[zone].owner == _seat:
			_unused[zone] = _regions[zone].units.duplicate()
			if _regions[zone].factory > 0:
				_capacity[zone] = _regions[zone].factory
	_note("ROUND %d · %s begins their turn." % [_round, Scenario.SIDES[_seat]])


static func income_for(regions: Dictionary, seat: int) -> int:
	var total := 0
	for region in regions.values():
		if region.owner == seat:
			total += int(region.ipc)
	return total


static func price(counts: Array) -> int:
	return counts[0] * Scenario.COST[0] + counts[1] * Scenario.COST[1] + counts[2] * Scenario.COST[2]


func _purchase(counts: Variant) -> String:
	var capacity := Battle.total(_capacity.values())
	if not _valid_counts(counts, [capacity, capacity, capacity]):
		return "Choose a valid quantity of each unit."
	if Battle.total(counts) > capacity:
		return "The order exceeds this turn’s factory capacity."
	var cost := price(counts)
	if cost > _treasury[_seat]:
		return "This order costs %d IPC. Your treasury holds %d IPC." % [cost, _treasury[_seat]]
	_treasury[_seat] -= cost
	_spent = cost
	_reinforcements = counts.duplicate()
	_note("Purchased %d units for %d IPC." % [Battle.total(counts), cost])
	_phase = Phase.COMBAT_MOVE
	return ""


static func legal_routes(regions: Dictionary, seat: int, combat: bool, origin: String, tanks_only: bool) -> Array:
	var routes := []
	if not regions.has(origin) or regions[origin].owner != seat:
		return routes
	var links := Scenario.LINKS if regions.has("normandy_bordeaux") else Scenario.LEGACY_LINKS
	for first in links[origin]:
		var friendly: bool = regions[first].owner == seat
		if friendly != combat:
			routes.append({"to": first, "via": ""})
		if not tanks_only:
			continue
		var blitz: bool = not friendly and combat and regions[first].factory == 0 and Battle.total(regions[first].units) == 0
		if not friendly and not blitz:
			continue
		for second in links[first]:
			if second == origin and not blitz:
				continue
			var friendly_destination: bool = regions[second].owner == seat
			if blitz or friendly_destination != combat:
				routes.append({"to": second, "via": first})
	return routes


static func remaining(view: Dictionary, origin: String, plans: Array) -> Array:
	var counts: Array = view.available.get(origin, Scenario.EMPTY).duplicate()
	for plan in plans:
		if plan.from == origin:
			_transfer(counts, plan.counts, -1)
	return counts


func _move(orders: Variant) -> String:
	if not orders is Array:
		return "The move list is invalid."
	var combat := _phase == Phase.COMBAT_MOVE
	var available := _unused.duplicate(true)
	for order in orders:
		if not order is Dictionary:
			return "Each move needs an origin, destination and units."
		var origin: Variant = order.get("from")
		var target: Variant = order.get("to")
		var via: Variant = order.get("via")
		var counts: Variant = order.get("counts")
		if not origin is String or not target is String or not via is String or not available.has(origin):
			return "Select an eligible starting territory and a legal destination."
		if not _valid_counts(counts, available[origin]) or Battle.total(counts) == 0:
			return "A move orders more units than are available at %s." % _regions[origin].name
		var routes := legal_routes(_regions, _seat, combat, origin, counts[0] == 0 and counts[1] == 0)
		if not {"to": target, "via": via} in routes:
			return "That route from %s is outside this force’s movement rules." % _regions[origin].name
		_transfer(available[origin], counts, -1)
	_unused = available
	_last_roll = {}
	# All departures happen before arrivals. Newly arrived units cannot be ordered twice.
	for order in orders:
		_transfer(_regions[order.from].units, order.counts, -1)
		if combat and not order.via.is_empty() and _regions[order.via].owner != _seat:
			_capture(order.via, "Blitzed")
	for order in orders:
		_arrive(order, combat)
		if combat:
			_transfer(_combat_committed, order.counts, 1)
	_phase = Phase.COMBAT if combat and not _battles.is_empty() else (Phase.NONCOMBAT if combat else Phase.MOBILIZE)
	return ""


func _arrive(order: Dictionary, combat: bool) -> void:
	var target: String = order.to
	var region: Dictionary = _regions[target]
	if combat and region.owner != _seat and Battle.total(region.units) > 0:
		if not _battles.has(target):
			_battles[target] = {"units": Scenario.EMPTY.duplicate(), "entries": []}
		_transfer(_battles[target].units, order.counts, 1)
		var entry: String = order.from if order.via.is_empty() else order.via
		if not entry in _battles[target].entries:
			_battles[target].entries.append(entry)
	else:
		if region.owner != _seat:
			_capture(target, "Occupied")
		_transfer(region.units, order.counts, 1)
	_event(order.from, target, _seat, order.counts, order.via)
	_note("Moved %d units from %s to %s." % [Battle.total(order.counts), _regions[order.from].name, _regions[target].name])


func _capture(zone: String, action: String) -> void:
	_regions[zone].owner = _seat
	_note("%s %s · %d IPC production." % [action, _regions[zone].name, _regions[zone].ipc])


func _conduct_combat(command: String, payload: Dictionary) -> String:
	if _battle == null:
		var zone: Variant = payload.get("zone")
		if command != "fight" or not zone is String or not _battles.has(zone):
			return "Choose a territory with a pending battle."
		_active_zone = zone
		_last_roll = {}
		var units: Array = _battles[zone].units
		_battle = Battle.new(_roller, units, _regions[zone].units, _regions[zone].name)
		_note("Battle for %s." % _regions[zone].name)
		_battle.submit(Battle.Seat.ATTACKER, 0, "commit", units)
		return ""
	var before: Dictionary = _battle.snapshot()
	var counts: Variant = payload.get("counts", [])
	var destination: Variant = payload.get("zone")
	if not counts is Array:
		return "Choose a valid casualty count."
	if command == "retreat" and (not destination is String or not destination in _battles[_active_zone].entries):
		return "Retreat to an adjacent territory used by an original attacker."
	var roller_seat := _actor()
	var error: String = _battle.submit(Battle.active_seat(before.step), before.revision, command, counts)
	if not error.is_empty():
		return error
	var after: Dictionary = _battle.snapshot()
	if command == "roll":
		_last_roll = after.volley
		_last_roll.merge({"revision": _revision + 1, "seat": roller_seat, "zone": _active_zone,
			"round": after.round, "attacking": roller_seat == _seat})
	var is_retreat := command == "retreat"
	for side in [0, 1]:
		if side == 0 and is_retreat:
			continue
		var group := "attackers" if side == 0 else "defenders"
		var losses: Array = before[group].duplicate()
		_transfer(losses, after[group], -1)
		if Battle.total(losses) > 0:
			_event(_active_zone, "", _seat if side == 0 else 1 - _seat, losses)
	if after.step == Battle.Step.FINISHED:
		_finish_combat(after, destination if is_retreat else "")
	return ""


func _finish_combat(state: Dictionary, retreat: String) -> void:
	_regions[_active_zone].units = state.defenders
	if state.captured:
		_capture(_active_zone, "Captured")
		_regions[_active_zone].units = state.attackers
	elif not retreat.is_empty():
		_transfer(_regions[retreat].units, state.reserve, 1)
		_event(_active_zone, retreat, _seat, state.reserve)
		_note("Survivors return to %s." % _regions[retreat].name)
	for entry in state.log.slice(1):
		_note(entry)
	_battles.erase(_active_zone)
	_active_zone = ""
	_battle = null
	if _battles.is_empty():
		_phase = Phase.NONCOMBAT


func _mobilize(placements: Variant, complete := true) -> String:
	if not placements is Array:
		return "The placement list is invalid."
	var pool := _reinforcements.duplicate()
	var capacity := _capacity.duplicate()
	for placement in placements:
		if not placement is Dictionary:
			return "Each placement needs a factory and units."
		var zone: Variant = placement.get("zone")
		var counts: Variant = placement.get("counts")
		if not zone is String or capacity.get(zone, 0) <= 0:
			return "Choose a factory with capacity that you controlled at the start of the turn."
		if not _valid_counts(counts, pool) or Battle.total(counts) == 0:
			return "The plan exceeds the reinforcement pool."
		var count := Battle.total(counts)
		if count > capacity[zone]:
			return "%s has %d factory slots left." % [_regions[zone].name, capacity[zone]]
		_transfer(pool, counts, -1)
		capacity[zone] -= count
	if complete and Battle.total(pool) > 0:
		return "Assign all reinforcements before committing."
	_reinforcements = pool
	_capacity = capacity
	for placement in placements:
		_transfer(_regions[placement.zone].units, placement.counts, 1)
		_event("", placement.zone, _seat, placement.counts)
		_note("Mobilized %d units in %s." % [Battle.total(placement.counts), _regions[placement.zone].name])
	if complete:
		_phase = Phase.INCOME
	return ""


static func _valid_counts(counts: Variant, limit: Array) -> bool:
	if not counts is Array or counts.size() != Scenario.EMPTY.size():
		return false
	for i in counts.size():
		if not counts[i] is int or counts[i] < 0 or counts[i] > limit[i]:
			return false
	return true


static func _transfer(target: Array, counts: Array, direction: int) -> void:
	for i in counts.size():
		target[i] += counts[i] * direction


func _event(from: String, to: String, seat: int, counts: Array, via := "") -> void:
	_events.append({"from": from, "to": to, "seat": seat, "counts": counts.duplicate(), "via": via})


func _note(line: String) -> void:
	_log.append(line)
	if _log.size() > LOG_LIMIT:
		_log.pop_front()
