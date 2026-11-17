extends SceneTree
## Verify the phone asset path, packed height precision and map picking.
const Terrain = preload("res://game/global_terrain.gd")
var failures := 0
var checks := 0

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var terrain := Terrain.new()
	terrain.use_mobile_textures = true
	root.add_child(terrain)
	terrain.set_quality(1)
	await process_frame
	var height: Texture2D = terrain.terrain_material.get_shader_parameter("height_map")
	var surface: Texture2D = terrain.terrain_material.get_shader_parameter("geography")
	_check(height.get_width() == 4096 and surface.get_width() == 4096, "Phone textures fit a 4096-pixel device limit")
	_check(not ResourceLoader.has_cached("res://game/art/terrain/global_height.png"), "Phone startup does not also load desktop height")
	_check(not ResourceLoader.has_cached("res://game/art/terrain/global_surface.png"), "Phone startup does not also load desktop color")
	_check(terrain.height_image.get_size() == Vector2i(4096, 1708), "CPU picking uses the phone heightfield")
	_check(terrain.terrain_material.get_shader_parameter("raster_size") == Vector2(4096, 1708), "Shader sampling uses the same phone heightfield")
	var precise := false
	for y in range(450, 500):
		for x in range(1100, 1150):
			precise = precise or terrain.height_image.get_pixel(x, y).g > 0
	_check(precise, "Phone elevations retain low-byte height precision")
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://game/global_1940.json"))
	for name in ["France", "Himalayas", "Japan", "Western United States", "Peru", "New South Wales"]:
		var xy: Array = data.regions[name].center
		var point := Vector2(xy[0], xy[1])
		terrain.configure(point, 0.8, Vector2(1240, 720))
		_check(terrain.height_at(point) > 0, "Phone relief remains above sea level in " + name)
		_check(terrain.world_point(terrain.screen_point(point)).distance_to(point) < 1, "Phone picking agrees with relief in " + name)
	print("Mobile terrain checks: %d passed, %d failed." % [checks - failures, failures])
	quit(0 if failures == 0 else 1)

func _check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		push_error(message)
