extends Button
## A paper index leaf projecting from the left edge of the orders document.
const UI = preload("res://game/ui_style.gd")
const Sheet = preload("res://game/orders_style.gd")

var active := false:
	set(value):
		active = value
		queue_redraw()


func _ready() -> void:
	custom_minimum_size = Vector2(70, 48)
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	# Keep Button's native input, focus and accessibility; draw the paper and
	# horizontal label ourselves so rotating the artwork doesn't rotate the type.
	for state in ["normal", "hover", "pressed", "focus", "disabled"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		add_theme_color_override(state, Color.TRANSPARENT)
	mouse_entered.connect(queue_redraw)
	mouse_exited.connect(queue_redraw)
	focus_entered.connect(queue_redraw)
	focus_exited.connect(queue_redraw)
	button_down.connect(queue_redraw)
	button_up.connect(queue_redraw)


func _draw() -> void:
	var inset := 0.0 if active else 7.0
	var tint := Color.WHITE if active else Color(0.88, 0.81, 0.68)
	if is_hovered(): tint = tint.lightened(0.07)
	if is_pressed(): tint = tint.darkened(0.06)
	var paper := Rect2(Vector2.ZERO, Vector2(size.y, size.x - inset))
	# Rotate the existing painted top-tab artwork to make a left-facing leaf.
	draw_set_transform(Vector2(inset + 1, size.y + 2), -PI / 2)
	draw_texture_rect(Sheet.tab(), paper, false, Color(0.18, 0.11, 0.04, 0.28))
	draw_set_transform(Vector2(inset, size.y), -PI / 2)
	draw_texture_rect(Sheet.tab(), paper, false, tint)
	draw_set_transform(Vector2.ZERO)
	var font := UI.DISPLAY if active else UI.BODY
	var font_size := 15
	var baseline := (size.y - font.get_height(font_size)) * 0.5 + font.get_ascent(font_size)
	draw_string(font, Vector2(inset + 5, baseline), text, HORIZONTAL_ALIGNMENT_CENTER, size.x - inset - 10, font_size, UI.INK)
	# A short printed rule marks the open sheet without relying on color alone.
	if active or has_focus():
		draw_line(Vector2(inset + 18, size.y - 10), Vector2(size.x - 16, size.y - 10), UI.INK, 1.0, true)
