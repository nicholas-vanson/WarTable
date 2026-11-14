extends RefCounted
## Local pass-and-play Global 1940 campaign. Board state has the same shape as the atlas.

const Rules = preload("res://game/global_rules.gd")
const SOURCE := "res://game/global_1940.json"
const VERSION := 1
enum Phase { PURCHASE, COMBAT_MOVE, COMBAT, NONCOMBAT, MOBILIZE, INCOME }

var board := {}
var diplomacy := {}
var treasury := {}
var start_owners := {}
var phase := Phase.PURCHASE
var turn := 0
var round := 1
var revision := 0
var battles := {}
var fight := {}
var air_to_land: Array = []
var pool := {}
var log: Array = []
var japan_opened_war := false
var _dice := RandomNumberGenerator.new()
var _roller: Callable


func _init(roller := Callable()) -> void:
	var source: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SOURCE))
	for name in source.regions:
		var region: Dictionary = source.regions[name]
		board[name] = {"owner": region.owner, "original": region.original, "units": region.units, "links": region.links,
			"water": region.water, "ipc": int(region.ipc), "blocked": region.blocked, "city": region.city, "landmark": region.landmark}
		for piece in board[name].units:
			piece[2] = int(piece[2])
	for row in source.diplomacy:
		var one: String = Rules.power(row[0])
		var two: String = Rules.power(row[1])
		if one != two:
			_set_relation(one, two, row[2])
	for owner in source.treasury:
		treasury[owner] = int(source.treasury[owner])
	_dice.randomize()
	_roller = roller if roller.is_valid() else _dice.randi_range.bind(1, 6)
	_begin_turn()


func power() -> String:
	return Rules.ORDER[turn]


func _begin_turn() -> void:
	start_owners.clear()
	for zone in board:
		start_owners[zone] = board[zone].owner
	pool.clear()
	battles.clear()
	air_to_land.clear()
	fight.clear()
	phase = Phase.PURCHASE


func save(path: String) -> bool:
	var pending_file := path + ".tmp"
	var file := FileAccess.open(pending_file, FileAccess.WRITE)
	if file == null:
		return false
	file.store_var({"version": VERSION, "board": board, "diplomacy": diplomacy, "treasury": treasury,
		"start_owners": start_owners, "phase": phase, "turn": turn, "round": round, "revision": revision,
		"battles": battles, "fight": fight, "air_to_land": air_to_land, "pool": pool, "log": log,
		"seed": _dice.seed, "rng": _dice.state, "japan_opened_war": japan_opened_war})
	file.flush()
	var written := file.get_error() == OK
	file.close()
	return written and DirAccess.rename_absolute(pending_file, path) == OK


func load_save(path: String) -> bool:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false
	var data: Variant = file.get_var(false)
	if not data is Dictionary or data.get("version") != VERSION:
		return false
	for key in ["board", "diplomacy", "treasury", "start_owners", "battles", "fight", "pool"]:
		if not data.get(key) is Dictionary:
			return false
	for key in ["phase", "turn", "round", "revision", "seed", "rng"]:
		if not data.get(key) is int:
			return false
	if not data.get("air_to_land") is Array or not data.get("log") is Array or not data.turn in range(Rules.ORDER.size()) or not data.phase in range(6):
		return false
	if data.board.size() != board.size() or board.keys().any(func(zone): return not data.board.has(zone)):
		return false
	board = data.board
	diplomacy = data.diplomacy
	treasury = data.treasury
	start_owners = data.start_owners
	phase = data.phase
	turn = data.turn
	round = data.round
	revision = data.revision
	battles = data.battles
	fight = data.fight
	air_to_land = data.air_to_land
	pool = data.pool
	log = data.log
	japan_opened_war = data.get("japan_opened_war", false)
	_dice.seed = data.seed
	_dice.state = data.rng
	return true


func _set_relation(one: String, two: String, value: String) -> void:
	if not diplomacy.has(one):
		diplomacy[one] = {}
	if not diplomacy.has(two):
		diplomacy[two] = {}
	diplomacy[one][two] = value
	diplomacy[two][one] = value


func at_war(one: String, two: String) -> bool:
	return Rules.relation(diplomacy, one, two) == "War"


