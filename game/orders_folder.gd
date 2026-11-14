extends PanelContainer
## A paper folder with an index tab; all controls remain ordinary accessible UI.

const UI = preload("res://game/ui_style.gd")


func _draw() -> void:
	var edge := Color("#a98b55")
	var manila := Color("#c9ad75")
	draw_style_box(UI.box(manila.darkened(0.08), edge, 0, 0, 3), Rect2(Vector2(-6, -5), size + Vector2(10, 9)))
	draw_style_box(UI.box(Color("#ecddbb"), edge, 0, 0, 2), Rect2(Vector2(-2, -2), size + Vector2(3, 3)))
	draw_colored_polygon(PackedVector2Array([Vector2(9, -5), Vector2(14, -23), Vector2(99, -23), Vector2(112, -5)]), manila)
	draw_polyline(PackedVector2Array([Vector2(9, -5), Vector2(14, -23), Vector2(99, -23), Vector2(112, -5)]), edge, 1, true)
	draw_string(UI.DISPLAY, Vector2(26, -9), "ORDERS", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#3c3a27"))
