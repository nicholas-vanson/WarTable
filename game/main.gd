extends Control

const Battle = preload("res://game/battle.gd")
const Turn = preload("res://game/turn.gd")
const Scenario = preload("res://game/scenario.gd")
const Session = preload("res://game/session.gd")
const Board = preload("res://game/board.gd")
const BoardDice = preload("res://game/board_dice.gd")
const UI = preload("res://game/ui_style.gd")
const StartMenu = preload("res://game/start_menu.gd")
const AtlasScreen = preload("res://game/atlas_screen.gd")
const GlobalScreen = preload("res://game/global_screen.gd")
const TEXT := UI.TEXT
const MUTED := UI.MUTED
const GOLD := UI.GOLD
const TEAL := UI.TEAL
const PANEL := UI.PANEL
const BORDER := UI.BORDER
const PHASE_NAMES := ["Purchase", "Combat move", "Conduct combat", "Noncombat move", "Mobilize", "Income"]

var _session: Node
var _root: VBoxContainer
var _sidebar_scroll: ScrollContainer
var _menu: StartMenu
var _atlas: AtlasScreen
var _global: GlobalScreen
var _compact := OS.has_feature("mobile") or "--touch-layout" in OS.get_cmdline_user_args()
var _workspace: HBoxContainer
var _drawer: Control
var _drawer_animation: Tween
var _drawer_open := false
var _combat_drawer := false
var _drawer_close: Button
var _drawer_header: HBoxContainer
var _battle_title: Label
var _battle_log: Button
var _turn_metrics: HBoxContainer
var _phase_status: Label
var _field: VBoxContainer
var _connection: HBoxContainer
var _network: Label
var _copy: Button
var _turn_label: Label
var _wallet_values: Array[Label] = []
var _objectives: VBoxContainer
var _objective_buttons := {}
var _phase_cells: Array[PanelContainer] = []
var _phase_labels: Array[Label] = []
var _summary_values: Array[Label] = []
var _purchase_values: Array[Label] = []
var _board: Board
var _map_label: Label
var _zoom_label: Button
var _dice: BoardDice
var _rail: PanelContainer
var _toggle_orders: Button
var _quick_action: Button
var _focus_battle: Button
var _skip_dialog: ConfirmationDialog
var _orders: VBoxContainer
var _actions: VBoxContainer
var _tabs: TabContainer
var _log: RichTextLabel
var _notice: Label
var _draft := [0, 0, 0]
var _draft_labels: Array[Label] = []
var _minus: Array[Button] = []
var _plus: Array[Button] = []
var _apply_button: Button
var _draft_caption: Label
var _limits: Array
var _limit_total: int
var _choice := ""
var _route_picker: OptionButton
var _routes: Array
var _route: Dictionary = {}
var _plans: Array = []
var _placements := {}
var _factory_buttons := {}
var _placement_status: Label
var _placement_available: Array[Label] = []
var _mobilize_button: Button
var _battle_loss_buttons: Array[Dictionary] = []
var _board_view := {}
var _last_revision := -1
var _last_phase := -1
var _last_actor := -1
var _finish_move_button: Button
var _region := ""
var _origin := ""


func _ready() -> void:
	theme = UI.make_theme()
	if _compact:
		get_window().content_scale_size = Vector2i(960, 540)
		theme.default_font_size = 17
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 8 if _compact else (18 if side in ["left", "right"] else 14))
	add_child(margin)
	_root = VBoxContainer.new()
	_root.add_theme_constant_override("separation", 5 if _compact else 10)
	margin.add_child(_root)
	_build_header()
	_build_phase_bar()
	_build_workspace()
	_menu = StartMenu.new()
	_menu.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_menu)
	_session = Session.new()
	_session.name = "Session"
	add_child(_session)
	_menu.local_requested.connect(_start_local)
	_menu.host_requested.connect(_host_game)
	_menu.join_requested.connect(_join_game)
	_menu.cancel_requested.connect(func(): _session.leave())
	_menu.credits_requested.connect(_show_licenses)
	_menu.atlas_requested.connect(_open_atlas)
	_menu.global_requested.connect(_open_global)
	_session.changed.connect(_render)
	_session.refused.connect(_show_notice)
	_render()


func _open_global() -> void:
	if not is_instance_valid(_global):
		_global = GlobalScreen.new()
		_global.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		add_child(_global)
		_global.closed.connect(_menu.show)
	_menu.hide()
	_global.open_campaign()


func _open_atlas() -> void:
	if not is_instance_valid(_atlas):
		_atlas = AtlasScreen.new()
		_atlas.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		add_child(_atlas)
		_atlas.closed.connect(func():
			_menu.visible = _session.view.is_empty()
			_root.visible = not _session.view.is_empty()
		)
		_atlas.sector_requested.connect(_focus_objective)
	_menu.hide()
	_root.hide()
	_atlas.open(_session.view)


func _build_header() -> void:
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 12)
	_root.add_child(header)
	var back := UI.button(header, "‹ Menu" if _compact else "← Main menu", _confirm_leave)
	if _compact:
		back.custom_minimum_size.y = 46
	back.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var title := VBoxContainer.new()
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	UI.heading(title, "Western Europe", 25 if _compact else 29)
	_turn_label = UI.label(title, "", 16 if _compact else 14, MUTED)
	UI.button(header, "World map", _open_atlas).custom_minimum_size.y = 44 if _compact else 35
	_objectives = VBoxContainer.new()
	_objectives.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_objectives.add_theme_constant_override("separation", 2)
	header.add_child(_objectives)
	if not _compact:
		var cities := UI.label(_objectives, "Victory cities", 12, MUTED)
		cities.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var badges := HBoxContainer.new()
	badges.add_theme_constant_override("separation", 6)
	_objectives.add_child(badges)
	for zone in Scenario.OBJECTIVES:
		var city := UI.button(badges, "★  " + Scenario.OBJECTIVES[zone], _focus_objective.bind(zone))
		_objective_buttons[zone] = city
	for seat in Scenario.SIDES.size():
		var wallet := PanelContainer.new()
		wallet.custom_minimum_size.x = 91 if _compact else 128
		wallet.add_theme_stylebox_override("panel", UI.box(PANEL, BORDER, 12, 6))
		header.add_child(wallet)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		wallet.add_child(row)
		var strip := ColorRect.new()
		strip.color = _country_color(seat)
		strip.custom_minimum_size.x = 3
		row.add_child(strip)
		var detail := VBoxContainer.new()
		detail.add_theme_constant_override("separation", 1)
		row.add_child(detail)
		UI.label(detail, Scenario.SIDES[seat], 13, _country_color(seat))
		_wallet_values.append(UI.label(detail, "", 17, TEXT))


