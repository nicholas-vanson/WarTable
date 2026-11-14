extends Control
## A transparent 3D layer over the board. Animation never changes a roll.

signal settled
signal firing_group_changed

const PHYSICS_TIME := 0.82
const ROLL_TIME := 1.17
const GROUP_DELAY := 0.085
const TABLE_INSET := 16.0
const MAX_VISIBLE := 24
const NORMALS := [Vector3.BACK, Vector3.RIGHT, Vector3.UP, Vector3.DOWN, Vector3.LEFT, Vector3.FORWARD]
const PIPS := [
	[Vector2(0, 0)], [Vector2(-1, -1), Vector2(1, 1)],
	[Vector2(-1, -1), Vector2(0, 0), Vector2(1, 1)],
	[Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)],
	[Vector2(-1, -1), Vector2(1, -1), Vector2(0, 0), Vector2(-1, 1), Vector2(1, 1)],
	[Vector2(-1, -1), Vector2(-1, 0), Vector2(-1, 1), Vector2(1, -1), Vector2(1, 0), Vector2(1, 1)],
]
const ATTACK_COLOR := Color("#b3353b")
const DEFENSE_COLOR := Color("#242b33")
const BoardIcons := [preload("res://game/units/infantry.svg"), preload("res://game/units/artillery.svg"), preload("res://game/units/tank.svg")]

var rolling := false
var _revision := -1
var _elapsed := 0.0
var _result: Dictionary = {}
var _bodies: Array[RigidBody3D] = []
var _faces: Array[Dictionary] = []
var _screen_points: Array[Vector2] = []
var _viewport: SubViewport
var _marks: Control
var _camera: Camera3D
var _shell: Mesh
var _pip_mesh: Mesh
var _pixels_per_unit := 42.0
var _table := Rect2()
var _rests: Array[Transform3D] = []
var _landings: Array[Transform3D] = []
var _shape := BoxShape3D.new()
var _physics_material := PhysicsMaterial.new()
var _rng := RandomNumberGenerator.new()
var _launches := 0
var _group_order: Array[int] = []
var _active_group := -1


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_viewport = SubViewport.new()
	_viewport.own_world_3d = true
	_viewport.transparent_bg = true
	_viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(_viewport)
	var picture := TextureRect.new()
	picture.texture = _viewport.get_texture()
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	picture.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(picture)
	_marks = Control.new()
	_marks.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_marks.draw.connect(_draw_marks)
	add_child(_marks)
	_camera = Camera3D.new()
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	_camera.position.z = 16
	_viewport.add_child(_camera)
	_camera.make_current()
	var lighting := WorldEnvironment.new()
	var environment := Environment.new()
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#d5e0f0")
	environment.ambient_light_energy = 0.56
	lighting.environment = environment
	_viewport.add_child(lighting)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-34, -33, 0)
	light.light_energy = 1.0
	_viewport.add_child(light)
	_shell = _make_shell()
	_pip_mesh = _make_pips()
	_shape.size = Vector3.ONE * 0.93
	_physics_material.bounce = 0.31
	_physics_material.friction = 0.62
	_rng.randomize()
	var floor_body := StaticBody3D.new()
	floor_body.physics_material_override = _physics_material
	var floor_shape := CollisionShape3D.new()
	var floor_box := BoxShape3D.new()
	floor_box.size = Vector3(150, 150, 1)
	floor_shape.shape = floor_box
	floor_body.position.z = -1.08
	floor_body.add_child(floor_shape)
	_viewport.add_child(floor_body)
	resized.connect(reposition)
	set_process(false)
	hide()


func display(result: Dictionary, animate: bool) -> void:
	var revision: int = result.get("revision", -1)
	if _revision == revision:
		return
	_revision = revision
	_result = result
	for body in _bodies:
		_viewport.remove_child(body)
		body.queue_free()
	_bodies.clear()
	_faces.clear()
	_screen_points.clear()
	_rests.clear()
	_landings.clear()
	_group_order.clear()
	_launches = 0
	_active_group = -1
	visible = not result.is_empty()
	rolling = visible and animate
	_elapsed = 0.0 if rolling else ROLL_TIME
	set_process(rolling)
	if not visible:
		_viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
		return
	var ordered: Array = result.dice.duplicate()
	ordered.sort_custom(func(left: Dictionary, right: Dictionary):
		return left.target < right.target or left.target == right.target and str(left.unit) < str(right.unit))
	var material := _material(ATTACK_COLOR if result.attacking else DEFENSE_COLOR, 0.38)
	for die in ordered.slice(0, MAX_VISIBLE):
		var body := RigidBody3D.new()
		body.freeze = true
		body.collision_layer = 0 if rolling else 1
		body.gravity_scale = 0.0
		body.linear_damp = 1.3
		body.angular_damp = 1.1
		body.physics_material_override = _physics_material
		body.continuous_cd = true
		var shape := CollisionShape3D.new()
		shape.shape = _shape
		body.add_child(shape)
		var shell := MeshInstance3D.new()
		shell.mesh = _shell
		shell.material_override = material
		body.add_child(shell)
		_viewport.add_child(body)
		var pips := MeshInstance3D.new()
		pips.mesh = _pip_mesh
		body.add_child(pips)
		_bodies.append(body)
		_faces.append(die)
		var group := group_key(die.target, die.unit)
		if group not in _group_order:
			_group_order.append(group)
		body.visible = not rolling
	reposition()
	if rolling:
		_launch_next()


