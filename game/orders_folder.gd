extends PanelContainer
## The approved folder artwork is the surface; controls are laid onto its paper.
const UI = preload("res://game/ui_style.gd")
var _paper: StyleBoxTexture

func _ready() -> void:
	_paper = UI.field_box(Color.WHITE, 27, 18)
	add_theme_stylebox_override("panel", _paper)
	resized.connect(_sync_paper)
	_sync_paper()

func _sync_paper() -> void:
	var compact := get_viewport_rect().size.y < 650 or OS.has_feature("mobile") or "--touch-layout" in OS.get_cmdline_user_args()
	_paper.content_margin_top = 48 if compact else 72
	_paper.content_margin_bottom = 18 if compact else 30
	queue_redraw()

func _draw() -> void:
	draw_string(UI.DISPLAY, Vector2(size.x * 0.13, size.y * 0.035), "ORDERS", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.INK)
