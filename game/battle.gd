extends RefCounted
## Rules for one overland engagement. The host owns this object and its dice.

enum Step { COMMIT, ATTACK_ROLL, DEFENDER_LOSSES, DEFENSE_ROLL, ATTACKER_LOSSES, DECIDE, FINISHED }
enum Seat { ATTACKER, DEFENDER }

const UNITS := ["Infantry", "Artillery", "Tank"]
const ATTACK := [1, 2, 3]
const DEFENSE := [2, 2, 3]
const ATTACKER_SETUP := [4, 2, 1]
const DEFENDER_SETUP := [3, 1, 1]
const LOG_LIMIT := 60

var _rng := RandomNumberGenerator.new()
var _roller: Callable
var _step := Step.COMMIT
var _revision := 0
var _round := 0
var _reserve: Array = ATTACKER_SETUP.duplicate()
var _attackers := [0, 0, 0]
var _defenders: Array = DEFENDER_SETUP.duplicate()
var _marked_defenders := [0, 0, 0]
var _hits_due := 0
var _result := ""
var _captured := false
var _volley := {}
var _round_hits := [-1, -1]
var _log: Array[String] = []
var _location: String


func _init(roller := Callable(), attackers := ATTACKER_SETUP, defenders := DEFENDER_SETUP, location := "the crossroads") -> void:
	_rng.randomize()
	_roller = roller if roller.is_valid() else _rng.randi_range.bind(1, 6)
	_reserve = attackers.duplicate()
	_defenders = defenders.duplicate()
	_location = location
	_note("The attacker chooses which units to send to %s." % _location)


func snapshot() -> Dictionary:
	return {
		"step": _step, "revision": _revision, "round": _round,
		"reserve": _reserve.duplicate(), "attackers": _attackers.duplicate(),
		"defenders": _defenders.duplicate(), "marked_defenders": _marked_defenders.duplicate(), "hits_due": _hits_due,
		"result": _result, "captured": _captured, "log": _log.duplicate(), "volley": _volley.duplicate(true),
		"round_hits": _round_hits.duplicate(),
	}


static func active_seat(step: int) -> int:
	match step:
		Step.DEFENDER_LOSSES, Step.DEFENSE_ROLL:
			return Seat.DEFENDER
		Step.FINISHED:
			return -1
		_:
			return Seat.ATTACKER


static func total(counts: Array) -> int:
	var sum := 0
	for count in counts:
		sum += int(count)
	return sum


func submit(seat: int, revision: int, command: String, counts: Array) -> String:
	if revision != _revision:
		return "The battle advanced. Review the current orders and try again."
	if _step == Step.FINISHED or seat != active_seat(_step):
		return "It is the other player's decision."
	match _step:
		Step.COMMIT:
			if command != "commit" or not _valid_counts(counts, _reserve) or total(counts) == 0:
				return "Choose at least one available attacking unit."
			_attackers = counts.duplicate()
			_subtract(_reserve, counts)
			_start_round()
		Step.ATTACK_ROLL:
			if command != "roll":
				return "Roll the attack dice first."
			_roll_attack()
		Step.DEFENDER_LOSSES:
			if command != "losses" or not _valid_losses(counts, _defenders):
				return "Mark exactly %d available defender casualties." % _hits_due
			_marked_defenders = counts.duplicate()
			_note("Defender marks %s. These units still return fire." % _force_text(counts))
			_step = Step.DEFENSE_ROLL
		Step.DEFENSE_ROLL:
			if command != "roll":
				return "Roll the defense dice first."
			_roll_defense()
		Step.ATTACKER_LOSSES:
			if command != "losses" or not _valid_losses(counts, _attackers):
				return "Remove exactly %d available attacker casualties." % _hits_due
			_subtract(_attackers, counts)
			_note("Attacker loses %s." % _force_text(counts))
			_end_round()
		Step.DECIDE:
			if command == "roll":
				_start_round()
				_roll_attack()
			elif command == "retreat":
				for i in UNITS.size():
					_reserve[i] += _attackers[i]
					_attackers[i] = 0
				_finish("The attacker retreats. The defender holds %s." % _location)
			else:
				return "Choose to continue or retreat."
	_revision += 1
	return ""