func declarations() -> Array:
	if phase != Phase.COMBAT_MOVE:
		return []
	var nation := power()
	var targets: Array = []
	match nation:
		"Germans", "Italians": targets = ["Americans", "Russians", "Chinese"]
		"Japanese": targets = ["Americans", "Russians", "British", "ANZAC", "French", "Dutch"]
		"British", "ANZAC": targets = ["Japanese"]
		"Russians": targets = ["Japanese"] + (["Germans", "Italians"] if round >= 4 or board["United Kingdom"].owner in Rules.AXIS else [])
		"Americans":
			if round >= 4 or japan_opened_war or board["United Kingdom"].owner in Rules.AXIS or Rules.AXIS.any(func(axis): return at_war(nation, axis)):
				targets = Rules.AXIS.duplicate()
	return targets.filter(func(target): return not at_war(nation, target))


func declare(target: String) -> bool:
	if target not in declarations():
		return false
	_set_relation(power(), target, "War")
	if power() == "Japanese" and target in ["British", "ANZAC"]:
		japan_opened_war = true
		for ally in ["British", "ANZAC", "Dutch"]:
			_set_relation(power(), ally, "War")
	elif power() in ["British", "ANZAC"] and target == "Japanese":
		_set_relation("British", target, "War")
		_set_relation("ANZAC", target, "War")
	revision += 1
	return true


func wallets() -> Array:
	return ["British", "UK_Pacific"] if power() == "British" else [power()]


func capacity(owner: String, zone: String) -> int:
	var region: Dictionary = board[zone]
	if region.water or start_owners.get(zone) != owner or region.owner != owner:
		return 0
	if owner == "Chinese":
		return 99
	for piece in region.units:
		if piece[1] == "factory_major":
			return 10
		if piece[1] == "factory_minor":
			return 3
	return 0


func purchase(draft: Dictionary) -> String:
	if phase != Phase.PURCHASE:
		return "Purchases are closed."
	var cost := {}
	for owner in wallets():
		var units: Dictionary = draft.get(owner, {})
		var slots := 0
		for zone in board:
			slots += capacity(owner, zone)
		cost[owner] = 0
		for unit in units:
			if not Rules.PROFILES.has(unit) or units[unit] < 0 or owner == "Chinese" and unit != "infantry" and not (unit == "artillery" and burma_road()):
				return "That unit is unavailable for this power."
			slots -= units[unit]
			cost[owner] += units[unit] * Rules.PROFILES[unit][0]
		if slots < 0 or cost[owner] > treasury[owner] or cost[owner] > 0 and not has_capital(owner):
			return "This purchase exceeds treasury or factory capacity."
	for owner in wallets():
		treasury[owner] -= cost[owner]
		pool[owner] = draft.get(owner, {}).duplicate()
	phase = Phase.COMBAT_MOVE
	revision += 1
	return ""


func burma_road() -> bool:
	for zone in ["India", "Burma", "Yunnan", "Szechwan"]:
		if board[zone].owner in Rules.AXIS or board[zone].owner.begins_with("Neutral"):
			return false
	return at_war("Chinese", "Japanese")


func has_capital(owner: String) -> bool:
	if owner == "Chinese":
		return true
	for region in board.values():
		if region.landmark == owner:
			return region.owner == owner
	return true


func units_at(zone: String) -> Dictionary:
	var totals := {}
	if not board.has(zone):
		return totals
	for piece in board[zone].units:
		if Rules.power(piece[0]) == power() and Rules.PROFILES.has(piece[1]):
			totals[piece[1]] = totals.get(piece[1], 0) + piece[2]
	return totals


func available(zone: String, orders: Array) -> Dictionary:
	var totals := units_at(zone)
	if phase == Phase.NONCOMBAT:
		for battle in battles.values():
			if battle.zone == zone:
				for piece in battle.moved:
					totals[piece[1]] = maxi(0, totals.get(piece[1], 0) - piece[2])
	for order in orders:
		if order.path[0] == zone and not order.get("landing", false):
			for unit in order.units:
				totals[unit] -= order.units[unit]
	for unit in totals.keys():
		if totals[unit] <= 0:
			totals.erase(unit)
	return totals


