extends Control
## Full-world atlas with a wrapping horizontal camera and geographic levels of detail.

signal selected(name: String)
signal camera_changed(percent: int)

const UI = preload("res://game/ui_style.gd")
const MapTouch = preload("res://game/map_touch.gd")
const Landmarks = preload("res://game/atlas_landmarks.gd")
const LAMP = preload("res://game/map_lamp.gdshader")
const RELIEF = preload("res://game/art/western-relief.png")
const WOOD = preload("res://game/art/wood049/Wood049_1K-JPG_Color.jpg")
const WOOD_NORMAL = preload("res://game/art/wood049/Wood049_1K-JPG_NormalGL.jpg")
const WOOD_ROUGHNESS = preload("res://game/art/wood049/Wood049_1K-JPG_Roughness.jpg")
const TABLE = preload("res://game/table_surface.gdshader")
const SOURCE := "res://game/global_1940.json"
const SEA := Color("#294d5b")
const RIM := Color("#9f9271")
const CHALK := Color("#f2e4c9")
const SIDE_COLORS := {
	"Germans": Color("#aa8e62"), "French": Color("#6a99a8"), "British": Color("#bd936c"),
	"UK_Pacific": Color("#bd936c"), "Americans": Color("#879b68"), "Russians": Color("#ab705f"),
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
const MOUNTAINS := ["Himalayas", "Switzerland", "Caucasus", "Afghanistan", "Szechwan", "Western United States", "Peru", "New Guinea"]
const WESTERN_ZONES := {"west_germany": "Western Germany", "central_europe": "Germany", "north_france": "France",
	"south_france": "Southern France", "low_countries": "Holland Belgium", "normandy_bordeaux": "Normandy Bordeaux",
	"greater_south_germany": "Greater Southern Germany"}
const Battle = preload("res://game/battle.gd")
const Rules = preload("res://game/global_rules.gd")
const STACK_ICONS := {
	"land": preload("res://game/units/tank.svg"),
	"air": preload("res://game/units/air.svg"),
	"sea": preload("res://game/units/fleet.svg"),
}

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
var _lighting: ColorRect
var _models: SubViewport
var _live := {}
var _campaign := false
var _orders: Array = []
var _legal := {}
var _battle_zones: Array = []


func _ready() -> void:
	clip_contents = true
	mouse_filter = MOUSE_FILTER_STOP
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	var surface := ColorRect.new()
	surface.mouse_filter = Control.MOUSE_FILTER_IGNORE
	surface.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var wood := ShaderMaterial.new()
	wood.shader = TABLE
	wood.set_shader_parameter("wood_color", WOOD)
	wood.set_shader_parameter("wood_normal", WOOD_NORMAL)
	wood.set_shader_parameter("wood_roughness", WOOD_ROUGHNESS)
	surface.material = wood
	surface.show_behind_parent = true
	add_child(surface)
	_lighting = ColorRect.new()
	_lighting.mouse_filter = MOUSE_FILTER_IGNORE
	var paint := ShaderMaterial.new()
	paint.shader = LAMP
	_lighting.material = paint
	_lighting.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_lighting)
	resized.connect(_update_camera)
	visibility_changed.connect(func(): _touch.reset())
	set_process_input(true)
	reset_camera()


func load_atlas() -> void:
	if not regions.is_empty():
		return
	_models = Landmarks.new()
	add_child(_models)
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


func _surface(polygon: PackedVector2Array, color: Color) -> Dictionary:
	var contour := polygon.duplicate()
	contour.append(polygon[0])
	var indices := Geometry2D.triangulate_polygon(polygon)
	var colors := PackedColorArray()
	var uv := PackedVector2Array()
	for point in polygon:
		var lighting := 0.12 * sin(point.x / 670.0) - 0.09 * sin(point.y / 280.0)
		colors.append(color.lerp(CHALK, maxf(0.0, lighting)).darkened(maxf(0.0, -lighting)))
		uv.append(point / 1150.0)
	return {"outline": contour, "points": polygon, "indices": indices, "colors": colors, "uv": uv}


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
	queue_redraw()