func _build_phase_bar() -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	_root.add_child(row)
	if _compact:
		_phase_status = UI.label(row, "", 17, GOLD)
		_phase_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_phase_status.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	for phase in PHASE_NAMES.size():
		var cell := PanelContainer.new()
		cell.size_flags_horizontal = Control.SIZE_SHRINK_END if _compact else Control.SIZE_EXPAND_FILL
		if _compact:
			cell.custom_minimum_size.x = 33
			cell.tooltip_text = PHASE_NAMES[phase]
		row.add_child(cell)
		_phase_cells.append(cell)
		var label := UI.label(cell, PHASE_NAMES[phase], 14, MUTED)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_phase_labels.append(label)


func _render_phase_bar(phase: int, seat: int) -> void:
	var accent := _country_color(seat)
	if _compact:
		_phase_status.text = PHASE_NAMES[phase] if phase < PHASE_NAMES.size() else "Match complete"
		_phase_status.add_theme_color_override("font_color", accent)
	for i in _phase_cells.size():
		var current := i == phase
		var fill := accent if current else PANEL
		_phase_cells[i].add_theme_stylebox_override("panel", UI.box(fill, accent if current else BORDER, 7, 3 if _compact else 9, 6))
		var marker := "✓" if i < phase else str(i + 1)
		_phase_labels[i].text = marker if _compact else "%s   %s" % [marker, PHASE_NAMES[i]]
		_phase_labels[i].add_theme_color_override("font_color", UI.DARK if current else (TEXT if i < phase else MUTED))


func _build_workspace() -> void:
	var workspace := HBoxContainer.new()
	_workspace = workspace
	workspace.add_theme_constant_override("separation", 12)
	workspace.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_root.add_child(workspace)
	var chart := VBoxContainer.new()
	chart.add_theme_constant_override("separation", 6)
	chart.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	workspace.add_child(chart)
	var frame := PanelContainer.new()
	frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	frame.add_theme_stylebox_override("panel", UI.box(PANEL, BORDER, 1, 1, 6))
	chart.add_child(frame)
	_board = Board.new()
	_board.touch_layout = _compact
	_board.territory_pressed.connect(_choose_territory)
	_board.stack_pressed.connect(_choose_stack)
	frame.add_child(_board)
	_dice = BoardDice.new()
	_dice.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dice.settled.connect(_render)
	_dice.firing_group_changed.connect(func(): _render_orders(_board_view))
	_board.add_child(_dice)
	_board.projection_changed.connect(_dice.reposition)
	_drawer = Control.new()
	_drawer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_drawer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_board.add_child(_drawer)
	_drawer.resized.connect(_layout_drawer)
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 6)
	chart.add_child(footer)
	_map_label = UI.label(footer, "", 16 if _compact else 14, TEXT)
	_map_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_map_label.custom_minimum_size.y = 35
	_map_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_map_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_focus_battle = UI.button(footer, "Focus battle", func(): _board.focus_zone(_board_view.active_zone))
	_focus_battle.hide()
	var zoom_out := UI.button(footer, "−", func(): _board.zoom_by(1.0 / 1.22))
	zoom_out.tooltip_text = "Zoom out"
	_zoom_label = UI.button(footer, "100%", _board.reset_camera)
	_zoom_label.tooltip_text = "Fit map"
	var zoom_in := UI.button(footer, "+", func(): _board.zoom_by(1.22))
	zoom_in.tooltip_text = "Zoom in"
	_board.camera_changed.connect(func(percent: int): _zoom_label.text = "%d%%" % percent)
	_toggle_orders = UI.button(footer, "Hide orders", _toggle_orders_panel)
	_quick_action = UI.button(footer, "", _use_quick_action)
	_quick_action.hide()
	_build_field(workspace)
	if _compact:
		for button in [zoom_out, zoom_in, _zoom_label, _toggle_orders, _quick_action, _focus_battle]:
			button.custom_minimum_size.y = 46
		_board.resized.connect(func():
			if _last_revision == 0:
				_board.reset_camera()
		)


func _toggle_orders_panel() -> void:
	_set_orders_visible(not _drawer_open, true)
	_refresh_quick_action()


func _set_orders_visible(open: bool, animate := false) -> void:
	_drawer_open = open
	_toggle_orders.text = "Hide orders" if open else "Orders"
	if is_instance_valid(_drawer_animation):
		_drawer_animation.kill()
	if _rail.get_parent() != _drawer or not animate:
		_rail.visible = open
		_layout_drawer()
		return
	_layout_drawer()
	var end := _rail.position.x
	if open:
		_rail.position.x = _drawer.size.x
		_rail.show()
	else:
		end = _drawer.size.x
	_drawer_animation = create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_drawer_animation.tween_property(_rail, "position:x", end, 0.19)
	if not open:
		_drawer_animation.tween_callback(_rail.hide)


func _layout_drawer() -> void:
	if not is_instance_valid(_rail) or _rail.get_parent() != _drawer:
		return
	var width := minf(395.0 if _compact else 367.0, _drawer.size.x - 16.0)
	_rail.size = Vector2(width, maxf(0.0, _drawer.size.y - 16.0))
	_rail.position = Vector2(_drawer.size.x - width - 8.0, 8.0)
	_update_dice_table()


func _use_drawer(combat: bool) -> void:
	_combat_drawer = combat
	var parent: Control = _drawer if _compact or combat else _workspace
	if _rail.get_parent() != parent:
		_rail.reparent(parent, false)
	_drawer_header.visible = parent == _drawer
	_layout_drawer()


func _update_dice_table() -> void:
	if not is_instance_valid(_dice):
		return
	var right := _rail.position.x if _combat_drawer and _drawer_open else _drawer.size.x
	var width := maxf(0.0, right - 32.0)
	var height := minf(_drawer.size.y * 0.53, 232.0)
	var table := Rect2(Vector2(16, maxf(7.0, _drawer.size.y - height - 17.0)), Vector2(width, height))
	_dice.set_table(table)


func _quick_target() -> Button:
	if _drawer_open or not _can_order():
		return null
	match int(_session.view.phase):
		Turn.Phase.COMBAT_MOVE, Turn.Phase.NONCOMBAT:
			if not _route.is_empty():
				return _apply_button
			if not _plans.is_empty():
				return _finish_move_button
		Turn.Phase.COMBAT:
			if is_instance_valid(_apply_button):
				return _apply_button
			if _actions.get_child_count() > 0:
				return _actions.get_child(0) as Button
		Turn.Phase.MOBILIZE:
			return _mobilize_button
	return null


func _refresh_quick_action() -> void:
	var target := _quick_target()
	_quick_action.visible = is_instance_valid(target)
	if _quick_action.visible:
		_quick_action.text = target.text
		_quick_action.disabled = target.disabled
		UI.primary(_quick_action, _country_color(_session.view.actor))


func _use_quick_action() -> void:
	var target := _quick_target()
	if is_instance_valid(target) and not target.disabled:
		target.pressed.emit()


