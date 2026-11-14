extends SubViewport
## Full-board heightfield, with a straight-down perspective camera and real lighting.

const Miniatures = preload("res://game/unit_miniatures.gd")
const SHADER = preload("res://game/global_terrain.gdshader")
const HEIGHT = preload("res://game/art/terrain/global_height.png")
const GEOGRAPHY = preload("res://game/art/terrain/global_geography.png")
const TERRITORIES = preload("res://game/art/terrain/global_territories.png")
const WORLD := Vector2(7705, 3213)
const RELIEF := 75.0
const CHUNK := 256.0
const STEP := 8.0

var camera := Camera3D.new()
var palette := Image.create(512, 2, false, Image.FORMAT_RGBA8)
var palette_texture: ImageTexture
var terrain_material := ShaderMaterial.new()
var height_image: Image
var _world := Node3D.new()
var _copies: Array[Node3D] = []
var _pieces := Node3D.new()
var _piece_nodes := {}
var _mesh_cache := {}
static var _terrain_meshes := {}
var _sun: DirectionalLight3D
var _tiles: Array = []


func _ready() -> void:
	own_world_3d = true
	transparent_bg = true
	msaa_3d = Viewport.MSAA_DISABLED
	render_target_update_mode = SubViewport.UPDATE_WHEN_VISIBLE
	add_child(_world)
	_world.add_child(_pieces)
	height_image = HEIGHT.get_image()
	# Color.TRANSPARENT has white RGB in Godot; unused state entries must be
	# black as well as transparent, otherwise lakes can acquire highlight colors.
	palette.fill(Color(0, 0, 0, 0))
	palette_texture = ImageTexture.create_from_image(palette)
	terrain_material.shader = SHADER
	terrain_material.set_shader_parameter("height_map", HEIGHT)
	terrain_material.set_shader_parameter("geography", GEOGRAPHY)
	terrain_material.set_shader_parameter("territories", TERRITORIES)
	terrain_material.set_shader_parameter("control_palette", palette_texture)
	terrain_material.set_shader_parameter("raster_size", Vector2(HEIGHT.get_width(), HEIGHT.get_height()))
	_world.add_child(camera)
	camera.keep_aspect = Camera3D.KEEP_WIDTH
	camera.fov = 35
	camera.near = 1.0
	camera.far = 30000
	camera.rotation_degrees.x = -90
	camera.make_current()
	var light := DirectionalLight3D.new()
	_sun = light
	light.rotation_degrees = Vector3(-56, -35, -18)
	light.light_color = Color("#fff1d2")
	light.light_energy = 0.72
	light.shadow_enabled = true
	light.shadow_bias = 0.025
	light.directional_shadow_max_distance = 15000
	light.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	_world.add_child(light)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("#172829")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("#bdcbd6")
	environment.environment.ambient_light_energy = 0.32
	environment.environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	_world.add_child(environment)
	_build_world()


func _build_world() -> void:
	for shift in [-1, 0, 1]:
		var copy := Node3D.new()
		copy.position.x = shift * WORLD.x
		_world.add_child(copy)
		_copies.append(copy)
	for y in range(0, int(WORLD.y), int(CHUNK)):
		for x in range(0, int(WORLD.x), int(CHUNK)):
			var mesh := _chunk_mesh(Vector2(x, y), 24.0)
			for copy in _copies:
				var tile := MeshInstance3D.new()
				tile.mesh = mesh
				tile.material_override = terrain_material
				tile.custom_aabb = AABB(Vector3(x, -1, y), Vector3(CHUNK, RELIEF + 2, CHUNK))
				copy.add_child(tile)
				_tiles.append({"node": tile, "origin": Vector2(x, y), "bounds": Rect2(Vector2(x + copy.position.x, y), Vector2.ONE * CHUNK), "step": 24.0})


func _chunk_mesh(origin: Vector2, step: float) -> ArrayMesh:
	var key := Vector3(origin.x, origin.y, step)
	if _terrain_meshes.has(key):
		return _terrain_meshes[key]
	var end := (origin + Vector2.ONE * CHUNK).min(WORLD)
	var nx := ceili((end.x - origin.x) / step)
	var nz := ceili((end.y - origin.y) / step)
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	for z in range(nz + 1):
		for x in range(nx + 1):
			var point := origin + Vector2((end.x - origin.x) * x / nx, (end.y - origin.y) * z / nz)
			vertices.append(Vector3(point.x, 0, point.y))
			normals.append(Vector3.UP)
			uvs.append(point / WORLD)
	for z in nz:
		for x in nx:
			var a := z * (nx + 1) + x
			indices.append_array(PackedInt32Array([a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1]))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	_terrain_meshes[key] = mesh
	return mesh


