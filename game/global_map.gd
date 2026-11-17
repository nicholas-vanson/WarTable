extends Control
## Full-world atlas with a wrapping horizontal camera and geographic levels of detail.

signal selected(name: String)
signal camera_changed(percent: int)

const UI = preload("res://game/ui_style.gd")
const MapTouch = preload("res://game/map_touch.gd")
const Terrain = preload("res://game/global_terrain.gd")
const SOURCE := "res://game/global_1940.json"
const CHALK := Color("#f2e4c9")
const SIDE_COLORS := {
	"Germans": Color("#718076"), "French": Color("#668da8"), "British": Color("#b7a066"),
	"UK_Pacific": Color("#b7a066"), "Americans": Color("#879b68"), "Russians": Color("#ab705f"),
	"Japanese": Color("#c7a163"), "Italians": Color("#af815d"), "Chinese": Color("#8a9e7b"),
	"ANZAC": Color("#79998f"), "Dutch": Color("#b98360"), "Neutral_Axis": Color("#93836c"),
	"Neutral_Allies": Color("#939d8b"), "Mongolians": Color("#938f87"),
}
const NAMES := {
	"Germans": "Germany", "French": "France", "British": "United Kingdom", "UK_Pacific": "UK Pacific",
	"Americans": "United States", "Russians": "Soviet Union", "Japanese": "Japan", "Italians": "Italy",
	"Chinese": "China", "ANZAC": "ANZAC", "Dutch": "Netherlands", "Neutral_Axis": "Pro-Axis neutral",
	"Neutral_Allies": "Pro-Allied neutral", "Mongolians": "Mongolia", "Neutral_True": "Neutral",
}
const THEATERS := [
	["NORTH AMERICA", Vector2(675, 660)], ["EUROPE", Vector2(2350, 465)], ["AFRICA", Vector2(2500, 1910)],
	["SOVIET UNION", Vector2(3830, 340)], ["EAST ASIA", Vector2(4970, 885)], ["PACIFIC OCEAN", Vector2(6510, 1850)],
	["SOUTH AMERICA", Vector2(1190, 2380)], ["INDIAN OCEAN", Vector2(3930, 2600)],
	["AUSTRALIA", Vector2(5610, 2740)], ["ATLANTIC OCEAN", Vector2(1550, 1270)],
]
const WESTERN_ZONES := {"west_germany": "Western Germany", "central_europe": "Germany", "north_france": "France",
	"south_france": "Southern France", "low_countries": "Holland Belgium", "normandy_bordeaux": "Normandy Bordeaux",
	"greater_south_germany": "Greater Southern Germany"}
const Battle = preload("res://game/battle.gd")
const Rules = preload("res://game/global_rules.gd")


var regions := {}
var extent := Vector2(7705, 3213)
var _geometry: Array[Dictionary] = []
var _selection := ""
var _linked: Array = []
var _center := Vector2.ZERO
var _zoom := 1.0
var _drag_button := MOUSE_BUTTON_NONE
var _press := Vector2.ZERO
var _dragged := false
var _touch := MapTouch.new()
var _terrain: SubViewport
var _stacks: Array = []
var _live := {}
var _campaign := false
var _orders: Array = []
var _legal := {}
var _battle_zones: Array = []


func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	_terrain = Terrain.new()
	add_child(_terrain)
	var picture := TextureRect.new()
	picture.texture = _terrain.get_texture()
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_SCALE
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	picture.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	picture.show_behind_parent = true
	add_child(picture)
	resized.connect(_update_camera)
	visibility_changed.connect(func(): _touch.reset())
	set_process_input(true)
	reset_camera()


func load_atlas() -> void:
	if not regions.is_empty():
		return
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SOURCE))
	extent = Vector2(data.size[0], data.size[1])
	regions = data.regions
	# Paint water first and hit-test land first. Islands remain selectable over sea zones.
	for water in [true, false]:
		for zone in regions:
			var region: Dictionary = regions[zone]
			if region.water != water:
				continue
			region.center = Vector2(region.center[0], region.center[1])
			region.bounds = Rect2(region.center, Vector2.ZERO)
			region.color = SIDE_COLORS.get(region.owner, Color("#a89b7f"))
			for i in region.detail.size():
				var detail := _polygon(region.detail[i])
				var overview := _polygon(region.overview[i])
				if detail.size() < 3:
					continue
				var bounds := Rect2(detail[0], Vector2.ZERO)
				for point in detail:
					bounds = bounds.expand(point)
				region.bounds = region.bounds.merge(bounds)
				var full := _surface(detail, region.color)
				var low := _surface(overview, region.color)
				_geometry.append({"id": zone, "water": water, "bounds": bounds, "detail": full,
					"overview": low if not low.indices.is_empty() else full})
			region.erase("overview")
			region.erase("detail")
	reset_camera()


