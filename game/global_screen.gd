extends "res://game/atlas_screen.gd"
## Orders drawer shared by touch and desktop on the live world board.

const Campaign = preload("res://game/global_turn.gd")
const Rules = preload("res://game/global_rules.gd")
const Dice = preload("res://game/board_dice.gd")
const SAVE := "user://global-1940.save"
const PHASES := ["Purchase", "Combat move", "Conduct combat", "Noncombat move", "Mobilize", "Collect income"]
const SHORT := ["Buy", "Attack", "Battle", "Redeploy", "Place", "Income"]
const TABS := ["All", "Land", "Air", "Sea"]

var game: Campaign
var _panel: PanelContainer
var _content: VBoxContainer
var _scroll: ScrollContainer
var _controls: VBoxContainer
var _status: Label
var _phase: Label
var _summary: Label
var _turn_badge: Label
var _order_toggle: Button
var _action: Button
var _dice: Dice
var _draft := {}
var _moves: Array = []
var _reinforcements: Array = []
var _selected_units := {}
var _origin := ""
var _route := {}
var _legal := {}
var _flight := -1
var _transport_mode := false
var _wallet := ""
var _filter := 0
var _losses := {}
var _factory := ""
var _panel_anim: Tween
var _panel_open := true
var _dice_phase := false
var _save_error := ""
var save_path := SAVE


func _ready() -> void:
	super._ready()
	(_header.get_child(1) as Label).text = "Global 1940"
	_phase = UI.label(_header, "", 16, UI.GOLD)
	_phase.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_header.move_child(_phase, 2)
	_turn_badge = UI.label(_header, "", 17, UI.TEXT)
	_turn_badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_header.move_child(_turn_badge, 3)
	if OS.has_feature("mobile") or "--touch-layout" in OS.get_cmdline_user_args():
		(_header.get_child(1) as Label).custom_minimum_size.x = 90
		(_header.get_child(1) as Label).text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_inspect.text = "Inspect"
	_order_toggle = UI.button(_footer, "Orders", func(): _show_panel(not _panel_open, true))
	_order_toggle.custom_minimum_size = Vector2(91, 45)
	_action = UI.button(_footer, "", _primary)
	_action.custom_minimum_size = Vector2(116, 45)
	UI.primary(_action)
	_dice = Dice.new()
	_dice.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_map.add_child(_dice)
	_dice.settled.connect(_refresh)
	_dice.firing_group_changed.connect(_refresh)
	_panel = PanelContainer.new()
	_panel.add_theme_stylebox_override("panel", UI.box(Color("#14242c"), Color("#948667"), 10, 9, 8))
	_map.add_child(_panel)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 5)
	_panel.add_child(content)
	var header := HBoxContainer.new()
	content.add_child(header)
	_summary = UI.heading(header, "", 22)
	_summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_summary.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	UI.button(header, "×", func(): _show_panel(false, true)).custom_minimum_size = Vector2(42, 38)
	_scroll = ScrollContainer.new()
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.add_child(_scroll)
	_content = VBoxContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_theme_constant_override("separation", 4)
	_scroll.add_child(_content)
	_controls = VBoxContainer.new()
	_controls.add_theme_constant_override("separation", 4)
	content.add_child(_controls)
	_status = UI.label(content, "", 14, UI.GOLD, true)
	_status.hide()
	_map.resized.connect(_layout_panel)
	_map.selected.connect(_on_board_selected)


func open_campaign() -> void:
	if game == null:
		game = Campaign.new()
		if not save_path.is_empty() and FileAccess.file_exists(save_path) and not game.load_save(save_path):
			_save_error = "The Global save could not be read."
		_wallet = game.wallets()[0]
	_map.load_atlas()
	show()
	if game.revision == 0:
		_map.focus("Germany")
		_map.zoom_by(0.51)
	_show_panel(game.phase in [Campaign.Phase.PURCHASE, Campaign.Phase.COMBAT, Campaign.Phase.MOBILIZE, Campaign.Phase.INCOME])
	_refresh()
	_notice(_save_error)


func _close() -> void:
	if _dice.rolling:
		return
	super._close()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel") and _panel_open and not _details.visible:
		_show_panel(false, true)
		get_viewport().set_input_as_handled()
		return
	super._unhandled_input(event)