func routes(origin: String, units: Dictionary, landing := -1) -> Dictionary:
	if units.is_empty() or not board.has(origin) or phase not in [Phase.COMBAT_MOVE, Phase.NONCOMBAT]:
		return {}
	var first: String = units.keys()[0]
	if not Rules.PROFILES.has(first):
		return {}
	var distance := 99
	for unit in units:
		if not Rules.PROFILES.has(unit) or Rules.domain(unit) != Rules.domain(first):
			return {}
		distance = mini(distance, Rules.range_for(board, diplomacy, power(), unit, origin, start_owners))
	if landing >= 0:
		distance = landing
	return Rules.legal_routes(board, diplomacy, start_owners, power(), origin, units, phase == Phase.COMBAT_MOVE, distance)


func commit_moves(orders: Array) -> String:
	if phase not in [Phase.COMBAT_MOVE, Phase.NONCOMBAT]:
		return "Movement is closed."
	var accepted := []
	var flight_ids := {}
	for order in orders:
		if not order is Dictionary or not order.get("path") is Array or order.path.size() < 2 or not order.get("units") is Dictionary or order.units.is_empty():
			return "Choose an origin, units and a destination."
		if order.has("transport"):
			var crossing := _check_crossing(order, accepted)
			if not crossing.is_empty():
				return crossing
			accepted.append(order.duplicate(true))
			continue
		var path: Array = order.path
		var origin: String = path[0]
		var units: Dictionary = order.units
		var flight: int = order.get("flight", -1)
		var legal: Dictionary
		if flight >= 0:
			if phase != Phase.NONCOMBAT or flight >= air_to_land.size() or flight_ids.has(flight):
				return "Choose each returning flight once."
			var mission: Dictionary = air_to_land[flight]
			if mission.zone != origin or units != {mission.unit: mission.count}:
				return "Land the whole selected flight."
			flight_ids[flight] = true
			legal = routes(origin, units, mission.range)
		else:
			var limit := available(origin, accepted)
			for unit in units:
				var count: int = _transport_available(origin, accepted) if unit == "transport" else limit.get(unit, 0)
				if not units[unit] is int or units[unit] <= 0 or units[unit] > count:
					return "There are not enough unused units at %s." % origin
			legal = routes(origin, units)
		if not legal.has(path[-1]) or legal[path[-1]].path != path:
			return "The route to %s is no longer legal." % path[-1]
		var validated: Dictionary = legal[path[-1]].duplicate(true)
		validated.units = units.duplicate()
		validated.flight = flight
		validated.landing = flight >= 0
		accepted.append(validated)
	if phase == Phase.NONCOMBAT and flight_ids.size() != air_to_land.size():
		return "Assign a landing site for every returning flight."
	var carrier_usage := {}
	var departure_capacity := {}
	for order in accepted:
		if order.has("transport"):
			for zone in order.transport:
				if accepted.any(func(other): return not other.has("transport") and other.path[-1] == zone and Rules.domain(other.units.keys()[0]) == "sea" and Rules.enemy_fleet(board[zone], diplomacy, power())):
					return "Resolve hostile sea zones before using this transport route."
			continue
		var kind: String = order.units.keys()[0]
		var destination: String = order.path[-1]
		if phase == Phase.NONCOMBAT and kind in Rules.AIR and board[destination].water:
			carrier_usage[destination] = carrier_usage.get(destination, 0) + _count(order.units)
			if carrier_usage[destination] > Rules._carrier_slots(board[destination], diplomacy, power()):
				return "There is not enough carrier deck space in %s." % destination
		if order.units.has("carrier"):
			var origin: String = order.path[0]
			var starting_slots := Rules._carrier_slots(board[origin], diplomacy, power())
			departure_capacity[origin] = int(departure_capacity.get(origin, 0)) + order.units.carrier * 2
			if starting_slots < departure_capacity[origin]:
				return "Relocate aircraft before moving this carrier."
	for destination in carrier_usage:
		if carrier_usage[destination] + departure_capacity.get(destination, 0) > Rules._carrier_slots(board[destination], diplomacy, power()):
			return "A departing carrier leaves too little deck space in %s." % destination
	for order in accepted:
		if order.get("flight", -1) >= 0:
			continue
		for unit in order.units:
			_take(board[order.path[0]].units, unit, order.units[unit])
		if order.has("transport"):
			_take(board[order.transport[0]].units, "transport", 1)
	for order in accepted:
		if order.has("transport"):
			_amphibious_arrival(order)
		else:
			_arrive(order)
	if phase == Phase.COMBAT_MOVE:
		phase = Phase.COMBAT if pending().size() > 0 else Phase.NONCOMBAT
	else:
		air_to_land.clear()
		phase = Phase.MOBILIZE
	revision += 1
	return ""


