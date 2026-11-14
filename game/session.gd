extends Node
## A shared session interface for hotseat and two-player LAN games.

signal changed
signal refused(reason: String)

enum Mode { MENU, HOTSEAT, HOST, JOINING, GUEST }

const Turn = preload("res://game/turn.gd")
const PORT := 41740
const PROTOCOL := 8
const JOIN_TIMEOUT_MS := 8000

var mode := Mode.MENU
var view: Dictionary = {}
var invite := ""
var status := ""
var awaiting_response := false
var save_prefix := "user://western-europe"
var _turn: RefCounted
var _guest_id := 0
var _join_deadline := 0
var _pending: Dictionary = {}


func _ready() -> void:
	multiplayer.peer_connected.connect(_peer_connected)
	multiplayer.peer_disconnected.connect(_peer_disconnected)
	multiplayer.connected_to_server.connect(_connected)
	multiplayer.connection_failed.connect(_connection_failed)
	multiplayer.server_disconnected.connect(_server_disconnected)


func _process(_delta: float) -> void:
	var now := Time.get_ticks_msec()
	if mode == Mode.JOINING and now >= _join_deadline:
		leave("Join timed out. Check the host address, Wi-Fi and firewall.")
	if mode == Mode.HOST:
		for id in _pending.keys():
			if now >= _pending[id]:
				_pending.erase(id)
				multiplayer.multiplayer_peer.disconnect_peer(id)


func start_hotseat(resume := false) -> String:
	if mode != Mode.MENU:
		return "Return to the menu before starting another session."
	_turn = _load(Mode.HOTSEAT) if resume else Turn.new()
	if _turn == null:
		return "This local save could not be loaded."
	mode = Mode.HOTSEAT
	status = "Pass & play"
	_publish()
	return ""


func host(port := PORT, address := "*", resume := false) -> String:
	if mode != Mode.MENU:
		return "Return to the menu before starting another session."
	var turn: RefCounted = _load(Mode.HOST) if resume else Turn.new()
	if turn == null:
		return "This hosted save could not be loaded."
	var peer := ENetMultiplayerPeer.new()
	peer.set_bind_ip(address)
	if peer.create_server(port, 4) != OK:
		return "Could not host on UDP port %d. It may already be in use." % port
	mode = Mode.HOST
	invite = Crypto.new().generate_random_bytes(4).hex_encode().to_upper()
	status = "Waiting for France to join."
	_turn = turn
	multiplayer.multiplayer_peer = peer
	_publish()
	return ""


func join(address: String, code: String, port := PORT) -> String:
	if mode != Mode.MENU:
		return "Return to the menu before joining another session."
	if not address.is_valid_ip_address():
		return "Enter the host's Wi-Fi IP address."
	if code.length() != 8 or not code.is_valid_hex_number():
		return "Enter the 8-character invite code from the host."
	var peer := ENetMultiplayerPeer.new()
	if peer.create_client(address, port) != OK:
		return "Could not start the connection. Check the host address."
	mode = Mode.JOINING
	invite = code.to_upper()
	status = "Connecting to %s…" % address
	_join_deadline = Time.get_ticks_msec() + JOIN_TIMEOUT_MS
	multiplayer.multiplayer_peer = peer
	changed.emit()
	return ""


func leave(message := "") -> void:
	mode = Mode.MENU
	var peer := multiplayer.multiplayer_peer
	if peer is ENetMultiplayerPeer:
		peer.close()
	multiplayer.multiplayer_peer = OfflineMultiplayerPeer.new()
	_turn = null
	_guest_id = 0
	_pending.clear()
	awaiting_response = false
	invite = ""
	view = {}
	status = message
	changed.emit()


func controls_active() -> bool:
	if view.is_empty() or awaiting_response or view.actor < 0:
		return false
	var seat: int = view.actor
	return (
		mode == Mode.HOTSEAT
		or (mode == Mode.HOST and _guest_id != 0 and seat == 0)
		or (mode == Mode.GUEST and seat == 1)
	)


func act(command: String, payload: Dictionary = {}) -> void:
	if not controls_active():
		return
	if mode == Mode.GUEST:
		awaiting_response = true
		changed.emit()
		if rpc_id(1, "_request_action", view.revision, command, payload) != OK:
			leave("Connection lost. Rejoin with the same invite to continue.")
	else:
		_apply(view.actor, view.revision, command, payload)