func _build_field(workspace: Control) -> void:
	_rail = PanelContainer.new()
	_rail.custom_minimum_size.x = 340
	_rail.add_theme_stylebox_override("panel", UI.box(PANEL, BORDER, 12, 10))
	workspace.add_child(_rail)
	_field = VBoxContainer.new()
	_field.add_theme_constant_override("separation", 9)
	_rail.add_child(_field)
	_drawer_header = HBoxContainer.new()
	_field.add_child(_drawer_header)
	_drawer_header.hide()
	_battle_title = UI.heading(_drawer_header, "", 22)
	_battle_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_battle_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_battle_title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_battle_log = UI.button(_drawer_header, "Log", _toggle_battle_log)
	_drawer_close = UI.button(_drawer_header, "Close orders", _toggle_orders_panel)
	_drawer_close.tooltip_text = "Close orders and return to the map"
	for button in [_battle_log, _drawer_close]:
		button.custom_minimum_size = Vector2(42, 38)
		button.add_theme_stylebox_override("normal", UI.box(UI.SURFACE, BORDER, 9, 4))
	_connection = HBoxContainer.new()
	_field.add_child(_connection)
	_network = UI.label(_connection, "", 13, MUTED, true)
	_network.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_copy = UI.button(_connection, "Copy invite", _copy_invite)
	_tabs = TabContainer.new()
	_tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_field.add_child(_tabs)
	var work := VBoxContainer.new()
	work.name = "Orders"
	work.add_theme_constant_override("separation", 9)
	_tabs.add_child(work)
	var metrics := HBoxContainer.new()
	_turn_metrics = metrics
	metrics.add_theme_constant_override("separation", 6)
	work.add_child(metrics)
	_summary_values.append(_metric(metrics, "Spent this turn", GOLD))
	_summary_values.append(_metric(metrics, "Units committed", TEXT))
	_summary_values.append(_metric(metrics, "Units to place", TEAL))
	_sidebar_scroll = ScrollContainer.new()
	_sidebar_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_sidebar_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_sidebar_scroll.follow_focus = true
	work.add_child(_sidebar_scroll)
	_orders = VBoxContainer.new()
	_orders.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_orders.add_theme_constant_override("separation", 8)
	_sidebar_scroll.add_child(_orders)
	_actions = VBoxContainer.new()
	_actions.add_theme_constant_override("separation", 6)
	work.add_child(_actions)
	_log = RichTextLabel.new()
	_log.name = "Turn log"
	_log.scroll_following = true
	_log.selection_enabled = true
	_log.add_theme_color_override("default_color", TEXT)
	_log.add_theme_font_size_override("normal_font_size", 14)
	_log.add_theme_stylebox_override("normal", UI.box(UI.DARK, BORDER, 10, 9))
	_tabs.add_child(_log)
	_notice = UI.label(_field, "", 14, GOLD, true)
	_notice.hide()


func _toggle_battle_log() -> void:
	_tabs.current_tab = 1 - _tabs.current_tab
	_battle_log.text = "Units" if _tabs.current_tab == 1 else "Log"


func _metric(parent: Control, title: String, color: Color) -> Label:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", UI.box(UI.DARK, BORDER, 8, 6, 6))
	parent.add_child(panel)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 1)
	panel.add_child(content)
	UI.label(content, title, 12, MUTED)
	return UI.heading(content, "0", 22, color)


func _country_color(seat: int) -> Color:
	return GOLD if seat == 0 else TEAL


func _zone_name(zone: String) -> String:
	return Scenario.name_of(zone, _board_view.get("expanded", true))


func _focus_objective(zone: String) -> void:
	_choose_territory(zone)
	_board.focus_zone(zone)


func _render_objectives(view: Dictionary) -> void:
	_objectives.visible = view.expanded
	if not view.expanded:
		return
	for zone in _objective_buttons:
		var owner: int = view.regions[zone].owner
		var color := _country_color(owner)
		var button: Button = _objective_buttons[zone]
		button.add_theme_stylebox_override("normal", UI.box(PANEL, Color(color, 0.65), 12, 7, 5))
		button.add_theme_color_override("font_color", color)
		button.tooltip_text = "%s controls %s. Hold both cities when collecting income to win." % [Scenario.SIDES[owner], Scenario.OBJECTIVES[zone]]


func _start_local(resume: bool) -> void:
	var reason: String = _session.start_hotseat(resume)
	if not reason.is_empty():
		_menu.set_status(reason)


func _host_game(resume: bool) -> void:
	var reason: String = _session.host(Session.PORT, "*", resume)
	if not reason.is_empty():
		_menu.set_status(reason)


func _join_game(address: String, code: String) -> void:
	var reason: String = _session.join(address, code)
	if not reason.is_empty():
		_menu.set_status(reason)


func _confirm_leave() -> void:
	if _session.mode != Session.Mode.HOST:
		_session.leave()
		return
	var dialog := ConfirmationDialog.new()
	dialog.theme = UI.field_theme()
	dialog.title = "Close the hosted game?"
	dialog.dialog_text = "France will disconnect. You can resume from the last autosave."
	dialog.ok_button_text = "Close game"
	dialog.confirmed.connect(func(): _session.leave())
	dialog.confirmed.connect(dialog.queue_free)
	dialog.canceled.connect(dialog.queue_free)
	add_child(dialog)
	dialog.popup_centered()


func _show_licenses() -> void:
	var sections := PackedStringArray(["Godot Engine", Engine.get_license_text()])
	sections.append("Global terrain: IHO–IOC GEBCO_08-derived elevation. Adapted to the playable board; heights are exaggerated visual relief. https://www.gebco.net/\nFull provenance: game/art/terrain/SOURCES.md\nTabletop wood and ground materials: ambientCG Wood049 and Ground030, CC0. https://ambientcg.com/")
	sections.append("Satellite surface: Blue Marble imagery (NASA), from the three-globe example texture. Adapted to the game board; not a historical 1940 photograph.\n" + FileAccess.get_file_as_string("res://game/art/terrain/BLUE-MARBLE-LICENSE.txt"))
	for component in Engine.get_copyright_info():
		sections.append(component.name)
		for part in component.parts:
			sections.append("%s\nLicense: %s" % ["\n".join(part.copyright), part.license])
	var licenses := Engine.get_license_info()
	for license_name in licenses:
		sections.append("%s\n%s" % [license_name, licenses[license_name]])
	for font in ["Inter", "BarlowCondensed", "OldStandardTT"]:
		sections.append(FileAccess.get_file_as_string("res://game/fonts/%s-OFL.txt" % font))
	var dialog := AcceptDialog.new()
	dialog.theme = UI.field_theme()
	dialog.title = "Engine and third-party licenses"
	var content := RichTextLabel.new()
	content.text = "\n\n".join(sections)
	content.add_theme_color_override("default_color", UI.INK)
	content.selection_enabled = true
	dialog.add_child(content)
	dialog.confirmed.connect(dialog.queue_free)
	dialog.canceled.connect(dialog.queue_free)
	add_child(dialog)
	dialog.popup_centered_ratio(0.75)


