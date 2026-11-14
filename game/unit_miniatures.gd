extends RefCounted
## Original procedural tabletop sculpts, with national 1940 equipment silhouettes.
## Models are cached as one colored mesh per power/type, not one node per soldier.

const TANKS := {
	"Germans": [1.02, 0.61, 0.25, 4, 0.60, false], # Panzer III
	"Russians": [1.12, 0.60, 0.20, 10, 0.59, false], # T-26
	"Japanese": [1.03, 0.55, 0.21, 10, 0.36, false], # Type 97 Chi-Ha
	"Americans": [0.85, 0.59, 0.20, 6, 0.39, false], # M2A4
	"Chinese": [0.94, 0.57, 0.19, 10, 0.42, false], # Vickers 6-ton
	"British": [1.16, 0.64, 0.22, 10, 0.45, true], # Matilda II
	"UK_Pacific": [0.88, 0.56, 0.19, 6, 0.30, false], # Vickers light tank
	"Italians": [0.98, 0.56, 0.21, 8, 0.42, false], # M13/40
	"ANZAC": [0.84, 0.54, 0.18, 6, 0.28, false], # Vickers Mk VI
	"French": [0.99, 0.63, 0.20, 12, 0.43, true], # Somua S35
	"Dutch": [0.83, 0.53, 0.18, 6, 0.27, false], # Vickers Model 1936
}
const AIRCRAFT := {
	"Germans": [1.10, 1.04, 0.10], "Russians": [0.86, 1.11, 0.02],
	"Japanese": [1.15, 1.30, 0.17], "Americans": [1.17, 1.17, -0.04],
	"Chinese": [0.88, 1.12, -0.12], "British": [1.12, 1.26, 0.18],
	"UK_Pacific": [1.12, 1.22, 0.08], "Italians": [0.98, 1.08, 0.06],
	"ANZAC": [1.08, 1.25, 0.05], "French": [1.04, 1.06, 0.12],
	"Dutch": [0.91, 1.09, -0.03],
}
const NAVAL := {
	"Germans": [1.50, 0.27, 3], "Russians": [1.39, 0.29, 4],
	"Japanese": [1.55, 0.30, 4], "Americans": [1.43, 0.34, 4],
	"Chinese": [1.12, 0.25, 2], "British": [1.46, 0.31, 4],
	"UK_Pacific": [1.40, 0.29, 3], "Italians": [1.49, 0.29, 4],
	"ANZAC": [1.37, 0.25, 3], "French": [1.42, 0.32, 4],
	"Dutch": [1.25, 0.26, 3],
}
const INFANTRY := {
	# Dome height, helmet brim, rifle length: M35 / SSh-36 / Type 90 /
	# M1917 / Chinese M35 / Mk II / M33 / slouch hat / Adrian / Dutch M34.
	"Germans": [0.13, 0.123, 0.65], "Russians": [0.14, 0.124, 0.72],
	"Japanese": [0.115, 0.111, 0.74], "Americans": [0.09, 0.160, 0.64],
	"Chinese": [0.125, 0.120, 0.70], "British": [0.075, 0.165, 0.66],
	"UK_Pacific": [0.075, 0.165, 0.66], "Italians": [0.11, 0.110, 0.55],
	"ANZAC": [0.10, 0.180, 0.665], "French": [0.10, 0.138, 0.59],
	"Dutch": [0.12, 0.130, 0.75],
}
const ARTILLERY := {
	# Gun, shield and carriage proportions reference leFH 18, F-22, Type 90,
	# M2A1, FK 16, 25-pounder, 75/32, mle 1897 and 7-veld respectively.
	"Germans": [0.79, 0.51, 0.31, 0.19], "Russians": [1.05, 0.47, 0.29, 0.21],
	"Japanese": [0.96, 0.44, 0.25, 0.18], "Americans": [0.74, 0.56, 0.33, 0.22],
	"Chinese": [0.87, 0.46, 0.28, 0.185], "British": [0.90, 0.53, 0.32, 0.20],
	"UK_Pacific": [0.90, 0.53, 0.32, 0.20], "Italians": [0.93, 0.42, 0.26, 0.195],
	"ANZAC": [0.90, 0.53, 0.32, 0.20], "French": [0.98, 0.45, 0.35, 0.205],
	"Dutch": [0.84, 0.43, 0.30, 0.175],
}