func _apply(seat: int, revision: int, command: String, payload: Dictionary) -> void:
	var reason: String = _turn.submit(seat, revision, command, payload)
	if reason.is_empty():
		var saved := _save()
		_publish()
		if not saved:
			refused.emit("Autosave failed. You can keep playing, but the last saved position may be older.")
	elif mode == Mode.HOST and seat == 1:
		_action_result.rpc_id(_guest_id, view, reason)
	else:
		refused.emit(reason)


func _publish() -> void:
	view = _turn.snapshot()
	if mode == Mode.HOST and _guest_id != 0:
		_action_result.rpc_id(_guest_id, view, "")
	changed.emit()


func _connected() -> void:
	if mode == Mode.JOINING:
		_request_join.rpc_id(1, PROTOCOL, invite)


func _peer_connected(id: int) -> void:
	if mode == Mode.HOST:
		_pending[id] = Time.get_ticks_msec() + JOIN_TIMEOUT_MS


func _peer_disconnected(id: int) -> void:
	_pending.erase(id)
	if mode == Mode.HOST and id == _guest_id:
		_guest_id = 0
		status = "France disconnected. They can rejoin with the same invite."
		changed.emit()


func _connection_failed() -> void:
	if mode == Mode.JOINING:
		leave("Could not connect. Check the address and that both devices are on the same Wi-Fi.")


func _server_disconnected() -> void:
	if mode == Mode.GUEST or mode == Mode.JOINING:
		leave("Disconnected from the host. Rejoin with the same invite to continue.")


@rpc("any_peer", "call_remote", "reliable")
func _request_join(version: int, code: String) -> void:
	var sender := multiplayer.get_remote_sender_id()
	if mode != Mode.HOST or not _pending.has(sender):
		return
	if version != PROTOCOL or code != invite or _guest_id != 0:
		var reason := "Invite code is incorrect."
		if version != PROTOCOL:
			reason = "Use the same game version as the host."
		elif _guest_id != 0:
			reason = "France already has a player."
		_join_result.rpc_id(sender, false, reason)
		return
	_pending.erase(sender)
	_guest_id = sender
	status = "France connected · you command Germany"
	_join_result.rpc_id(sender, true, "")
	_publish()


@rpc("authority", "call_remote", "reliable")
func _join_result(accepted: bool, reason: String) -> void:
	if mode != Mode.JOINING:
		return
	if accepted:
		mode = Mode.GUEST
		status = "Connected · you command France"
	else:
		# Leave after this network callback returns.
		leave.call_deferred(reason)


@rpc("any_peer", "call_remote", "reliable")
func _request_action(revision: int, command: String, payload: Dictionary) -> void:
	if mode == Mode.HOST and _guest_id != 0 and multiplayer.get_remote_sender_id() == _guest_id:
		_apply(1, revision, command, payload)


@rpc("authority", "call_remote", "reliable")
func _action_result(state: Dictionary, reason: String) -> void:
	if mode != Mode.GUEST:
		return
	view = state
	awaiting_response = false
	changed.emit()
	if not reason.is_empty():
		refused.emit(reason)


func has_save(seat_mode: int) -> bool:
	return not save_prefix.is_empty() and (FileAccess.file_exists(_save_path(seat_mode)) or FileAccess.file_exists(_save_path(seat_mode, true)))


func _save_path(seat_mode: int, legacy := false) -> String:
	var edition := "" if legacy else "-front"
	return save_prefix + edition + ("-host.save" if seat_mode == Mode.HOST else "-local.save")


func _load(seat_mode: int) -> RefCounted:
	if not has_save(seat_mode):
		return null
	var path := _save_path(seat_mode)
	if not FileAccess.file_exists(path):
		path = _save_path(seat_mode, true)
	var file := FileAccess.open(path, FileAccess.READ)
	return null if file == null else Turn.restore(file.get_var(false))


func _save() -> bool:
	if save_prefix.is_empty():
		return true
	var path := _save_path(mode)
	var pending := path + ".%d.tmp" % OS.get_process_id()
	var file := FileAccess.open(pending, FileAccess.WRITE)
	if file == null:
		return false
	file.store_var(_turn.record(), false)
	file.flush()
	var written := file.get_error() == OK
	file.close()
	if not written:
		return false
	return DirAccess.rename_absolute(pending, path) == OK
