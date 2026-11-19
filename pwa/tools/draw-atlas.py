"""Build the original atlas from public-domain Natural Earth 1:50m data.
Usage: python draw-atlas.py DATA_DIR (see README for the source datasets).
"""
import json
import math
import sys
from pathlib import Path
from xml.sax.saxutils import escape

import numpy as np
from PIL import Image
from shapely.geometry import shape, box, Polygon
from shapely.ops import unary_union

data = Path(sys.argv[1])
assets = Path(__file__).resolve().parents[1] / "assets"
west, south, east, north = -13, 36, 46, 69
width, height = 2006, 1716
extent = box(west, south, east, north)
def point(lon, lat):
    return ((lon-west)*34, (north-lat)*52)
def xy(lon, lat):
    return "%.1f,%.1f" % point(lon, lat)
def line(coords):
    return "M"+" ".join(xy(*c[:2]) for c in coords)
def path(g):
    if g.is_empty:
        return ''
    if g.geom_type == 'Polygon':
        return line(g.exterior.coords)+'Z'+''.join(line(h.coords)+'Z' for h in g.interiors)
    if g.geom_type == 'LineString':
        return line(g.coords)
    return ''.join(path(p) for p in getattr(g, 'geoms', []))
def features(name):
    return json.loads((data/(name+'.json')).read_text())['features']

countries = {}
for f in features('admin_0_countries'):
    geom = shape(f['geometry']).intersection(extent)
    if not geom.is_empty:
        countries[f['properties']['ADM0_A3']] = geom.simplify(.014, preserve_topology=True)
land = unary_union(list(countries.values()))
# Cartographic approximations for the four exercise areas; their legal graph is in rules.js.
holland = unary_union([countries[k] for k in ('NLD','BEL','LUX')])
germany = countries['DEU'].intersection(Polygon([(5,56),(10.1,56),(10.4,53.7),(10,52.8),(9.5,51.8),(10,50.9),(9.3,50),(10.2,49),(10.3,47),(5,47)]))
france = countries['FRA'].intersection(Polygon([(-5,51.6),(4,51.6),(8.5,50),(8,47.4),(6.3,46.5),(4,46.3),(2.5,46.1),(0.8,45.9),(.65,47.1),(.5,48.1),(.6,48.7),(1.55,49.6),(1.7,50.4)]))
normandy = countries['FRA'].difference(france).intersection(Polygon([(-6,51),(2.7,51),(2.5,46.1),(.8,45.9),(.3,44.6),(-1.5,43.3),(-6,43)]))
areas = {'hb':holland, 'wg':germany, 'fr':france, 'nb':normandy}
out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">', '''<defs><pattern id="sea" width="14" height="13" patternUnits="userSpaceOnUse"><path d="M2 6h2m4 5h1" stroke="#44696d" opacity=".32" stroke-width=".8"/></pattern></defs>''',
       '<rect width="100%" height="100%" fill="#b9ccca"/><rect width="100%" height="100%" fill="url(#sea)"/>']
def draw(g, attrs):
    out.append(f'<path d="{path(g)}" {attrs}/>')
draw(land,'fill="#e5dfc5" stroke="#799896" stroke-width="6" stroke-linejoin="round"')
draw(land,'fill="#e4dec4" stroke="#595e50" stroke-width="1.4"')
for a, color in zip(areas.values(),['#cec7a8','#cdc6a8','#d8d6ba','#d1d6bd']):
    draw(a,f'fill="{color}" stroke="#75694e" stroke-width="1.4" stroke-dasharray="5 2" stroke-linejoin="round"')
# Background regions deliberately have no modern political borders.
for feature in features('rivers_lake_centerlines'):
    g=shape(feature['geometry']).intersection(extent)
    if not g.is_empty:
        draw(g.simplify(.016),'fill="none" stroke="#849d9e" stroke-width=".95"')
for feature in features('lakes'):
    g=shape(feature['geometry']).intersection(extent)
    if not g.is_empty:
        draw(g.simplify(.02),'fill="#b4c6c4" stroke="#899a90" stroke-width=".65"')
# Generalized transport corridors between period cities, a visual layer only.
corridors = [
    [(-.12,51.51),(-.95,51.46),(-1.78,51.56),(-2.59,51.45)],
    [(-.12,51.51),(.51,51.28),(.87,51.15),(1.31,51.13)],
    [(2.35,48.86),(2.31,49.89),(3.06,50.63),(3.87,50.85),(4.35,50.85),(4.7,50.88),(5.57,50.64),(6.08,50.78),(6.96,50.94)],
    [(2.35,48.86),(1.45,49.10),(1.09,49.44),(.17,49.49)],
    [(2.35,48.86),(1.9,47.9),(.68,47.39),(.34,46.58),(.16,45.65),(-.58,44.84)],
    [(2.35,48.86),(4.03,48.96),(6.18,48.69),(7.75,48.58)],
    [(4.35,50.85),(4.40,51.22),(4.78,51.59),(4.48,51.92),(4.9,52.36)],
    [(6.96,50.94),(7.59,50.36),(8.27,50.00),(8.68,50.11),(9.93,49.79),(11.08,49.45)],
    [(8.68,50.11),(9.68,50.55),(10.32,50.98),(11.03,50.98),(12.37,51.34),(13.41,52.52)],
    [(13.41,52.52),(12.13,54.08)],[(2.35,48.86),(3.57,47.8),(4.84,46.30),(4.84,45.76),(4.82,43.95),(5.37,43.30)]
]
for coords in corridors:
    d=line(coords)
    out.append(f'<path d="{d}" fill="none" stroke="#826f53" opacity=".60" stroke-width=".7"/>')
    out.append(f'<path d="{d}" fill="none" stroke="#826f53" opacity=".58" stroke-width="2" stroke-dasharray=".65 4"/>')
for lon in range(-10,46,5):
    x,_=point(lon,0)
    out.append(f'<path d="M{x} 0v{height}" stroke="#4e6357" opacity=".21" stroke-width=".75"/>')
for lat in range(40,70,5):
    _,y=point(0,lat)
    out.append(f'<path d="M0 {y}h{width}" stroke="#4e6357" opacity=".21" stroke-width=".75"/>')
# Relief is geographically registered to the base; transparent white keeps ink and sea readable.
im = Image.open(data/'GRAY_50M_SR_W.tif').convert('L')
w,h=im.size
im=im.crop(tuple(round(v) for v in ((west+180)*w/360,(90-north)*h/180,(east+180)*w/360,(90-south)*h/180))).resize((width,height),Image.Resampling.BICUBIC)
a=np.asarray(im,dtype=float)
shade=np.clip((255-a)*.40,0,118).astype('uint8')
overlay=Image.new('RGBA',(width,height),(83,72,47,0))
overlay.putalpha(Image.fromarray(shade))
overlay.save(assets/'relief.webp',lossless=True)
# SVG images loaded as <image> cannot load external images; relief is a sibling in the map.
out.append('</svg>')
(assets/'atlas.svg').write_text(''.join(out))
(assets/'territories.json').write_text(json.dumps({key:path(g) for key,g in areas.items()},separators=(',',':')))