func _render() -> void:
	var view: Dictionary = _session.view
	var atlas_visible := is_instance_valid(_atlas) and _atlas.visible
	if atlas_visible:
		_atlas.update_sector(view)
	_menu.visible = view.is_empty() and not atlas_visible
	_root.visible = not view.is_empty() and not atlas_visible
	if view.is_empty():
		if _last_revision >= 0:
			_menu.open_home()
		_last_revision = -1
		_last_phase = -1
		_last_actor = -1
		_region = ""
		_origin = ""
		_plans.clear()
		_placements.clear()
		_board_view = {}
		_use_drawer(false)
		_reset_draft()
		_dice.display({}, false)
		if is_instance_valid(_skip_dialog):
			_skip_dialog.queue_free()
		_board.display({}, {})
		_menu.present(_session.has_save(Session.Mode.HOTSEAT), _session.has_save(Session.Mode.HOST),
			_session.mode == Session.Mode.JOINING, _session.status)
		return
	if _last_revision < 0:
		_board.reset_camera()
		_set_orders_visible(true)
	var roll: Dictionary = view.last_roll.duplicate()
	if not roll.is_empty():
		roll.location = _zone_name(roll.zone)
	_dice.display(roll, _last_revision >= 0 and roll.get("revision") == view.revision)
	# A defensive volley can finish the battle. Show the firing line until its dice settle.
	if _dice.rolling and view.last_roll.revision == view.revision and not view.last_roll.attacking and not _board_view.get("combat", {}).is_empty():
		view = _board_view
	else:
		_board_view = view
	if view.phase != _last_phase or view.actor != _last_actor:
		_tabs.current_tab = 0
		if view.phase != _last_phase:
			_use_drawer(view.phase == Turn.Phase.COMBAT or not view.last_roll.is_empty())
			if _compact or view.phase == Turn.Phase.COMBAT:
				_set_orders_visible(not _is_movement(view.phase) or _combat_drawer)
		elif _compact and view.phase == Turn.Phase.COMBAT and _session.controls_active():
			_set_orders_visible(true)
		_last_phase = view.phase
		_last_actor = view.actor
	if view.revision != _last_revision:
		_plans.clear()
		_placements.clear()
		_origin = ""
		_reset_draft()
		_last_revision = view.revision
		_show_notice("")
		_log.text = "\n\n".join(view.log)
		_sidebar_scroll.scroll_vertical = 0
		if not view.active_zone.is_empty():
			_region = view.active_zone
	_copy.visible = _session.mode == Session.Mode.HOST
	_connection.visible = _session.mode != Session.Mode.HOTSEAT
	_network.text = _session.status
	if _copy.visible:
		_network.text += "\nHost %s  ·  Invite %s" % [_local_addresses(), _session.invite]
	_turn_label.text = "Round %d  ·  %s’s turn" % [view.round, Scenario.SIDES[view.seat]] if view.winner < 0 else "%s wins · Round %d" % [Scenario.SIDES[view.winner], view.round]
	_turn_label.add_theme_color_override("font_color", _country_color(view.seat))
	_render_objectives(view)
	for seat in _wallet_values.size():
		_wallet_values[seat].text = "%d IPC" % view.treasury[seat]
	_render_phase_bar(view.phase, view.seat)
	_summary_values[0].text = "%d IPC" % view.spent
	_summary_values[1].text = str(Battle.total(view.combat_committed))
	_summary_values[1].tooltip_text = _unit_summary(view.combat_committed)
	_summary_values[2].text = str(Battle.total(view.reinforcements))
	_summary_values[2].tooltip_text = _unit_summary(view.reinforcements)
	_render_orders(view)
	_refresh_board()


func _can_order() -> bool:
	return _session.controls_active() and not _dice.rolling


func _refresh_board() -> void:
	var view := _board_view
	_refresh_quick_action()
	var overlay := {"selected": _region, "origin": _origin, "legal": [], "draft": _draft}
	if not view.is_empty() and _can_order():
		match int(view.phase):
			Turn.Phase.COMBAT_MOVE, Turn.Phase.NONCOMBAT:
				overlay.plans = _plans
				overlay.route = _route
				overlay.draft_seat = view.seat
				for route in _routes:
					if not route.to in overlay.legal:
						overlay.legal.append(route.to)
			Turn.Phase.COMBAT:
				if view.combat.is_empty():
					overlay.legal = view.battles.keys()
				elif _choice == "losses":
					overlay.origin = view.active_zone
					overlay.draft_seat = view.actor
					overlay.casualties = true
			Turn.Phase.MOBILIZE:
				overlay.placements = _placements
				if Battle.total(view.reinforcements) > 0:
					for zone in view.capacity:
						if view.capacity[zone] > 0:
							overlay.legal.append(zone)
	_board.display(view, overlay)
	if not view.is_empty() and _is_movement(view.phase) and not _route.is_empty():
		_map_label.text = "%s → %s · %s selected" % [_zone_name(_origin), _zone_name(_route.to), _unit_quantity(Battle.total(_draft))]
		return
	if not view.is_empty() and _is_movement(view.phase) and not _origin.is_empty() and Battle.total(_draft) > 0:
		_map_label.text = "%s · %s selected" % [_zone_name(_origin), _unit_quantity(Battle.total(_draft))]
		return
	if _region.is_empty():
		_map_label.text = "Select a territory or unit stack to inspect it."
		return
	var regions: Dictionary = view.get("regions", Scenario.LAND)
	var region: Dictionary = regions.get(_region, {})
	if not view.is_empty() and view.phase == Turn.Phase.MOBILIZE and view.capacity.get(_region, 0) > 0:
		_map_label.text = "%s · %d/%d planned" % [
			_zone_name(_region), Battle.total(_placements.get(_region, Scenario.EMPTY)), view.capacity[_region]]
		return
	var detail := "Map context"
	if not region.is_empty():
		detail = "%s · %d IPC" % [Scenario.SIDES[region.owner], region.ipc]
		if region.factory > 0:
			detail += " · Factory"
		if view.get("battles", {}).has(_region):
			detail = "Battle pending" if view.active_zone != _region else "Battle · Round %d" % view.combat.round
	_map_label.text = "%s  /  %s" % [_board.region_name(_region), detail]


func _choose_territory(zone: String) -> void:
	var changed_region := _region != zone
	_region = zone
	if not _can_order():
		_refresh_board()
		return
	var view: Dictionary = _session.view
	if _is_movement(view.phase):
		var candidate := {}
		for route in _routes:
			if route.to == zone:
				if candidate.is_empty() or route.via.is_empty():
					candidate = route
		if not candidate.is_empty():
			_select_route(candidate)
			return
		if Battle.total(_draft) == 0 and Battle.total(Turn.remaining(view, zone, _plans)) > 0:
			_select_origin(zone)
			return
		if Battle.total(_draft) > 0 and view.regions.has(zone):
			_show_notice("Choose a highlighted destination or clear the selected units.")
	elif view.phase == Turn.Phase.MOBILIZE and changed_region:
		_reset_draft()
		_draft = _placements.get(zone, Scenario.EMPTY).duplicate()
		_render_orders(view)
	elif view.phase == Turn.Phase.COMBAT and view.combat.is_empty() and changed_region:
		_render_orders(view)
	_refresh_board()


