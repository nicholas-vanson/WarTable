extends RefCounted
## Global 1940 unit profiles and route validation. The printed map graph is authoritative.

const ORDER := ["Germans", "Russians", "Japanese", "Americans", "Chinese", "British", "Italians", "ANZAC", "French"]
const AXIS := ["Germans", "Japanese", "Italians"]
const FACILITIES := ["factory_minor", "factory_major", "airfield", "harbour"]
const AIR := ["fighter", "tactical_bomber", "bomber"]
const SEA := ["transport", "submarine", "destroyer", "cruiser", "carrier", "battleship"]
const PROFILES := {
	"infantry": [3, 1, 2, 1], "artillery": [4, 2, 2, 1], "mech_infantry": [4, 1, 2, 2], "armour": [6, 3, 3, 2], "aaGun": [5, 0, 0, 1],
	"fighter": [10, 3, 4, 4], "tactical_bomber": [11, 3, 3, 4], "bomber": [12, 4, 1, 6],
	"transport": [7, 0, 0, 2], "submarine": [6, 2, 1, 2], "destroyer": [8, 2, 2, 2],
	"cruiser": [12, 3, 3, 2], "carrier": [16, 0, 2, 2], "battleship": [20, 4, 4, 2],
}
const NAMES := {"armour": "Tank", "aaGun": "AAA", "mech_infantry": "Mechanized infantry", "tactical_bomber": "Tactical bomber",
	"bomber": "Strategic bomber", "factory_minor": "Minor factory", "factory_major": "Major factory", "harbour": "Naval base", "airfield": "Air base"}
const CANALS := [
	["64 Sea Zone", "89 Sea Zone", ["Central America"]], ["81 Sea Zone", "98 Sea Zone", ["Egypt", "Trans-Jordan"]],
	["99 Sea Zone", "100 Sea Zone", ["Turkey"]], ["91 Sea Zone", "92 Sea Zone", ["Gibraltar"]],
	["112 Sea Zone", "113 Sea Zone", ["Denmark"]],
]
const CHINESE_FRONT := ["Burma", "Kwangtung"]
const US_PATROL := ["10 Sea Zone", "11 Sea Zone", "26 Sea Zone", "64 Sea Zone", "89 Sea Zone", "101 Sea Zone", "102 Sea Zone"]


static func power(owner: String) -> String:
	return "British" if owner == "UK_Pacific" else owner


static func title(unit: String) -> String:
	return NAMES.get(unit, unit.capitalize())


static func domain(unit: String) -> String:
	if unit in AIR:
		return "air"
	return "sea" if unit in SEA else "land"


static func relation(diplomacy: Dictionary, one: String, two: String) -> String:
	if one.is_empty() or two.is_empty():
		return "Neutrality"
	one = power(one)
	two = power(two)
	return "Allied" if one == two else diplomacy.get(one, {}).get(two, "Neutrality")


static func controls_base(board: Dictionary, diplomacy: Dictionary, nation: String, zone: String, base: String) -> bool:
	var region: Dictionary = board[zone]
	if relation(diplomacy, nation, region.owner) != "Allied":
		return false
	for piece in region.units:
		if piece[1] == base and piece[2] > 0:
			return true
	return false


static func enemy_fleet(region: Dictionary, diplomacy: Dictionary, nation: String, ignore_light := false) -> bool:
	for piece in region.units:
		if piece[1] in SEA and relation(diplomacy, nation, piece[0]) == "War":
			if not ignore_light or piece[1] not in ["transport", "submarine"]:
				return true
	return false


static func canal_open(start_owners: Dictionary, diplomacy: Dictionary, nation: String, unit: String, left: String, right: String) -> bool:
	for gate in CANALS:
		if (gate[0] == left and gate[1] == right) or (gate[1] == left and gate[0] == right):
			if gate[0] == "91 Sea Zone" and unit == "submarine":
				return true
			for coast in gate[2]:
				if relation(diplomacy, nation, start_owners[coast]) != "Allied":
					return false
	return true


static func range_for(board: Dictionary, diplomacy: Dictionary, nation: String, unit: String, origin: String, start_owners: Dictionary) -> int:
	var distance: int = PROFILES[unit][3]
	if unit in AIR and start_owners.get(origin) == board[origin].owner and controls_base(board, diplomacy, nation, origin, "airfield"):
		distance += 1
	elif unit in SEA:
		for neighbor in board[origin].links:
			if not board[neighbor].water and start_owners.get(neighbor) == board[neighbor].owner and controls_base(board, diplomacy, nation, neighbor, "harbour"):
				distance += 1
				break
	return distance