func set_campaign(board: Dictionary, paths: Array, legal: Dictionary, battles: Array) -> void:
	_campaign = true
	_live = board
	_orders = paths.duplicate()
	_legal = legal.duplicate()
	_battle_zones = battles.duplicate()
	_linked = []
	queue_redraw()


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
	return _center + (screen - size * 0.5) / _scale()


func _screen(point: Vector2) -> Vector2:
	return size * 0.5 + (point - _center) * _scale()


func _zoom_at(cursor: Vector2, factor: float) -> void:
	var point := _world(cursor)
	_zoom = clampf(_zoom * factor, 1.0, 30.0)
	_center += point - _world(cursor)
	_update_camera()


func _pan(amount: Vector2) -> void:
	_center -= amount / _scale()
	_update_camera()


func _update_camera() -> void:
	_center.x = fposmod(_center.x, extent.x)
	var half_height := minf(size.y / (_scale() * 2.0), extent.y * 0.5)
	_center.y = clampf(_center.y, half_height, extent.y - half_height)
	camera_changed.emit(roundi(_zoom * 100.0))
	queue_redraw()


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
	queue_redraw()


func _draw() -> void:
	if regions.is_empty():
		return
	var view := Rect2(_world(Vector2.ZERO), size / _scale())
	var close := _zoom >= 4.4
	for copy in range(floori(view.position.x / extent.x), floori(view.end.x / extent.x) + 1):
		var offset := Vector2(copy * extent.x, 0)
		var bounds := Rect2(view.position - offset, view.size)
		draw_set_transform(_screen(offset), 0, Vector2.ONE * _scale())
		draw_rect(Rect2(Vector2(0, 5.0 / _scale()), extent).grow(4.0 / _scale()), Color(0.05, 0.03, 0.02, 0.65))
		_draw_tile(bounds, close)
		draw_set_transform(Vector2.ZERO)
		_draw_labels(offset, bounds, close)


func _draw_tile(bounds: Rect2, close: bool) -> void:
	var line := 1.0 / _scale()
	draw_rect(Rect2(Vector2.ZERO, extent), SEA)
	draw_line(Vector2.ZERO, Vector2(extent.x, 0), Color("#d1b58c"), line * 1.6)
	draw_line(Vector2(0, extent.y), extent, Color("#8a7457"), line * 1.6)
	for x in range(0, int(extent.x), 260):
		if x >= bounds.position.x and x <= bounds.end.x:
			draw_line(Vector2(x, 0), Vector2(x, extent.y), Color(0.86, 0.84, 0.70, 0.09), line)
	for y in range(0, int(extent.y), 260):
		if y >= bounds.position.y and y <= bounds.end.y:
			draw_line(Vector2(0, y), Vector2(extent.x, y), Color(0.86, 0.84, 0.70, 0.09), line)
	for shape in _geometry:
		if not shape.bounds.intersects(bounds):
			continue
		var surface: Dictionary = shape.detail if close else shape.overview
		var selected_zone: bool = _selection == shape.id
		if shape.water:
			if selected_zone and not surface.indices.is_empty():
				draw_colored_polygon(surface.points, Color("#4d727b"))
			draw_polyline(surface.outline, Color(0.75, 0.79, 0.72, 0.29), line)
		else:
			if not surface.indices.is_empty():
				var colors: PackedColorArray = surface.colors
				if _live.has(shape.id) and _live[shape.id].owner != regions[shape.id].owner:
					colors = PackedColorArray([SIDE_COLORS.get(_live[shape.id].owner, Color("#a89b7f"))])
				draw_polygon(surface.points, colors)
				if close:
					draw_polygon(surface.points, PackedColorArray([Color(1, 1, 1, 0.37)]), surface.uv, RELIEF)
			draw_polyline(surface.outline, Color("#485650"), line * 1.25, close)
		if shape.id in _battle_zones:
			draw_polyline(surface.outline, Color("#ef9b74"), line * 2.1, true)
		if selected_zone or shape.id in _linked or _legal.has(shape.id):
			draw_polyline(surface.outline, CHALK if selected_zone else Color(0.88, 0.77, 0.51, 0.68), line * (2.6 if selected_zone else 1.3), true)
	if regions.has(_selection):
		var start: Vector2 = regions[_selection].center
		for neighbor in _linked:
			var point: Vector2 = regions[neighbor].center
			point.x = start.x + wrapf(point.x - start.x, -extent.x * 0.5, extent.x * 0.5)
			draw_line(start, point, Color(0.98, 0.80, 0.46, 0.60), line * 1.5, true)
	for order in _orders:
		for i in range(1, order.path.size()):
			var start: Vector2 = regions[order.path[i - 1]].center
			var end: Vector2 = regions[order.path[i]].center
			end.x = start.x + wrapf(end.x - start.x, -extent.x * 0.5, extent.x * 0.5)
			for shift in [-extent.x, 0.0, extent.x]:
				var offset := Vector2(shift, 0)
				var a := start + offset
				var b := end + offset
				if not bounds.intersects(Rect2(a, Vector2.ZERO).expand(b).grow(18)):
					continue
				draw_line(a, b, Color("#201e19"), line * 5.0, true)
				draw_line(a, b, Color("#efc677"), line * 2.7, true)
				var direction := a.direction_to(b)
				var base := b - direction * line * 10.0
				var edge := direction.orthogonal() * line * 5.0
				draw_colored_polygon(PackedVector2Array([b, base + edge, base - edge]), Color("#efc677"))


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
			_caption(center, title, 18 if close else 15, CHALK)
		if close:
			_draw_region_badges(center, region_info(zone) if _live.has(zone) else region, zone)