func configure(center: Vector2, pixels_per_unit: float, viewport_size: Vector2) -> void:
	if viewport_size.x < 1 or viewport_size.y < 1:
		return
	size = Vector2i(maxi(1, int(viewport_size.x)), maxi(1, int(viewport_size.y)))
	var altitude := viewport_size.x / (2.0 * maxf(pixels_per_unit, 0.001) * tan(deg_to_rad(camera.fov) * 0.5))
	camera.position = Vector3(center.x, altitude, center.y)
	_sun.directional_shadow_max_distance = altitude * 1.6
	var half_width := viewport_size.x / (2.0 * maxf(pixels_per_unit, 0.001))
	for i in _copies.size():
		var left := (i - 1) * WORLD.x
		_copies[i].visible = left <= center.x + half_width and left + WORLD.x >= center.x - half_width
	var bounds := Rect2(center - viewport_size / pixels_per_unit * 0.5, viewport_size / pixels_per_unit).grow(150)
	var step := STEP if pixels_per_unit >= 0.35 else 24.0
	for tile in _tiles:
		tile.node.visible = bounds.intersects(tile.bounds)
		if tile.node.visible and tile.step != step:
			tile.node.mesh = _chunk_mesh(tile.origin, step)
			tile.step = step


func height_at(point: Vector2) -> float:
	if height_image == null:
		return 0.0
	var uv := Vector2(fposmod(point.x, WORLD.x) / WORLD.x, clampf(point.y / WORLD.y, 0.0, 1.0))
	var p := uv * Vector2(height_image.get_width() - 1, height_image.get_height() - 1)
	var x := int(p.x)
	var z := int(p.y)
	var x1 := mini(x + 1, height_image.get_width() - 1)
	var z1 := mini(z + 1, height_image.get_height() - 1)
	return lerpf(lerpf(height_image.get_pixel(x, z).r, height_image.get_pixel(x1, z).r, p.x - x), lerpf(height_image.get_pixel(x, z1).r, height_image.get_pixel(x1, z1).r, p.x - x), p.y - z) * RELIEF


func screen_point(point: Vector2) -> Vector2:
	return camera.unproject_position(Vector3(point.x, height_at(point), point.y))


func world_point(screen: Vector2) -> Vector2:
	var start := camera.project_ray_origin(screen)
	var direction := camera.project_ray_normal(screen)
	var point := start + direction * (-start.y / direction.y)
	for i in 5:
		var elevation := height_at(Vector2(point.x, point.z))
		point = start + direction * ((elevation - start.y) / direction.y)
	return Vector2(point.x, point.z)


func update_control(names: Array, regions: Dictionary, live: Dictionary, colors: Dictionary, selection: String, legal: Dictionary, battles: Array) -> void:
	for i in names.size():
		var name: String = names[i]
		var r: Dictionary = regions[name]
		var owner: String = live.get(name, r).get("owner", "")
		var color: Color = colors.get(owner, Color("#c0b394"))
		color.a = 0.0 if r.water or owner.begins_with("Neutral") or owner in ["", "Mongolians"] else 1.0
		palette.set_pixel(i + 1, 0, color)
		palette.set_pixel(i + 1, 1, Color(1.0 if name == selection else 0.0, 1.0 if legal.has(name) else 0.0, 1.0 if name in battles else 0.0, 1))
	palette_texture.update(palette)


func sync_units(stacks: Array, pixels_per_unit: float, colors: Dictionary) -> void:
	var retained := {}
	for stack in stacks:
		var key: String = stack.key
		retained[key] = true
		if not _piece_nodes.has(key):
			var profile: String = stack.owner + ":" + stack.unit
			if not _mesh_cache.has(profile):
				_mesh_cache[profile] = Miniatures.build(stack.owner, stack.unit, colors.get(stack.owner, Color("#b7ad92")))
			var piece := MeshInstance3D.new()
			piece.mesh = _mesh_cache[profile]
			piece.material_override = Miniatures.material()
			_pieces.add_child(piece)
			_piece_nodes[key] = piece
		var node: MeshInstance3D = _piece_nodes[key]
		var point: Vector2 = stack.point
		node.position = Vector3(point.x, height_at(point) + 0.8, point.y)
		node.scale = Vector3.ONE * (25.0 / maxf(pixels_per_unit, 0.001))
	for key in _piece_nodes.keys():
		if not retained.has(key):
			_piece_nodes[key].queue_free()
			_piece_nodes.erase(key)
