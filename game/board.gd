extends Control
## Board coordinates stay stable as the viewport moves. Match snapshots and local
## order previews are separate, so panning and drafting never affect the host.

signal territory_pressed(id: String)
signal stack_pressed(zone: String, seat: int, unit: int)
signal camera_changed(percent: int)
signal projection_changed

const Map = preload("res://game/map_data.gd")
const Battle = preload("res://game/battle.gd")
const Scenario = preload("res://game/scenario.gd")
const UI = preload("res://game/ui_style.gd")
const MapTouch = preload("res://game/map_touch.gd")
const RELIEF = preload("res://game/art/western-relief.png")
const UNIT_ICONS := [preload("res://game/units/infantry.svg"), preload("res://game/units/artillery.svg"), preload("res://game/units/tank.svg")]
const SEA := Color("#173d50")
const INK := Color("#182923")
const GOLD := Color("#f4ce85")
const TEAL := Color("#b9e0ce")
const AMBER_INK := Color("#5e422a")
const TEAL_INK := Color("#254840")
const LOSS := Color("#e68a72")
const PAPER := Color("#f3ead8")
const TOKEN_SIZE := Vector2(36, 33)
const TOKEN_GAP := 42.0
const ANIMATION_TIME := 0.62

var _polygons: Dictionary = {}
var _sea_polygons: Dictionary = {}
var _territories: Array = []
var _coast: PackedVector2Array = []
var _terrain_uv := {}
var _expanded := true
var _state: Dictionary = {}
var _overlay: Dictionary = {}
var _stacks: Array[Dictionary] = []
var _selected := ""
var _hover := ""
var _zoom := 1.0
var _pan := Vector2.ZERO
var _press := Vector2.ZERO
var _drag_button := MOUSE_BUTTON_NONE
var _dragging := false
var _touch := MapTouch.new()
var touch_layout := false
var _effects: Array[Dictionary] = []
var _age := 0.0
var _font: Font
var _bold: FontVariation
var _grain: PackedVector2Array = []


func _ready() -> void:
	clip_contents = true
	_font = UI.BODY
	_bold = FontVariation.new()
	_bold.base_font = _font
	_bold.variation_embolden = 0.42
	_configure_map(true)
	for sea in Map.SEAS:
		_sea_polygons[sea[0]] = PackedVector2Array(sea[4])
	var rng := RandomNumberGenerator.new()
	rng.seed = 1740
	for i in 4400:
		var point := Vector2(rng.randf_range(1, Map.EXTENT.x - 2), rng.randf_range(1, Map.EXTENT.y - 2))
		_grain.append(point)
		_grain.append(point + Vector2(1.2, 0.5))
	resized.connect(_clamp_camera)
	visibility_changed.connect(func(): _touch.reset())
	mouse_exited.connect(func():
		_hover = ""
		queue_redraw()
	)
	set_process(false)


func display(state: Dictionary, overlay: Dictionary) -> void:
	var expanded: bool = state.get("expanded", true)
	if expanded != _expanded:
		_configure_map(expanded)
	if state.is_empty():
		_effects.clear()
		set_process(false)
	elif not _state.is_empty() and state.revision != _state.revision:
		_animate_change(_state, state)
	_state = state
	_overlay = overlay
	_selected = overlay.get("selected", "")
	_collect_stacks()
	queue_redraw()


func _configure_map(expanded: bool) -> void:
	_expanded = expanded
	_territories = Map.territories(expanded)
	_polygons.clear()
	_terrain_uv.clear()
	_coast.clear()
	var edges := {}
	for region in _territories:
		var polygon := PackedVector2Array(region[4])
		_polygons[region[0]] = polygon
		var uv := PackedVector2Array()
		for i in polygon.size():
			var from := polygon[i]
			var to := polygon[(i + 1) % polygon.size()]
			uv.append(from / Map.EXTENT)
			if from > to:
				var swap := from
				from = to
				to = swap
			var edge := Vector4(from.x, from.y, to.x, to.y)
			edges[edge] = edges.get(edge, 0) + 1
		_terrain_uv[region[0]] = uv
	for edge: Vector4 in edges:
		if edges[edge] == 1:
			_coast.append(Vector2(edge.x, edge.y))
			_coast.append(Vector2(edge.z, edge.w))


