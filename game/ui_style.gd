extends RefCounted
## Artwork-backed WWII field stationery. No legacy flat control theme.

const BODY = preload("res://game/fonts/OldStandardTT-Regular.ttf")
const DISPLAY = preload("res://game/fonts/OldStandardTT-Bold.ttf")
const FOLDER = preload("res://game/art/ui/orders-folder.png")
const CONTROLS = preload("res://game/art/ui/controls-atlas.png")
const ILLUSTRATIONS = preload("res://game/art/ui/unit-illustrations.png")
const TEXT := Color("#f0e2c7")
const MUTED := Color("#b8aa8c")
const GOLD := Color("#cdb077")
const TEAL := Color("#b2b894")
const PANEL := Color("#302719")
const SURFACE := Color("#4d4028")
const BORDER := Color("#90703f")
const DARK := Color("#211d14")
const INK := Color("#30291d")
const ICON_KEYS := ["infantry", "artillery", "armour", "aaGun", "mech_infantry", "fighter", "tactical_bomber", "bomber", "transport", "submarine", "destroyer", "cruiser", "carrier", "battleship", "factory_minor", "airfield"]
static var _textures := {}


static func _atlas(key: String, region: Rect2) -> AtlasTexture:
	if not _textures.has(key):
		var texture := AtlasTexture.new()
		texture.atlas = CONTROLS
		texture.region = region
		texture.filter_clip = true
		_textures[key] = texture
	return _textures[key]


static func paper_button() -> Texture2D:
	return _atlas("paper", Rect2(188, 178, 276, 282))


static func painted_button() -> Texture2D:
	return _atlas("olive", Rect2(657, 225, 572, 184))


static func folder_tab() -> Texture2D:
	return _atlas("tab", Rect2(27, 817, 576, 238))


static func walnut() -> Texture2D:
	return _atlas("walnut", Rect2(651, 650, 580, 580))


static func texture_box(texture: Texture2D, padding_x := 10, padding_y := 6, tint := Color.WHITE) -> StyleBoxTexture:
	var style := StyleBoxTexture.new()
	style.texture = texture
	style.modulate_color = tint
	style.content_margin_left = padding_x
	style.content_margin_right = padding_x
	style.content_margin_top = padding_y
	style.content_margin_bottom = padding_y
	return style


static func box(fill: Color, _edge: Color, padding_x := 12, padding_y := 9, _radius := 0) -> StyleBoxTexture:
	return texture_box(walnut() if fill.get_luminance() < 0.3 else paper_button(), padding_x, padding_y)


static func make_theme() -> Theme:
	var theme := Theme.new()
	theme.default_font = BODY
	theme.default_font_size = 16
	for kind in ["Label", "RichTextLabel"]:
		theme.set_color("font_color", kind, TEXT)
		theme.set_color("default_color", kind, TEXT)
	for kind in ["Button", "OptionButton", "MenuButton", "CheckButton", "LineEdit"]:
		for state in ["normal", "hover", "pressed", "disabled", "focus"]:
			var tint := Color.WHITE
			if state == "hover": tint = Color(1.10, 1.07, 1.0)
			if state == "pressed": tint = Color(0.83, 0.79, 0.69)
			if state == "disabled": tint = Color(0.83, 0.81, 0.74, 0.7)
			theme.set_stylebox(state, kind, texture_box(paper_button(), 11, 5, tint))
		for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
			theme.set_color(state, kind, INK)
		theme.set_color("font_disabled_color", kind, Color("#85775c"))
		theme.set_color("font_placeholder_color", kind, Color("#837357"))
	var rule := StyleBoxLine.new()
	rule.color = Color(0.35, 0.27, 0.14, 0.58)
	rule.thickness = 1
	theme.set_stylebox("separator", "HSeparator", rule)
	theme.set_constant("separation", "HSeparator", 9)
	for kind in ["PopupMenu", "AcceptDialog", "PanelContainer", "TabContainer"]:
		theme.set_stylebox("panel", kind, field_box())
		theme.set_color("font_color", kind, INK)
	for state in ["tab_selected", "tab_unselected", "tab_hovered"]:
		theme.set_stylebox(state, "TabContainer", texture_box(folder_tab(), 16, 8))
	var window := texture_box(walnut(), 5, 5)
	window.expand_margin_top = 30
	theme.set_stylebox("embedded_border", "Window", window)
	var scrollbar := texture_box(folder_tab(), 0, 0, Color(0.60, 0.48, 0.30))
	for state in ["scroll", "grabber", "grabber_highlight", "grabber_pressed"]:
		theme.set_stylebox(state, "VScrollBar", scrollbar)
	theme.set_constant("scrollbar_width", "VScrollBar", 8)
	return theme