func _choose_stack(zone: String, seat: int, unit: int) -> void:
	if not _can_order() or seat != _session.view.actor:
		_choose_territory(zone)
		return
	var view: Dictionary = _session.view
	if _is_movement(view.phase):
		if _origin != zone:
			if Battle.total(Turn.remaining(view, zone, _plans)) == 0:
				_choose_territory(zone)
				return
			_select_origin(zone)
		if _choice == "queue":
			_adjust(unit, 1)
	elif _choice == "losses" and zone == view.active_zone:
		_adjust(unit, 1)
	else:
		_choose_territory(zone)


func _select_origin(zone: String) -> void:
	if _session.view.phase == Turn.Phase.NONCOMBAT:
		_dice.hide()
		if _combat_drawer:
			_use_drawer(false)
	_region = zone
	_origin = zone
	_reset_draft()
	_show_notice("")
	_render_orders(_session.view)
	_refresh_board()


func _reset_draft() -> void:
	_draft = Scenario.EMPTY.duplicate()
	_route = {}
	_routes = []


func _is_movement(phase: int) -> bool:
	return phase == Turn.Phase.COMBAT_MOVE or phase == Turn.Phase.NONCOMBAT


func _render_orders(view: Dictionary) -> void:
	_clear(_orders)
	_clear(_actions)
	_battle_loss_buttons.clear()
	_factory_buttons.clear()
	_placement_available.clear()
	_mobilize_button = null
	_choice = ""
	_purchase_values.clear()
	_route_picker = null
	_apply_button = null
	_draft_caption = null
	_finish_move_button = null
	var titles := ["Buy reinforcements", "Plan attacks", "Resolve battles", "Redeploy units", "Place reinforcements", "Collect income"]
	var color := _country_color(view.actor)
	_focus_battle.visible = not view.active_zone.is_empty()
	_turn_metrics.visible = view.phase != Turn.Phase.COMBAT
	_orders.add_theme_constant_override("separation", 4 if _compact and view.phase == Turn.Phase.COMBAT else 8)
	var battle: bool = view.phase == Turn.Phase.COMBAT
	_tabs.tabs_visible = not battle
	_battle_log.visible = battle
	_battle_title.visible = battle
	_battle_log.text = "Units" if _tabs.current_tab == 1 else "Log"
	_drawer_close.text = "×" if battle else "Close orders"
	_drawer_close.tooltip_text = "Collapse battle overlay" if battle else "Close orders and return to the map"
	if view.phase == Turn.Phase.COMPLETE:
		var winner := _country_color(view.winner)
		UI.heading(_orders, "%s wins" % Scenario.SIDES[view.winner], 31, winner)
		UI.label(_orders, "Held Paris and Berlin at the end of the turn.", 15, TEXT, true)
		UI.primary(UI.button(_actions, "Return to main menu", func(): _session.leave()), winner)
		return
	if view.phase == Turn.Phase.COMBAT:
		_render_combat(view)
		return
	UI.heading(_orders, titles[view.phase], 29)
	if not _can_order():
		var waiting := "Waiting for %s." % Scenario.SIDES[view.actor]
		if _dice.rolling:
			waiting = "Resolving the dice…"
		elif _session.awaiting_response:
			waiting = "Sending your order…"
		elif _session.mode == Session.Mode.HOST and view.actor == 0:
			waiting = "Share the host address and invite to begin or resume."
		UI.label(_orders, waiting, 16, color, true)
		return
	match int(view.phase):
		Turn.Phase.PURCHASE:
			var capacity := Battle.total(view.capacity.values())
			var finances := HBoxContainer.new()
			finances.add_theme_constant_override("separation", 6)
			_orders.add_child(finances)
			_purchase_values.append(_metric(finances, "Treasury", TEXT))
			_purchase_values.append(_metric(finances, "Draft cost", GOLD))
			_purchase_values.append(_metric(finances, "After purchase", TEAL))
			UI.label(_orders, "%d factory slots this turn" % capacity, 14, MUTED)
			_choices([capacity, capacity, capacity], capacity, "purchase", "Skip purchases")
			if view.expanded and view.revision == 0:
				UI.label(_orders, "Hold Paris and Berlin when you collect income to win.", 13, MUTED, true)
		Turn.Phase.COMBAT_MOVE, Turn.Phase.NONCOMBAT:
			_render_movement(view)
		Turn.Phase.MOBILIZE:
			_render_mobilize(view)
		Turn.Phase.INCOME:
			var income := Turn.income_for(view.regions, view.seat)
			UI.label(_orders, "Territory production", 14, MUTED)
			for zone in view.regions:
				if view.regions[zone].owner == view.seat:
					var item := HBoxContainer.new()
					_orders.add_child(item)
					UI.label(item, _zone_name(zone), 15, TEXT).size_flags_horizontal = Control.SIZE_EXPAND_FILL
					UI.label(item, "+%d IPC" % view.regions[zone].ipc, 15, color)
			_orders.add_child(HSeparator.new())
			UI.label(_orders, "Treasury after collection  ·  %d IPC" % (view.treasury[view.seat] + income), 15, TEXT)
			var wins: bool = view.expanded and view.regions.north_france.owner == view.seat and view.regions.central_europe.owner == view.seat
			var action := "Collect %d IPC & claim victory" if wins else "Collect %d IPC & end turn"
			UI.primary(UI.button(_actions, action % income, func(): _session.act("collect")), color)


func _render_movement(view: Dictionary) -> void:
	var combat: bool = view.phase == Turn.Phase.COMBAT_MOVE
	var guidance := "Select a friendly stack, then choose a highlighted destination."
	if combat and not _origin.is_empty():
		guidance = "Queue each attack before committing. Tanks can blitz empty enemy land."
	elif not combat and not _origin.is_empty():
		guidance = "Move unused units through friendly territory."
	UI.label(_orders, guidance, 14, MUTED, true)
	var available := Turn.remaining(view, _origin, _plans)
	if Battle.total(available) > 0:
		UI.label(_orders, _zone_name(_origin), 17, TEXT)
		_choices(available, Battle.total(available), "queue", "Queue move")
	var queued_units := 0
	for plan in _plans:
		queued_units += Battle.total(plan.counts)
	UI.label(_orders, "Queued orders  ·  %s" % _unit_quantity(queued_units), 15, TEXT)
	for index in _plans.size():
		_render_move_card(_plans[index], index)
	var finish := "Commit " + _unit_quantity(queued_units) if combat else "Redeploy " + _unit_quantity(queued_units)
	if queued_units == 0:
		finish = "Skip combat moves" if combat else "Skip noncombat moves"
	_finish_move_button = UI.button(_actions, finish, _finish_moves)
	if queued_units > 0:
		UI.primary(_finish_move_button, _country_color(view.actor))
	_refresh_finish_button()