func _polygon(coords: Array) -> PackedVector2Array:
	var polygon := PackedVector2Array()
	polygon.resize(coords.size() / 2)
	for i in polygon.size():
		polygon[i] = Vector2(coords[i * 2], coords[i * 2 + 1])
	return polygon


func _surface(polygon: PackedVector2Array, _color: Color) -> Dictionary:
	var contour := polygon.duplicate()
	contour.append(polygon[0])
	return {"outline": contour, "points": polygon, "indices": Geometry2D.triangulate_polygon(polygon)}


func owner_name(owner: String) -> String:
	return NAMES.get(owner, "Neutral")


func set_sector(view: Dictionary) -> void:
	_campaign = false
	_orders.clear()
	_legal.clear()
	_battle_zones.clear()
	_live = {}
	for zone in view.get("regions", {}):
		var region: Dictionary = view.regions[zone]
		var owner := "Germans" if region.owner == 0 else "French"
		var positions := []
		var counts: Array = view.combat.defenders if view.active_zone == zone else region.units
		for unit in Battle.UNITS.size():
			if counts[unit] > 0:
				positions.append([owner, Battle.UNITS[unit], counts[unit]])
			if view.battles.has(zone):
				var attackers: Array = view.combat.attackers if view.active_zone == zone else view.battles[zone].units
				if attackers[unit] > 0:
					positions.append(["Germans" if view.seat == 0 else "French", Battle.UNITS[unit], attackers[unit]])
		if region.factory > 0:
			positions.append([owner, "factory_minor", 1])
		_live[WESTERN_ZONES[zone]] = {"owner": owner, "units": positions, "ipc": region.ipc, "zone": zone}
	_refresh_visuals()


func set_campaign(board: Dictionary, paths: Array, legal: Dictionary, battles: Array) -> void:
	_campaign = true
	_live = board
	_orders = paths.duplicate()
	_legal = legal.duplicate()
	_battle_zones = battles.duplicate()
	_linked = []
	_refresh_visuals()


func region_info(zone: String) -> Dictionary:
	if not regions.has(zone):
		return {}
	var info: Dictionary = regions[zone].duplicate()
	info.merge(_live.get(zone, {}), true)
	return info


func battle_screen_point(zone: String) -> Vector2:
	if not regions.has(zone):
		return size * 0.5
	var point: Vector2 = regions[zone].center
	point.x = _center.x + wrapf(point.x - _center.x, -extent.x * 0.5, extent.x * 0.5)
	return _screen(point)


func reset_camera() -> void:
	_zoom = 1.0
	_center = extent * 0.5
	_update_camera()


func zoom_by(factor: float) -> void:
	_zoom_at(size * 0.5, factor)


func set_visual_quality(level: int) -> void:
	_terrain.set_quality(level)
	_update_camera()


func focus(zone: String) -> void:
	if not regions.has(zone):
		return
	_zoom = clampf(1400.0 / maxf(regions[zone].bounds.size.x, 120.0) * 3.0, 4.0, 13.0)
	_center = regions[zone].center
	_select(zone)
	_update_camera()


func inspect_theater(zone: String) -> void:
	if not regions.has(zone):
		return
	_zoom = 4.4
	_center = regions[zone].center
	_select(zone)
	_update_camera()


func _scale() -> float:
	return maxf(0.001, size.x / extent.x) * _zoom


func _world(screen: Vector2) -> Vector2:
	return _terrain.world_point(screen) if is_instance_valid(_terrain) and _terrain.camera.position.y > 0 else _center + (screen - size * 0.5) / _scale()


func _screen(point: Vector2) -> Vector2:
	return _terrain.screen_point(point) if is_instance_valid(_terrain) and _terrain.camera.position.y > 0 else size * 0.5 + (point - _center) * _scale()


func _zoom_at(cursor: Vector2, factor: float) -> void:
	var point := _world(cursor)
	_zoom = clampf(_zoom * factor, 1.0, 20.0)
	_terrain.configure(_center, _scale(), size)
	_center += point - _world(cursor)
	_update_camera()