func zoom_by(factor: float) -> void:
	_zoom_at(size * 0.5, factor)


func reset_camera() -> void:
	_zoom = _minimum_zoom()
	_pan = Vector2.ZERO
	_clamp_camera()
	camera_changed.emit(roundi(_zoom * 100.0))


func focus_zone(zone: String) -> void:
	if not Map.ROUTE_ANCHORS.has(zone):
		return
	_zoom = maxf(1.55, _minimum_zoom())
	_center_camera(_route_anchor(zone))
	camera_changed.emit(roundi(_zoom * 100.0))


func _center_camera(point: Vector2) -> void:
	_pan = (Map.EXTENT * 0.5 - point) * _scale()
	_clamp_camera()


func battle_screen_point(zone: String) -> Vector2:
	return _origin() + _route_anchor(zone) * _scale()


func _route_anchor(zone: String) -> Vector2:
	if _expanded and Map.FRONT_ROUTES.has(zone):
		return Map.FRONT_ROUTES[zone]
	return Map.ROUTE_ANCHORS.get(zone, Map.EXTENT * 0.5)


func region_name(id: String) -> String:
	if _regions().has(id):
		return _regions()[id].name
	for region in _territories + Map.SEAS:
		if region[0] == id:
			return String(region[1]).capitalize()
	return "Western Europe"


func _gui_input(event: InputEvent) -> void:
	if _touch.handle(event, _tap, _pan_by, _zoom_at):
		accept_event()
		return
	if event.device == InputEvent.DEVICE_ID_EMULATION:
		return
	if event is InputEventMouseButton:
		if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			_zoom_at(event.position, 1.16 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.16)
			accept_event()
		elif event.pressed and event.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_MIDDLE, MOUSE_BUTTON_RIGHT]:
			if _zoom > 1.01 and event.button_index == MOUSE_BUTTON_LEFT and _minimap_rect().has_point(event.position):
				var inset := _minimap_rect()
				_center_camera((event.position - inset.position) / inset.size * Map.EXTENT)
				accept_event()
				return
			_drag_button = event.button_index
			_dragging = false
			_press = event.position
			accept_event()
		elif not event.pressed and _drag_button != MOUSE_BUTTON_NONE and event.button_index == _drag_button:
			_drag_button = MOUSE_BUTTON_NONE
			if not _dragging and event.button_index == MOUSE_BUTTON_LEFT:
				_tap(event.position)
			accept_event()
	elif event is InputEventMouseMotion:
		if _drag_button != MOUSE_BUTTON_NONE and (_dragging or _press.distance_to(event.position) >= 7.0):
			_dragging = true
			_pan += event.relative
			_clamp_camera()
		else:
			var region := _region_at(_to_board(event.position))
			if _hover != region:
				_hover = region
				queue_redraw()
	elif event is InputEventMagnifyGesture and not OS.has_feature("android"):
		_zoom_at(event.position, event.factor)
		accept_event()


func _pan_by(amount: Vector2) -> void:
	_pan += amount
	_clamp_camera()


func _tap(point: Vector2) -> void:
	if _zoom > 1.01 and _minimap_rect().has_point(point):
		var inset := _minimap_rect()
		_center_camera((point - inset.position) / inset.size * Map.EXTENT)
	else:
		_activate_at(_to_board(point))


func _activate_at(point: Vector2) -> void:
	var hit := _stack_at(point)
	if not hit.is_empty():
		stack_pressed.emit(hit[0].zone, hit[0].seat, hit[1])
		return
	var region := _region_at(point)
	if not region.is_empty():
		territory_pressed.emit(region)


func _stack_at(point: Vector2) -> Array:
	for stack in _stacks:
		for unit in Battle.UNITS.size():
			var rect := _token_rect(stack.zone, stack.seat, unit).grow_individual(0, 0, 4, 7)
			if _visible_count(stack, unit) > 0 and rect.has_point(point):
				return [stack, unit]
	return []


func _get_tooltip(at_position: Vector2) -> String:
	var hit := _stack_at(_to_board(at_position))
	if hit.is_empty():
		return ""
	var stack: Dictionary = hit[0]
	return "%s · %s · %d on this stack" % [Scenario.SIDES[stack.seat], Battle.UNITS[hit[1]], stack.units[hit[1]]]


