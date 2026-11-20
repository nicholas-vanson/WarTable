"""Bake WarTable's watercolor and etched terrain into a registered, label-free atlas.

Run from any directory with Inkscape, Pillow, NumPy and SciPy installed.
"""
import random
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy.ndimage import distance_transform_edt

ART = Path(__file__).resolve().parent / 'art'
OUTPUT = ART.parents[1] / 'assets' / 'staff-map.webp'
MAP_SIZE = (2006, 1716)
SCALE = 2
SIZE = tuple(n * SCALE for n in MAP_SIZE)
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
rng = np.random.default_rng(1940)


def rasterize(svg):
    with tempfile.TemporaryDirectory() as temp:
        src = Path(temp) / 'layer.svg'
        png = Path(temp) / 'layer.png'
        ET.ElementTree(svg).write(src, encoding='utf-8')
        subprocess.run(['inkscape', str(src), '-w', str(SIZE[0]), '-h', str(SIZE[1]),
                        '--export-filename='+str(png)], check=True, capture_output=True)
        return Image.open(png).convert('RGBA')


def noise(width, height):
    patch = Image.fromarray(rng.integers(0, 256, (height, width), dtype=np.uint8))
    return np.asarray(patch.resize(SIZE, Image.Resampling.BICUBIC)).astype('float32') / 255


def mask(values):
    return Image.fromarray(np.uint8(np.clip(values, 0, 1) * 255))


def wash(paint, color, opacity):
    return Image.blend(paint, Image.new('RGB', paint.size, color), opacity)


def impression(sheet, col, row, pitch):
    # Reflected edges plus a slow displacement field keep the printed grain continuous.
    side = sheet.width // 2
    swatch = np.asarray(sheet.crop((col*side+6, row*side+6, (col+1)*side-6, (row+1)*side-6)))
    n = swatch.shape[0]
    def folded(v):
        return np.abs(np.mod(v.astype(np.int32), 2*n-2) - (n-1))
    u = folded(xx*pitch + 17*np.sin(yy/109) + 11*np.sin(xx/65+yy/75))
    v = folded(yy*pitch + 14*np.sin(xx/94) + 8*np.cos(xx/88-yy/64))
    return Image.fromarray(swatch[v, u])


def influence(lon, lat, rx, ry):
    cx, cy = (lon+13)*34, (69-lat)*52
    return np.exp(-((xx-cx)/rx)**2 - ((yy-cy)/ry)**2)


source = ET.parse(ART/'geography.svg').getroot()
land = next(p for p in source if p.get('fill') == '#e4dec4')
cut = ET.Element('{%s}svg'%NS, {'viewBox':source.get('viewBox')})
ET.SubElement(cut, '{%s}path'%NS, {'d':land.attrib['d'], 'fill':'white'})
land_mask = rasterize(cut).getchannel('A')
xx = np.arange(SIZE[0], dtype='float32')[None, :] / SCALE
yy = np.arange(SIZE[1], dtype='float32')[:, None] / SCALE
sheet = Image.open(ART/'staff-swatches.webp').convert('RGB')
fields = wash(impression(sheet, 0, 0, 3.1), '#eee3c7', .43)
woods = wash(impression(sheet, 1, 0, 3.5), '#ced1a6', .33)
ridges = wash(impression(sheet, 0, 1, 3.0), '#dcd3b7', .36)

# Illustrative woodland washes cluster around the Ardennes, Vosges, Black Forest
# and other wooded uplands. These are visual textures, independent of movement rules.
broad, fine = noise(78, 66), noise(320, 275)
wood = .86*broad + .29*fine - .75
for patch in [(5.6,50.15,37,29),(7.1,48.2,16,38),(8.2,48.25,15,36),
              (-.8,48.65,34,25),(1.6,47.6,25,25),(14,62,160,235),(28,58,180,120)]:
    wood += .40*influence(*patch)