func _pan(amount: Vector2) -> void:
	_center -= amount / _scale()
	_update_camera()


func _update_camera() -> void:
	_center.x = fposmod(_center.x, extent.x)
	var half_height := minf(size.y / (_scale() * 2.0), extent.y * 0.5)
	_center.y = clampf(_center.y, half_height, extent.y - half_height)
	if is_instance_valid(_terrain):
		_terrain.configure(_center, _scale(), size)
	camera_changed.emit(roundi(_zoom * 100.0))
	_refresh_visuals()


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree() or not (event is InputEventScreenTouch or event is InputEventScreenDrag):
		return
	var local := make_input_local(event)
	# A gesture that starts on the map keeps its pointer capture as fingers leave the rectangle.
	if event is InputEventScreenTouch and event.pressed:
		if not Rect2(Vector2.ZERO, size).has_point(local.position):
			return
		for child in get_children():
			if child is Control and child.mouse_filter != Control.MOUSE_FILTER_IGNORE and child.visible and child.get_rect().has_point(local.position):
				return
	if _touch.handle(local, _tap, _pan, _zoom_at):
		get_viewport().set_input_as_handled()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch or event is InputEventScreenDrag:
		return
	if event.device == InputEvent.DEVICE_ID_EMULATION:
		return
	if event is InputEventMouseButton:
		if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			_zoom_at(event.position, 1.20 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.20)
			accept_event()
		elif event.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_MIDDLE, MOUSE_BUTTON_RIGHT]:
			if event.pressed:
				_drag_button = event.button_index
				_press = event.position
				_dragged = false
			elif event.button_index == _drag_button:
				_drag_button = MOUSE_BUTTON_NONE
				if not _dragged and event.button_index == MOUSE_BUTTON_LEFT:
					_tap(event.position)
			accept_event()
	elif event is InputEventMouseMotion and _drag_button != MOUSE_BUTTON_NONE:
		if _dragged or _press.distance_to(event.position) > 6.0:
			_dragged = true
			_pan(event.relative)
		accept_event()
	elif event is InputEventMagnifyGesture:
		_zoom_at(event.position, event.factor)
		accept_event()


func _tap(screen: Vector2) -> void:
	for i in range(_stacks.size() - 1, -1, -1):
		var stack: Dictionary = _stacks[i]
		if Rect2(_screen(stack.point) - Vector2(15, 20), Vector2(42, 44)).has_point(screen):
			_select(stack.zone)
			return
	_select(region_at(_world(screen)))


func region_at(point: Vector2) -> String:
	point.x = fposmod(point.x, extent.x)
	for index in range(_geometry.size() - 1, -1, -1):
		var shape := _geometry[index]
		if shape.bounds.has_point(point) and Geometry2D.is_point_in_polygon(point, shape.detail.points):
			return shape.id
	return ""


func _select(zone: String) -> void:
	_selection = zone
	_linked = regions[zone].links if not _campaign and regions.has(zone) else []
	selected.emit(zone)
	_refresh_visuals()


func _refresh_visuals() -> void:
	if not is_instance_valid(_terrain) or regions.is_empty():
		return
	_terrain.update_control(regions.keys(), regions, _live, SIDE_COLORS, _selection, _legal, _battle_zones)
	_stacks.clear()
	if _zoom >= 2.8:
		for zone in regions:
			var region: Dictionary = region_info(zone)
			var center: Vector2 = region.center
			center.x = _center.x + wrapf(center.x - _center.x, -extent.x * 0.5, extent.x * 0.5)
			var screen := _screen(center)
			if not Rect2(Vector2(-100, -100), size + Vector2(200, 200)).has_point(screen):
				continue
			var groups := {}
			for unit in region.units:
				if unit[1] in Rules.FACILITIES:
					continue
				var kind: String = str(unit[1])
				if _zoom < 6.0:
					kind = {"land": "armour", "air": "fighter", "sea": "cruiser"}[Rules.domain(kind)]
				var key: String = str(unit[0]) + ":" + kind
				groups[key] = int(groups.get(key, 0)) + int(unit[2])
			var index := 0
			var columns := mini(4, maxi(1, groups.size()))
			for key in groups:
				var row := floori(float(index) / columns)
				var column := index % columns
				var offset := Vector2((column - (columns - 1) * 0.5) * 35.0, 29 + row * 35.0)
				var point: Vector2 = _terrain.world_point(screen + offset)
				_stacks.append({"key": zone + ":" + key, "zone": zone, "owner": key.get_slice(":", 0), "unit": key.get_slice(":", 1), "count": groups[key], "point": point})
				index += 1
	_terrain.sync_units(_stacks, _scale(), SIDE_COLORS)
	queue_redraw()