func _region_at(point: Vector2) -> String:
	for region: String in _polygons:
		if Geometry2D.is_point_in_polygon(point, _polygons[region]):
			return region
	for sea: String in _sea_polygons:
		if Geometry2D.is_point_in_polygon(point, _sea_polygons[sea]):
			return sea
	return ""


func _zoom_at(cursor: Vector2, factor: float) -> void:
	var point := _to_board(cursor)
	_zoom = clampf(_zoom * factor, 1.0, 3.8)
	_pan += cursor - (_origin() + point * _scale())
	_clamp_camera()
	camera_changed.emit(roundi(_zoom * 100.0))


func _clamp_camera() -> void:
	var bounds := ((Map.EXTENT * _scale() - size) * 0.5).max(Vector2.ZERO)
	_pan = _pan.clamp(-bounds, bounds)
	queue_redraw()
	projection_changed.emit()


func _scale() -> float:
	return maxf(0.001, minf(size.x / Map.EXTENT.x, size.y / Map.EXTENT.y)) * _zoom


func _minimum_zoom() -> float:
	if not touch_layout or size.y < 1.0:
		return 1.0
	return clampf(size.x * Map.EXTENT.y / (size.y * Map.EXTENT.x) * 0.83, 1.0, 1.66)


func _origin() -> Vector2:
	return (size - Map.EXTENT * _scale()) * 0.5 + _pan


func _to_board(point: Vector2) -> Vector2:
	return (point - _origin()) / _scale()


func _draw() -> void:
	if _font == null:
		return
	draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(size.x, 0), size, Vector2(0, size.y)]),
		PackedColorArray([Color("#1a3a49"), Color("#173748"), Color("#0e283a"), Color("#183b4b")]))
	draw_set_transform(_origin(), 0, Vector2.ONE * _scale())
	_draw_chart()
	draw_multiline(_coast, Color("#427786"), 10.0, true)
	draw_multiline(_coast, Color("#85ada4"), 3.8, true)
	for region in _territories:
		_draw_territory(region)
	draw_multiline(_grain, Color(0.13, 0.15, 0.10, 0.16), 0.75)
	_draw_geography()
	_draw_routes()
	_draw_battle_markers()
	for stack in _stacks:
		_draw_force(stack)
	_draw_effects()
	draw_rect(Rect2(Vector2.ZERO, Map.EXTENT), Color("#1e302f"), false, 2.0)
	draw_set_transform(Vector2.ZERO)
	if _zoom > 1.01:
		_draw_minimap()


func _draw_chart() -> void:
	draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(Map.EXTENT.x, 0), Map.EXTENT, Vector2(0, Map.EXTENT.y)]),
		PackedColorArray([Color("#274e60"), SEA, Color("#112d42"), Color("#194254")]))
	for sea: String in _sea_polygons:
		if sea == _selected or sea == _hover:
			draw_colored_polygon(_sea_polygons[sea], Color(0.78, 0.88, 0.86, 0.18 if sea == _selected else 0.09))
	for x in range(40, int(Map.EXTENT.x), 57):
		draw_line(Vector2(x, 0), Vector2(x, Map.EXTENT.y), Color(0.67, 0.76, 0.75, 0.07), 1.0)
	for y in range(24, int(Map.EXTENT.y), 57):
		draw_line(Vector2(0, y), Vector2(Map.EXTENT.x, y), Color(0.67, 0.76, 0.75, 0.07), 1.0)
	for sea in Map.SEAS:
		var polygon: PackedVector2Array = _sea_polygons[sea[0]]
		for i in polygon.size():
			draw_dashed_line(polygon[i], polygon[(i + 1) % polygon.size()], Color("#6b959d"), 1.1, 7.0)
		var color := PAPER if _selected == sea[0] or _hover == sea[0] else Color("#a3bfc2")
		_caption(sea[2], sea[1], 15, color)
		var center: Vector2 = sea[2] + Vector2(0, 19)
		draw_circle(center, 12.5, Color("#143040"), true, -1, true)
		draw_circle(center, 12.5, Color(color, 0.68), false, 1.0, true)
		_caption(center + Vector2(0, 4.0), sea[3], 11, color, _bold)
	var compass := Vector2(79, 559)
	draw_circle(compass, 34, Color("#658c94"), false, 1.0, true)
	draw_circle(compass, 27, Color("#658c94"), false, 1.0, true)
	for i in 8:
		var ray := Vector2.from_angle(TAU * i / 8.0)
		var tip := compass + ray * (32 if i % 2 == 0 else 19)
		var shoulder := ray.orthogonal() * 6.0
		draw_colored_polygon(PackedVector2Array([compass, tip, compass + shoulder]), Color("#b0c9c6"))
		draw_colored_polygon(PackedVector2Array([compass, tip, compass - shoulder]), Color("#567e87"))
	draw_circle(compass, 3, PAPER, true, -1, true)
	_caption(compass + Vector2(0, -40), "N", 13, PAPER, _bold)