ground = Image.composite(woods, fields, mask(wood*3))
relief = Image.open(ART/'relief.webp').getchannel('A').resize(SIZE, Image.Resampling.BICUBIC)
# Local variation in the registered hillshade identifies rugged areas.
contrast = np.asarray(relief.filter(ImageFilter.MaxFilter(7)), dtype='float32') - np.asarray(relief.filter(ImageFilter.MinFilter(7)), dtype='float32')
mountains = contrast/46
for belt in [(10,46.7,112,41),(-.2,42.75,90,24),(10,62,110,185),(8.2,48.2,23,33)]:
    mountains += .63*influence(*belt)
ground = Image.composite(ridges, ground, mask(mountains))
ground = Image.composite(Image.new('RGB',SIZE,'#695f45'), ground, relief.point(lambda v:min(95,int(v*.82))))

water = wash(impression(sheet, 1, 1, 2.3), '#86adbc', .47)
shore_distance = distance_transform_edt(np.asarray(land_mask)<128).astype('float32')/SCALE
shelf = np.exp(-shore_distance/(12+10*broad))
water = Image.composite(wash(water,'#ced8c1',.56), water, mask(shelf))
# Two fine bathymetric tints follow the real shore, printed lightly in shallow water.
for depth in (3.5, 8.5):
    shelf_line = np.exp(-((shore_distance-depth-.7*fine)/.65)**2)
    water = Image.composite(wash(water,'#477582',.30),water,mask(shelf_line))

# Add small original engraved settlement plans, using actual city positions as anchors.
towns = [(2.35,48.86,2.0),(4.35,50.85,1.3),(3.06,50.63,1.0),(.17,49.49,.8),
         (1.09,49.44,1.0),(-.37,49.18,.8),(1.9,47.9,.8),(-.58,44.84,1.1),
         (4.9,52.36,1.2),(6.96,50.94,1.25),(-.12,51.51,2.0),(13.41,52.52,1.7),
         (12.5,41.9,1.4),(21,52.23,1.3),(4.84,45.76,1.1),(6.18,48.69,.8)]
pen = ImageDraw.Draw(ground)
randomizer = random.Random(1940)
for lon,lat,magnitude in towns:
    cx,cy=(lon+13)*34,(69-lat)*52
    for i in range(round(24*magnitude)):
        x,y=randomizer.gauss(0,3.7*magnitude),randomizer.gauss(0,2.6*magnitude)
        x,y=round(x/1.9)*1.9,round(y/1.6)*1.6
        center=(cx+x*.93-y*.36, cy+x*.36+y*.93)
        corners=[((center[0]+dx*.93-dy*.36)*SCALE,(center[1]+dx*.36+dy*.93)*SCALE)
                 for dx,dy in [(-.7,-.45),(.7,-.45),(.7,.45),(-.7,.45)]]
        pen.polygon(corners, fill=randomizer.choice(['#776e58','#8a7e63','#9b8d70']))
picture = Image.composite(ground, water, land_mask)

# Print the existing geographic ink plate over the painting. Preserve all coordinates.
ink = ET.Element('{%s}svg'%NS, {'viewBox':source.get('viewBox')})
for path in source.findall('{%s}path'%NS):
    attrs = dict(path.attrib)
    if attrs.get('fill')=='#e5dfc5':
        continue
    if attrs.get('fill')=='#e4dec4':
        attrs.update(fill='none',stroke='#575e50',**{'stroke-width':'.88'})
    elif attrs.get('stroke')=='#605c4b':
        attrs.update(stroke='#66563f',**{'stroke-width':'1.5','fill-opacity':'.16'})
    elif attrs.get('stroke')=='#849d9e':
        attrs.update(stroke='#64868a',**{'stroke-width':'.85'})
    elif attrs.get('fill')=='#b4c6c4':
        attrs.update(fill='#9abcc0')
    ET.SubElement(ink,'{%s}path'%NS,attrs)
plate = rasterize(ink)
picture.paste(plate,(0,0),plate)
picture.save(OUTPUT,'WEBP',quality=81,method=6)