static func field_theme() -> Theme:
	var theme := make_theme()
	for kind in ["Label", "RichTextLabel"]:
		theme.set_color("font_color", kind, INK)
		theme.set_color("default_color", kind, INK)
	return theme


static func field_box(_fill := Color("#e4d2aa"), padding_x := 26, padding_y := 28) -> StyleBoxTexture:
	return texture_box(FOLDER, padding_x, padding_y)


static func label(parent: Control, value: String, font_size: int, color: Color = TEXT, wrap := false) -> Label:
	var item := Label.new()
	item.text = value
	item.add_theme_font_size_override("font_size", font_size)
	item.add_theme_color_override("font_color", color)
	if wrap: item.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(item)
	return item


static func heading(parent: Control, value: String, font_size: int, color: Color = TEXT) -> Label:
	var item := label(parent, value, font_size, color)
	item.add_theme_font_override("font", DISPLAY)
	return item


static func button(parent: Control, title: String, callback: Callable) -> Button:
	var item := Button.new()
	item.text = title
	item.custom_minimum_size = Vector2(36, 34)
	item.pressed.connect(callback)
	parent.add_child(item)
	return item


static func primary(item: Button, _accent: Color = GOLD) -> void:
	for state in ["normal", "hover", "pressed", "focus"]:
		var tint := Color(1.12, 1.10, 1.0) if state == "hover" else Color.WHITE
		if state == "pressed": tint = Color(0.80, 0.77, 0.66)
		item.add_theme_stylebox_override(state, texture_box(painted_button(), 14, 8, tint))
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		item.add_theme_color_override(state, TEXT)
	item.add_theme_font_override("font", DISPLAY)


static func field_primary(item: Button) -> void:
	primary(item)


static func secondary(item: Button) -> void:
	for state in ["normal", "hover", "pressed", "focus"]:
		item.remove_theme_stylebox_override(state)
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		item.remove_theme_color_override(state)


static func text_link(item: Button, active := false) -> void:
	for state in ["normal", "hover", "pressed", "focus"]:
		var empty := StyleBoxEmpty.new()
		empty.content_margin_left = 7
		empty.content_margin_right = 7
		empty.content_margin_top = 3
		empty.content_margin_bottom = 3
		item.add_theme_stylebox_override(state, empty)
		item.add_theme_color_override("font_color", INK)
	item.add_theme_font_override("font", DISPLAY if active else BODY)
	if active: item.text = "[ " + item.text + " ]"


static func index_tab(item: Button, active := false) -> void:
	for state in ["normal", "hover", "pressed", "focus"]:
		var tint := Color.WHITE if active else Color(0.93, 0.90, 0.82)
		if state == "hover": tint = Color(1.1, 1.07, 1.0)
		item.add_theme_stylebox_override(state, texture_box(folder_tab(), 10, 6, tint))
	item.add_theme_font_override("font", DISPLAY if active else BODY)
	item.add_theme_font_size_override("font_size", 14)


static func unit_icon(unit: String) -> Texture2D:
	var index := ICON_KEYS.find(unit)
	if index < 0: return null
	var key := "unit:" + unit
	if not _textures.has(key):
		var texture := AtlasTexture.new()
		texture.atlas = ILLUSTRATIONS
		var cell := float(ILLUSTRATIONS.get_width()) / 4.0
		texture.region = Rect2(Vector2(index % 4, floori(float(index) / 4)) * cell, Vector2.ONE * cell)
		texture.filter_clip = true
		_textures[key] = texture
	return _textures[key]


static func unit_for_title(title: String) -> String:
	var titles := ["Infantry", "Artillery", "Tank", "AAA", "Mechanized infantry", "Fighter", "Tactical bomber", "Strategic bomber", "Transport", "Submarine", "Destroyer", "Cruiser", "Carrier", "Battleship"]
	for i in titles.size():
		if title.begins_with(titles[i]): return ICON_KEYS[i]
	return ""