func _draw_territory(region: Array) -> void:
	var id: String = region[0]
	var fill := _territory_color(region)
	if id == _selected or id == _hover:
		fill = fill.lightened(0.12 if id == _selected else 0.07)
	var polygon: PackedVector2Array = _polygons[id]
	draw_colored_polygon(polygon, fill)
	draw_polygon(polygon, PackedColorArray([Color(1.0, 1.0, 1.0, 0.43)]), _terrain_uv[id], RELIEF)
	var edge := polygon.duplicate()
	edge.append(polygon[0])
	draw_polyline(edge, Color("#3d554c"), 2.0, true)
	if id in _overlay.get("legal", []):
		draw_polyline(edge, GOLD, 3.1, true)
	elif _state.get("battles", {}).has(id):
		draw_polyline(edge, LOSS, 2.7, true)
	elif id == _selected or id == _overlay.get("origin", ""):
		draw_polyline(edge, PAPER, 2.6, true)


func _territory_color(region: Array) -> Color:
	var fill: Color = region[3]
	var land: Dictionary = _regions().get(region[0], {})
	if land.is_empty():
		return fill.lerp(Color("#b9b7a1"), 0.60)
	var color := Color("#d9ab6e") if land.owner == 0 else Color("#85c6b8")
	return fill.lerp(color, 0.88)


func _minimap_rect() -> Rect2:
	return Rect2(Vector2(15, size.y - 115), Vector2(151, 97))


func _draw_minimap() -> void:
	var inset := _minimap_rect()
	draw_rect(inset.grow(4.0), Color("#0f212b"))
	draw_rect(inset, SEA)
	for region in _territories:
		var points := PackedVector2Array()
		for point in _polygons[region[0]]:
			points.append(inset.position + point / Map.EXTENT * inset.size)
		draw_colored_polygon(points, _territory_color(region))
	var visible_map := Rect2(_to_board(Vector2.ZERO), size / _scale()).intersection(Rect2(Vector2.ZERO, Map.EXTENT))
	var visible_inset := Rect2(inset.position + visible_map.position / Map.EXTENT * inset.size, visible_map.size / Map.EXTENT * inset.size)
	draw_rect(inset.grow(2.0), Color("#64818b"), false, 1.0)
	draw_rect(visible_inset, PAPER, false, 1.5)