func _render_move_card(plan: Dictionary, index: int) -> void:
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", UI.box(UI.DARK, BORDER, 9, 7, 6))
	_orders.add_child(card)
	var row := HBoxContainer.new()
	card.add_child(row)
	var detail := VBoxContainer.new()
	detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(detail)
	UI.label(detail, "%s → %s" % [_zone_name(plan.from), _zone_name(plan.to)], 14, TEXT, true)
	var caption := _unit_summary(plan.counts)
	if not plan.via.is_empty():
		caption += " · via " + _zone_name(plan.via)
	UI.label(detail, caption, 13, MUTED, true)
	var remove := UI.button(row, "×", _remove_move.bind(index))
	remove.tooltip_text = "Remove this queued move"
	remove.size_flags_vertical = Control.SIZE_SHRINK_CENTER


func _unit_summary(counts: Array) -> String:
	var parts := PackedStringArray()
	for unit in counts.size():
		var count: int = counts[unit]
		if count > 0:
			var name: String = Battle.UNITS[unit].to_lower()
			if unit == 2 and count != 1:
				name += "s"
			parts.append("%d %s" % [count, name])
	return " · ".join(parts) if not parts.is_empty() else "No units"


func _unit_quantity(count: int) -> String:
	return "%d %s" % [count, "unit" if count == 1 else "units"]


func _refresh_finish_button() -> void:
	if is_instance_valid(_finish_move_button):
		_finish_move_button.disabled = Battle.total(_draft) > 0
		_finish_move_button.tooltip_text = "Queue or clear the selected units first." if _finish_move_button.disabled else ""
	_refresh_quick_action()


func _render_combat(view: Dictionary) -> void:
	var combat: Dictionary = view.combat
	var pending := combat.is_empty()
	var zone: String = (_region if view.battles.has(_region) else view.battles.keys()[0]) if pending else view.active_zone
	var attackers: Array = view.battles[zone].units if pending else combat.attackers
	var defenders: Array = view.regions[zone].units if pending else combat.defenders
	var round_hits: Array = [-1, -1] if pending else combat.round_hits.duplicate()
	if _dice.rolling:
		round_hits[0 if _session.view.last_roll.attacking else 1] = -1
	var volley: Dictionary = _session.view.last_roll
	if volley.get("zone", "") != zone or volley.get("round", -1) != combat.get("round", 0):
		volley = {}
	var step: int = -1 if pending else combat.step
	var can_act := _can_order()
	var taking_attacker: bool = can_act and step == Battle.Step.ATTACKER_LOSSES
	var taking_defender: bool = can_act and step == Battle.Step.DEFENDER_LOSSES
	if taking_attacker or taking_defender:
		_choice = "losses"
		_limits = attackers if taking_attacker else defenders
		_limit_total = combat.hits_due
	_battle_title.text = _zone_name(zone) if pending else "%s · Round %d" % [_zone_name(zone), combat.round]
	_battle_title.tooltip_text = _battle_title.text
	_battle_row(attackers, view.seat, true, taking_attacker, Scenario.EMPTY, round_hits[0], volley)
	_battle_row(defenders, 1 - view.seat, false, taking_defender,
		Scenario.EMPTY if pending else combat.marked_defenders, round_hits[1], volley)
	if not can_act:
		var message: String = "Waiting for " + Scenario.SIDES[view.actor]
		if _dice.rolling:
			message = "Rolling…"
		elif _session.awaiting_response:
			message = "Sending order…"
		UI.label(_actions, message, 14, MUTED)
		return
	var accent := _country_color(view.actor)
	if pending:
		if view.battles.size() > 1:
			for target in view.battles:
				if target != zone:
					UI.button(_orders, _zone_name(target), _choose_territory.bind(target))
		UI.primary(UI.button(_actions, "Start battle", _fight.bind(zone)), accent)
	elif taking_attacker or taking_defender:
		_draft_caption = UI.label(_actions, "", 13, accent)
		var controls := HBoxContainer.new()
		_actions.add_child(controls)
		_apply_button = UI.button(controls, "Confirm losses", _confirm_choice)
		_apply_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		UI.primary(_apply_button, accent)
		var clear := UI.button(controls, "Clear", _clear_losses)
		clear.tooltip_text = "Clear the current loss selection"
		_refresh_losses()
	else:
		var title := "Roll defense dice" if step == Battle.Step.DEFENSE_ROLL else "Roll attack dice"
		UI.primary(UI.button(_actions, title, func(): _session.act("roll")), accent)
		if step == Battle.Step.DECIDE:
			for destination in view.battles[zone].entries:
				UI.button(_orders, "Retreat to " + _zone_name(destination), _retreat.bind(destination))


func _battle_row(units: Array, seat: int, attacking: bool, selectable: bool, marked: Array, hits: int, volley: Dictionary) -> void:
	var accent := _country_color(seat)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 7)
	_orders.add_child(header)
	var die := PanelContainer.new()
	die.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	die.custom_minimum_size = Vector2(16, 16)
	var die_color := BoardDice.ATTACK_COLOR if attacking else BoardDice.DEFENSE_COLOR
	die.add_theme_stylebox_override("panel", UI.box(die_color, Color("#8b98a3"), 0, 0, 3))
	header.add_child(die)
	var pip := UI.label(die, "•", 11, TEXT)
	pip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pip.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var name := UI.label(header, Scenario.SIDES[seat], 15, accent)
	name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var role := "Attack" if attacking else "Defense"
	var hit_text := "%s · %d %s" % [role, hits, "hit" if hits == 1 else "hits"]
	UI.label(header, hit_text if hits >= 0 else role, 12, MUTED)
	var groups := Battle.formation(units, attacking)
	var group_hits := {}
	if not volley.is_empty() and volley.attacking == attacking:
		for result in volley.dice:
			var slot := Vector2i(result.target, result.unit)
			if _dice.group_is_firing(result.target, result.unit):
				group_hits[slot] = int(group_hits.get(slot, 0)) + int(result.face <= result.target and not _dice.rolling)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	_orders.add_child(row)
	var pending_marks := marked.duplicate()
	for target in [1, 2, 3]:
		var column := VBoxContainer.new()
		column.custom_minimum_size.x = 82
		column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		column.add_theme_constant_override("separation", 3)
		row.add_child(column)
		if not groups.has(target):
			continue
		var label := UI.label(column, "≤ %d" % target, 12, MUTED)
		label.tooltip_text = "Hits on %d or less" % target
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		for unit in Battle.UNITS.size():
			var quantity: int = groups[target][unit]
			if quantity == 0:
				continue
			var button := UI.button(column, str(quantity), _adjust.bind(unit, 1))
			button.icon = Board.UNIT_ICONS[unit]
			button.expand_icon = true
			button.add_theme_constant_override("icon_max_width", 26)
			button.custom_minimum_size = Vector2(0, 34 if _compact else 36)
			button.tooltip_text = "%s · %d · hits on %d or less" % [Battle.UNITS[unit], quantity, target]
			var firing := group_hits.has(Vector2i(target, unit))
			var landed: int = group_hits.get(Vector2i(target, unit), 0)
			if selectable:
				_battle_loss_buttons.append({"button": button, "unit": unit, "count": quantity})
			else:
				if landed > 0:
					button.text += "  ✓%d" % landed
				var losses := mini(quantity, pending_marks[unit])
				pending_marks[unit] -= losses
				if losses > 0:
					button.text += " −%d" % losses
				button.disabled = true
				var fill := UI.DARK.lerp(accent, 0.12)
				var edge := fill.lightened(0.15)
				if firing:
					fill = fill.lerp(Color("#b4a45e"), 0.20)
					edge = Color("#d6c785") if landed > 0 else Color("#90835f")
				if losses > 0:
					edge = Board.LOSS
				button.add_theme_stylebox_override("disabled", UI.box(fill, edge, 5, 3, 4))
				button.add_theme_color_override("font_disabled_color", accent)
				button.add_theme_color_override("icon_disabled_color", Color.WHITE)