func abandon_air(index: int) -> bool:
	if phase != Phase.NONCOMBAT or index < 0 or index >= air_to_land.size():
		return false
	var flight: Dictionary = air_to_land[index]
	if not routes_for_landing(flight).is_empty():
		return false
	air_to_land.remove_at(index)
	log.append("%d %s lost without a legal landing site." % [flight.count, Rules.title(flight.unit)])
	revision += 1
	return true


func crossings(origin: String, units: Dictionary, orders: Array) -> Dictionary:
	if phase not in [Phase.COMBAT_MOVE, Phase.NONCOMBAT] or units.is_empty() or not board.has(origin) or board[origin].water or _count(units) > 2 or _count(units) == 2 and not units.has("infantry"):
		return {}
	if units.keys().any(func(unit): return not Rules.PROFILES.has(unit) or Rules.domain(unit) != "land" or phase == Phase.COMBAT_MOVE and unit == "aaGun"):
		return {}
	var results := {}
	for port: String in board[origin].links:
		if not board[port].water or _transport_available(port, orders) <= 0 or Rules.enemy_fleet(board[port], diplomacy, power(), true):
			continue
		var queue := [[port]]
		var seen := {port: true}
		var radius := Rules.range_for(board, diplomacy, power(), "transport", port, start_owners)
		while not queue.is_empty():
			var sea_path: Array = queue.pop_front()
			var current: String = sea_path[-1]
			for neighbor: String in board[current].links:
				if board[neighbor].blocked or neighbor == origin:
					continue
				if board[neighbor].water:
					if sea_path.size() <= radius and not seen.has(neighbor) and Rules.canal_open(start_owners, diplomacy, power(), "transport", current, neighbor) and not Rules.enemy_fleet(board[neighbor], diplomacy, power(), true):
						seen[neighbor] = true
						queue.append(sea_path + [neighbor])
					continue
				var relationship := Rules.relation(diplomacy, power(), board[neighbor].owner)
				if (phase == Phase.COMBAT_MOVE and relationship == "War" or phase == Phase.NONCOMBAT and relationship == "Allied") and not results.has(neighbor):
					results[neighbor] = {"path": [origin] + sea_path + [neighbor], "transport": sea_path, "units": units.duplicate(), "blitz": "", "flight": -1}
	return results


func _transport_available(port: String, orders: Array) -> int:
	var count: int = available(port, orders).get("transport", 0)
	for order in orders:
		if order.has("transport") and order.transport[0] == port:
			count -= 1
	return count


func _check_crossing(order: Dictionary, accepted: Array) -> String:
	var origin: String = order.path[0]
	var destination: String = order.path[-1]
	var available_units := available(origin, accepted)
	for unit in order.units:
		if not order.units[unit] is int or order.units[unit] <= 0 or order.units[unit] > available_units.get(unit, 0):
			return "There are not enough troops for that transport."
	var routes_found := crossings(origin, order.units, accepted)
	if not routes_found.has(destination) or routes_found[destination].path != order.path or routes_found[destination].transport != order.transport:
		return "That transport crossing is unavailable."
	return ""


func _amphibious_arrival(order: Dictionary) -> void:
	var origin: String = order.path[0]
	var zone: String = order.path[-1]
	var coast: String = order.transport[-1]
	var ship := [power(), "transport", 1]
	_put(board[coast].units, ship)
	if phase == Phase.COMBAT_MOVE:
		if not battles.has(coast):
			battles[coast] = {"zone": coast, "units": [], "air": [], "moved": [], "entries": [], "resolved": true}
		battles[coast].moved.append(ship)
	var movement := order.duplicate()
	movement.path = [origin, zone]
	_arrive(movement)


func retreat_sites() -> Array:
	if fight.is_empty() or fight.stage != "press" or board[fight.zone].water:
		return []
	return battles[fight.zone].entries.filter(func(zone):
		return Rules.relation(diplomacy, power(), board[zone].owner) == "Allied")