var _builder := SurfaceTool.new()
var _paint := Color.WHITE
static var _material: StandardMaterial3D


static func material() -> StandardMaterial3D:
	if _material == null:
		_material = StandardMaterial3D.new()
		_material.vertex_color_use_as_albedo = true
		_material.roughness = 0.62
		_material.metallic = 0.23
		_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	return _material


static func build(owner: String, kind: String, color: Color) -> ArrayMesh:
	var sculpt = load("res://game/unit_miniatures.gd").new()
	sculpt._paint = color
	sculpt._builder.begin(Mesh.PRIMITIVE_TRIANGLES)
	if kind == "infantry":
		sculpt._infantry(owner)
	elif kind in ["armour", "tank"]:
		sculpt._tank(owner)
	elif kind in ["artillery", "aaGun"]:
		sculpt._artillery(owner, kind == "aaGun")
	elif kind == "mech_infantry":
		sculpt._truck(owner)
	elif kind in ["fighter", "tactical_bomber", "bomber"]:
		sculpt._aircraft(owner, kind)
	elif kind in ["transport", "submarine", "destroyer", "cruiser", "carrier", "battleship"]:
		sculpt._ship(owner, kind)
	else:
		sculpt._box(Vector3(0, 0.2, 0), Vector3(0.6, 0.4, 0.4), color)
	return sculpt._builder.commit()


func _part(mesh: PrimitiveMesh, center: Vector3, color: Color, rotation := Vector3.ZERO) -> void:
	var arrays := mesh.get_mesh_arrays()
	var points: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	var basis := Basis.from_euler(rotation)
	for index in indices:
		_builder.set_color(color)
		_builder.set_normal(basis * normals[index])
		_builder.add_vertex(center + basis * points[index])


func _box(center: Vector3, dimensions: Vector3, color: Color, rotation := Vector3.ZERO) -> void:
	var box := BoxMesh.new()
	box.size = dimensions
	_part(box, center, color, rotation)


func _cylinder(center: Vector3, radius: float, height: float, color: Color, sides := 10, rotation := Vector3.ZERO, top := -1.0) -> void:
	var cylinder := CylinderMesh.new()
	cylinder.bottom_radius = radius
	cylinder.top_radius = radius if top < 0 else top
	cylinder.height = height
	cylinder.radial_segments = sides
	cylinder.rings = 0
	_part(cylinder, center, color, rotation)


func _sphere(center: Vector3, radius: float, height: float, color: Color) -> void:
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = height
	sphere.radial_segments = 10
	sphere.rings = 5
	_part(sphere, center, color)


