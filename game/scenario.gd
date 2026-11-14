extends RefCounted
## Schematic two-player land scenario. The chart includes additional context regions.

const SIDES := ["Germany", "France"]
const COST := [3, 4, 6]
const STARTING_TREASURY := [14, 14]
const EMPTY := [0, 0, 0]
const OBJECTIVES := {"north_france": "Paris", "central_europe": "Berlin"}
const LEGACY_LAND := {
	"west_germany": {"name": "Western Germany", "owner": 0, "ipc": 4, "factory": 3, "units": [4, 2, 1]},
	"central_europe": {"name": "Central Europe", "owner": 0, "ipc": 3, "factory": 3, "units": [2, 0, 1]},
	"low_countries": {"name": "Low Countries", "owner": 1, "ipc": 1, "factory": 0, "units": [0, 0, 0]},
	"north_france": {"name": "Northern France", "owner": 1, "ipc": 4, "factory": 3, "units": [3, 1, 1]},
	"south_france": {"name": "Southern France", "owner": 1, "ipc": 2, "factory": 3, "units": [2, 1, 0]},
}
const LEGACY_LINKS := {
	"west_germany": ["central_europe", "low_countries", "north_france", "south_france"],
	"central_europe": ["west_germany"],
	"low_countries": ["west_germany", "north_france"],
	"north_france": ["low_countries", "west_germany", "south_france"],
	"south_france": ["north_france", "west_germany"],
}
const LAND := {
	"west_germany": {"name": "Western Germany", "owner": 0, "ipc": 4, "factory": 3, "units": [4, 2, 1]},
	"central_europe": {"name": "Germany", "owner": 0, "ipc": 3, "factory": 3, "units": [2, 0, 1]},
	"greater_south_germany": {"name": "Greater Southern Germany", "owner": 0, "ipc": 2, "factory": 0, "units": [1, 0, 0]},
	"low_countries": {"name": "Holland–Belgium", "owner": 1, "ipc": 1, "factory": 0, "units": [0, 0, 0]},
	"normandy_bordeaux": {"name": "Normandy–Bordeaux", "owner": 1, "ipc": 2, "factory": 3, "units": [1, 1, 0]},
	"north_france": {"name": "France", "owner": 1, "ipc": 4, "factory": 3, "units": [3, 1, 1]},
	"south_france": {"name": "Southern France", "owner": 1, "ipc": 2, "factory": 0, "units": [2, 1, 0]},
}
const LINKS := {
	"west_germany": ["central_europe", "greater_south_germany", "low_countries", "north_france"],
	"central_europe": ["west_germany", "greater_south_germany"],
	"greater_south_germany": ["west_germany", "central_europe"],
	"low_countries": ["west_germany", "north_france", "normandy_bordeaux"],
	"normandy_bordeaux": ["low_countries", "north_france", "south_france"],
	"north_france": ["west_germany", "low_countries", "normandy_bordeaux", "south_france"],
	"south_france": ["north_france", "normandy_bordeaux"],
}


static func starting_regions(expanded := true) -> Dictionary:
	return (LAND if expanded else LEGACY_LAND).duplicate(true)


static func name_of(zone: String, expanded := true) -> String:
	return (LAND if expanded else LEGACY_LAND)[zone].name