func _clear_losses() -> void:
	_draft = Scenario.EMPTY.duplicate()
	_refresh_losses()
	_refresh_board()


func _refresh_losses() -> void:
	var remaining := _draft.duplicate()
	var accent := _country_color(_session.view.actor)
	for slot in _battle_loss_buttons:
		var button: Button = slot.button
		var selected := mini(slot.count, remaining[slot.unit])
		remaining[slot.unit] -= selected
		button.text = "%d −%d" % [slot.count, selected] if selected > 0 else str(slot.count)
		button.disabled = not _can_add(slot.unit)
		var fill := UI.DARK.lerp(accent, 0.17)
		var edge := Board.LOSS if selected > 0 else accent
		for state in ["normal", "disabled"]:
			button.add_theme_stylebox_override(state, UI.box(fill, edge, 5, 3, 4))
		button.add_theme_color_override("font_disabled_color", accent)
		button.add_theme_color_override("icon_disabled_color", Color.WHITE)
	var total := Battle.total(_draft)
	_draft_caption.text = "%s · %d/%d losses" % [Scenario.SIDES[_session.view.actor], total, _limit_total]
	_apply_button.disabled = total != _limit_total


func _render_mobilize(view: Dictionary) -> void:
	var total := Battle.total(view.reinforcements)
	if total == 0:
		if view.spent > 0:
			UI.primary(UI.button(_actions, "Review income", func(): _session.act("mobilize", {"placements": []})), _country_color(view.actor))
		else:
			UI.button(_actions, "Skip mobilization", _confirm_skip.bind("mobilization", "Advance to income collection.", "mobilize", {"placements": []}))
		return
	if view.capacity.get(_region, 0) == 0:
		UI.label(_orders, "Select a factory on the map.", 14, MUTED)
	for zone in view.capacity:
		if view.capacity[zone] > 0:
			var button := UI.button(_orders, "", _choose_territory.bind(zone))
			_factory_buttons[zone] = button
			if zone == _region:
				button.add_theme_stylebox_override("normal", UI.box(UI.SURFACE, _country_color(view.actor), 8, 7))
	var capacity: int = view.capacity.get(_region, 0)
	if capacity > 0:
		_choices(_placement_pool(view, _region), capacity, "place", "")
	_placement_status = UI.label(_actions, "", 13, MUTED, true)
	_mobilize_button = UI.button(_actions, "Commit placements", _commit_placements)
	UI.primary(_mobilize_button, _country_color(view.actor))
	_refresh_placement_status()


func _placement_pool(view: Dictionary, except_zone := "") -> Array:
	var pool: Array = view.reinforcements.duplicate()
	for zone in _placements:
		if zone != except_zone:
			for unit in pool.size():
				pool[unit] -= _placements[zone][unit]
	return pool


func _refresh_placement_status() -> void:
	if not is_instance_valid(_mobilize_button):
		return
	var view: Dictionary = _session.view
	var unassigned := _placement_pool(view)
	var remaining := Battle.total(unassigned)
	var total := Battle.total(view.reinforcements)
	for zone in _factory_buttons:
		var count := Battle.total(_placements.get(zone, Scenario.EMPTY))
		_factory_buttons[zone].text = "%s  ·  %d/%d" % [_zone_name(zone), count, view.capacity[zone]]
	_placement_status.text = "%d/%d assigned" % [total - remaining, total]
	if remaining > 0 and _placement_available.is_empty():
		_placement_status.text += " · " + _unit_summary(unassigned) + " left"
	_mobilize_button.disabled = remaining != 0
	_mobilize_button.text = "Commit " + _unit_quantity(total)


func _commit_placements() -> void:
	if not _can_order() or not is_instance_valid(_mobilize_button) or _mobilize_button.disabled:
		return
	var orders := []
	for zone in _placements:
		orders.append({"zone": zone, "counts": _placements[zone].duplicate()})
	_session.act("mobilize", {"placements": orders})


func _fight(zone: String) -> void:
	_session.act("fight", {"zone": zone})


func _retreat(zone: String) -> void:
	_session.act("retreat", {"zone": zone})


func _choices(available: Array, max_total: int, command: String, title: String) -> void:
	_limits = available
	_limit_total = max_total
	_choice = command
	_draft_labels.clear()
	_minus.clear()
	_plus.clear()
	for i in Battle.UNITS.size():
		var row := HBoxContainer.new()
		_orders.add_child(row)
		var icon := TextureRect.new()
		icon.texture = Board.UNIT_ICONS[i]
		icon.custom_minimum_size = Vector2(27, 20)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		row.add_child(icon)
		var detail := VBoxContainer.new()
		detail.add_theme_constant_override("separation", 0)
		detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(detail)
		UI.label(detail, Battle.UNITS[i], 14, TEXT)
		var amount := "%d IPC" % Scenario.COST[i] if command == "purchase" else "%d available" % available[i]
		var availability := UI.label(detail, amount, 12, MUTED)
		if command == "place":
			_placement_available.append(availability)
		_minus.append(UI.button(row, "−", _adjust.bind(i, -1)))
		var value := UI.label(row, "0", 16, TEXT)
		value.custom_minimum_size.x = 22
		value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		value.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		value.add_theme_stylebox_override("normal", UI.box(UI.DARK, BORDER, 4, 4, 4))
		_draft_labels.append(value)
		_plus.append(UI.button(row, "+", _adjust.bind(i, 1)))
	match command:
		"queue":
			_route_picker = OptionButton.new()
			_route_picker.fit_to_longest_item = false
			_route_picker.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
			_route_picker.custom_minimum_size.y = 34
			_route_picker.item_selected.connect(_pick_route)
			_orders.add_child(_route_picker)
			_draft_caption = UI.label(_orders, "", 14, MUTED, true)
			var row := HBoxContainer.new()
			_orders.add_child(row)
			_apply_button = UI.button(row, title, _confirm_choice)
			_apply_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			UI.button(row, "Clear selection", func(): _select_origin(""))
		"purchase":
			_draft_caption = UI.label(_actions, "", 14, TEXT, true)
			_apply_button = UI.button(_actions, title, _confirm_choice)
	_refresh_choices()