func retreat(destination: String) -> void:
	if destination not in retreat_sites():
		return
	var battle: Dictionary = battles[fight.zone]
	for piece in fight.attack:
		if piece[2] > 0 and Rules.domain(piece[1]) == "land":
			_put(board[destination].units, piece)
			if not battles.has(destination):
				battles[destination] = {"zone": destination, "moved": [], "resolved": true}
			battles[destination].moved.append(piece.duplicate())
			piece[2] = 0
	_finish_battle()
	revision += 1


func _arrive(order: Dictionary) -> void:
	var origin: String = order.path[0]
	var destination: String = order.path[-1]
	if not order.blitz.is_empty():
		_capture(order.blitz)
	var is_combat := phase == Phase.COMBAT_MOVE
	var region: Dictionary = board[destination]
	var arrivals := []
	var airborne := []
	for unit in order.units:
		var owner := power()
		if power() == "British" and not region.water and region.owner == "UK_Pacific":
			owner = "UK_Pacific"
		var piece := [owner, unit, order.units[unit]]
		arrivals.append(piece)
		if is_combat and unit in Rules.AIR:
			var left: int = Rules.range_for(board, diplomacy, power(), unit, origin, start_owners) - order.path.size() + 1
			airborne.append({"zone": destination, "unit": unit, "count": piece[2], "range": left})
	var hostile := _hostile(destination)
	var needs_battle := is_combat and not hostile.is_empty()
	if is_combat and region.owner == "Neutral_True" and Rules.relation(diplomacy, power(), "Neutral_True") == "Strict_Neutral":
		# The attack, rather than the capture, changes the other strict neutrals' alignment.
		for nation in Rules.ORDER:
			_set_relation(nation, "Neutral_True", "Unfriendly_Neutral" if (nation in Rules.AXIS) == (power() in Rules.AXIS) else "Friendly_Neutral")
	if needs_battle:
		if not battles.has(destination):
			battles[destination] = {"zone": destination, "units": [], "air": [], "moved": [], "entries": [], "resolved": false}
		var battle: Dictionary = battles[destination]
		var entry: String = order.path[-2]
		if not order.has("transport") and entry not in battle.entries and arrivals.any(func(piece): return Rules.domain(piece[1]) != "air"):
			battle.entries.append(entry)
		for piece in arrivals:
			_put(battle.units, piece)
		battle.air.append_array(airborne)
	elif is_combat:
		air_to_land.append_array(airborne)
		var land := arrivals.filter(func(piece): return piece[1] not in Rules.AIR)
		if not region.water and not land.is_empty() and Rules.relation(diplomacy, power(), region.owner) != "Allied":
			_capture(destination)
		for piece in land:
			_put(region.units, piece)
		if not land.is_empty():
			if not battles.has(destination):
				battles[destination] = {"zone": destination, "units": [], "air": [], "moved": [], "resolved": true}
			battles[destination].moved.append_array(land)
	else:
		if not region.water and Rules.relation(diplomacy, power(), region.owner) == "Friendly_Neutral":
			_capture(destination)
		for piece in arrivals:
			_put(region.units, piece)


func _hostile(zone: String) -> Array:
	return board[zone].units.filter(func(piece):
		var relationship := Rules.relation(diplomacy, power(), piece[0])
		return piece[1] not in Rules.FACILITIES and relationship in ["War", "Unfriendly_Neutral", "Strict_Neutral"])


func _capture(zone: String) -> void:
	var region: Dictionary = board[zone]
	var old: String = region.owner
	var owner := power()
	if Rules.relation(diplomacy, owner, region.original) == "Allied" and not region.original.begins_with("Neutral") and region.original != "Dutch" and has_capital(region.original):
		owner = region.original
	elif owner == "British" and region.original == "UK_Pacific":
		owner = "UK_Pacific"
	if old == region.landmark and treasury.has(old) and old != "Chinese" and at_war(owner, old):
		treasury[owner] += treasury[old]
		treasury[old] = 0
	region.owner = owner
	for piece in region.units:
		if piece[0] == old and (piece[1] in Rules.FACILITIES or old.begins_with("Neutral") and Rules.relation(diplomacy, owner, old) == "Friendly_Neutral"):
			piece[0] = owner
			if piece[1] == "factory_major":
				piece[1] = "factory_minor"