func _show_panel(open: bool, animate := false) -> void:
	_panel_open = open
	_order_toggle.text = "Hide orders" if open else "Orders"
	if is_instance_valid(_panel_anim):
		_panel_anim.kill()
	_layout_panel()
	if not animate:
		_panel.visible = open
		return
	var edge := _panel.position.x
	if open:
		_panel.position.x = _map.size.x
		_panel.show()
	_panel_anim = create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_panel_anim.tween_property(_panel, "position:x", edge if open else _map.size.x, 0.19)
	if not open:
		_panel_anim.tween_callback(_panel.hide)


func _layout_panel() -> void:
	var width := clampf(_map.size.x * 0.39, 316, 392)
	_panel.size = Vector2(width, maxf(1.0, _map.size.y - 16.0))
	_panel.position = Vector2(_map.size.x - width - 8.0, 8.0)
	var right := _panel.position.x if _panel_open else _map.size.x
	var height := minf(245.0, _map.size.y * 0.49)
	_dice.set_table(Rect2(Vector2(14, _map.size.y - height - 12.0), Vector2(maxf(1.0, right - 27.0), height)))


func _refresh() -> void:
	if game == null:
		return
	var nation := game.power()
	_phase.text = "R%d · %s" % [game.round, SHORT[game.phase]]
	_turn_badge.text = "%s · %d IPC" % [_map.owner_name(nation), game.treasury[nation]]
	_turn_badge.add_theme_color_override("font_color", _map.SIDE_COLORS.get(nation, UI.GOLD).lightened(0.23))
	_summary.text = PHASES[game.phase]
	var paths := _moves.duplicate()
	if not _route.is_empty():
		paths.append(_route)
	var live := game.board.duplicate()
	for zone in game.pending():
		live[zone] = live[zone].duplicate()
		live[zone].units = live[zone].units + game.battles[zone].units
	_map.set_campaign(live, paths, _legal, game.pending())
	if not _zone.is_empty():
		_select(_zone)
	_clear(_content)
	_clear(_controls)
	match game.phase:
		Campaign.Phase.PURCHASE: _purchase_ui()
		Campaign.Phase.COMBAT_MOVE, Campaign.Phase.NONCOMBAT: _movement_ui()
		Campaign.Phase.COMBAT: _combat_ui()
		Campaign.Phase.MOBILIZE: _mobilize_ui()
		Campaign.Phase.INCOME: _income_ui()
	var actions := ["Confirm buy", "Commit moves", "Battle", "Commit moves", "Place units", "Collect IPC"]
	_action.text = actions[game.phase]
	if not _route.is_empty() and game.phase in [Campaign.Phase.COMBAT_MOVE, Campaign.Phase.NONCOMBAT]:
		_action.text = "Queue move"
	if game.phase == Campaign.Phase.COMBAT and not game.fight.is_empty():
		var stage: String = game.fight.stage
		_action.text = {"attack": "Roll attack", "defense": "Roll defense", "press": "Next volley"}.get(stage, "Confirm losses")
	_action.disabled = _dice.rolling


func _purchase_ui() -> void:
	if game.wallets().size() > 1:
		var wallets := HBoxContainer.new()
		_content.add_child(wallets)
		for owner in game.wallets():
			var label := "Europe" if owner == "British" else "Pacific"
			var button := UI.button(wallets, "%s · %d" % [label, game.treasury[owner]], _choose_wallet.bind(owner))
			if owner == _wallet:
				UI.primary(button)
	var units: Dictionary = _draft.get(_wallet, {})
	var spent := 0
	for unit in units:
		spent += Rules.PROFILES[unit][0] * units[unit]
	UI.label(_content, "%d IPC left · %d in draft" % [game.treasury[_wallet] - spent, spent], 16, UI.GOLD)
	var filters := HBoxContainer.new()
	_content.add_child(filters)
	for index in TABS.size():
		var item := UI.button(filters, TABS[index], _choose_filter.bind(index))
		if index == _filter:
			UI.primary(item)
	for unit in Rules.PROFILES:
		if _filter > 0 and Rules.domain(unit) != TABS[_filter].to_lower():
			continue
		if _wallet == "Chinese" and unit != "infantry" and not (unit == "artillery" and game.burma_road()):
			continue
		var cost: int = Rules.PROFILES[unit][0]
		_quantity_row(Rules.title(unit), "%d IPC" % cost, units.get(unit, 0), int(game.treasury[_wallet] - spent >= cost), _change_purchase.bind(unit))


