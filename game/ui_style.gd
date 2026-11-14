extends RefCounted

const BODY = preload("res://game/fonts/Inter.ttf")
const DISPLAY = preload("res://game/fonts/BarlowCondensed-Bold.ttf")
const TEXT := Color("#f2efe7")
const MUTED := Color("#abbac6")
const GOLD := Color("#efc784")
const TEAL := Color("#aedbce")
const PANEL := Color("#15212c")
const SURFACE := Color("#1c2b37")
const BORDER := Color("#344654")
const DARK := Color("#101b25")


static func make_theme() -> Theme:
	var theme := Theme.new()
	theme.default_font = BODY
	theme.default_font_size = 15
	theme.set_color("font_color", "Label", TEXT)
	theme.set_color("font_color", "Button", TEXT)
	theme.set_color("font_hover_color", "Button", TEXT)
	theme.set_color("font_pressed_color", "Button", TEXT)
	theme.set_color("font_disabled_color", "Button", Color("#8494a0"))
	theme.set_stylebox("normal", "Button", box(SURFACE, BORDER, 12, 7))
	theme.set_stylebox("hover", "Button", box(Color("#2a3f4e"), Color("#506775"), 12, 7))
	theme.set_stylebox("pressed", "Button", box(Color("#314856"), TEAL, 12, 7))
	theme.set_stylebox("disabled", "Button", box(PANEL, BORDER, 12, 7))
	var focus := box(Color.TRANSPARENT, GOLD, 12, 7)
	focus.set_border_width_all(2)
	theme.set_stylebox("focus", "Button", focus)
	theme.set_stylebox("normal", "LineEdit", box(DARK, BORDER, 12, 8))
	theme.set_stylebox("focus", "LineEdit", focus)
	theme.set_color("font_placeholder_color", "LineEdit", Color("#8194a3"))
	theme.set_stylebox("tab_selected", "TabContainer", box(SURFACE, BORDER, 17, 9))
	theme.set_stylebox("tab_unselected", "TabContainer", box(PANEL, Color.TRANSPARENT, 17, 9))
	theme.set_stylebox("tab_hovered", "TabContainer", box(SURFACE, BORDER, 17, 9))
	theme.set_stylebox("panel", "TabContainer", StyleBoxEmpty.new())
	theme.set_stylebox("panel", "AcceptDialog", box(PANEL, BORDER, 15, 13, 6))
	var window := box(PANEL, BORDER, 0, 0, 6)
	window.expand_margin_top = 31
	theme.set_stylebox("embedded_border", "Window", window)
	theme.set_stylebox("separator", "HSeparator", box(BORDER, BORDER, 0, 0))
	return theme


static func box(fill: Color, edge: Color, padding_x := 12, padding_y := 9, radius := 8) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = edge
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	style.content_margin_left = padding_x
	style.content_margin_right = padding_x
	style.content_margin_top = padding_y
	style.content_margin_bottom = padding_y
	return style


static func label(parent: Control, value: String, font_size: int, color: Color = TEXT, wrap := false) -> Label:
	var item := Label.new()
	item.text = value
	item.add_theme_font_size_override("font_size", font_size)
	item.add_theme_color_override("font_color", color)
	if wrap:
		item.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(item)
	return item


static func heading(parent: Control, value: String, font_size: int, color: Color = TEXT) -> Label:
	var item := label(parent, value, font_size, color)
	item.add_theme_font_override("font", DISPLAY)
	return item


static func button(parent: Control, title: String, callback: Callable) -> Button:
	var item := Button.new()
	item.text = title
	item.custom_minimum_size = Vector2(39, 35)
	item.pressed.connect(callback)
	parent.add_child(item)
	return item


static func primary(item: Button, accent: Color = GOLD) -> void:
	item.add_theme_stylebox_override("normal", box(accent, accent, 12, 7))
	item.add_theme_stylebox_override("hover", box(accent.lightened(0.12), accent, 12, 7))
	item.add_theme_stylebox_override("pressed", box(accent.darkened(0.12), accent, 12, 7))
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		item.add_theme_color_override(state, DARK)


static func secondary(item: Button) -> void:
	for state in ["normal", "hover", "pressed"]:
		item.remove_theme_stylebox_override(state)
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		item.remove_theme_color_override(state)
