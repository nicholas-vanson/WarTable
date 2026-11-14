extends RefCounted
## Drawn in board coordinates. Gameplay connectivity lives in scenario.gd.

const EXTENT := Vector2(1060, 680)

const TERRITORIES := [
	["ireland", "IRELAND", Vector2(76, 118), Color("#aaa684"), [
		Vector2(0, 69), Vector2(31, 66), Vector2(51, 83), Vector2(77, 75), Vector2(104, 92),
		Vector2(98, 121), Vector2(113, 138), Vector2(96, 169), Vector2(67, 177),
		Vector2(47, 193), Vector2(13, 182), Vector2(0, 158)]],
	["britain", "GREAT BRITAIN", Vector2(221, 114), Color("#bfbd94"), [
		Vector2(135, 0), Vector2(243, 0), Vector2(246, 29), Vector2(231, 45), Vector2(237, 65),
		Vector2(261, 83), Vector2(267, 117), Vector2(294, 131), Vector2(301, 151),
		Vector2(289, 169), Vector2(310, 193), Vector2(283, 202), Vector2(257, 196),
		Vector2(230, 210), Vector2(198, 206), Vector2(171, 216), Vector2(134, 231),
		Vector2(119, 226), Vector2(143, 203), Vector2(170, 184), Vector2(146, 176),
		Vector2(139, 157), Vector2(157, 138), Vector2(153, 121), Vector2(177, 105),
		Vector2(162, 88), Vector2(149, 57), Vector2(158, 36), Vector2(132, 23)]],
	["denmark", "DENMARK", Vector2(669, 69), Color("#b9ad84"), [
		Vector2(635, 93), Vector2(641, 68), Vector2(630, 51), Vector2(655, 32),
		Vector2(661, 13), Vector2(685, 5), Vector2(699, 18), Vector2(687, 40),
		Vector2(711, 55), Vector2(706, 78), Vector2(719, 89), Vector2(704, 102), Vector2(672, 96)]],
	["low_countries", "LOW COUNTRIES", Vector2(530, 208), Color("#a6ab83"), [
		Vector2(423, 269), Vector2(442, 250), Vector2(454, 225), Vector2(481, 209),
		Vector2(478, 194), Vector2(500, 168), Vector2(503, 140), Vector2(535, 125),
		Vector2(559, 124), Vector2(565, 152), Vector2(583, 177), Vector2(574, 211),
		Vector2(600, 240), Vector2(585, 271), Vector2(569, 302), Vector2(537, 289),
		Vector2(510, 306), Vector2(478, 289), Vector2(455, 272)]],
	["west_germany", "WESTERN GERMANY", Vector2(715, 199), Color("#bb9b66"), [
		Vector2(559, 124), Vector2(594, 114), Vector2(610, 97), Vector2(635, 93),
		Vector2(672, 96), Vector2(704, 102), Vector2(738, 112), Vector2(759, 100),
		Vector2(796, 94), Vector2(814, 128), Vector2(802, 166), Vector2(824, 199),
		Vector2(802, 229), Vector2(833, 258), Vector2(816, 298), Vector2(840, 331),
		Vector2(816, 359), Vector2(838, 393), Vector2(810, 431), Vector2(758, 436),
		Vector2(723, 457), Vector2(685, 448), Vector2(656, 454), Vector2(620, 420),
		Vector2(607, 385), Vector2(587, 353), Vector2(590, 329), Vector2(569, 302),
		Vector2(585, 271), Vector2(600, 240), Vector2(574, 211), Vector2(583, 177),
		Vector2(565, 152)]],
	["central_europe", "CENTRAL EUROPE", Vector2(946, 255), Color("#ada27c"), [
		Vector2(796, 94), Vector2(840, 85), Vector2(860, 65), Vector2(894, 70),
		Vector2(919, 58), Vector2(961, 66), Vector2(997, 55), Vector2(1035, 72), Vector2(1060, 62),
		Vector2(1060, 447), Vector2(1012, 433), Vector2(979, 453), Vector2(934, 430),
		Vector2(903, 455), Vector2(867, 447), Vector2(810, 431), Vector2(838, 393),
		Vector2(816, 359), Vector2(840, 331), Vector2(816, 298), Vector2(833, 258),
		Vector2(802, 229), Vector2(824, 199), Vector2(802, 166), Vector2(814, 128)]],
	["north_france", "NORTHERN FRANCE", Vector2(421, 362), Color("#8eb0a0"), [
		Vector2(162, 337), Vector2(191, 330), Vector2(225, 342), Vector2(259, 332),
		Vector2(280, 350), Vector2(304, 344), Vector2(308, 317), Vector2(333, 315),
		Vector2(345, 296), Vector2(370, 301), Vector2(393, 289), Vector2(405, 275),
		Vector2(423, 269), Vector2(455, 272), Vector2(478, 289), Vector2(510, 306),
		Vector2(537, 289), Vector2(569, 302), Vector2(590, 329), Vector2(587, 353),
		Vector2(607, 385), Vector2(620, 420), Vector2(656, 454), Vector2(620, 471),
		Vector2(590, 506), Vector2(542, 497), Vector2(505, 517), Vector2(456, 515),
		Vector2(424, 499), Vector2(372, 518), Vector2(333, 491), Vector2(300, 501),
		Vector2(273, 470), Vector2(253, 439), Vector2(234, 429), Vector2(235, 400),
		Vector2(213, 388), Vector2(182, 382), Vector2(152, 363)]],
	["south_france", "SOUTHERN FRANCE", Vector2(458, 546), Color("#afae88"), [
		Vector2(300, 501), Vector2(333, 491), Vector2(372, 518), Vector2(424, 499),
		Vector2(456, 515), Vector2(505, 517), Vector2(542, 497), Vector2(590, 506),
		Vector2(620, 471), Vector2(656, 454), Vector2(685, 448), Vector2(693, 474),
		Vector2(678, 502), Vector2(683, 531), Vector2(663, 553), Vector2(686, 587),
		Vector2(656, 609), Vector2(625, 602), Vector2(594, 594), Vector2(562, 603),
		Vector2(529, 628), Vector2(500, 627), Vector2(456, 614), Vector2(422, 616),
		Vector2(377, 597), Vector2(345, 604), Vector2(321, 585), Vector2(321, 552)]],
	["alpine_region", "ALPINE REGION", Vector2(786, 473), Color("#bdb18c"), [
		Vector2(685, 448), Vector2(723, 457), Vector2(758, 436), Vector2(810, 431),
		Vector2(867, 447), Vector2(903, 455), Vector2(884, 491), Vector2(846, 520),
		Vector2(809, 515), Vector2(773, 537), Vector2(736, 521), Vector2(702, 545),
		Vector2(683, 531), Vector2(678, 502), Vector2(693, 474)]],
	["italy", "NORTHERN ITALY", Vector2(838, 574), Color("#bca17c"), [
		Vector2(683, 531), Vector2(702, 545), Vector2(736, 521), Vector2(773, 537),
		Vector2(809, 515), Vector2(846, 520), Vector2(884, 491), Vector2(903, 455),
		Vector2(918, 499), Vector2(910, 537), Vector2(944, 555), Vector2(940, 586),
		Vector2(965, 618), Vector2(1001, 646), Vector2(1038, 655), Vector2(1060, 680),
		Vector2(914, 680), Vector2(891, 651), Vector2(865, 628), Vector2(856, 600),
		Vector2(825, 589), Vector2(794, 606), Vector2(771, 588), Vector2(737, 576),
		Vector2(709, 589), Vector2(686, 587), Vector2(663, 553)]],
	["iberia", "IBERIAN PENINSULA", Vector2(339, 647), Color("#b8ac82"), [
		Vector2(321, 585), Vector2(345, 604), Vector2(377, 597), Vector2(422, 616),
		Vector2(456, 614), Vector2(500, 627), Vector2(529, 628), Vector2(516, 647),
		Vector2(491, 652), Vector2(469, 680), Vector2(169, 680), Vector2(140, 651),
		Vector2(149, 630), Vector2(181, 636), Vector2(207, 626), Vector2(252, 630),
		Vector2(286, 615), Vector2(309, 615)]],
]

