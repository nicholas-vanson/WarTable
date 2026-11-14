extends RefCounted
## Shares the map gestures between the regional board and the world atlas.

var _fingers := {}
var _start := Vector2.ZERO
var _moved := false


func handle(event: InputEvent, tap: Callable, pan: Callable, zoom: Callable) -> bool:
	if event is InputEventScreenTouch:
		if event.pressed:
			if _fingers.is_empty():
				_start = event.position
				_moved = false
			else:
				_moved = true
			_fingers[event.index] = event.position
		else:
			if not _fingers.erase(event.index):
				return false
			if _fingers.is_empty() and not _moved and not event.canceled:
				tap.call(event.position)
		return true
	if event is InputEventScreenDrag and _fingers.has(event.index):
		var previous: Vector2 = _fingers[event.index]
		_fingers[event.index] = event.position
		if _fingers.size() == 2:
			var other: Vector2 = _fingers.values()[0 if _fingers.keys()[0] != event.index else 1]
			var old_distance := other.distance_to(previous)
			if old_distance > 5.0:
				pan.call((event.position - previous) * 0.5)
				zoom.call((other + event.position) * 0.5, other.distance_to(event.position) / old_distance)
		elif _fingers.size() == 1 and (_moved or _start.distance_to(event.position) > 6.0):
			pan.call(event.position - previous)
			_moved = true
		return true
	return false


func reset() -> void:
	_fingers.clear()
	_moved = false