func _choose_wallet(owner: String) -> void:
	_wallet = owner
	_refresh()


func _choose_filter(value: int) -> void:
	_filter = value
	_scroll.scroll_vertical = 0
	_refresh()


func _change_purchase(delta: int, unit: String) -> void:
	if not _draft.has(_wallet):
		_draft[_wallet] = {}
	_set_quantity(_draft[_wallet], unit, delta)
	if _draft[_wallet].is_empty():
		_draft.erase(_wallet)
	_refresh()


func _movement_ui() -> void:
	if game.phase == Campaign.Phase.COMBAT_MOVE and _moves.is_empty():
		var available_wars := game.declarations()
		if not available_wars.is_empty():
			var politics := MenuButton.new()
			politics.text = "Declare war…"
			politics.custom_minimum_size.y = 42
			_content.add_child(politics)
			for target in available_wars:
				politics.get_popup().add_item(_map.owner_name(target))
			politics.get_popup().id_pressed.connect(func(index):
				var target: String = available_wars[index]
				_confirm("Declare war on %s?" % _map.owner_name(target), func():
					if game.declare(target):
						_update_routes()
						_accepted()
				)
			)
	if game.phase == Campaign.Phase.NONCOMBAT:
		for index in game.air_to_land.size():
			var flight: Dictionary = game.air_to_land[index]
			if _moves.any(func(order): return order.get("flight", -1) == index):
				continue
			if game.routes_for_landing(flight).is_empty():
				UI.button(_content, "Resolve stranded " + Rules.title(flight.unit), _lose_flight.bind(index))
				continue
			var pick := UI.button(_content, "Land %d %s · %s" % [flight.count, Rules.title(flight.unit), flight.zone], _choose_flight.bind(index))
			pick.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if not _origin.is_empty() and _flight < 0:
		UI.label(_content, _origin, 17, UI.GOLD, true)
		var units := game.available(_origin, _moves)
		for unit in units:
			if units[unit] > 0:
				var count: int = _selected_units.get(unit, 0)
				_quantity_row(Rules.title(unit), "%d ready" % units[unit], count, units[unit] - count, _change_units.bind(unit))
		if not _selected_units.is_empty() and Rules.domain(_selected_units.keys()[0]) == "land":
			var cross := UI.button(_content, "Sea crossing" if not _transport_mode else "Use land routes", _toggle_transport)
			if _transport_mode:
				UI.primary(cross)
	elif _flight >= 0:
		UI.label(_content, "Choose a highlighted landing site", 16, UI.GOLD, true)
	else:
		UI.label(_content, "Tap a territory or fleet to select units.", 16, UI.MUTED, true)
	for index in _moves.size():
		var order: Dictionary = _moves[index]
		var row := HBoxContainer.new()
		_content.add_child(row)
		var caption := UI.label(row, "%s → %s · %d" % [order.path[0], order.path[-1], Campaign._count(order.units)], 15, UI.TEXT, true)
		caption.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		UI.button(row, "×", _remove_move.bind(index))
	if not _route.is_empty():
		UI.label(_controls, "%s → %s" % [_origin, _route.path[-1]], 15, UI.GOLD, true)


func _choose_flight(index: int) -> void:
	var flight: Dictionary = game.air_to_land[index]
	_flight = index
	_transport_mode = false
	_origin = flight.zone
	_selected_units = {flight.unit: flight.count}
	_route = {}
	_legal = game.routes_for_landing(flight)
	_map.focus(flight.zone)
	_refresh()


func _lose_flight(index: int) -> void:
	_confirm("This flight has no legal landing site. Remove it?", func():
		if game.abandon_air(index):
			for order in _moves:
				if order.flight > index:
					order.flight -= 1
			_reset_selection()
			_accepted()
	)


func _change_units(delta: int, unit: String) -> void:
	if delta > 0 and not _selected_units.is_empty() and Rules.domain(_selected_units.keys()[0]) != Rules.domain(unit):
		_selected_units.clear()
	_set_quantity(_selected_units, unit, delta)
	_update_routes()
	_refresh()