func _tank(owner: String) -> void:
	var p: Array = TANKS.get(owner, TANKS.French)
	var hull: Color = _paint
	var tracks := _paint.darkened(0.65)
	for side in [-1, 1]:
		_box(Vector3(side * p[1] * 0.47, 0.14, 0), Vector3(0.17, 0.25, p[0]), tracks)
		for wheel in 5:
			_cylinder(Vector3(side * p[1] * 0.6, 0.13, (wheel - 2) * p[0] / 5.3), 0.085, 0.022, hull.darkened(0.25), 8, Vector3(0, 0, PI / 2))
	_box(Vector3(0, 0.24, 0), Vector3(p[1] * 0.77, 0.25, p[0] * 0.88), hull)
	if owner == "French":
		_sphere(Vector3(0, 0.32, -0.06), p[1] * 0.43, 0.24, hull)
	else:
		_box(Vector3(0, 0.37, -0.04), Vector3(p[1] * 0.7, 0.11, p[0] * 0.52), hull.lightened(0.07))
	_cylinder(Vector3(0, 0.46, -0.13), p[2], 0.25, hull, p[3])
	_cylinder(Vector3(0, 0.61, -0.13), 0.075, 0.05, hull.lightened(0.13), 8)
	_cylinder(Vector3(0, 0.48, -0.28 - p[4] * 0.5), 0.027, p[4], hull.darkened(0.1), 8, Vector3(PI / 2, 0, 0))
	_box(Vector3(0, 0.39, p[0] * 0.29), Vector3(p[1] * 0.47, 0.025, 0.18), tracks)
	if p[5]:
		for side in [-1, 1]:
			_box(Vector3(side * p[1] * 0.53, 0.22, 0), Vector3(0.04, 0.24, p[0] * 0.88), hull)


func _infantry(owner: String) -> void:
	var profile: Array = INFANTRY.get(owner, INFANTRY.French)
	_cylinder(Vector3(0, 0.035, 0), 0.25, 0.07, _paint.darkened(0.25), 16)
	for side in [-1, 1]:
		_box(Vector3(side * 0.09, 0.17, 0.04 * side), Vector3(0.12, 0.27, 0.13), _paint.darkened(0.16), Vector3(0.18 * side, 0, 0.12 * side))
	_box(Vector3(0, 0.39, 0), Vector3(0.28, 0.25, 0.19), _paint)
	_sphere(Vector3(0, 0.57, -0.015), 0.09, 0.15, Color("#b29e7a"))
	_cylinder(Vector3(0, 0.64, -0.02), profile[1], 0.025, _paint.darkened(0.1), 12)
	_sphere(Vector3(0, 0.66, -0.02), 0.10, profile[0], _paint)
	if owner == "French":
		_box(Vector3(0, 0.72, -0.02), Vector3(0.025, 0.035, 0.19), _paint.darkened(0.2))
	for side in [-1, 1]:
		_box(Vector3(side * 0.16, 0.39, -0.12), Vector3(0.11, 0.12, 0.27), _paint, Vector3(0, side * -0.45, 0))
	_box(Vector3(0.12, 0.42, -0.26), Vector3(0.035, 0.04, profile[2]), Color("#514838"), Vector3(0, -0.25, 0))
	_box(Vector3(0, 0.39, 0.14), Vector3(0.20, 0.19, 0.09), _paint.darkened(0.23))


func _artillery(owner: String, aaa: bool) -> void:
	var profile: Array = ARTILLERY.get(owner, ARTILLERY.French)
	if owner in ["British", "UK_Pacific", "ANZAC"]:
		_cylinder(Vector3(0, 0.045, 0.08), 0.29, 0.04, _paint.darkened(0.18), 16)
	for side in [-1, 1]:
		_cylinder(Vector3(side * 0.28, 0.18, 0.1), profile[3], 0.09, _paint.darkened(0.6), 12, Vector3(0, 0, PI / 2))
		_cylinder(Vector3(side * 0.34, 0.18, 0.1), 0.12, 0.015, _paint, 10, Vector3(0, 0, PI / 2))
		_box(Vector3(side * 0.14, 0.08, 0.35), Vector3(0.055, 0.06, 0.65), _paint, Vector3(0, side * 0.30, 0))
	_box(Vector3(0, 0.33, -0.02), Vector3(profile[1], profile[2], 0.055), _paint)
	_cylinder(Vector3(0, 0.35, -0.35), 0.038, profile[0], _paint, 8, Vector3(PI / 2 - (0.55 if aaa else 0.12), 0, 0))


