extends RefCounted
## Shared illustrated hardware for the field-stationery interface.
## Keep action names in native tooltips/accessibility, never baked into artwork.

const ATLAS = preload("res://game/art/ui/utility-icons.png")
# Square crops normalize the silhouettes without stretching the original art.
const REGIONS := {
	"tuck": Rect2(60, 65, 215, 215),
	"reopen": Rect2(369, 65, 215, 215),
	"expand": Rect2(667, 58, 225, 225),
	"restore": Rect2(970, 52, 235, 235),
	"add": Rect2(59, 374, 215, 215),
	"subtract": Rect2(364, 374, 215, 215),
	"zoom_in": Rect2(656, 358, 240, 240),
	"zoom_out": Rect2(970, 358, 240, 240),
	"back": Rect2(47, 682, 225, 225),
	"compass": Rect2(331, 642, 275, 275),
	"settings": Rect2(663, 667, 240, 240),
	"inspect": Rect2(972, 671, 240, 240),
	"discard": Rect2(61, 994, 205, 205),
	"confirm": Rect2(362, 988, 225, 225),
	"disclose": Rect2(684, 1014, 190, 190),
	"frame": Rect2(978, 983, 220, 220),
}
static var _textures := {}


static func icon(key: String) -> Texture2D:
	assert(REGIONS.has(key), "Missing illustrated control: " + key)
	if not _textures.has(key):
		var texture := AtlasTexture.new()
		texture.atlas = ATLAS
		texture.region = REGIONS[key]
		texture.filter_clip = true
		_textures[key] = texture
	return _textures[key]


static func apply(button: Button, key: String, description: String, pixels := 22) -> void:
	button.icon = icon(key)
	button.expand_icon = true
	button.add_theme_constant_override("icon_max_width", pixels)
	button.add_theme_constant_override("h_separation", 5)
	button.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	button.tooltip_text = description
	button.accessibility_name = description
	for state in ["normal", "hover", "pressed", "focus", "disabled"]:
		var tint := Color.WHITE
		if state == "hover": tint = Color(1.18, 1.13, 1.02)
		if state == "pressed": tint = Color(0.72, 0.66, 0.53)
		if state == "focus": tint = Color(1.18, 1.13, 1.02)
		if state == "disabled": tint = Color(0.72, 0.69, 0.62, 0.35)
		button.add_theme_color_override("icon_%s_color" % state, tint)
		# Small icon buttons retain their paper face with room for the artwork.
		if button.text.is_empty():
			var face := button.get_theme_stylebox(state).duplicate() as StyleBox
			face.content_margin_left = 4
			face.content_margin_right = 4
			face.content_margin_top = 4
			face.content_margin_bottom = 4
			button.add_theme_stylebox_override(state, face)
	# Registration corners make keyboard focus visible on paper and walnut.
	var focus := StyleBoxTexture.new()
	focus.texture = icon("frame")
	focus.modulate_color = Color(1.35, 1.2, 0.88, 0.8)
	focus.content_margin_left = 4
	focus.content_margin_right = 4
	focus.content_margin_top = 4
	focus.content_margin_bottom = 4
	button.add_theme_stylebox_override("focus", focus)
	# expand_icon excludes art from Button's minimum-size calculation. Reserve
	# its width beside real text so the label cannot squeeze it down to a sliver.
	if not button.text.is_empty():
		button.custom_minimum_size.x = maxf(button.custom_minimum_size.x,
			button.get_minimum_size().x + pixels + 5)
