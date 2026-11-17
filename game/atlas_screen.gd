extends Control

signal closed
signal sector_requested(zone: String)

const Atlas = preload("res://game/global_map.gd")
const UI = preload("res://game/ui_style.gd")
const UNIT_NAMES := {"armour": "Tank", "aaGun": "AA gun", "mech_infantry": "Mechanized infantry",
	"factory_minor": "Minor factory", "factory_major": "Major factory", "harbour": "Naval base"}

var _map: Atlas
var _region: Label
var _info: Label
var _inspect: Button
var _details: PanelContainer
var _sector: Button
var _zone := ""
var _footer: HBoxContainer
var _header: HBoxContainer


func _ready() -> void:
	theme = UI.field_theme()
	var frame := PanelContainer.new()
	frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var timber := UI.texture_box(UI.walnut(), 9, 9)
	frame.add_theme_stylebox_override("panel", timber)
	add_child(frame)
	_map = Atlas.new()
	frame.add_child(_map)
	_map.selected.connect(_select)
	var strip := TextureRect.new()
	strip.texture = UI.walnut()
	strip.modulate = Color(0.55, 0.50, 0.40)
	strip.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	strip.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	strip.offset_bottom = 36
	add_child(strip)
	var bar := HBoxContainer.new()
	_header = bar
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 9
	bar.offset_right = -9
	bar.offset_top = 3
	bar.offset_bottom = 33
	bar.add_theme_constant_override("separation", 8)
	add_child(bar)
	var back := UI.button(bar, "‹ Back", _close)
	back.custom_minimum_size = Vector2(61, 28)
	UI.text_link(back)
	back.add_theme_color_override("font_color", UI.TEXT)
	var title := UI.heading(bar, "GLOBAL 1940", 15)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.add_child(spacer)
	var jump := MenuButton.new()
	jump.text = "Theaters ▾"
	UI.text_link(jump)
	jump.add_theme_color_override("font_color", UI.TEXT)
	jump.custom_minimum_size = Vector2(107, 28)
	bar.add_child(jump)
	var theaters := [["Europe", "France"], ["North America", "Eastern United States"], ["Africa", "Egypt"],
		["Soviet Union", "Russia"], ["East Asia", "Japan"], ["Pacific", "Hawaiian Islands"], ["South Pacific", "New South Wales"]]
	for theater in theaters:
		jump.get_popup().add_item(theater[0])
	jump.get_popup().id_pressed.connect(func(index: int): _map.inspect_theater(theaters[index][1]))
	var display := MenuButton.new()
	display.text = "☰"
	display.tooltip_text = "Display quality"
	UI.text_link(display)
	display.add_theme_color_override("font_color", UI.TEXT)
	display.add_theme_font_size_override("font_size", 21)
	bar.add_child(display)
	for option in ["High detail", "Balanced", "Performance"]:
		display.get_popup().add_radio_check_item(option)
	var preferences := ConfigFile.new()
	preferences.load("user://display.cfg")
	var default_quality := 1 if OS.has_feature("mobile") else 0
	var quality := clampi(int(preferences.get_value("display", "quality", default_quality)), 0, 2)
	display.get_popup().set_item_checked(quality, true)
	_map.set_visual_quality(quality)
	display.get_popup().id_pressed.connect(func(index: int):
		for i in 3:
			display.get_popup().set_item_checked(i, i == index)
		_map.set_visual_quality(index)
		preferences.set_value("display", "quality", index)
		preferences.save("user://display.cfg")
	)
	_build_inspector()
	var footer := HBoxContainer.new()
	_footer = footer
	footer.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	footer.offset_left = 9
	footer.offset_right = -9
	footer.offset_top = -38
	footer.offset_bottom = -8
	footer.add_theme_constant_override("separation", 5)
	add_child(footer)
	_region = UI.label(footer, "Opening positions · Select a territory", 14, UI.TEXT)
	_region.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_region.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_region.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_inspect = UI.button(footer, "Details", func(): _details.visible = not _details.visible)
	_inspect.custom_minimum_size = Vector2(65, 30)
	_inspect.disabled = true
	_sector = UI.button(footer, "View on board", func():
		var zone: String = _map.region_info(_zone).zone
		_close()
		sector_requested.emit(zone)
	)
	_sector.hide()
	UI.button(footer, "−", func(): _map.zoom_by(0.72)).custom_minimum_size = Vector2(30, 30)
	var fit := UI.button(footer, "100%", _map.reset_camera)
	fit.custom_minimum_size = Vector2(54, 30)
	fit.tooltip_text = "Whole world"
	_map.camera_changed.connect(func(percent: int): fit.text = "%d%%" % percent)
	UI.button(footer, "+", func(): _map.zoom_by(1.38)).custom_minimum_size = Vector2(30, 30)
	hide()


func open(view: Dictionary = {}) -> void:
	show()
	_map.load_atlas()
	update_sector(view)


func update_sector(view: Dictionary) -> void:
	_map.set_sector(view)
	_select(_zone)


func _close() -> void:
	_details.hide()
	hide()
	closed.emit()


func _build_inspector() -> void:
	_details = PanelContainer.new()
	_details.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	_details.offset_left = 12
	_details.offset_right = 320
	_details.offset_top = -214
	_details.offset_bottom = -10
	_details.add_theme_stylebox_override("panel", UI.field_box())
	_map.add_child(_details)
	var layout := VBoxContainer.new()
	_details.add_child(layout)
	UI.button(layout, "Close details", _details.hide)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	layout.add_child(scroll)
	_info = UI.label(scroll, "", 14, Color("#303327"), true)
	_info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_details.hide()


func _select(zone: String) -> void:
	_zone = zone
	_inspect.disabled = zone.is_empty()
	var region := _map.region_info(zone)
	_sector.visible = region.has("zone")
	if zone.is_empty():
		_region.text = "Opening positions · Tap a territory"
		_details.hide()
		return
	_region.text = zone if region.water else "%s · %s · %d IPC" % [zone, _map.owner_name(region.owner), region.ipc]
	var lines: PackedStringArray = [_region.text]
	lines.append("Current position" if region.has("zone") else "Opening position")
	if region.city:
		lines.append("★ Victory city")
	for unit in region.units:
		lines.append("%d × %s · %s" % [unit[2], UNIT_NAMES.get(unit[1], String(unit[1]).capitalize()), _map.owner_name(unit[0])])
	lines.append("\nBorders · " + ", ".join(region.links))
	_info.text = "\n".join(lines)


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel"):
		if _details.visible:
			_details.hide()
		else:
			_close()
		get_viewport().set_input_as_handled()