func pending() -> Array:
	return battles.keys().filter(func(zone): return not battles[zone].resolved)


func start_battle(zone: String) -> void:
	if phase != Phase.COMBAT or not fight.is_empty() or zone not in pending():
		return
	fight = {"zone": zone, "attack": battles[zone].units.duplicate(true), "defense": _hostile(zone).duplicate(true),
		"damage": [{}, {}], "stage": "attack", "round": 1, "hits": 0, "volley": {}, "defender_losses": []}
	revision += 1


func roll() -> Dictionary:
	if fight.is_empty() or fight.stage not in ["attack", "defense"]:
		return {}
	var attacking: bool = fight.stage == "attack"
	var side: Array = fight.attack if attacking else fight.defense
	var artillery := _unit_count(side, "artillery") if attacking else 0
	var support := _unit_count(side, "armour") + _unit_count(side, "fighter") if attacking else 0
	var dice: Array = []
	var hits := 0
	for piece in side:
		var unit: String = piece[1]
		var base: int = Rules.PROFILES[unit][1 if attacking else 2]
		for _i in piece[2]:
			var target := base
			if artillery > 0 and unit in ["infantry", "mech_infantry"]:
				target += 1
				artillery -= 1
			if support > 0 and unit == "tactical_bomber":
				target += 1
				support -= 1
			if target > 0:
				var face: int = _roller.call()
				dice.append({"unit": unit, "face": face, "target": target})
				hits += int(face <= target)
	revision += 1
	var result := {"revision": revision, "zone": fight.zone, "location": fight.zone, "attacking": attacking, "dice": dice, "hits": hits}
	fight.volley = result
	log.append("%s · %s · %d hits" % [fight.zone, "Attack" if attacking else "Defense", hits])
	var victim: Array = fight.defense if attacking else fight.attack
	fight.hits = mini(hits, _hit_capacity(victim, fight.damage[1 if attacking else 0]))
	fight.stage = "defender_losses" if attacking else "attacker_losses"
	if fight.hits == 0:
		apply_losses({})
	return result


func apply_losses(losses: Dictionary) -> bool:
	if fight.is_empty() or fight.stage not in ["attacker_losses", "defender_losses"] or _count(losses) != fight.hits:
		return false
	var defender: bool = fight.stage == "defender_losses"
	var pieces: Array = fight.defense if defender else fight.attack
	for index in losses:
		if not index is int or index < 0 or index >= pieces.size() or not losses[index] is int or losses[index] < 0:
			return false
	var damage: Dictionary = fight.damage[1 if defender else 0]
	var taken := []
	for i in pieces.size():
		var piece: Array = pieces[i]
		var hit: int = losses.get(i, 0)
		var old_damage: int = damage.get(i, 0)
		var two_hits: bool = piece[1] in ["battleship", "carrier"]
		if hit < 0 or hit > piece[2] * (2 if two_hits else 1) - old_damage:
			return false
		var combined := hit + old_damage
		var killed := maxi(0, combined - piece[2]) if two_hits else hit
		taken.append([killed, combined - killed * 2 if two_hits else 0])
	if defender:
		fight.defender_losses = taken
		fight.stage = "defense"
	else:
		_remove_losses(fight.attack, fight.damage[0], taken)
		_remove_losses(fight.defense, fight.damage[1], fight.defender_losses)
		if _unit_count(fight.attack) == 0 or _unit_count(fight.defense) == 0:
			_finish_battle()
		else:
			fight.stage = "press"
	revision += 1
	return true


func _remove_losses(pieces: Array, damage: Dictionary, taken: Array) -> void:
	for i in pieces.size():
		pieces[i][2] -= taken[i][0]
		damage[i] = taken[i][1]


func next_round() -> void:
	if not fight.is_empty() and fight.stage == "press":
		fight.stage = "attack"
		fight.round += 1
		fight.volley = {}
		revision += 1