func _draw_geography() -> void:
	for river in [[Vector2(513, 173), Vector2(532, 183), Vector2(555, 184), Vector2(592, 203), Vector2(613, 236),
		Vector2(632, 259), Vector2(623, 283), Vector2(638, 318), Vector2(624, 355), Vector2(645, 380), Vector2(662, 416)],
		[Vector2(324, 323), Vector2(344, 345), Vector2(379, 370), Vector2(396, 401), Vector2(432, 411), Vector2(462, 408)]]:
		draw_polyline(PackedVector2Array(river), Color("#4c8284"), 2.1, true)
	for region in _territories:
		var land: Dictionary = _regions().get(region[0], {})
		var title: String = region[1]
		var font_size := 16 if not land.is_empty() else 13
		if title.length() > 20:
			font_size = 14
		_caption(region[2], title, font_size, INK, _bold, Color(0.91, 0.88, 0.71, 0.46))
		if not land.is_empty():
			var center: Vector2 = region[2] + Vector2(0, 15)
			var label := "%d" % land.ipc
			var badge_size := Vector2(42 if land.factory > 0 else 20, 18)
			var badge := Rect2(center - badge_size * 0.5, badge_size)
			draw_rect(badge, Color(INK, 0.85))
			if land.factory > 0:
				_factory_symbol(center - Vector2(10, 0), PAPER)
				center.x += 8
			_caption(center + Vector2(0, 4), label, 11, PAPER, _bold)
	for place in Map.POINTS:
		var point: Vector2 = place[0]
		if _expanded and place[1] in ["Paris", "Berlin"]:
			var zone := "north_france" if place[1] == "Paris" else "central_europe"
			if place[1] == "Paris":
				point = Vector2(432, 378)
			var color := GOLD if _regions()[zone].owner == 0 else TEAL
			draw_circle(point, 10, Color("#182a29"), true, -1, true)
			draw_circle(point, 9, color, false, 1.4, true)
			var star := PackedVector2Array()
			for i in 10:
				star.append(point + Vector2.from_angle(TAU * i / 10.0 - PI * 0.5) * (6.0 if i % 2 == 0 else 2.8))
			draw_colored_polygon(star, color)
			if place[1] == "Paris":
				_caption(point + Vector2(0, 24), place[1], 14, INK, _bold)
			else:
				draw_string(_bold, point + Vector2(15, 5), place[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 14, INK)
			continue
		if place[2] == "factory":
			_factory_symbol(point, INK)
		elif place[2] == "airfield":
			draw_line(point + Vector2(-6, 4), point + Vector2(5, -5), INK, 3.3, true)
			draw_line(point + Vector2(-4, -4), point + Vector2(4, 4), INK, 2.2, true)
		elif place[2] == "city":
			draw_circle(point, 6.0, PAPER, true, -1, true)
			draw_circle(point, 6.0, INK, false, 1.8, true)
			draw_circle(point, 2.1, INK, true, -1, true)
		else:
			draw_circle(point, 3.5, INK, true, -1, true)
		draw_string(_font, point + Vector2(11, 4), place[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, INK)


func _factory_symbol(point: Vector2, color: Color) -> void:
	var outline := PackedVector2Array([point + Vector2(-7, 4), point + Vector2(-7, -6), point + Vector2(-4, -6), point + Vector2(-4, -1), point + Vector2(1, -4), point + Vector2(1, -1), point + Vector2(7, -4), point + Vector2(7, 4)])
	draw_colored_polygon(outline, color)


func _draw_battle_markers() -> void:
	for zone: String in _state.get("battles", {}):
		var point := _route_anchor(zone) + Vector2(25, 8)
		var shape := PackedVector2Array([point + Vector2(0, -15), point + Vector2(15, 0), point + Vector2(0, 15), point + Vector2(-15, 0)])
		draw_colored_polygon(shape, Color("#562d29"))
		shape.append(shape[0])
		draw_polyline(shape, LOSS, 1.6, true)
		for direction in [Vector2(1, 1), Vector2(1, -1)]:
			draw_line(point - direction * 5.0, point + direction * 5.0, PAPER, 2.0, true)


func _draw_routes() -> void:
	var routes: Array = _overlay.get("plans", [])
	var draft: Dictionary = _overlay.get("route", {})
	for route in routes:
		_draw_path(route, GOLD if _state.seat == 0 else TEAL, false)
	if not draft.is_empty():
		_draw_path(draft, GOLD if _state.seat == 0 else TEAL, true)


func _draw_path(route: Dictionary, color: Color, preview: bool) -> void:
	var start := _route_anchor(route.from)
	var finish := _route_anchor(route.to)
	if not route.via.is_empty():
		var middle := _route_anchor(route.via)
		_draw_arrow(start, middle, color, preview)
		start = middle
		if route.to == route.from:
			finish += Vector2(18, 18)
	_draw_arrow(start, finish, color, preview)
	var counts: Array = _overlay.draft if preview else route.counts
	var badge := finish + (start - finish).normalized() * 27.0 + Vector2(0, -13)
	draw_circle(badge, 11.0, Color("#192b30"), true, -1, true)
	draw_circle(badge, 11.0, color, false, 1.3, true)
	_caption(badge + Vector2(0, 4), str(Battle.total(counts)), 12, PAPER, _bold)


func _draw_arrow(start: Vector2, finish: Vector2, color: Color, preview: bool) -> void:
	var direction := start.direction_to(finish)
	var from := start + direction * 10.0
	var to := finish - direction * 12.0
	var path := PackedVector2Array()
	for i in 17:
		path.append(_route_point(from, to, i / 16.0))
	var shadow := Color("#17282b")
	draw_polyline(path, Color(shadow, 0.80), 7.0, true)
	if preview:
		for i in range(0, path.size() - 1, 2):
			draw_line(path[i], path[i + 1], color, 3.2, true)
	else:
		draw_polyline(path, color, 3.7, true)
	direction = path[-2].direction_to(to)
	var wing := direction.orthogonal() * 7.0
	var base := to - direction * 13.0
	draw_colored_polygon(PackedVector2Array([to, base + wing, base - wing]), color)


func _route_point(from: Vector2, to: Vector2, progress: float) -> Vector2:
	var bend := minf(24.0, from.distance_to(to) * 0.16)
	return from.lerp(to, progress) + from.direction_to(to).orthogonal() * sin(progress * PI) * bend


func _regions() -> Dictionary:
	return _state.get("regions", Scenario.LAND if _expanded else Scenario.LEGACY_LAND)


func _collect_stacks() -> void:
	_stacks.clear()
	var active: String = _state.get("active_zone", "")
	var combat: Dictionary = _state.get("combat", {})
	var battles: Dictionary = _state.get("battles", {})
	for zone: String in _regions():
		var region: Dictionary = _regions()[zone]
		var defenders: Array = combat.defenders if active == zone else region.units
		var marked: Array = combat.marked_defenders if active == zone else Scenario.EMPTY
		_stacks.append({"zone": zone, "seat": region.owner, "units": defenders, "marked": marked})
		if battles.has(zone):
			var attackers: Array = combat.attackers if active == zone else battles[zone].units
			_stacks.append({"zone": zone, "seat": _state.seat, "units": attackers, "marked": Scenario.EMPTY})


func _token_rect(zone: String, seat: int, unit: int, regions: Dictionary = {}) -> Rect2:
	var land := _regions() if regions.is_empty() else regions
	var lane := 0 if land[zone].owner == seat else 1
	var anchors: Array = Map.FRONT_STACKS.get(zone, Map.STACK_ANCHORS[zone]) if _expanded else Map.STACK_ANCHORS[zone]
	return Rect2(anchors[lane] + Vector2(unit * TOKEN_GAP, 0), TOKEN_SIZE)


func _draw_force(stack: Dictionary) -> void:
	for unit in Battle.UNITS.size():
		var count := _visible_count(stack, unit)
		var staged: Array = _overlay.get("placements", {}).get(stack.zone, Scenario.EMPTY)
		if count <= 0 and staged[unit] <= 0:
			continue
		var marked: int = stack.marked[unit]
		var selected := 0
		var active: bool = stack.zone == _overlay.get("origin", "") and stack.seat == _overlay.get("draft_seat", -1)
		if active:
			selected = _overlay.draft[unit]
			if _overlay.get("casualties", false):
				marked += selected
				selected = 0
		var committed: int = staged[unit]
		for plan in _overlay.get("plans", []):
			if plan.from == stack.zone and stack.seat == _state.seat:
				committed += plan.counts[unit]
		_draw_token(_token_rect(stack.zone, stack.seat, unit), stack.seat, unit, count,
			selected + committed, marked, 0.68 if count == 0 else 1.0, active)


func _visible_count(stack: Dictionary, unit: int) -> int:
	var count: int = stack.units[unit]
	for effect in _effects:
		if effect.to == stack.zone and effect.seat == stack.seat and effect.unit == unit and not effect.from.is_empty():
			count -= effect.count
	return count


func _draw_token(rect: Rect2, seat: int, unit: int, count: int, selected := 0, marked := 0, alpha := 1.0, active := false) -> void:
	var accent := GOLD if seat == 0 else TEAL
	var fill := AMBER_INK if seat == 0 else TEAL_INK
	var edge := LOSS if marked > 0 else accent
	var center := rect.get_center()
	var radius := rect.size.y * 0.54
	draw_circle(center + Vector2(1, 4), radius + 1.2, Color(0.06, 0.12, 0.11, alpha * 0.58), true, -1, true)
	if active:
		draw_circle(center, radius + 4.0, Color(accent, alpha * 0.46), true, -1, true)
		fill = fill.lightened(0.20)
	draw_circle(center, radius, Color(fill, alpha), true, -1, true)
	draw_circle(center, radius, Color(edge, alpha), false, 2.4 if selected > 0 or marked > 0 else 1.35, true)
	draw_arc(center, radius - 4.0, PI, TAU, 18, Color(accent, alpha * 0.32), 1.2, true)
	draw_texture_rect(UNIT_ICONS[unit], Rect2(rect.position + Vector2(3, 5), Vector2(30, 22)), false, Color(1, 1, 1, alpha))
	if count > 0:
		var digits := str(count)
		var badge := rect.end - Vector2(4, 5)
		var badge_radius := maxf(9.5, digits.length() * 4.0 + 3.0)
		draw_circle(badge, badge_radius, Color("#132325", alpha), true, -1, true)
		draw_circle(badge, badge_radius, Color(accent, alpha), false, 1.5, true)
		_caption(badge + Vector2(0, 4), digits, 13, Color(PAPER, alpha), _bold)
	if selected > 0 or marked > 0:
		var ribbon := rect.position + Vector2(0, -5)
		var caption := "−%d" % marked if marked > 0 else "+%d" % selected
		draw_rect(Rect2(ribbon - Vector2(1, 8), Vector2(25, 16)), Color(edge, alpha))
		_caption(ribbon + Vector2(11, 4), caption, 11, Color(INK, alpha), _bold)


func _animate_change(before: Dictionary, after: Dictionary) -> void:
	_effects.clear()
	for event in after.events:
		for unit in Battle.UNITS.size():
			if event.counts[unit] <= 0:
				continue
			var effect: Dictionary = event.duplicate()
			effect.unit = unit
			effect.count = event.counts[unit]
			if not event.from.is_empty():
				effect.start = _token_rect(event.from, event.seat, unit, before.regions).position
			if not event.to.is_empty():
				effect.finish = _token_rect(event.to, event.seat, unit, after.regions).position
			_effects.append(effect)
	_age = 0.0
	set_process(not _effects.is_empty())


func _process(delta: float) -> void:
	_age += delta
	if _age >= ANIMATION_TIME:
		_effects.clear()
		set_process(false)
	queue_redraw()


func _draw_effects() -> void:
	var progress := clampf(_age / ANIMATION_TIME, 0.0, 1.0)
	for effect in _effects:
		if effect.to.is_empty() or effect.from.is_empty():
			var loss: bool = effect.to.is_empty()
			var point: Vector2 = effect.start if loss else effect.finish
			var center := point + TOKEN_SIZE * 0.5 - Vector2(0, 20 * progress)
			var color := LOSS if loss else (GOLD if effect.seat == 0 else TEAL)
			draw_circle(center, 14 + 13 * progress, Color(color, 1.0 - progress), false, 2.0, true)
			_caption(center + Vector2(0, 5), ("−%d" if loss else "+%d") % effect.count, 16, Color(color, 1.0 - progress), _bold)
		else:
			var start: Vector2 = effect.start
			var finish: Vector2 = effect.finish
			var amount := smoothstep(0.0, 1.0, progress)
			var point := _route_point(start, finish, amount)
			if not effect.via.is_empty():
				var middle := _route_anchor(effect.via) - TOKEN_SIZE * 0.5
				point = _route_point(start, middle, amount * 2) if amount < 0.5 else _route_point(middle, finish, amount * 2 - 1)
			point.y -= sin(progress * PI) * 16.0
			_draw_token(Rect2(point, TOKEN_SIZE), effect.seat, effect.unit, effect.count, 0, 0, 1.0 - progress * 0.16)


func _caption(point: Vector2, text: String, font_size: int, color: Color, face: Font = null, outline := Color.TRANSPARENT) -> void:
	if face == null:
		face = _font
	var width := face.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var start := point - Vector2(width * 0.5, 0)
	if outline.a > 0.0:
		draw_string_outline(face, start, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 3, outline)
	draw_string(face, start, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
