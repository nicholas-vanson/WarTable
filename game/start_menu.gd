extends Control

signal local_requested(resume: bool)
signal host_requested(resume: bool)
signal join_requested(address: String, code: String)
signal cancel_requested
signal credits_requested
signal atlas_requested
signal global_requested

const UI = preload("res://game/ui_style.gd")
const BACKDROP = preload("res://game/art/map-room.png")

var _home: VBoxContainer
var _online: VBoxContainer
var _status: Label
var _address: LineEdit
var _code: LineEdit
var play_local: Button
var play_global: Button
var resume_local: Button
var multiplayer_button: Button
var host_game: Button
var resume_host: Button
var join_game: Button
var _back: Button
var _compact := false


func _ready() -> void:
	_compact = get_viewport_rect().size.y < 650 or OS.has_feature("mobile") or "--touch-layout" in OS.get_cmdline_user_args()
	theme = UI.field_theme()
	_build_background()
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 28 if _compact else 68)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_top", 16 if _compact else 24)
	margin.add_theme_constant_override("margin_bottom", 16 if _compact else 24)
	add_child(margin)
	var frame := HBoxContainer.new()
	margin.add_child(frame)
	var file := PanelContainer.new()
	file.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	file.custom_minimum_size.x = 366 if _compact else 420
	var paper := UI.field_box(Color.WHITE, 29, 24)
	paper.content_margin_top = 48 if _compact else 70
	paper.content_margin_bottom = 18 if _compact else 30
	file.add_theme_stylebox_override("panel", paper)
	frame.add_child(file)
	var column := VBoxContainer.new()
	column.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	column.add_theme_constant_override("separation", 6 if _compact else 12)
	file.add_child(column)
	_home = VBoxContainer.new()
	_home.add_theme_constant_override("separation", 7 if _compact else 10)
	column.add_child(_home)
	_build_home()
	_online = VBoxContainer.new()
	_online.add_theme_constant_override("separation", 6 if _compact else 9)
	column.add_child(_online)
	_build_multiplayer()
	_status = UI.label(column, "", 15, Color("#7c452d"), true)
	open_home()


func _build_background() -> void:
	var picture := TextureRect.new()
	picture.texture = BACKDROP
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	picture.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(picture)
	var shade := TextureRect.new()
	var ramp := Gradient.new()
	ramp.offsets = PackedFloat32Array([0, 0.32, 0.57, 1])
	ramp.colors = PackedColorArray([Color("#071019"), Color(0.04, 0.07, 0.10, 0.95), Color(0.04, 0.07, 0.10, 0.40), Color(0.04, 0.07, 0.10, 0.12)])
	var gradient := GradientTexture2D.new()
	gradient.gradient = ramp
	gradient.fill_to = Vector2(1, 0)
	gradient.width = 512
	gradient.height = 2
	shade.texture = gradient
	shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)


func _build_home() -> void:
	var title := UI.heading(_home, "CROSSROADS\nCOMMAND", 30 if _compact else 42, UI.INK)
	title.add_theme_constant_override("line_spacing", 0)
	UI.label(_home, "1940 strategy board", 16, Color("#736242"))
	var gap := Control.new()
	gap.custom_minimum_size.y = 6 if _compact else 12
	_home.add_child(gap)
	resume_local = _menu_button(_home, "Continue local game", func(): local_requested.emit(true))
	UI.primary(resume_local)
	play_global = _menu_button(_home, "Play Global 1940", func(): global_requested.emit())
	UI.primary(play_global)
	play_local = _menu_button(_home, "New Western Europe game", func(): local_requested.emit(false))
	multiplayer_button = _menu_button(_home, "Multiplayer", _open_multiplayer)
	_menu_button(_home, "Explore the 1940 world map", func(): atlas_requested.emit())
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 8)
	_home.add_child(footer)
	UI.button(footer, "Credits & licenses", func(): credits_requested.emit())
	UI.button(footer, "Quit game", func(): get_tree().quit())
	var version := String(ProjectSettings.get_setting("application/config/version"))
	UI.label(_home, "Version " + version, 13, Color("#736242"))


func _build_multiplayer() -> void:
	UI.heading(_online, "MULTIPLAYER", 30 if _compact else 36, UI.INK)
	UI.label(_online, "Play on the same Wi-Fi network.", 16, Color("#736242"))
	host_game = _menu_button(_online, "Host a new game as Germany", func(): host_requested.emit(false))
	resume_host = _menu_button(_online, "Resume hosted game", func(): host_requested.emit(true))
	_online.add_child(HSeparator.new())
	UI.label(_online, "Join as France", 17, UI.INK)
	_address = _line("Host IP address", "192.168.1.24", 45)
	_code = _line("Invite code", "8 characters", 8)
	_address.text_submitted.connect(func(_text: String): _code.grab_focus())
	_code.text_submitted.connect(func(_text: String): _join())
	join_game = _menu_button(_online, "Join game", _join)
	UI.primary(join_game)
	_back = UI.button(_online, "← Back", _return_from_multiplayer)


func present(local_save: bool, hosted_save: bool, joining: bool, message: String) -> void:
	resume_local.visible = local_save
	resume_host.visible = hosted_save
	for button in [join_game, host_game, resume_host]:
		button.disabled = joining
	_address.editable = not joining
	_code.editable = not joining
	_back.text = "Cancel connection" if joining else "← Back"
	set_status(message)


func set_status(message: String) -> void:
	_status.text = message
	_status.visible = not message.is_empty()


func open_home() -> void:
	_home.show()
	_online.hide()
	set_status("")


func _open_multiplayer() -> void:
	_home.hide()
	_online.show()
	set_status("")
	host_game.grab_focus()


func _return_from_multiplayer() -> void:
	if join_game.disabled:
		cancel_requested.emit()
	else:
		open_home()
		multiplayer_button.grab_focus()


func _unhandled_input(event: InputEvent) -> void:
	if is_visible_in_tree() and _online.visible and event.is_action_pressed("ui_cancel"):
		_return_from_multiplayer()
		get_viewport().set_input_as_handled()


func _join() -> void:
	if not join_game.disabled:
		join_requested.emit(_address.text.strip_edges(), _code.text.strip_edges())


func _line(title: String, placeholder: String, max_length: int) -> LineEdit:
	UI.label(_online, title, 14, Color("#736242"))
	var input := LineEdit.new()
	input.placeholder_text = placeholder
	input.max_length = max_length
	input.custom_minimum_size.y = 44
	_online.add_child(input)
	return input


func _menu_button(parent: Control, title: String, action: Callable) -> Button:
	var item := UI.button(parent, title, action)
	item.custom_minimum_size.y = 34 if _compact else 44
	UI.text_link(item)
	item.add_theme_font_size_override("font_size", 16 if _compact else 17)
	item.alignment = HORIZONTAL_ALIGNMENT_LEFT
	return item