const SEAS := [
	["atlantic", "BAY OF BISCAY", Vector2(149, 490), "105", [Vector2(0, 412), Vector2(123, 415),
		Vector2(300, 499), Vector2(590, 454), Vector2(590, 575), Vector2(529, 628), Vector2(469, 680), Vector2(0, 680)]],
	["channel", "ENGLISH CHANNEL", Vector2(266, 286), "110", [Vector2(0, 308), Vector2(192, 272),
		Vector2(385, 232), Vector2(405, 275), Vector2(590, 270), Vector2(590, 454), Vector2(300, 499), Vector2(123, 415), Vector2(0, 412)]],
	["north_sea", "NORTH SEA", Vector2(417, 106), "111", [Vector2.ZERO, Vector2(704, 0),
		Vector2(766, 96), Vector2(590, 270), Vector2(405, 275), Vector2(385, 232), Vector2(192, 272), Vector2(0, 308)]],
	["baltic", "BALTIC SEA", Vector2(873, 34), "114", [Vector2(704, 0), Vector2(1060, 0),
		Vector2(1060, 270), Vector2(590, 270), Vector2(766, 96)]],
	["mediterranean", "WESTERN MEDITERRANEAN", Vector2(660, 636), "93", [Vector2(590, 270), Vector2(1060, 270),
		Vector2(1060, 680), Vector2(469, 680), Vector2(529, 628), Vector2(590, 575), Vector2(590, 454)]],
]

const POINTS := [
	[Vector2(254, 174), "London", "city"],
	[Vector2(182, 166), "Airfield", "airfield"],
	[Vector2(524, 171), "Amsterdam", "town"],
	[Vector2(663, 238), "Ruhr works", "factory"],
	[Vector2(396, 401), "Paris", "city"],
	[Vector2(932, 153), "Berlin", "city"],
	[Vector2(569, 549), "Lyon", "town"],
]