func _update_routes() -> void:
	_route = {}
	if _flight >= 0:
		_legal = game.routes_for_landing(game.air_to_land[_flight])
	elif _transport_mode:
		_legal = game.crossings(_origin, _selected_units, _moves)
	else:
		_legal = game.routes(_origin, _selected_units)


func _toggle_transport() -> void:
	_transport_mode = not _transport_mode
	_update_routes()
	_refresh()


func _remove_move(index: int) -> void:
	_moves.remove_at(index)
	_update_routes()
	_refresh()


func _combat_ui() -> void:
	if game.fight.is_empty():
		for zone in game.pending():
			UI.button(_content, zone, _start_battle.bind(zone))
		return
	var battle: Dictionary = game.fight
	_summary.text = "%s · Round %d" % [battle.zone, battle.round]
	var stage: String = battle.stage
	var sides := [battle.attack, battle.defense]
	for side in 2:
		var counts: Array = sides[side]
		var picking := not _dice.rolling and (side == 0 and stage == "attacker_losses" or side == 1 and stage == "defender_losses")
		var heading := "Attack" if side == 0 else "Defense"
		if not counts.is_empty():
			var owners := []
			for piece in counts:
				var owner := _map.owner_name(piece[0])
				if owner not in owners and piece[2] > 0:
					owners.append(owner)
			heading += " · " + "/".join(owners)
		UI.label(_content, heading, 16, UI.GOLD if side == 0 else UI.TEAL)
		var groups := _battle_groups(counts, side == 0)
		for entry in groups:
			var piece: Array = counts[entry.index]
			var target: int = entry.target
			var caption := "≤%d" % target if target > 0 else "—"
			var volley: Dictionary = battle.volley
			var matching: bool = not volley.is_empty() and volley.attacking == (side == 0)
			if matching and not _dice.rolling:
				var hits: int = volley.dice.filter(func(die): return die.unit == piece[1] and die.target == target and die.face <= die.target).size()
				if hits > 0:
					caption += "  ✓%d" % hits
			if picking:
				var chosen: int = _losses.get(entry.index, 0)
				var damage: int = battle.damage[side].get(entry.index, 0)
				var max_hits: int = piece[2] * (2 if piece[1] in ["carrier", "battleship"] else 1) - damage
				_quantity_row("%d %s" % [piece[2], Rules.title(piece[1])], caption, chosen, mini(max_hits - chosen, battle.hits - Campaign._count(_losses)), _change_loss.bind(entry.index), true)
			else:
				var firing := matching and _dice.rolling and _dice.group_is_firing(target, piece[1])
				var color := UI.GOLD if firing or "✓" in caption else UI.TEXT
				UI.label(_content, "%d %s  ·  %s" % [entry.count, Rules.title(piece[1]), caption], 15, color, true)
	if not _dice.rolling and stage in ["attacker_losses", "defender_losses"]:
		UI.label(_controls, "%d / %d hits assigned" % [Campaign._count(_losses), battle.hits], 15, UI.GOLD)
	if not _dice.rolling and stage == "press":
		for zone in game.retreat_sites():
			UI.button(_content, "Retreat to " + zone, _retreat.bind(zone))


func _battle_groups(pieces: Array, attacking: bool) -> Array:
	var result := []
	var artillery := Campaign._unit_count(pieces, "artillery") if attacking else 0
	var escorts := Campaign._unit_count(pieces, "fighter") + Campaign._unit_count(pieces, "armour") if attacking else 0
	var taking: bool = game.fight.stage == ("attacker_losses" if attacking else "defender_losses")
	for index in pieces.size():
		var piece: Array = pieces[index]
		if piece[2] <= 0:
			continue
		var target: int = Rules.PROFILES[piece[1]][1 if attacking else 2]
		var boosted := 0
		if piece[1] in ["infantry", "mech_infantry"]:
			boosted = mini(piece[2], artillery)
			artillery -= boosted
		elif piece[1] == "tactical_bomber":
			boosted = mini(piece[2], escorts)
			escorts -= boosted
		if not taking and boosted > 0:
			result.append({"index": index, "target": target + 1, "count": boosted})
		if taking or piece[2] > boosted:
			result.append({"index": index, "target": target, "count": piece[2] if taking else piece[2] - boosted})
	result.sort_custom(func(a, b): return a.target < b.target)
	return result