static func group_key(target: int, unit: Variant) -> int:
	return hash([target, unit])


func group_is_firing(target: int, unit: Variant) -> bool:
	return not rolling or _active_group == group_key(target, unit)


func set_table(table: Rect2) -> void:
	if _table == table:
		return
	_table = table
	reposition()


func reposition() -> void:
	if not visible or _bodies.is_empty() or size.x < 2 or size.y < 2:
		return
	_viewport.size = Vector2i(size.ceil())
	var table := _table.intersection(Rect2(Vector2.ZERO, size))
	if not table.has_area():
		table = Rect2(Vector2.ZERO, size)
	var count := _bodies.size()
	var columns := 1
	var best := 0.0
	for candidate in range(1, count + 1):
		var depth := ceili(float(count) / candidate)
		var fit := minf((table.size.x - TABLE_INSET * 2.0) / candidate, (table.size.y - 44.0) / depth)
		if fit > best:
			best = fit
			columns = candidate
	var rows := ceili(float(count) / columns)
	_pixels_per_unit = minf(48.0, minf((table.size.x - TABLE_INSET * 2.0) / columns, (table.size.y - 44.0) / rows) / 1.52)
	_pixels_per_unit = maxf(12.0, _pixels_per_unit)
	_camera.size = size.y / _pixels_per_unit
	_rests.clear()
	for i in count:
		var row := floori(float(i) / columns)
		var row_count := mini(columns, count - row * columns)
		var grid := Vector2(i % columns - (row_count - 1) * 0.5, row - (rows - 1) * 0.5)
		var finish := table.get_center() + Vector2(0, 8) + grid * _pixels_per_unit * 1.51
		var local := (finish - size * 0.5) / _pixels_per_unit
		var face_up := Quaternion(NORMALS[_faces[i].face - 1], Vector3.BACK)
		var tilt := Quaternion(Vector3.RIGHT, 0.27) * Quaternion(Vector3.UP, -0.20)
		var twist := Quaternion(Vector3.BACK, sin(i * 3.5) * 0.21)
		_rests.append(Transform3D(Basis(twist * tilt * face_up), Vector3(local.x, -local.y, 0.0)))
	_update_dice()


func _launch_next() -> void:
	if _rests.size() != _faces.size():
		return
	var previous := _active_group
	while _launches < _faces.size():
		var die := _faces[_launches]
		var group := group_key(die.target, die.unit)
		if _elapsed + 0.001 < _group_order.find(group) * GROUP_DELAY:
			break
		var body := _bodies[_launches]
		var start := _rests[_launches].origin + Vector3(-0.73, 0.53, 0.88 + _rng.randf_range(0.0, 0.48))
		var spin := Vector3(_rng.randf_range(-1.0, 1.0), _rng.randf_range(-1.0, 1.0), _rng.randf_range(-1.0, 1.0))
		body.transform = Transform3D(Basis.from_euler(spin * PI), start)
		body.visible = true
		body.collision_layer = 1
		body.constant_force = Vector3(0, 0, -18)
		body.linear_velocity = Vector3(_rng.randf_range(2.0, 3.8), _rng.randf_range(-2.2, -1.0), _rng.randf_range(0.1, 1.2))
		body.angular_velocity = spin * 13.0
		body.freeze = false
		_active_group = group
		_launches += 1
	if previous != _active_group and previous >= 0:
		firing_group_changed.emit()


func _process(delta: float) -> void:
	_elapsed = minf(_elapsed + delta, ROLL_TIME)
	if _launches < _faces.size():
		_launch_next()
	if _elapsed >= PHYSICS_TIME and _landings.is_empty():
		for body in _bodies:
			_landings.append(body.transform)
			body.freeze = true
	_update_dice()
	if _elapsed >= ROLL_TIME:
		rolling = false
		set_process(false)
		_marks.queue_redraw()
		settled.emit()


func _update_dice() -> void:
	_screen_points.resize(_rests.size())
	var progress := smoothstep(PHYSICS_TIME, ROLL_TIME, _elapsed)
	for i in _rests.size():
		var body := _bodies[i]
		if not rolling or _elapsed >= ROLL_TIME:
			body.transform = _rests[i]
		elif not _landings.is_empty():
			body.transform = _landings[i].interpolate_with(_rests[i], progress)
		var position_3d := body.position
		_screen_points[i] = size * 0.5 + Vector2(position_3d.x, -position_3d.y) * _pixels_per_unit
	_viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
	queue_redraw()
	_marks.queue_redraw()