const STACK_ANCHORS := {
	"west_germany": [Vector2(669, 283), Vector2(669, 340)],
	"central_europe": [Vector2(878, 285), Vector2(878, 340)],
	"low_countries": [Vector2(478, 224), Vector2(462, 263)],
	"north_france": [Vector2(308, 443), Vector2(465, 405)],
	"south_france": [Vector2(404, 578), Vector2(550, 553)],
	"normandy_bordeaux": [Vector2(263, 387), Vector2(270, 443)],
	"greater_south_germany": [Vector2(874, 350), Vector2(901, 400)],
}

const ROUTE_ANCHORS := {
	"west_germany": Vector2(729, 332),
	"central_europe": Vector2(944, 332),
	"low_countries": Vector2(530, 244),
	"north_france": Vector2(480, 434),
	"south_france": Vector2(494, 584),
	"normandy_bordeaux": Vector2(348, 426),
	"greater_south_germany": Vector2(944, 390),
}

const FRONT_STACKS := {
	"north_france": [Vector2(433, 414), Vector2(467, 349)],
	"central_europe": [Vector2(875, 203), Vector2(903, 254)],
}
const FRONT_ROUTES := {"north_france": Vector2(518, 389), "central_europe": Vector2(943, 205)}

const FRONT_TERRITORIES := {
	"low_countries": ["low_countries", "HOLLAND–BELGIUM", Vector2(523, 206), Color("#a6ab83"), TERRITORIES[3][4]],
	"alpine_region": ["alpine_region", "SWITZERLAND", Vector2(786, 473), Color("#bdb18c"), TERRITORIES[8][4]],
	"north_france": ["north_france", "FRANCE", Vector2(522, 321), Color("#8eb0a0"), [
		Vector2(455, 272), Vector2(478, 289), Vector2(510, 306), Vector2(537, 289),
		Vector2(569, 302), Vector2(590, 329), Vector2(587, 353), Vector2(607, 385),
		Vector2(620, 420), Vector2(656, 454), Vector2(620, 471), Vector2(590, 506),
		Vector2(542, 497), Vector2(505, 517), Vector2(456, 515), Vector2(424, 499),
		Vector2(372, 518), Vector2(386, 478), Vector2(404, 437), Vector2(386, 401),
		Vector2(408, 372), Vector2(401, 346), Vector2(418, 312)]],
	"central_europe": ["central_europe", "GERMANY", Vector2(946, 124), Color("#ada27c"), [
		Vector2(796, 94), Vector2(840, 85), Vector2(860, 65), Vector2(894, 70),
		Vector2(919, 58), Vector2(961, 66), Vector2(997, 55), Vector2(1035, 72),
		Vector2(1060, 62), Vector2(1060, 308), Vector2(1003, 297), Vector2(963, 313),
		Vector2(923, 294), Vector2(870, 306), Vector2(816, 298), Vector2(833, 258),
		Vector2(802, 229), Vector2(824, 199), Vector2(802, 166), Vector2(814, 128)]],
}

const FRONT_ADDITIONS := [
	["normandy_bordeaux", "NORMANDY–BORDEAUX", Vector2(309, 359), Color("#98b4a4"), [
		Vector2(162, 337), Vector2(191, 330), Vector2(225, 342), Vector2(259, 332),
		Vector2(280, 350), Vector2(304, 344), Vector2(308, 317), Vector2(333, 315),
		Vector2(345, 296), Vector2(370, 301), Vector2(393, 289), Vector2(405, 275),
		Vector2(423, 269), Vector2(455, 272), Vector2(418, 312), Vector2(401, 346),
		Vector2(408, 372), Vector2(386, 401), Vector2(404, 437), Vector2(386, 478),
		Vector2(372, 518), Vector2(333, 491), Vector2(300, 501), Vector2(273, 470),
		Vector2(253, 439), Vector2(234, 429), Vector2(235, 400), Vector2(213, 388),
		Vector2(182, 382), Vector2(152, 363)]],
	["greater_south_germany", "GREATER SOUTHERN GERMANY", Vector2(945, 342), Color("#b59a76"), [
		Vector2(816, 298), Vector2(870, 306), Vector2(923, 294), Vector2(963, 313),
		Vector2(1003, 297), Vector2(1060, 308), Vector2(1060, 447), Vector2(1012, 433),
		Vector2(979, 453), Vector2(934, 430), Vector2(903, 455), Vector2(867, 447),
		Vector2(810, 431), Vector2(838, 393), Vector2(816, 359), Vector2(840, 331)]],
]


static func territories(expanded: bool) -> Array:
	if not expanded:
		return TERRITORIES
	var result := []
	for region in TERRITORIES:
		result.append(FRONT_TERRITORIES.get(region[0], region))
	result.append_array(FRONT_ADDITIONS)
	return result