func _draw_region_badges(center: Vector2, region: Dictionary, zone: String) -> void:
	var models := _zoom >= 8.0
	var is_mountain := zone in MOUNTAINS
	var point := center + Vector2(0, 22)
	if models and not region.water and (is_mountain or region.city or region.bounds.size.x * _scale() >= 160.0):
		var model := 2 if is_mountain else (0 if region.city else 1)
		var region_rect := Rect2(model * 192, 0, 192, 192)
		draw_texture_rect_region(_models.get_texture(), Rect2(center + Vector2(-47, -80), Vector2(94, 94)), region_rect)
	var groups := {}
	for unit in region.units:
		if unit[1] not in Rules.FACILITIES:
			var kind := Rules.domain(String(unit[1]).to_lower())
			var key := Vector2i(["land", "air", "sea"].find(kind), NAMES.keys().find(unit[0]))
			groups[key] = int(groups.get(key, 0)) + int(unit[2])
	if not _campaign:
		var armies := 0
		for count in groups.values():
			armies += count
		if region.ipc > 0 or armies > 0:
			_caption(point, "%d IPC · %d units" % [region.ipc, armies], 13, CHALK)
		return
	if region.ipc > 0:
		_caption(point, "%d IPC" % region.ipc, 14, CHALK)
		point.y += 18
	var stacks: Array = groups.keys().slice(0, 5)
	for i in stacks.size():
		var key: Vector2i = stacks[i]
		var chip := Rect2(point + Vector2((i - (stacks.size() - 1) * 0.5) * 38.0 - 18.0, -10), Vector2(36, 21))
		var side: String = NAMES.keys()[key.y] if key.y >= 0 else "Neutral_True"
		var paint: Color = SIDE_COLORS.get(side, Color("#a69779"))
		draw_rect(chip, Color("#1c2729"))
		draw_rect(chip, paint, false, 1.4)
		var icon: Texture2D = STACK_ICONS[["land", "air", "sea"][key.x]]
		draw_texture_rect(icon, Rect2(chip.position + Vector2(2, 3), Vector2(15, 15)), false, paint.lightened(0.28))
		_caption(chip.position + Vector2(26, 15), str(groups[key]), 15, CHALK)


func _caption(point: Vector2, value: String, font_size: int, color: Color) -> void:
	var font: Font = UI.DISPLAY
	var start := point - Vector2(font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x * 0.5, 0)
	draw_string_outline(font, start, value, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 5, Color("#202d2c"))
	draw_string(font, start, value, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
