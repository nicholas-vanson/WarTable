extends RefCounted
## The orders document is the first material sample; other screens retain their skin.

const UI = preload("res://game/ui_style.gd")
const PAPER = preload("res://game/art/ui/orders-stationery.png")
const CONTROLS = preload("res://game/art/ui/orders-controls.png")
static var _textures := {}


static func _atlas(key: String, region: Rect2) -> AtlasTexture:
	if not _textures.has(key):
		var texture := AtlasTexture.new()
		texture.atlas = CONTROLS
		texture.region = region
		texture.filter_clip = true
		_textures[key] = texture
	return _textures[key]


static func counter() -> Texture2D:
	return _atlas("counter", Rect2(170, 176, 298, 302))


static func olive() -> Texture2D:
	return _atlas("olive", Rect2(658, 246, 566, 164))


static func tab() -> Texture2D:
	return _atlas("tab", Rect2(665, 806, 561, 259))


static func band() -> StyleBoxTexture:
	var texture := _atlas("band", Rect2(38, 857, 550, 187))
	return UI.texture_box(texture, 10, 9, Color(1, 1, 1, 0.64))


static func theme() -> Theme:
	var result := UI.field_theme()
	for kind in ["Button", "MenuButton", "OptionButton"]:
		for state in ["normal", "hover", "pressed", "disabled", "focus"]:
			var tint := Color.WHITE
			if state == "hover": tint = Color(1.04, 1.02, 0.97)
			if state == "pressed": tint = Color(0.86, 0.81, 0.71)
			if state == "disabled": tint = Color(0.9, 0.87, 0.8, 0.55)
			result.set_stylebox(state, kind, UI.texture_box(counter(), 7, 4, tint))
		result.set_color("font_disabled_color", kind, Color("#8a7a5e"))
		result.set_constant("outline_size", kind, 0)
	var vertical_rule := StyleBoxLine.new()
	vertical_rule.vertical = true
	vertical_rule.color = Color(0.35, 0.27, 0.14, 0.4)
	result.set_stylebox("separator", "VSeparator", vertical_rule)
	result.set_constant("separation", "VSeparator", 12)
	var rule := StyleBoxLine.new()
	rule.color = Color(0.35, 0.27, 0.14, 0.36)
	result.set_stylebox("separator", "HSeparator", rule)
	result.set_constant("separation", "HSeparator", 5)
	# ScrollBar width comes from its style's minimum size, not a width constant.
	result.set_stylebox("scroll", "VScrollBar", UI.texture_box(counter(), 4, 0, Color(1, 1, 1, 0.16)))
	for state in ["grabber", "grabber_highlight", "grabber_pressed"]:
		result.set_stylebox(state, "VScrollBar", UI.texture_box(olive(), 4, 8, Color(0.88, 0.83, 0.70)))
	return result


static func primary(button: Button) -> void:
	for state in ["normal", "hover", "pressed", "focus", "disabled"]:
		var tint := Color(1.1, 1.07, 1.0) if state == "hover" else Color.WHITE
		if state == "pressed": tint = Color(0.83, 0.8, 0.7)
		if state == "disabled": tint = Color(0.85, 0.84, 0.77, 0.65)
		button.add_theme_stylebox_override(state, UI.texture_box(olive(), 16, 10, tint))
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		button.add_theme_color_override(state, UI.TEXT)
	button.add_theme_font_override("font", UI.DISPLAY)


static func category(button: Button, active: bool) -> void:
	for state in ["normal", "hover", "pressed", "focus"]:
		var tint := Color.WHITE if active else Color(1, 1, 1, 0.5)
		if state == "hover": tint = Color(1.06, 1.03, 0.97)
		button.add_theme_stylebox_override(state, UI.texture_box(tab(), 10, 7, tint))
	button.add_theme_font_override("font", UI.DISPLAY if active else UI.BODY)
	button.add_theme_font_size_override("font_size", 14)
	button.tooltip_text = "Show %s units" % button.text.to_lower()
