extends SubViewport
## Small orthographic 3D models drawn onto the atlas at close zoom.

var _models := Node3D.new()

const GROUND_COLOR = preload("res://game/art/ground030/Ground030_1K-JPG_Color.jpg")
const GROUND_NORMAL = preload("res://game/art/ground030/Ground030_1K-JPG_NormalGL.jpg")
const GROUND_ROUGHNESS = preload("res://game/art/ground030/Ground030_1K-JPG_Roughness.jpg")


func _ready() -> void:
	size = Vector2i(576, 192)
	own_world_3d = true
	transparent_bg = true
	render_target_update_mode = SubViewport.UPDATE_ONCE
	add_child(_models)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.keep_aspect = Camera3D.KEEP_HEIGHT
	camera.size = 3.8
	add_child(camera)
	camera.position = Vector3(0, 7, 7)
	camera.look_at(Vector3.ZERO)
	camera.make_current()
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-52, -34, -12)
	light.light_energy = 1.28
	light.shadow_enabled = true
	light.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	light.directional_shadow_max_distance = 18.0
	add_child(light)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("#e0e6d8")
	environment.environment.ambient_light_energy = 0.58
	add_child(environment)
	for x in [-4.58, 0.0, 4.62]:
		_ground(Vector3(x, -0.08, 0))
	for block in [Vector3(-5.48, 0, 0.3), Vector3(-4.45, 0, 0.45), Vector3(-4.90, 0, -0.60)]:
		_box(block + Vector3.UP * 0.26, Vector3(0.66, 0.52, 0.64), Color("#d4bea1"))
		_cone(block + Vector3.UP * 0.64, 0.54, 0.40, 4, Color("#9c5945"), PI / 4.0)
	_box(Vector3(-3.68, 0.55, -0.55), Vector3(0.31, 1.10, 0.32), Color("#a69c86"))
	_cone(Vector3(-3.68, 1.25, -0.55), 0.26, 0.36, 4, Color("#696257"), PI / 4.0)
	for tree in [Vector3(-0.74, 0, 0.56), Vector3(0.06, 0, 0.62), Vector3(0.78, 0, 0.22), Vector3(-0.31, 0, -0.38), Vector3(0.54, 0, -0.60)]:
		_box(tree + Vector3.UP * 0.26, Vector3(0.13, 0.54, 0.13), Color("#74513e"))
		_cone(tree + Vector3.UP * 0.78, 0.42, 1.08, 6, Color("#476749"), tree.x)
	for ridge in [Vector3(3.7, 0, 0.34), Vector3(4.63, 0, -0.37), Vector3(5.45, 0, 0.23)]:
		var height := 1.32 + 0.7 * (1.0 - absf(ridge.x - 4.65))
		_cone(ridge + Vector3.UP * height * 0.5, 0.94, height, 5, Color("#7c8179"), ridge.x)
		_cone(ridge + Vector3.UP * height * 0.83, 0.41, height * 0.34, 5, Color("#e3dfcc"), ridge.x)


func _ground(point: Vector3) -> void:
	var mesh := CylinderMesh.new()
	mesh.top_radius = 1.42
	mesh.bottom_radius = 1.27
	mesh.height = 0.20
	mesh.radial_segments = 9
	var base := MeshInstance3D.new()
	base.mesh = mesh
	base.position = point
	var paint := StandardMaterial3D.new()
	paint.albedo_color = Color("#b5a988")
	paint.albedo_texture = GROUND_COLOR
	paint.normal_enabled = true
	paint.normal_texture = GROUND_NORMAL
	paint.normal_scale = 0.62
	paint.roughness_texture = GROUND_ROUGHNESS
	base.material_override = paint
	_models.add_child(base)


func _box(point: Vector3, dimensions: Vector3, color: Color) -> void:
	var box := BoxMesh.new()
	box.size = dimensions
	_add_mesh(box, point, color, 0.0)


func _cone(point: Vector3, radius: float, height: float, sides: int, color: Color, angle: float) -> void:
	var cone := CylinderMesh.new()
	cone.bottom_radius = radius
	cone.top_radius = 0.0
	cone.height = height
	cone.radial_segments = sides
	cone.rings = 0
	_add_mesh(cone, point, color, angle)


func _add_mesh(mesh: Mesh, point: Vector3, color: Color, angle: float) -> void:
	var model := MeshInstance3D.new()
	model.mesh = mesh
	model.position = point
	model.rotation.y = angle
	var paint := StandardMaterial3D.new()
	paint.albedo_color = color
	paint.roughness = 0.95
	model.material_override = paint
	_models.add_child(model)