static func legal_routes(board: Dictionary, diplomacy: Dictionary, start_owners: Dictionary, nation: String, origin: String,
		units: Dictionary, combat: bool, distance: int) -> Dictionary:
	if not board.has(origin) or units.is_empty() or distance <= 0:
		return {}
	var unit: String = units.keys()[0]
	var branch := domain(unit)
	var route := {"path": [origin], "blitz": ""}
	var queue := [route]
	var results := {}
	var visited := {origin: true}
	while not queue.is_empty():
		route = queue.pop_front()
		var last: String = route.path[-1]
		for next: String in board[last].links:
			var path: Array = route.path + [next]
			var key: String = next + "|" + route.blitz
			if visited.has(key):
				continue
			var step := _step(board, diplomacy, start_owners, nation, units, branch, combat, route, next, distance - path.size() + 1)
			if step.is_empty():
				continue
			visited[key] = true
			var order := {"path": path, "blitz": step.blitz}
			if step.destination and not results.has(next):
				results[next] = {"path": path, "blitz": route.blitz}
			if step.through and path.size() - 1 < distance and next not in route.path:
				queue.append(order)
	return results


static func _step(board: Dictionary, dip: Dictionary, start: Dictionary, nation: String, units: Dictionary,
		branch: String, combat: bool, route: Dictionary, next: String, spare: int) -> Dictionary:
	var region: Dictionary = board[next]
	var relation_to_owner := relation(dip, nation, region.owner)
	var friendly := relation_to_owner == "Allied"
	var enemy := relation_to_owner == "War" or relation_to_owner in ["Unfriendly_Neutral", "Strict_Neutral"]
	var blitz: String = route.blitz
	if region.blocked or (nation == "Chinese" and (region.water or region.original != "Chinese" and next not in CHINESE_FRONT)):
		return {}
	if branch == "land":
		if region.water or combat and units.has("aaGun"):
			return {}
		if friendly:
			return {"destination": not combat or not blitz.is_empty(), "through": blitz.is_empty(), "blitz": blitz}
		if not combat:
			return {"destination": true, "through": false, "blitz": ""} if relation_to_owner == "Friendly_Neutral" and not units.has("aaGun") else {}
		if not enemy:
			return {}
		var can_blitz: bool = spare > 0 and relation_to_owner == "War" and region.units.is_empty() and blitz.is_empty() \
			and units.get("armour", 0) >= units.get("mech_infantry", 0) and units.get("armour", 0) > 0 \
			and units.keys().all(func(kind): return kind in ["armour", "mech_infantry"])
		return {"destination": true, "through": can_blitz, "blitz": next if can_blitz else blitz}
	if branch == "sea":
		if not region.water or not canal_open(start, dip, nation, units.keys()[0], route.path[-1], next):
			return {}
		if nation == "Americans" and not AXIS.any(func(axis): return relation(dip, nation, axis) == "War") and next not in US_PATROL:
			return {}
		var hostile := enemy_fleet(region, dip, nation, true)
		var any_enemy := enemy_fleet(region, dip, nation)
		var enemy_destroyer: bool = region.units.any(func(piece): return piece[1] == "destroyer" and relation(dip, nation, piece[0]) == "War")
		var can_pass := not hostile or units.size() == 1 and units.has("submarine") and not enemy_destroyer
		var has_attacker := units.keys().any(func(kind): return PROFILES[kind][1] > 0)
		return {"destination": any_enemy and has_attacker if combat else not hostile, "through": can_pass, "blitz": ""}
	if not region.water and not friendly and relation_to_owner != "War":
		return {}
	var can_land := friendly and relation(dip, nation, start[next]) == "Allied"
	if region.water:
		can_land = _carrier_slots(region, dip, nation) >= _air_count(units) and not units.has("bomber")
	var attack := (relation_to_owner == "War" if not region.water else enemy_fleet(region, dip, nation))
	var destination := can_land if not combat else attack and _landing_reachable(board, dip, start, nation, next, units, spare)
	return {"destination": destination, "through": true, "blitz": ""}


static func _air_count(units: Dictionary) -> int:
	return units.get("fighter", 0) + units.get("tactical_bomber", 0)


static func _carrier_slots(region: Dictionary, dip: Dictionary, nation: String) -> int:
	var slots := 0
	for piece in region.units:
		if relation(dip, nation, piece[0]) != "Allied":
			continue
		if piece[1] == "carrier":
			slots += piece[2] * 2
		elif piece[1] in ["fighter", "tactical_bomber"]:
			slots -= piece[2]
	return slots


static func _landing_reachable(board: Dictionary, dip: Dictionary, start: Dictionary, nation: String, origin: String, units: Dictionary, distance: int) -> bool:
	if distance <= 0:
		return false
	return not legal_routes(board, dip, start, nation, origin, units, false, distance).is_empty()
