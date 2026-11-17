extends Button
## An index cut into the cream paper margin, inside the manila folder.
const UI = preload("res://game/ui_style.gd")

var active := false:
	set(value):
		active = value
		queue_redraw()


func _ready() -> void:
	custom_minimum_size = Vector2(54, 48)
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	# The folder already supplies continuous paper texture beneath these
	# controls. Draw just the cut edge and type; no separate tab artwork.
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
	var edge := Color(0.37, 0.28, 0.16, 0.30)
	var seam := size.x - 2
	if active:
		# The open sheet joins the document at the right; its cut edge steps
		# outward around the index label. The original paper grain stays intact.
		var cut := PackedVector2Array([Vector2(seam, 0), Vector2(8, 0), Vector2(2, 6), Vector2(2, size.y - 6), Vector2(8, size.y), Vector2(seam, size.y)])
		draw_polyline(cut, edge, 1.0, true)
		draw_line(Vector2(4, 7), Vector2(4, size.y - 7), Color(1, 0.98, 0.88, 0.50), 1.0, true)
	else:
		# A faint recessed tint reads as a lower sheet under the open page.
		draw_rect(Rect2(3, 1, size.x - 5, size.y - 2), Color(0.48, 0.35, 0.17, 0.045))
		draw_line(Vector2(seam, 0), Vector2(seam, size.y), edge, 1.0, true)
		draw_line(Vector2(8, size.y), Vector2(seam, size.y), Color(edge, 0.18), 1.0, true)
	if is_hovered() or has_focus():
		draw_rect(Rect2(5, 3, size.x - 9, size.y - 6), Color(0.53, 0.44, 0.25, 0.055))
	var font := UI.DISPLAY if active else UI.BODY
	var font_size := 14
	var baseline := (size.y - font.get_height(font_size)) * 0.5 + font.get_ascent(font_size)
	draw_string(font, Vector2(4, baseline), text, HORIZONTAL_ALIGNMENT_CENTER, size.x - 9, font_size, UI.INK)
	# A short printed rule marks the open sheet without relying on color alone.
	if active or has_focus():
		draw_line(Vector2(15, size.y - 10), Vector2(size.x - 15, size.y - 10), UI.INK, 1.0, true)
