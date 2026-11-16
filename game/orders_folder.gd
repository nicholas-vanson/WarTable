extends PanelContainer
## The approved folder artwork is the surface; controls are laid onto its paper.
const UI = preload("res://game/ui_style.gd")
const Sheet = preload("res://game/orders_style.gd")
var _paper: StyleBoxTexture

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
	draw_string(UI.DISPLAY, Vector2(size.x * 0.11, size.y * 0.05), "ORDERS", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, UI.INK)