func _change_loss(delta: int, index: int) -> void:
	_set_quantity(_losses, index, delta)
	_refresh()


func _start_battle(zone: String) -> void:
	_dice.display({}, false)
	game.start_battle(zone)
	_map.focus(zone)
	_show_panel(true)
	_accepted()


func _retreat(zone: String) -> void:
	game.retreat(zone)
	_accepted()


func _mobilize_ui() -> void:
	var owner: String = game.board[_factory].owner if game.board.has(_factory) else ""
	var staged := 0
	for placement in _reinforcements:
		if placement.factory == _factory:
			staged += placement.count
	if not _factory.is_empty():
		UI.label(_content, "%s · %d/%d slots" % [_factory, staged, game.capacity(owner, _factory)], 16, UI.GOLD, true)
	else:
		UI.label(_content, "Select a factory or Chinese territory.", 16, UI.MUTED, true)
	for wallet in game.wallets():
		var available: Dictionary = game.pool.get(wallet, {}).duplicate()
		for order in _reinforcements:
			if order.owner == wallet:
				available[order.unit] -= order.count
		for unit in available:
			if available[unit] <= 0:
				continue
			var label := "%d %s left" % [available[unit], Rules.title(unit)]
			if owner != wallet or _factory.is_empty() or staged >= game.capacity(owner, _factory):
				UI.label(_content, label, 15, UI.MUTED)
			elif unit in Rules.SEA:
				for zone in game.board[_factory].links:
					if game.board[zone].water and not Rules.enemy_fleet(game.board[zone], game.diplomacy, game.power(), true):
						UI.button(_content, label + " → " + zone, _stage_unit.bind(wallet, unit, zone)).autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			else:
				UI.button(_content, "+ " + label, _stage_unit.bind(wallet, unit, _factory))
	for index in _reinforcements.size():
		var order: Dictionary = _reinforcements[index]
		UI.button(_content, "− %d %s · %s" % [order.count, Rules.title(order.unit), order.zone], _remove_placement.bind(index)).autowrap_mode = TextServer.AUTOWRAP_WORD_SMART


func _stage_unit(owner: String, unit: String, zone: String) -> void:
	for order in _reinforcements:
		if order.owner == owner and order.unit == unit and order.zone == zone and order.factory == _factory:
			order.count += 1
			_refresh()
			return
	_reinforcements.append({"owner": owner, "unit": unit, "zone": zone, "factory": _factory, "count": 1})
	_refresh()


func _remove_placement(index: int) -> void:
	_reinforcements[index].count -= 1
	if _reinforcements[index].count <= 0:
		_reinforcements.remove_at(index)
	_refresh()


func _income_ui() -> void:
	for owner in game.wallets():
		UI.label(_content, "%s · +%d IPC" % [_map.owner_name(owner), game.income(owner)], 19, UI.GOLD, true)
	var next: String = Rules.ORDER[(game.turn + 1) % Rules.ORDER.size()]
	UI.label(_content, "Next · " + _map.owner_name(next), 17, UI.TEXT)


func _on_board_selected(zone: String) -> void:
	if game == null or zone.is_empty() or _dice.rolling:
		return
	_notice("")
	match game.phase:
		Campaign.Phase.COMBAT_MOVE, Campaign.Phase.NONCOMBAT:
			if _legal.has(zone):
				_route = _legal[zone]
			elif not game.available(zone, _moves).is_empty():
				_origin = zone
				_flight = -1
				_transport_mode = false
				_selected_units.clear()
				_update_routes()
				_show_panel(true)
		Campaign.Phase.COMBAT:
			if zone in game.pending() and game.fight.is_empty():
				_start_battle(zone)
				return
		Campaign.Phase.MOBILIZE:
			for owner in game.wallets():
				if game.capacity(owner, zone) > 0:
					_factory = zone
					_show_panel(true)
	_refresh()


