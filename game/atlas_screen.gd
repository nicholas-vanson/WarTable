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
	var backdrop := ColorRect.new()
	backdrop.color = Color("#0e1a21")
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 10)
	add_child(margin)
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 7)
	margin.add_child(layout)
	var bar := HBoxContainer.new()
	_header = bar
	bar.add_theme_constant_override("separation", 8)
	layout.add_child(bar)
	UI.button(bar, "‹ Back", _close).custom_minimum_size = Vector2(90, 44)
	var title := UI.heading(bar, "World Map · 1940", 29)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var jump := OptionButton.new()
	jump.custom_minimum_size = Vector2(127, 44)
	bar.add_child(jump)
	jump.add_item("Jump to…")
	var theaters := [["Europe", "France"], ["North America", "Eastern United States"], ["Africa", "Egypt"],
		["Soviet Union", "Russia"], ["East Asia", "Japan"], ["Pacific", "Hawaiian Islands"], ["South Pacific", "New South Wales"]]
	for theater in theaters:
		jump.add_item(theater[0])
	jump.item_selected.connect(func(index: int):
		if index > 0:
			_map.inspect_theater(theaters[index - 1][1])
		jump.select(0)
	)
	var board_frame := PanelContainer.new()
	board_frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	board_frame.add_theme_stylebox_override("panel", UI.box(Color("#132832"), Color("#a79774"), 3, 3, 3))
	layout.add_child(board_frame)
	_map = Atlas.new()
	board_frame.add_child(_map)
	_map.selected.connect(_select)
	_build_inspector()
	var footer := HBoxContainer.new()
	_footer = footer
	footer.add_theme_constant_override("separation", 6)
	layout.add_child(footer)
	_region = UI.label(footer, "Opening positions · Tap a territory", 17, UI.TEXT)
	_region.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_region.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_region.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_inspect = UI.button(footer, "Details", func(): _details.visible = not _details.visible)
	_inspect.custom_minimum_size = Vector2(91, 44)
	_inspect.disabled = true
	_sector = UI.button(footer, "View on board", func():
		var zone: String = _map.region_info(_zone).zone
		_close()
		sector_requested.emit(zone)
	)
	_sector.custom_minimum_size.y = 44
	_sector.hide()
	UI.button(footer, "−", func(): _map.zoom_by(0.72)).custom_minimum_size = Vector2(46, 44)
	var fit := UI.button(footer, "100%", _map.reset_camera)
	fit.custom_minimum_size = Vector2(70, 44)
	fit.tooltip_text = "Whole world"
	_map.camera_changed.connect(func(percent: int): fit.text = "%d%%" % percent)
	UI.button(footer, "+", func(): _map.zoom_by(1.38)).custom_minimum_size = Vector2(46, 44)
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
	_details.add_theme_stylebox_override("panel", UI.box(Color("#16272d"), Color("#a79774"), 13, 10, 5))
	_map.add_child(_details)
	var layout := VBoxContainer.new()
	_details.add_child(layout)
	UI.button(layout, "Close details", _details.hide)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	layout.add_child(scroll)
	_info = UI.label(scroll, "", 16, UI.TEXT, true)
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
