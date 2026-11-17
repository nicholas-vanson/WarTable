extends SceneTree
## Regression coverage for world relief, projection, controllers and folder UI.
## Optional real-render captures: -- --capture-dir /absolute/path (not headless).

const Screen = preload("res://game/global_screen.gd")
const Rules = preload("res://game/global_rules.gd")
const Miniatures = preload("res://game/unit_miniatures.gd")
const UI = preload("res://game/ui_style.gd")
var failures := 0
var checks := 0
var captures := ""


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var args := OS.get_cmdline_user_args()
	if "--capture-dir" in args:
		captures = args[args.find("--capture-dir") + 1]
		DirAccess.make_dir_recursive_absolute(captures)
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	var screen := Screen.new()
	screen.save_path = "" # Never read or overwrite a player's campaign.
	screen.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(screen)
	screen.open_campaign()
	await process_frame
	var map = screen._map
	map.set_visual_quality(0)
	_check(map.regions.size() == 332, "Every game territory is retained")
	_check(map._terrain.height_image.get_width() >= 8192, "World elevation retains its 8K resolution")
	var fine_height := false
	for y in range(1000, 1032):
		for x in range(2270, 2302):
			fine_height = fine_height or map._terrain.height_image.get_pixel(x, y).g > 0.0
	_check(fine_height, "Terrain carries sub-byte elevation precision")
	_check(screen._panel.get_theme_stylebox("panel") is StyleBoxTexture, "Orders use the approved paper artwork")
	_check(screen._action.get_theme_stylebox("normal") is StyleBoxTexture, "Primary actions use painted material artwork")
	_check(UI.unit_icon("infantry") != null and UI.unit_icon("carrier") != null, "Purchase sheet includes printed unit illustrations")
	_check(map._terrain._copies.size() == 3, "Terrain supports horizontal wraparound")
	_check(map._terrain.palette.get_pixel(0, 1).is_equal_approx(Color(0, 0, 0, 0)), "Unassigned water has no ownership or battle highlight")
	_check(map._terrain.camera.rotation_degrees.is_equal_approx(Vector3(-90, 0, 0)), "Camera is straight overhead")
	_check(map._terrain.camera.projection == Camera3D.PROJECTION_PERSPECTIVE, "Relief has perspective parallax")
	for zone in ["France", "Caucasus", "Himalayas", "Western United States", "Peru", "Japan", "New South Wales"]:
		map.focus(zone)
		var at: Vector2 = map.regions[zone].center
		_check(map._terrain.height_at(at) > 0, "Land relief exists in " + zone)
		_check(map._world(map._screen(at)).distance_to(at) < 1.0, "Screen picking agrees with relief in " + zone)
	map.focus("Himalayas")
	var high: Vector2 = map.regions.Himalayas.center
	var peak := 0.0
	for y in range(-100, 101, 10):
		for x in range(-100, 101, 10):
			var sample: Vector2 = map.regions.Himalayas.center + Vector2(x, y)
			var elevation: float = map._terrain.height_at(sample)
			if elevation > peak:
				peak = elevation
				high = sample
	var flat: Vector2 = map._terrain.camera.unproject_position(Vector3(high.x, 0, high.y))
	_check(map._screen(high).distance_to(flat) > 0.05, "Elevated terrain has actual perspective parallax")
	map.inspect_theater("Himalayas")
	var relative_before: Vector2 = map._screen(high) - map._terrain.camera.unproject_position(Vector3(high.x, 0, high.y))
	map._pan(Vector2(180, 0))
	var relative_after: Vector2 = map._screen(high) - map._terrain.camera.unproject_position(Vector3(high.x, 0, high.y))
	var visible_parallax := relative_after.distance_to(relative_before)
	_check(visible_parallax >= 10.0, "An ordinary overhead pan visibly separates mountain relief from ground")
	print("Measured crest/ground parallax: %.2f pixels per 180-pixel pan." % visible_parallax)
	map.inspect_theater("France")
	await process_frame
	_check(not map._stacks.is_empty(), "Visible armies instantiate 3D miniatures")
	_check(map._terrain._piece_nodes.size() == map._stacks.size(), "Displayed stacks have matching 3D instances")
	var sample_tile: Dictionary
	for tile in map._terrain._tiles:
		if tile.node.visible:
			sample_tile = tile
			break
	var high_vertices: int = sample_tile.node.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX].size()
	map.set_visual_quality(2)
	_check(sample_tile.node.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX].size() < high_vertices, "Performance mode reduces terrain geometry")
	map.set_visual_quality(0)
	var stack: Dictionary = map._stacks[0]
	map._tap(map._screen(stack.point))
	_check(map._selection == stack.zone, "Tapping a miniature selects its territory")
	var names: Array = map.regions.keys()
	var ident := names.find("France") + 1
	_check(map._terrain.palette.get_pixel(ident, 0).is_equal_approx(map.SIDE_COLORS.French), "French control uses the French tint")
	var live: Dictionary = map._live.duplicate(true)
	live.France.owner = "Germans"
	map.set_campaign(live, [], {}, [])
	_check(map._terrain.palette.get_pixel(ident, 0).is_equal_approx(map.SIDE_COLORS.Germans), "Capturing land updates ownership without rebuilding relief")
	screen._refresh()
	for owner in Rules.ORDER:
		for unit in Rules.PROFILES:
			var mesh := Miniatures.build(owner, unit, map.SIDE_COLORS[owner])
			_check(mesh.get_surface_count() == 1 and mesh.get_aabb().size.length() > 0, owner + " has a " + unit + " sculpt")
	var german := Miniatures.build("Germans", "armour", map.SIDE_COLORS.Germans)
	var french := Miniatures.build("French", "armour", map.SIDE_COLORS.French)
	_check(not german.get_aabb().is_equal_approx(french.get_aabb()), "National tanks have distinct geometry")
	screen._show_panel(true)
	await process_frame
	var original_width := screen._panel.size.x
	screen._maximize_panel()
	await process_frame
	_check(screen._panel.size.x > original_width, "Orders folder maximizes")
	screen._maximize_panel()
	screen._show_panel(false, true)
	await create_timer(0.30).timeout
	_check(not screen._panel.visible and screen._order_toggle.visible, "Minimized folder leaves an accessible edge tab")
	screen._order_toggle.pressed.emit()
	await create_timer(0.30).timeout
	_check(screen._panel.visible and not screen._order_toggle.visible, "The tab reopens the folder")
	map.inspect_theater("France")
	await _capture("europe-folder")
	screen._show_panel(false)
	map.reset_camera()
	await _capture("global-overview")
	map.inspect_theater("Japan")
	await _capture("east-asia")
	map.inspect_theater("Eastern United States")
	await _capture("north-america")
	map.inspect_theater("Hawaiian Islands")
	var before: Vector2 = map._center
	map._pan(Vector2(-map.extent.x * map._scale(), 0))
	_check(map._center.distance_to(before) < 0.1, "A complete pan wraps to the original place")
	root.size = Vector2i(960, 540)
	root.content_scale_size = root.size
	await process_frame
	screen._show_panel(true)
	await process_frame
	_check(screen._panel.position.x >= 0 and screen._panel.get_rect().end.x <= map.size.x, "Folder fits a small touchscreen")
	_check(screen._panel.get_rect().end.y <= map.size.y, "Small-screen folder stays vertically reachable")
	screen._choose_filter(0)
	await process_frame
	await process_frame
	_check(screen._panel.get_global_rect().encloses(screen._document.get_global_rect()), "Changing categories after resizing keeps the document inside its folder")
	# Exercise the transformed hit areas, not just the tab's pressed signal.
	# The selected sheet, its tab and the live document must stay together.
	for index in [2, 3, 0, 1]:
		var tab: Button = screen._category_tabs.get_child(index)
		var at: Vector2 = tab.get_global_transform() * (tab.size * 0.5)
		var motion := InputEventMouseMotion.new()
		motion.position = at
		root.push_input(motion, true)
		for down in [true, false]:
			var click := InputEventMouseButton.new()
			click.position = at
			click.button_index = MOUSE_BUTTON_LEFT
			click.pressed = down
			root.push_input(click, true)
		for frame in 4: await process_frame
		_check(screen._filter == index and screen._panel.front_page() == index, "Clicking the rotated %s tab brings its sheet forward" % tab.text)
		_check(is_equal_approx(tab.rotation, screen._document.rotation), "The %s tab and document follow the same sheet angle" % tab.text)
		var within_paper := true
		var inverse: Transform2D = screen._panel.page_transform(index).affine_inverse()
		var paper: Rect2 = screen._panel.page_rect()
		for corner in [Vector2.ZERO, Vector2(screen._action.size.x, 0), screen._action.size, Vector2(0, screen._action.size.y)]:
			var point: Vector2 = screen._action.get_global_transform() * corner - screen._panel.global_position
			within_paper = within_paper and paper.has_point(inverse * point)
		_check(within_paper, "The action remains inside the %s sheet after switching" % tab.text)
	screen._choose_filter(1)
	map.inspect_theater("France")
	await _capture("touch-layout")
	print("World visual checks: %d passed, %d failed." % [checks - failures, failures])
	quit(0 if failures == 0 else 1)


func _capture(label: String) -> void:
	if captures.is_empty() or DisplayServer.get_name() == "headless":
		return
	for i in 4:
		await process_frame
	await RenderingServer.frame_post_draw
	var err := root.get_texture().get_image().save_png(captures.path_join(label + ".png"))
	_check(err == OK, "Rendered " + label)
	print("Captured ", label, "; FPS ", Engine.get_frames_per_second())


func _check(passed: bool, message: String) -> void:
	checks += 1
	if not passed:
		failures += 1
		push_error(message)