func _finish_battle() -> void:
	var zone: String = fight.zone
	var battle: Dictionary = battles[zone]
	var region: Dictionary = board[zone]
	for piece in _hostile(zone):
		region.units.erase(piece)
	for piece in fight.defense:
		if piece[2] > 0:
			_put(region.units, piece)
	if _unit_count(fight.defense) == 0 and not region.water and fight.attack.any(func(piece): return piece[2] > 0 and Rules.domain(piece[1]) == "land" and piece[1] != "aaGun"):
		_capture(zone)
	for piece in fight.attack:
		if piece[1] in Rules.AIR:
			var survivors: int = piece[2]
			var flights: Array = battle.air.filter(func(flight): return flight.unit == piece[1])
			flights.sort_custom(func(a, b): return a.range > b.range)
			for flight in flights:
				if survivors == 0:
					break
				flight.count = mini(survivors, flight.count)
				survivors -= flight.count
				if routes_for_landing(flight).is_empty():
					log.append("%s lost after battle · no legal landing site" % Rules.title(flight.unit))
				else:
					air_to_land.append(flight)
		elif piece[2] > 0:
			_put(region.units, piece)
			battle.moved.append(piece)
	battle.resolved = true
	battle.units.clear()
	fight = {}
	if pending().is_empty():
		phase = Phase.NONCOMBAT


func routes_for_landing(flight: Dictionary) -> Dictionary:
	return Rules.legal_routes(board, diplomacy, start_owners, power(), flight.zone, {flight.unit: flight.count}, false, flight.range)


func income(owner: String) -> int:
	if not has_capital(owner):
		return 0
	var total := 0
	for region in board.values():
		if region.owner == owner:
			total += region.ipc
	if owner == "Chinese" and burma_road():
		total += 6
	return total


func mobilize(orders: Array) -> String:
	if phase != Phase.MOBILIZE:
		return "Mobilization is closed."
	var left := pool.duplicate(true)
	var slots := {}
	for order in orders:
		if not order is Dictionary or not order.get("count") is int:
			return "Invalid reinforcement order."
		var owner: String = order.owner
		var factory: String = order.factory
		var zone: String = order.zone
		var unit: String = order.unit
		var count: int = order.count
		if owner not in wallets() or not Rules.PROFILES.has(unit) or not board.has(factory) or not board.has(zone) or count <= 0 or count > left[owner].get(unit, 0):
			return "Invalid reinforcement order."
		var free: int = slots.get(factory, capacity(owner, factory))
		if count > free:
			return "This factory is at capacity."
		if unit in Rules.SEA:
			if not board[zone].water or zone not in board[factory].links or Rules.enemy_fleet(board[zone], diplomacy, power(), true):
				return "Ships need a friendly sea zone adjacent to the factory."
		elif zone != factory:
			return "Place land and air units at the factory."
		slots[factory] = free - count
		left[owner][unit] -= count
	for units in left.values():
		if _count(units) > 0:
			return "Place all purchased units before committing."
	for order in orders:
		_put(board[order.zone].units, [order.owner, order.unit, order.count])
	pool.clear()
	phase = Phase.INCOME
	revision += 1
	return ""


func collect() -> void:
	if phase != Phase.INCOME:
		return
	for owner in wallets():
		treasury[owner] += income(owner)
	turn += 1
	if turn == Rules.ORDER.size():
		turn = 0
		round += 1
	_begin_turn()
	revision += 1


func _take(pieces: Array, unit: String, amount: int) -> void:
	for piece in pieces.duplicate():
		if Rules.power(piece[0]) == power() and piece[1] == unit and amount > 0:
			var removed := mini(amount, piece[2])
			piece[2] -= removed
			amount -= removed
			if piece[2] == 0:
				pieces.erase(piece)


static func _put(pieces: Array, unit: Array) -> void:
	for piece in pieces:
		if piece[0] == unit[0] and piece[1] == unit[1]:
			piece[2] += unit[2]
			return
	pieces.append(unit.duplicate())


static func _unit_count(pieces: Array, kind := "") -> int:
	var total := 0
	for piece in pieces:
		if kind.is_empty() or piece[1] == kind:
			total += piece[2]
	return total


static func _count(counts: Dictionary) -> int:
	var total := 0
	for value in counts.values():
		total += value
	return total


static func _hit_capacity(pieces: Array, damage: Dictionary) -> int:
	var total := 0
	for i in pieces.size():
		total += pieces[i][2] * (2 if pieces[i][1] in ["battleship", "carrier"] else 1) - damage.get(i, 0)
	return total
