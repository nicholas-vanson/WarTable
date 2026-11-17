extends PanelContainer
## The approved folder artwork is the surface; controls are laid onto its paper.
const UI = preload("res://game/ui_style.gd")
const Sheet = preload("res://game/orders_style.gd")
var _paper: StyleBoxTexture
var _index_tabs: Array[Rect2] = []
var _active_page := -1
# Stable, individually placed sheets. Selection changes their stacking order,
# not their pose, so a tab always belongs to the same physical piece of paper.
const PAGE_OFFSETS := [Vector2(-5, -10), Vector2(2, 2), Vector2(-4, -3), Vector2(5, -7)]
const PAGE_ANGLES := [-0.85, 0.45, -0.40, 0.80]
var _stack_order: Array[int] = [0, 2, 3, 1]
@export var title := "ORDERS":
	set(value):
		title = value
		queue_redraw()

func _ready() -> void:
	theme = Sheet.theme()
	_paper = UI.texture_box(Sheet.FOLDER, 30, 18)
	add_theme_stylebox_override("panel", _paper)
	resized.connect(_sync_paper)
	_sync_paper()

func _sync_paper() -> void:
	var compact := get_viewport_rect().size.y < 650 or OS.has_feature("mobile") or "--touch-layout" in OS.get_cmdline_user_args()
	_paper.content_margin_top = size.y * 0.14 + (8 if compact else 12)
	_paper.content_margin_bottom = size.y * 0.06 + 14
	_paper.content_margin_left = clampf(size.x * 0.075, 26, 43)
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
	if active_page >= 0 and active_page != _active_page:
		_stack_order.erase(active_page)
		_stack_order.append(active_page)
	_active_page = active_page
	queue_redraw()


func page_rect() -> Rect2:
	return Rect2(Vector2(size.x * 0.04, size.y * 0.14), Vector2(size.x * 0.91, size.y * 0.80))


func page_transform(index: int) -> Transform2D:
	var center := page_rect().get_center()
	var spread := clampf(size.x / 650.0, 0.7, 1.0)
	var rotation := Transform2D(deg_to_rad(PAGE_ANGLES[index]), Vector2.ZERO)
	rotation.origin = center + PAGE_OFFSETS[index] * spread - rotation * center
	return rotation


func front_page() -> int:
	return _stack_order.back()


func _draw_pages() -> void:
	var page := page_rect()
	if page.size.x < 24 or page.size.y < 40:
		return
	for layer in _stack_order.size():
		var index := _stack_order[layer]
		var depth := _stack_order.size() - layer - 1
		var tab := _index_tabs[index] if index < _index_tabs.size() else Rect2()
		# A resize may redraw before the deferred container sort updates its
		# tabs. Draw a plain sheet for that frame instead of a self-crossing join.
		if tab.has_area() and (tab.position.y < page.position.y + 6 or tab.end.y > page.end.y - 6):
			tab = Rect2()
		var points := _page_outline(page, tab)
		var pose := page_transform(index)
		var uv := PackedVector2Array()
		for point in points:
			# Sample only cream paper from the approved stationery artwork,
			# including on the projecting tab; never sample the manila folder.
			var p := ((point - page.position) / page.size).clamp(Vector2.ZERO, Vector2.ONE)
			uv.append(Vector2(0.07 + p.x * 0.85, 0.18 + p.y * 0.74))
		# Transform the canvas, not the polygon vertices: this preserves the
		# shared triangulation at nearly-collinear tab/page joins after rotation.
		var shadow_pose := pose
		shadow_pose.origin += Vector2(1.2, 2.2)
		draw_set_transform_matrix(shadow_pose)
		draw_colored_polygon(points, Color(0.19, 0.12, 0.05, 0.23))
		draw_set_transform_matrix(pose)
		var tint := Color.WHITE.darkened(depth * 0.025)
		draw_polygon(points, PackedColorArray([tint]), uv, Sheet.PAPER)
		var edge := points.duplicate()
		edge.append(points[0])
		draw_polyline(edge, Color(0.48, 0.36, 0.19, 0.38), 1.0, true)
		draw_line(page.position + Vector2(10, 1), Vector2(page.end.x - 10, page.position.y + 1), Color(1, 0.98, 0.88, 0.65), 1.0, true)
		draw_set_transform_matrix(Transform2D.IDENTITY)


func _page_outline(page: Rect2, tab: Rect2) -> PackedVector2Array:
	var x := page.position.x
	var y := page.position.y
	var right := page.end.x
	var bottom := page.end.y
	var radius := 5.0
	var result := PackedVector2Array()
	# Rounded paper corners, with the tab interrupting the left page edge.
	var corners := [Vector2(right - radius, y + radius), Vector2(right - radius, bottom - radius), Vector2(x + radius, bottom - radius)]
	for index in corners.size():
		var start := (index - 1) * PI / 2
		for step in 5:
			result.append(corners[index] + Vector2.from_angle(start + step * PI / 8) * radius)
	if tab.has_area():
		result.append(Vector2(x, tab.end.y))
		# Small round corners on the index projection; the join to the sheet is
		# continuous paper, with no separate button face pasted onto the edge.
		for step in 5:
			result.append(Vector2(tab.position.x + radius, tab.end.y - radius) + Vector2.from_angle(PI / 2 + step * PI / 8) * radius)
		for step in 5:
			result.append(Vector2(tab.position.x + radius, tab.position.y + radius) + Vector2.from_angle(PI + step * PI / 8) * radius)
		result.append(Vector2(x, tab.position.y))
	for step in 5:
		result.append(Vector2(x + radius, y + radius) + Vector2.from_angle(PI + step * PI / 8) * radius)
	return result
