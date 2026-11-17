extends Button
## Native input and vertical type over the tab belonging to a complete sheet.
const UI = preload("res://game/ui_style.gd")

var active := false:
	set(value):
		active = value
		queue_redraw()


func _ready() -> void:
	custom_minimum_size = Vector2(36, 48)
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	# The parent folder draws all four paper sheets and their joined tabs.
	# This button supplies input, keyboard focus, accessibility and rotated type.
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
	if is_hovered() or has_focus():
		draw_rect(Rect2(5, 5, size.x - 9, size.y - 10), Color(0.53, 0.44, 0.25, 0.075))
	var font := UI.DISPLAY if active else UI.BODY
	var font_size := 14
	# Rotate counterclockwise: the word reads upward along the paper edge.
	draw_set_transform(Vector2(0, size.y), -PI / 2)
	var baseline := (size.x - font.get_height(font_size)) * 0.5 + font.get_ascent(font_size)
	draw_string(font, Vector2(4, baseline), text, HORIZONTAL_ALIGNMENT_CENTER, size.y - 8, font_size, UI.INK)
	# A short printed rule marks the open sheet without relying on color alone.
	if active or has_focus():
		draw_line(Vector2(12, size.x - 7), Vector2(size.y - 12, size.x - 7), UI.INK, 1.0, true)
	draw_set_transform(Vector2.ZERO)