func _draw() -> void:
	if _screen_points.is_empty():
		return
	var table := _table.intersection(Rect2(Vector2.ZERO, size))
	if table.has_area():
		var surface := StyleBoxFlat.new()
		surface.bg_color = Color(0.045, 0.12, 0.13, 0.92)
		surface.border_color = Color("#a49877")
		surface.set_border_width_all(1)
		surface.set_corner_radius_all(8)
		surface.shadow_size = 8
		surface.shadow_color = Color(0, 0, 0, 0.35)
		draw_style_box(surface, table)
		var title := "%s  ·  %s" % [String(_result.get("location", "Battle")), "Attack" if _result.attacking else "Defense"]
		draw_string(ThemeDB.fallback_font, table.position + Vector2(13, 23), title, HORIZONTAL_ALIGNMENT_LEFT, table.size.x - 26, 15, Color("#efe1bf"))
	for i in _launches if rolling else _screen_points.size():
		var point := _screen_points[i]
		draw_set_transform(point + Vector2(3, _pixels_per_unit * 0.37), 0, Vector2(1.0, 0.38))
		draw_circle(Vector2.ZERO, _pixels_per_unit * 0.65, Color(0.03, 0.05, 0.06, 0.35), true, -1, true)
		draw_set_transform(Vector2.ZERO)


func _draw_marks() -> void:
	if rolling or _screen_points.is_empty():
		return
	for i in _screen_points.size():
		var target := "≤%d" % _faces[i].target
		var kind: Variant = _faces[i].unit
		var point := _screen_points[i] + Vector2(-15, _pixels_per_unit * 0.66)
		if kind is int:
			_marks.draw_texture_rect(BoardIcons[kind], Rect2(point, Vector2(15, 12)), false, Color("#e5d5b7"))
		else:
			var symbols := {"infantry": "INF", "artillery": "ART", "armour": "TNK", "mech_infantry": "MEC", "fighter": "FTR", "tactical_bomber": "TAC", "bomber": "BMR", "submarine": "SUB", "destroyer": "DD", "cruiser": "CA", "carrier": "CV", "battleship": "BB"}
			target = "%s %s" % [symbols.get(kind, ""), target]
			point.x -= 16
		_marks.draw_string(ThemeDB.fallback_font, point + Vector2(17, 10), target, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#e5d5b7"))
		if _faces[i].face > _faces[i].target:
			continue
		point = _screen_points[i] + Vector2(0.55, -0.52) * _pixels_per_unit
		_marks.draw_circle(_screen_points[i], _pixels_per_unit * 0.70, Color(0.92, 0.82, 0.44, 0.42), false, 2.0, true)
		_marks.draw_circle(point, 8.4, Color("#273429"), true, -1, true)
		_marks.draw_circle(point, 7.3, Color("#d4dfab"), true, -1, true)
		var check := PackedVector2Array([point + Vector2(-3, 0), point + Vector2(-1, 2), point + Vector2(4, -3)])
		_marks.draw_polyline(check, Color("#273429"), 1.6, true)
	if _faces.size() < _result.dice.size():
		var label := "+%d in turn log" % (_result.dice.size() - _faces.size())
		var last := _screen_points[-1]
		var font := ThemeDB.fallback_font
		var width := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		var text_position := Vector2(clampf(last.x - width * 0.5, 6.0, size.x - width - 6.0), minf(last.y + 34, size.y - 6))
		_marks.draw_string_outline(font, text_position, label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 5, Color("#1d2932"))
		_marks.draw_string(font, text_position, label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#f2efe7"))


func _make_shell() -> Mesh:
	var box := BoxMesh.new()
	box.subdivide_width = 8
	box.subdivide_height = 8
	box.subdivide_depth = 8
	var arrays := box.get_mesh_arrays()
	var positions: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	var inner := Vector3.ONE * 0.406
	for i in positions.size():
		var core := positions[i].clamp(-inner, inner)
		var normal := (positions[i] - core).normalized()
		positions[i] = core + normal * 0.094
		normals[i] = normal
	arrays[Mesh.ARRAY_VERTEX] = positions
	arrays[Mesh.ARRAY_NORMAL] = normals
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


func _make_pips() -> Mesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var white := _material(Color("#f2eee2"), 0.76)
	white.cull_mode = BaseMaterial3D.CULL_DISABLED
	surface.set_material(white)
	for face in NORMALS.size():
		var normal: Vector3 = NORMALS[face]
		var right := (Vector3.FORWARD if absf(normal.y) > 0.9 else Vector3.UP).cross(normal).normalized()
		var up := normal.cross(right)
		for pip: Vector2 in PIPS[face]:
			var center := normal * 0.503 + (right * pip.x + up * pip.y) * 0.245
			for edge in 16:
				var start := Vector2.from_angle(TAU * edge / 16.0)
				var end := Vector2.from_angle(TAU * (edge + 1) / 16.0)
				for point: Vector2 in [Vector2.ZERO, start, end]:
					surface.set_normal(normal)
					surface.add_vertex(center + (right * point.x + up * point.y) * 0.079)
	return surface.commit()


func _material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material