func _primary() -> void:
	if _dice.rolling:
		return
	match game.phase:
		Campaign.Phase.PURCHASE:
			if _draft.is_empty():
				_confirm("Skip purchases?", _finish_purchase)
			else:
				_finish_purchase()
		Campaign.Phase.COMBAT_MOVE, Campaign.Phase.NONCOMBAT:
			if not _route.is_empty():
				var order := _route.duplicate(true)
				order.units = _selected_units.duplicate()
				order.flight = _flight
				order.landing = _flight >= 0
				_moves.append(order)
				_reset_selection()
				_show_panel(false, true)
				_refresh()
			elif _moves.is_empty():
				_confirm("Skip this movement phase?", _commit_moves)
			else:
				_commit_moves()
		Campaign.Phase.COMBAT: _combat_action()
		Campaign.Phase.MOBILIZE:
			var reason := game.mobilize(_reinforcements)
			if reason.is_empty():
				_reinforcements.clear()
				_accepted()
			else:
				_notice(reason)
		Campaign.Phase.INCOME:
			game.collect()
			_draft.clear()
			_wallet = game.wallets()[0]
			_factory = ""
			_filter = 0
			_show_panel(true)
			_accepted()


func _finish_purchase() -> void:
	var reason := game.purchase(_draft)
	if reason.is_empty():
		_show_panel(false, true)
		_accepted()
	else:
		_notice(reason)


func _commit_moves() -> void:
	if not _selected_units.is_empty():
		_reset_selection()
	var reason := game.commit_moves(_moves)
	if reason.is_empty():
		_moves.clear()
		_dice.display({}, false)
		_show_panel(game.phase != Campaign.Phase.NONCOMBAT)
		_accepted()
	else:
		_show_panel(true)
		_refresh()
		_notice(reason)


func _combat_action() -> void:
	if game.fight.is_empty():
		if _zone in game.pending():
			_start_battle(_zone)
		else:
			_show_panel(true)
		return
	var stage: String = game.fight.stage
	if stage in ["attack", "defense"]:
		var result := game.roll()
		_dice.display(result, true)
		_accepted()
	elif stage == "press":
		game.next_round()
		_dice.display({}, false)
		_accepted()
	elif game.apply_losses(_losses):
		_losses.clear()
		_accepted()
	else:
		_notice("Assign exactly %d hits to eligible units." % game.fight.hits)


func _accepted() -> void:
	_notice("")
	if not save_path.is_empty() and not game.save(save_path):
		_notice("Autosave failed on this device.")
	_refresh()


func _reset_selection() -> void:
	_origin = ""
	_flight = -1
	_transport_mode = false
	_route = {}
	_legal = {}
	_selected_units.clear()


func _notice(value: String) -> void:
	if not value.is_empty() and not _panel_open:
		_show_panel(true)
	_status.text = value
	_status.visible = not value.is_empty()


func _confirm(message: String, action: Callable) -> void:
	var dialog := ConfirmationDialog.new()
	dialog.dialog_text = message
	dialog.ok_button_text = "Confirm"
	dialog.confirmed.connect(action)
	dialog.confirmed.connect(dialog.queue_free)
	dialog.canceled.connect(dialog.queue_free)
	add_child(dialog)
	dialog.popup_centered()
	dialog.get_cancel_button().grab_focus()


func _quantity_row(title: String, detail: String, count: int, extra: int, change: Callable, compact := false) -> void:
	var row := HBoxContainer.new()
	_content.add_child(row)
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation", 0)
	row.add_child(column)
	if compact:
		var label := UI.label(column, "%s  %s" % [title, detail], 15, UI.TEXT, true)
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	else:
		UI.label(column, title, 16, UI.TEXT, true)
		UI.label(column, detail, 13, UI.MUTED)
	var less := UI.button(row, "−", change.bind(-1))
	less.custom_minimum_size = Vector2(42, 37 if compact else 42)
	less.disabled = count == 0
	var quantity := UI.label(row, str(count), 17, UI.TEXT)
	quantity.custom_minimum_size.x = 21
	quantity.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	quantity.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var more := UI.button(row, "+", change.bind(1))
	more.custom_minimum_size = Vector2(42, 37 if compact else 42)
	more.disabled = extra <= 0


func _set_quantity(counts: Dictionary, unit: Variant, delta: int) -> void:
	var count: int = counts.get(unit, 0) + delta
	if count > 0:
		counts[unit] = count
	else:
		counts.erase(unit)


func _clear(container: Control) -> void:
	for child in container.get_children():
		container.remove_child(child)
		child.queue_free()