func _valid_counts(counts: Array, available: Array) -> bool:
	if counts.size() != UNITS.size():
		return false
	for i in UNITS.size():
		if typeof(counts[i]) != TYPE_INT or counts[i] < 0 or counts[i] > available[i]:
			return false
	return true


func _valid_losses(counts: Array, available: Array) -> bool:
	return _valid_counts(counts, available) and total(counts) == _hits_due


func _start_round() -> void:
	_round += 1
	_round_hits = [-1, -1]
	_step = Step.ATTACK_ROLL
	_note("ROUND %d" % _round)


func _roll_attack() -> void:
	_hits_due = mini(_roll_volley(true), total(_defenders))
	_step = Step.DEFENSE_ROLL if _hits_due == 0 else Step.DEFENDER_LOSSES


func _roll_defense() -> void:
	_hits_due = mini(_roll_volley(false), total(_attackers))
	if _hits_due == 0:
		_end_round()
	else:
		_step = Step.ATTACKER_LOSSES


func _roll_volley(attacking: bool) -> int:
	var force := _attackers if attacking else _defenders
	var values := ATTACK if attacking else DEFENSE
	var supported := mini(force[0], force[1]) if attacking else 0
	var hits := 0
	var results: Array[Dictionary] = []
	var groups: Array[String] = []
	for i in UNITS.size():
		var rolls: Array[String] = []
		for unit in int(force[i]):
			var target: int = values[i]
			if i == 0 and unit < supported:
				target += 1
			var die: int = _roller.call()
			if die <= target:
				hits += 1
			results.append({"face": die, "target": target, "unit": i})
			rolls.append("%d≤%d %s" % [die, target, "hit" if die <= target else "miss"])
		if not rolls.is_empty():
			groups.append("%s: %s" % [UNITS[i], ", ".join(rolls)])
	var side := "Attack" if attacking else "Defense"
	var support := " • %d supported infantry" % supported if supported > 0 else ""
	_volley = {"dice": results, "hits": hits}
	_round_hits[Seat.ATTACKER if attacking else Seat.DEFENDER] = hits
	_note("%s • %d %s%s\n%s" % [side, hits, "hit" if hits == 1 else "hits", support, "\n".join(groups)])
	return hits


static func formation(force: Array, attacking: bool) -> Dictionary:
	var values := ATTACK if attacking else DEFENSE
	var groups := {}
	for i in UNITS.size():
		if force[i] > 0:
			if not groups.has(values[i]):
				groups[values[i]] = [0, 0, 0]
			groups[values[i]][i] = force[i]
	if attacking and force[0] > 0 and force[1] > 0:
		var supported := mini(force[0], force[1])
		groups[1][0] -= supported
		groups[2][0] += supported
		if groups[1][0] == 0:
			groups.erase(1)
	return groups


func _end_round() -> void:
	_subtract(_defenders, _marked_defenders)
	_marked_defenders = [0, 0, 0]
	_hits_due = 0
	if total(_attackers) == 0:
		if total(_defenders) == 0:
			_finish("Both forces are eliminated. The defender keeps control of %s." % _location)
		else:
			_finish("The attacking force is eliminated. The defender holds %s." % _location)
	elif total(_defenders) == 0:
		_captured = true
		_finish("The attacker takes control of %s." % _location)
	else:
		_step = Step.DECIDE
		_note("The attacker can press the attack or retreat.")


func _finish(result: String) -> void:
	_result = result
	_step = Step.FINISHED
	_note(result)


func _note(entry: String) -> void:
	_log.append(entry)
	if _log.size() > LOG_LIMIT:
		_log.pop_front()


func _subtract(force: Array, losses: Array) -> void:
	for i in UNITS.size():
		force[i] -= losses[i]


func _force_text(force: Array) -> String:
	var parts: Array[String] = []
	for i in UNITS.size():
		if force[i] > 0:
			parts.append("%d %s" % [force[i], UNITS[i].to_lower()])
	return ", ".join(parts)
