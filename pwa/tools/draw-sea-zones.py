"""Draw original sea zones on the staff map projection using Global 1940 zone contacts."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parents[1]
FRAME = box(-13, 36, 46, 69)

# Shared offshore junctions and hand-drawn dividers. End coastal dividers just inland
# so the registered coastline supplies their exact endpoints.
biscay = (-7.1, 48.45)
approaches = (-7.45, 49.6)
north_sea = (2.15, 55.55)
bank = (2.5, 58.45)
shetland = (-.6, 60.45)
orkney = (-4.5, 59.6)
atlantic = (-10.5, 62.4)
balearic = (1.25, 38.1)
sardinia = (6.8, 39.75)
sicily = (11.7, 37.3)
ionian = (16.05, 37.15)
aegean = (22.3, 36.1)
dividers = [
    [(-13.5, 39.0), (-10.7, 39.55), (-8.95, 39.6)],  # 91 / 104
    [(-5.67, 36.17), (-5.67, 35.8)],  # Gibraltar
    [(-8.84, 43.0), (-9.25, 44.8), (-8.35, 47.2), biscay],
    [biscay, (-5.55, 48.45), (-4.45, 48.45)],
    [biscay, approaches],
    [approaches, (-10.2, 50.35), (-13.5, 51.0)],
    [approaches, (-6.25, 49.88), (-5.5, 50.11)],
    [(-13.5, 55.45), (-11.2, 55.0), (-9.74, 54.03)],
    [(-6.12, 55.08), (-5.89, 55.21), (-5.60, 55.37)],
    [(-2.1, 55.76), (-.2, 55.6), north_sea],
    # Follow the Ems estuary to the joint vertex of the Dutch and German territory paths.
    [north_sea, (4.65, 54.45), (6.987, 53.8), (6.94, 53.55), (6.98, 53.42),
     (7.011, 53.36), (7.107, 53.32), (7.161, 53.30), (686.7/34-13, 69-817.3/52)],
    [north_sea, (2.6, 57.1), bank],
    [bank, (4.2, 58.7), (5.85, 58.95)],
    [bank, shetland], [shetland, orkney],
    [orkney, (-4.4, 58.45)], [orkney, atlantic],
    [atlantic, (-13.5, 60.8)], [atlantic, (-8.45, 65.3), (-8.5, 70)],
    [shetland, (.75, 63.25), (1.8, 66.6), (4.4, 70)],
    [(7.2, 70), (8.7, 68.4), (12.1, 66.15), (13.45, 65.73)],
    [(8.0, 58.2), (9.25, 57.86), (10.54, 57.69)],
    [(12.1, 54.05), (12.05, 54.47), (12.1, 54.85), (12.88, 55.17), (13.56, 55.46)],
    [(19.67, 54.37), (18.4, 55.9), (16.4, 57.05)],
    [(0.24, 40.55), (1.25, 39.35), balearic],
    [balearic, (.25, 36.85), (-.45, 35.7)], [balearic, (4.1, 38.7), sardinia],
    [sardinia, (7.15, 42.35), (7.53, 43.84)], [sardinia, (8.45, 38.2), sicily],
    [sicily, (10.4, 35.7)], [sicily, (13.4, 36.2), (15.35, 36.35), ionian],
    [ionian, (16.27, 38.35)], [ionian, (18.8, 36.85), aegean],
    [aegean, (22.04, 37.07)], [aegean, (23.0, 35.6)],
    [(26.1, 35.7), (26.75, 36.12), (30.5, 36.15), (32.1, 35.7)],
    [(29.00, 41.17), (29.15, 41.15)],  # Turkish Straits
]
# One interior map-label anchor per zone, in longitude/latitude.
anchors = {
    91:(-10.85,37.55), 92:(-.9,37.2), 93:(4.65,41.25), 94:(4.4,37.55),
    95:(10.6,40.3), 96:(15.1,36.12), 97:(18.3,38.2), 98:(29.65,36.07),
    99:(24.9,38.4), 100:(33.0,42.55), 104:(-10.3,46.45), 105:(-3.55,46.65),
    109:(-5.35,52.65), 110:(.45,50.45), 111:(.05,57.15), 112:(5.55,55.6),
    113:(11.25,56.83), 114:(16.45,55.7), 115:(19.7,59.0),
    119:(-8.55,57.55), 123:(-11.75,63.75), 124:(-4.2,62.45),
    125:(2.35,61.55), 126:(10.9,68.4), 127:(41.4,68.45),
}


def geographic_shape(path):
    rings = []
    for ring in path.strip('MZ').split('ZM'):
        xy = [tuple(map(float, pt.split(','))) for pt in ring.split()]
        rings.append(Polygon([(x/34-13, 69-y/52) for x, y in xy]))
    # The SVG includes both exterior and interior rings.
    land = Polygon()
    for ring in sorted(rings, key=lambda p: p.area, reverse=True):
        if ring.area:
            land = land.symmetric_difference(ring.buffer(0))
    return land


def parts(geometry):
    return list(geometry.geoms) if hasattr(geometry, 'geoms') else [geometry]


def svg_line(coords):
    return 'M'+' '.join(f'{(x+13)*34:.1f},{(69-y)*52:.1f}' for x,y in coords)


def svg_area(geometry):
    return ''.join(svg_line(r.coords)+'Z' for p in parts(geometry)
                   for r in [p.exterior, *p.interiors])


source = ET.parse(ROOT/'tools/art/geography.svg')
land_path = next(p.get('d') for p in source.findall('{*}path') if p.get('fill') == '#e4dec4')
water = FRAME.difference(geographic_shape(land_path))
# Inland lakes and the Caspian Sea have no numbered game space.
water = unary_union([p for p in parts(water) if p.area > .015 and p.centroid.x < 44
                     and (p.area > 20 or p.intersects(FRAME.boundary))])
network = unary_union([water.boundary, *(LineString(line) for line in dividers)])
cells = [p for p in polygonize(network) if water.covers(p.representative_point())]
zones = {}
for number, xy in anchors.items():
    cell = next((c for c in cells if c.contains(Point(xy))), None)
    if cell is None or cell in zones.values():
        raise ValueError(f'Check anchor {number} at {xy}, cell {None if cell is None else cell.bounds}, conflicts {[k for k,v in zones.items() if v==cell]}')
    zones[number] = cell
# Small disconnected bays and channels inherit the nearest labelled water polygon.
main_cells = zones.copy()
for cell in cells:
    if cell not in main_cells.values():
        if cell.area > 4:
            raise ValueError(f'Unassigned water at {cell.representative_point().wkt}, area {cell.area:.2f}')
        owner = min(main_cells, key=lambda n: main_cells[n].distance(cell.representative_point()))
        zones[owner] = zones[owner].union(cell)

# Check shared borders against the project's Second Edition connection data. Two links
# between mapped zones lie beyond the frame: 96–98 south of Crete and 126–127 around Norway.
facts = json.loads((ROOT.parent/'game/global_1940.json').read_text())['regions']
neighbors = {n: sorted(int(name.split()[0]) for name in facts[f'{n} Sea Zone']['links']
                       if name.endswith(' Sea Zone')) for n in zones}
territories = json.loads((ROOT/'assets/territories.json').read_text())
for key, name in {'hb':'Holland Belgium','wg':'Western Germany','nb':'Normandy Bordeaux','fr':'France'}.items():
    coast = geographic_shape(territories[key]).boundary
    actual = {n for n, zone in zones.items() if coast.intersection(zone.boundary).length > .00001}
    expected = {n for n in zones if f'{n} Sea Zone' in facts[name]['links']}
    if actual != expected:
        raise ValueError(f'{name} touches {actual}, expected {expected}')

edges = []
for number, shape in zones.items():
    for other in zones:
        if other < number:
            shared = shape.boundary.intersection(zones[other].boundary)
            expected = other in neighbors[number] and (other, number) not in {(96,98), (126,127)}
            if (shared.length > .00001) != expected:
                raise ValueError(f'Unexpected boundary between zones {other} and {number}')
            edges.extend(svg_line(line.coords) for line in parts(shared)
                         if line.geom_type=='LineString' and line.length > 0)
def label_room(zone, x, y, half_width):
    # Bound the full number and its two rules within this water polygon at each zoom.
    low, high = 0, 6
    for _ in range(12):
        mid = (low+high)/2
        rect = box(x-half_width*mid/34, y-8*mid/52, x+half_width*mid/34, y+8*mid/52)
        if zone.covers(rect):
            low = mid
        else:
            high = mid
    return round(low, 3)


asset = {'dividers': ''.join(edges), 'zones': [
    {'number':n, 'neighbors':neighbors[n], 'room':label_room(zones[n],x,y,14), 'ruleRoom':label_room(zones[n],x,y,20), 'label':[round((x+13)*34,1),round((69-y)*52,1)], 'd':svg_area(zones[n])}
    for n,(x,y) in anchors.items()]}
(ROOT/'assets/sea-zones.json').write_text(json.dumps(asset,separators=(',',':'))+'\n')