func _truck(owner: String) -> void:
	var length: float = TANKS.get(owner, TANKS.French)[0]
	_box(Vector3(0, 0.21, 0), Vector3(0.45, 0.15, length), _paint.darkened(0.3))
	_box(Vector3(0, 0.42, -0.27), Vector3(0.46, 0.35, 0.35), _paint)
	_box(Vector3(0, 0.38, 0.2), Vector3(0.44, 0.27, 0.56), _paint.darkened(0.13))
	for side in [-1, 1]:
		for z in [-0.32, 0.28]:
			_cylinder(Vector3(side * 0.25, 0.15, z), 0.14, 0.07, _paint.darkened(0.7), 10, Vector3(0, 0, PI / 2))


func _aircraft(owner: String, kind: String) -> void:
	var p: Array = AIRCRAFT.get(owner, AIRCRAFT.British)
	var bomber := kind == "bomber"
	var wings: float = p[1] * (1.25 if bomber else 1.0)
	var length: float = p[0] * (1.3 if bomber else 1.0)
	_cylinder(Vector3(0, 0.38, 0), 0.085, length, _paint, 10, Vector3(PI / 2, 0, 0), 0.035)
	for side in [-1, 1]:
		_box(Vector3(side * wings * 0.23, 0.36, -0.03), Vector3(wings * 0.50, 0.055, 0.23), _paint, Vector3(0, side * p[2], 0))
		_box(Vector3(side * 0.2, 0.38, length * 0.36), Vector3(0.40, 0.035, 0.12), _paint)
		if bomber or kind == "tactical_bomber":
			_cylinder(Vector3(side * wings * 0.24, 0.38, -0.08), 0.075, 0.36, _paint.darkened(0.17), 8, Vector3(PI / 2, 0, 0))
	_box(Vector3(0, 0.50, length * 0.35), Vector3(0.04, 0.25, 0.20), _paint)
	_sphere(Vector3(0, 0.47, -0.05), 0.07, 0.09, Color("#405b60"))
	_cylinder(Vector3(0, 0.04, 0), 0.21, 0.04, _paint.darkened(0.45), 16)
	_cylinder(Vector3(0, 0.21, 0), 0.025, 0.33, Color("#b5a47f"), 6)


func _ship(owner: String, kind: String) -> void:
	var p: Array = NAVAL.get(owner, NAVAL.British)
	var length: float = p[0] * (0.82 if kind in ["submarine", "destroyer"] else 1.0)
	var width: float = p[1]
	_sphere(Vector3(0, 0.11, 0), width * 0.5, 0.16, _paint.darkened(0.2))
	# A tapered bow/stern, rather than a rectangular token.
	_box(Vector3(0, 0.10, 0), Vector3(width, 0.16, length * 0.65), _paint.darkened(0.15))
	for side in [-1, 1]:
		_cylinder(Vector3(0, 0.11, side * length * 0.34), width * 0.5, length * 0.3, _paint, 8, Vector3(PI / 2, 0, 0), 0.015)
	if kind == "submarine":
		_box(Vector3(0, 0.26, 0.02), Vector3(0.12, 0.20, 0.22), _paint)
		return
	if kind == "carrier":
		_box(Vector3(0, 0.24, 0), Vector3(width * 1.4, 0.06, length * 0.92), _paint.lightened(0.15))
		_box(Vector3(width * 0.65, 0.36, 0.1), Vector3(0.10, 0.22, 0.34), _paint)
	else:
		_box(Vector3(0, 0.24, 0.02), Vector3(width * 0.66, 0.17, length * 0.45), _paint.lightened(0.12))
		for i in int(p[2]):
			var z: float = (float(i) / maxf(p[2] - 1, 1) - 0.5) * length * 0.63
			_cylinder(Vector3(0, 0.26, z), width * 0.29, 0.11, _paint, 8)
			_box(Vector3(0, 0.30, z + (-0.12 if z < 0 else 0.12)), Vector3(0.025, 0.025, 0.28), _paint.darkened(0.15))
		_cylinder(Vector3(0, 0.40, 0.04), width * 0.20, 0.22, _paint.darkened(0.15), 8)