func _draw() -> void:
	if regions.is_empty():
		return
	var view := Rect2(_world(Vector2.ZERO), size / _scale()).grow(160.0 / _scale())
	for copy in range(floori(view.position.x / extent.x), floori(view.end.x / extent.x) + 1):
		var offset := Vector2(copy * extent.x, 0)
		var bounds := Rect2(view.position - offset, view.size)
		_draw_boundaries(offset, bounds)
		_draw_labels(offset, bounds, _zoom >= 4.4)
	for stack in _stacks:
		var at := _screen(stack.point) + Vector2(11, 9)
		var text := str(stack.count)
		var width := maxf(15, UI.BODY.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x + 6)
		var badge := Rect2(at, Vector2(width, 15))
		draw_style_box(UI.box(Color("#f0e0bf"), Color("#716344"), 2, 1, 2), badge)
		draw_string(UI.BODY, at + Vector2(3, 12), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#24291e"))
	for order in _orders:
		for i in range(1, order.path.size()):
			var start: Vector2 = regions[order.path[i - 1]].center
			var end: Vector2 = regions[order.path[i]].center
			start.x = _center.x + wrapf(start.x - _center.x, -extent.x * 0.5, extent.x * 0.5)
			end.x = start.x + wrapf(end.x - start.x, -extent.x * 0.5, extent.x * 0.5)
			var a := _screen(start)
			var b := _screen(end)
			draw_line(a, b, Color("#342d20"), 4, true)
			draw_line(a, b, Color("#e2ba72"), 2, true)
			var direction := a.direction_to(b)
			var edge := direction.orthogonal() * 4
			draw_colored_polygon(PackedVector2Array([b, b - direction * 9 + edge, b - direction * 9 - edge]), Color("#e2ba72"))


func _draw_boundaries(offset: Vector2, bounds: Rect2) -> void:
	for shape in _geometry:
		if not shape.bounds.intersects(bounds):
			continue
		var surface: Dictionary = shape.detail
		var outline := PackedVector2Array()
		for point in surface.outline:
			outline.append(_screen(point + offset))
		var color := Color(0.15, 0.17, 0.13, 0.78) if not shape.water else Color(0.75, 0.79, 0.71, 0.25)
		draw_polyline(outline, color, 1.2 if not shape.water else 0.8, true)
		if _selection == shape.id:
			draw_polyline(outline, Color("#7e5031"), 1.7, true)


func _draw_labels(offset: Vector2, bounds: Rect2, close: bool) -> void:
	if _zoom < 2.25:
		for entry in THEATERS:
			if bounds.has_point(entry[1]):
				_caption(_screen(entry[1] + offset), entry[0], 16, CHALK)
		return
	for zone in regions:
		var region: Dictionary = regions[zone]
		if not bounds.has_point(region.center):
			continue
		var center := _screen(region.center + offset)
		if region.water:
			if close or _selection == zone:
				_caption(center, zone.get_slice(" ", 0), 15, Color("#bad3cf"))
			if close and _campaign:
				_draw_region_badges(center, region_info(zone), zone)
			continue
		var title: String = zone
		if region.city:
			title = "★ " + title
		if close or region.city or region.bounds.size.x * _scale() > 95.0 or _selection == zone:
			_caption(center, title, 14 if close else 12, Color("#f1e6c8"))
		if close:
			_draw_region_badges(center, region_info(zone) if _live.has(zone) else region, zone)


func _draw_region_badges(center: Vector2, region: Dictionary, _zone: String) -> void:
	if not region.water and region.ipc > 0 and _zoom >= 4.4:
		_caption(center + Vector2(0, 14), "%d IPC" % region.ipc, 11, Color("#e0dcc2"))


func _caption(point: Vector2, value: String, font_size: int, color: Color) -> void:
	var font: Font = UI.DISPLAY
	var start := point - Vector2(font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x * 0.5, 0)
	var halo := Color(0.93, 0.88, 0.73, 0.7) if color.get_luminance() < 0.35 else Color("#263b3d")
	draw_string_outline(font, start, value, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 2, halo)
	draw_string(font, start, value, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