func _adjust(index: int, delta: int) -> void:
	if _choice.is_empty() or not _can_order():
		return
	var quantity: int = _draft[index] + delta
	if quantity < 0 or quantity > _limits[index] or (delta > 0 and not _can_add(index)):
		return
	_draft[index] = quantity
	if _choice == "place":
		if Battle.total(_draft) == 0:
			_placements.erase(_region)
		else:
			_placements[_region] = _draft.duplicate()
		_refresh_placement_status()
	_show_notice("")
	_refresh_choices()
	_refresh_finish_button()
	_refresh_board()


func _can_add(index: int) -> bool:
	var view: Dictionary = _session.view
	if _draft[index] >= _limits[index] or Battle.total(_draft) >= _limit_total:
		return false
	if _choice == "purchase":
		return Turn.price(_draft) + Scenario.COST[index] <= view.treasury[view.seat]
	return true


func _refresh_choices() -> void:
	if _choice == "losses":
		_refresh_losses()
		return
	var total := Battle.total(_draft)
	for i in Battle.UNITS.size():
		if _draft_labels[i] == null:
			continue
		_draft_labels[i].text = str(_draft[i])
		_minus[i].disabled = _draft[i] == 0
		_plus[i].disabled = not _can_add(i)
	if _draft_caption != null:
		_draft_caption.text = "%s selected" % _unit_quantity(total)
	if is_instance_valid(_apply_button):
		_apply_button.disabled = total == 0
	match _choice:
		"purchase":
			var cost := Turn.price(_draft)
			var view: Dictionary = _session.view
			var treasury: int = view.treasury[view.seat]
			_purchase_values[0].text = "%d IPC" % treasury
			_purchase_values[1].text = "%d IPC" % cost
			_purchase_values[2].text = "%d IPC" % (treasury - cost)
			_draft_caption.text = "%s in this order" % _unit_quantity(total) if total > 0 else ""
			_apply_button.text = "Buy %s · %d IPC" % [_unit_quantity(total), cost] if total > 0 else "Skip purchases"
			_apply_button.disabled = false
			if total > 0:
				UI.primary(_apply_button, _country_color(view.actor))
			else:
				UI.secondary(_apply_button)
		"queue":
			_refresh_routes(total)
			_apply_button.disabled = _route.is_empty()
			_apply_button.text = "Queue " + _unit_quantity(total) if total > 0 else "Queue move"
		"place":
			for i in _placement_available.size():
				_placement_available[i].text = "%d unassigned" % (_limits[i] - _draft[i])


func _refresh_routes(total: int) -> void:
	var view: Dictionary = _session.view
	_routes = []
	if total > 0:
		_routes = Turn.legal_routes(view.regions, view.seat, view.phase == Turn.Phase.COMBAT_MOVE, _origin, _draft[0] == 0 and _draft[1] == 0)
		if _routes.is_empty():
			_draft_caption.text = "These units have no legal destination from here."
	_route_picker.clear()
	_route_picker.add_item("Choose destination")
	_route_picker.disabled = _routes.is_empty()
	var selection := 0
	for i in _routes.size():
		var route: Dictionary = _routes[i]
		var label := _zone_name(route.to)
		if not route.via.is_empty():
			label += " via " + _zone_name(route.via)
		_route_picker.add_item(label)
		if not _route.is_empty() and route.to == _route.to and route.via == _route.via:
			selection = i + 1
	if selection == 0:
		_route = {}
	_route_picker.select(selection)


func _pick_route(index: int) -> void:
	if index <= 0:
		_route = {}
		_refresh_choices()
		_refresh_board()
	else:
		_select_route(_routes[index - 1])


func _select_route(route: Dictionary) -> void:
	_region = route.to
	_route = {"from": _origin, "to": route.to, "via": route.via}
	_show_notice("")
	_refresh_choices()
	_refresh_board()


func _confirm_choice() -> void:
	if not _can_order() or _apply_button.disabled:
		return
	if _choice == "queue":
		var plan := _route.duplicate()
		plan.counts = _draft.duplicate()
		_plans.append(plan)
		_origin = ""
		_reset_draft()
		_render_orders(_session.view)
		_refresh_board()
	elif _choice == "purchase" and Battle.total(_draft) == 0:
		_confirm_skip("purchases", "You’ll start combat movement without buying reinforcements.", "purchase", {"counts": _draft.duplicate()})
	else:
		_session.act(_choice, {"counts": _draft.duplicate(), "zone": _region})


func _remove_move(index: int) -> void:
	_plans.remove_at(index)
	_render_orders(_session.view)
	_refresh_board()


func _finish_moves() -> void:
	if not _can_order():
		return
	if Battle.total(_draft) > 0:
		_show_notice("Queue the selected move or clear the selection before advancing.")
		return
	if _plans.is_empty():
		var combat: bool = _session.view.phase == Turn.Phase.COMBAT_MOVE
		var phase := "combat movement" if combat else "noncombat movement"
		var detail := "No attacks will be launched this turn." if combat else "Advance to mobilization without redeploying units."
		_confirm_skip(phase, detail, "moves", {"orders": []})
	else:
		_session.act("moves", {"orders": _plans.duplicate(true)})


func _confirm_skip(phase: String, detail: String, command: String, payload: Dictionary) -> void:
	if not _can_order() or is_instance_valid(_skip_dialog):
		return
	var revision: int = _session.view.revision
	var dialog := ConfirmationDialog.new()
	dialog.theme = UI.field_theme()
	_skip_dialog = dialog
	dialog.title = "Skip %s?" % phase
	dialog.dialog_text = detail
	dialog.ok_button_text = "Skip phase"
	dialog.cancel_button_text = "Keep playing"
	dialog.confirmed.connect(func():
		if _can_order() and _session.view.revision == revision:
			_session.act(command, payload)
		dialog.queue_free()
	)
	dialog.canceled.connect(dialog.queue_free)
	add_child(dialog)
	dialog.popup_centered()
	dialog.get_cancel_button().grab_focus()


func _local_addresses() -> String:
	var addresses: PackedStringArray = []
	for address in IP.get_local_addresses():
		if "." in address and not ":" in address and not address.begins_with("127.") and not address.begins_with("169.254."):
			addresses.append(address)
	return " / ".join(addresses) if not addresses.is_empty() else "127.0.0.1 (this device only)"


func _copy_invite() -> void:
	DisplayServer.clipboard_set(_session.invite)
	_show_notice("Invite code copied. Share the host IP address as well.")


func _show_notice(message: String) -> void:
	_notice.text = message
	_notice.visible = not message.is_empty()


func _clear(parent: Control) -> void:
	for child in parent.get_children():
		parent.remove_child(child)
		child.queue_free()
