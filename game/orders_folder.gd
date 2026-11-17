extends PanelContainer
## The approved folder artwork is the surface; controls are laid onto its paper.
const UI = preload("res://game/ui_style.gd")
const Sheet = preload("res://game/orders_style.gd")
var _paper: StyleBoxTexture
var _index_tabs: Array[Rect2] = []
var _active_page := -1
@export var title := "ORDERS":
	set(value):
		title = value
		queue_redraw()

func _ready() -> void:
	theme = Sheet.theme()
	_paper = UI.texture_box(Sheet.PAPER, 30, 18)
	add_theme_stylebox_override("panel", _paper)
	resized.connect(_sync_paper)
	_sync_paper()

func _sync_paper() -> void:
	var compact := get_viewport_rect().size.y < 650 or OS.has_feature("mobile") or "--touch-layout" in OS.get_cmdline_user_args()
	_paper.content_margin_top = size.y * 0.14 + (8 if compact else 12)
	_paper.content_margin_bottom = size.y * 0.043 + 8
	_paper.content_margin_left = clampf(size.x * 0.07, 23, 37)
	_paper.content_margin_right = _paper.content_margin_left
	# Style changes during a resize can arrive inside Container's current sort.
	# Sort again afterward so children use the new paper margins, not the old width.
	queue_sort.call_deferred()
	queue_redraw()

func _draw() -> void:
	_draw_pages()
	# The tab is the document's only title. Fit it within the physical tab at
	# normal, expanded and compact widths instead of repeating it on the sheet.
	var tab := Rect2(size.x * 0.11, size.y * 0.018, size.x * 0.26, size.y * 0.055)
	var font_size := clampi(roundi(size.y * 0.025), 13, 19)
	while font_size > 12 and UI.DISPLAY.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > tab.size.x:
		font_size -= 1
	var baseline := tab.position.y + (tab.size.y - UI.DISPLAY.get_height(font_size)) * 0.5 + UI.DISPLAY.get_ascent(font_size)
	draw_string(UI.DISPLAY, Vector2(tab.position.x, baseline), title, HORIZONTAL_ALIGNMENT_LEFT, tab.size.x, font_size, UI.INK)


func set_index_pages(tabs: Array[Rect2], active_page: int) -> void:
	_index_tabs = tabs
	_active_page = active_page
	queue_redraw()


func _draw_pages() -> void:
	if _index_tabs.is_empty() or _active_page < 0:
		return
	# Each category is a complete textured sheet with its tab cut from the
	# same outline. Draw the selected page last so its tab joins it seamlessly.
	var order: Array[int] = []
	for index in _index_tabs.size():
		if index != _active_page:
			order.append(index)
	order.append(_active_page)
	for layer in order.size():
		var index := order[layer]
		var depth := order.size() - layer - 1
		var page := Rect2(Vector2(size.x * 0.03 - depth * 1.5, size.y * 0.137 - depth * 5), Vector2(size.x * 0.935 + depth * 2.5, size.y * 0.817 + depth * 8))
		var tab := _index_tabs[index]
		if depth > 0:
			tab.position.x += 2.0
			tab.size.x -= 2.0
		var points := _page_outline(page, tab)
		var shadow := PackedVector2Array()
		var uv := PackedVector2Array()
		for point in points:
			shadow.append(point + Vector2(1.5, 2.0))
			# Sample only cream paper from the approved stationery artwork,
			# including on the projecting tab; never sample the manila folder.
			var p := ((point - page.position) / page.size).clamp(Vector2.ZERO, Vector2.ONE)
			uv.append(Vector2(0.055 + p.x * 0.89, 0.16 + p.y * 0.78))
		draw_colored_polygon(shadow, Color(0.19, 0.12, 0.05, 0.23))
		var tint := Color.WHITE.darkened(depth * 0.025)
		draw_polygon(points, PackedColorArray([tint]), uv, Sheet.PAPER)
		var edge := points.duplicate()
		edge.append(points[0])
		draw_polyline(edge, Color(0.48, 0.36, 0.19, 0.38), 1.0, true)
		draw_line(page.position + Vector2(10, 1), Vector2(page.end.x - 10, page.position.y + 1), Color(1, 0.98, 0.88, 0.65), 1.0, true)


func _page_outline(page: Rect2, tab: Rect2) -> PackedVector2Array:
	var x := page.position.x
	var y := page.position.y
	var right := page.end.x
	var bottom := page.end.y
	var radius := 9.0
	var result := PackedVector2Array()
	# Rounded paper corners, with the tab interrupting the left page edge.
	var corners := [Vector2(right - radius, y + radius), Vector2(right - radius, bottom - radius), Vector2(x + radius, bottom - radius)]
	for index in corners.size():
		var start := (index - 1) * PI / 2
		for step in 5:
			result.append(corners[index] + Vector2.from_angle(start + step * PI / 8) * radius)
	result.append(Vector2(x, tab.end.y))
	result.append(Vector2(tab.position.x + 6, tab.end.y))
	result.append(Vector2(tab.position.x, tab.end.y - 6))
	result.append(Vector2(tab.position.x, tab.position.y + 6))
	result.append(Vector2(tab.position.x + 6, tab.position.y))
	result.append(Vector2(x, tab.position.y))
	for step in 5:
		result.append(Vector2(x + radius, y + radius) + Vector2.from_angle(PI + step * PI / 8) * radius)
	return result
