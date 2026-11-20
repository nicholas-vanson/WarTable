"""Compose the self-contained European survey plate from registered geography and painted inks."""
import base64
from io import BytesIO
from pathlib import Path
import random
from contextlib import contextmanager
import shutil
import xml.etree.ElementTree as ET

import contourpy
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from playwright.sync_api import sync_playwright
from scipy.ndimage import distance_transform_edt, zoom
from matplotlib.path import Path as PlotPath

ART = Path(__file__).resolve().parent / 'art'
OUTPUT = ART.parents[1] / 'assets' / 'staff-map.svg'
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
WIDTH, HEIGHT = 2006, 1716
rng = random.Random(1940)


def element(parent, tag, **attrs):
    return ET.SubElement(parent, '{%s}%s' % (NS, tag),
                         {k.replace('_', '-'): str(v) for k, v in attrs.items()})


def project(lon, lat):
    return (lon+13)*34, (69-lat)*52


def bitmap(image, quality=90, alpha_quality=100):
    data = BytesIO()
    image.save(data, 'WEBP', quality=quality, alpha_quality=alpha_quality, method=4)
    return 'data:image/webp;base64,'+base64.b64encode(data.getvalue()).decode()


def land_silhouette(path):
    # Paint the same rings as the vector coast, from continents down to their holes and islands.
    mask = Image.new('L', (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(mask)
    rings = []
    for ring in path.strip('MZ').split('ZM'):
        coords = np.fromstring(ring.replace(',', ' '), sep=' ').reshape(-1, 2)
        x, y = coords.T
        area = np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))
        rings.append((area, coords))
    rings.sort(key=lambda ring: abs(ring[0]), reverse=True)
    exterior = np.sign(rings[0][0])
    for area, coords in rings:
        draw.polygon([tuple(pt) for pt in coords], fill=255 if np.sign(area) == exterior else 0)
    return mask


def scatter(width, height, pitch, spacing, is_water, brush_rng):
    stride = pitch * spacing
    stamps = []
    for row, y in enumerate(np.arange(-stride, height+stride, stride*.87)):
        for x in np.arange(-stride, width+stride, stride):
            cx = x + (row % 2)*stride/2 + brush_rng.uniform(-.21, .21)*stride
            cy = y + brush_rng.uniform(-.21, .21)*stride
            bearing = brush_rng.uniform(-8, 8) if is_water else brush_rng.uniform(-180, 180)
            sx = pitch * brush_rng.uniform(.95, 1.25) * brush_rng.choice((-1, 1))
            sy = pitch * brush_rng.uniform(.95, 1.25)
            stamps.append((brush_rng.randrange(4), cx, cy, bearing, sx, sy))
    brush_rng.shuffle(stamps)
    return stamps


def feather(size, phase):
    v, u = np.mgrid[-1:1:complex(size), -1:1:complex(size)]
    theta = np.arctan2(v, u)
    edge = .94 + .035*np.cos(3*theta+phase) + .025*np.sin(5*theta-phase)
    alpha = np.clip((edge - np.hypot(u, v))/.23, 0, 1)
    return alpha**2 * (3 - 2*alpha)


def paint_material(parent, name, column, row, pitch, paper, tint, footprint, seed):
    # Quilt small samples at print resolution first. Only the larger patches need drawing on the phone.
    brush_rng = random.Random(seed)
    width, height = sheet.size
    quadrant = sheet.crop((column*width//2+5, row*height//2+5,
                           (column+1)*width//2-5, (row+1)*height//2-5))
    quadrant = Image.blend(quadrant, Image.new('RGB', quadrant.size, paper), tint)
    paper_value = np.asarray(quadrant).mean()
    size = min(quadrant.size) * 2 // 3
    brushes = []
    for _ in range(4):
        x = brush_rng.randrange(quadrant.width - size + 1)
        y = brush_rng.randrange(quadrant.height - size + 1)
        sample = np.asarray(quadrant.crop((x, y, x+size, y+size)))
        alpha = feather(size, brush_rng.uniform(0, 2*np.pi))
        if name == 'sea':
            ink = sample.mean(axis=2) - paper_value
            alpha *= np.clip(abs(ink)/115, 0, .25)
            sample = np.where(ink[:, :, None] > 0, [220, 226, 210], [51, 87, 107])
        brushes.append(Image.fromarray(np.dstack((sample, np.rint(255*alpha))).astype('uint8')))

    # Reuse the pigment, but never tile a square. Both levels vary their crop, scale and bearing.
    pixels = 1024
    span = pitch * 3.4
    for i in range(4):
        patch = Image.new('RGBA', (pixels, pixels), (0, 0, 0, 0) if name == 'sea' else paper)
        for j, cx, cy, angle, sx, sy in scatter(pixels, pixels, pixels/3.4, .49, name == 'sea', brush_rng):
            brush = brushes[j].resize((round(abs(sx)), round(sy)), Image.Resampling.BICUBIC)
            if sx < 0:
                brush = ImageOps.mirror(brush)
            brush = brush.rotate(angle, Image.Resampling.BICUBIC, expand=True)
            patch.alpha_composite(brush, (round(cx-brush.width/2), round(cy-brush.height/2)))
        alpha = feather(pixels, brush_rng.uniform(0, 2*np.pi)) * np.asarray(patch.getchannel('A'))
        if name == 'woods':
            # Lift the pale gaps in the canopy so the underlying parcels show through.
            green = np.asarray(patch.getchannel('G'), dtype=float)
            coverage = np.clip((198 - green)/45, 0, 1)
            alpha *= coverage**2 * (3 - 2*coverage)
        patch.putalpha(Image.fromarray(np.rint(alpha).astype('uint8')))
        element(defs, 'image', id=f'{name}-{i}', x=-.5, y=-.5, width=1, height=1,
                preserveAspectRatio='none', href=bitmap(patch, quality=78, alpha_quality=64))

    # Cull only distant, invisible patches. The registered vector paths still define exact edges.
    footprint = footprint.resize(((WIDTH+7)//8, (HEIGHT+7)//8), Image.Resampling.BOX)
    for i, x, y, bearing, sx, sy in scatter(WIDTH, HEIGHT, span, .70 if name == 'woods' else .47,
                                            name == 'sea', brush_rng):
        radius = span*.90
        if footprint.crop((int((x-radius)//8), int((y-radius)//8),
                           int((x+radius)//8)+1, int((y+radius)//8)+1)).getbbox():
            transform = f'translate({x:.1f} {y:.1f}) rotate({bearing:.1f}) scale({sx:.1f} {sy:.1f})'
            element(parent, 'use', href=f'#{name}-{i}', transform=transform)


def sea_plate(ground_mask, heights):
    # Ground distance ties the nearshore wash to even the smallest vector headlands.
    depth = np.maximum(-np.asarray(Image.fromarray(heights).resize(
        (WIDTH, HEIGHT), Image.Resampling.BILINEAR)), 0)
    offshore = distance_transform_edt(np.asarray(ground_mask) == 0)
    depth *= 1 - np.exp(-offshore / 4.5)
    stops = [0, 8, 25, 70, 200, 1000, 4500]
    inks = np.array([[196,207,188], [178,201,190], [151,186,185], [125,164,178],
                     [107,148,168], [95,133,156], [82,116,142]])
    rgb = np.stack([np.interp(depth, stops, channel) for channel in inks.T], axis=2)
    element(atlas, 'image', width=WIDTH, height=HEIGHT, href=bitmap(Image.fromarray(rgb.astype('uint8'))))
    paint_material(atlas, 'sea', 1, 1, 74, '#789eb5', .15, ImageOps.invert(ground_mask), 1941)


def sea_contours(parent, heights):
    soundings = smooth_grid(heights)
    for meters in (20, 50, 100, 200, 1000, 2000):
        lines = [path_data(line) for line in soundings.lines(-meters) if len(line) >= 12]
        element(parent, 'path', d=''.join(lines), fill='none', stroke='#557d89',
                stroke_width=.30, opacity=.38)


def path_data(points):
    # Retain survey shapes to sub-pixel accuracy while limiting the plate size.
    geometry=PlotPath(points)
    geometry.simplify_threshold=.15
    simplified=geometry.cleaned(simplify=True).vertices[:-1]
    return 'M'+' '.join(f'{x:.2f},{y:.2f}' for x,y in simplified)


def smooth_grid(values):
    fine=zoom(values,2,order=3)
    return contourpy.contour_generator(x=np.linspace(0,WIDTH,fine.shape[1]),
               y=np.linspace(0,HEIGHT,fine.shape[0]),z=fine,fill_type='OuterOffset')


@contextmanager
def rasterize(art):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
        page = browser.new_page()
        svg = 'data:image/svg+xml;base64,' + base64.b64encode(ET.tostring(art)).decode()
        page.evaluate("""async src => {
            window.plate = new Image();
            plate.src = src;
            await plate.decode();
        }""", svg)

        def crop(x, y, w, h, scale, quality):
            return page.evaluate("""([x,y,w,h,scale,quality]) => {
                const canvas = document.createElement('canvas');
                canvas.width = w*scale;
                canvas.height = h*scale;
                canvas.getContext('2d').drawImage(plate, x,y,w,h, 0,0,canvas.width,canvas.height);
                return canvas.toDataURL('image/webp', quality);
            }""", [x, y, w, h, scale, quality])

        yield crop
        browser.close()


def bake_pigment(art):
    # Paint resolution follows the source brush detail. Separate tiles let the phone draw only
    # the visible terrain at close zoom. Overlap one map unit to avoid fractional-pixel seams.
    tiles = []
    with rasterize(art) as crop:
        for y in range(0, HEIGHT, 288):
            for x in range(0, WIDTH, 336):
                w, h = min(337, WIDTH-x), min(289, HEIGHT-y)
                tiles.append((x, y, w, h, crop(x, y, w, h, 5, .78)))
    for layer in list(art):
        art.remove(layer)
    for x, y, w, h, data in tiles:
        element(art, 'image', x=x, y=y, width=w, height=h, href=data)


def woodland_mask():
    # Density fades independently from the higher-resolution painted tree crowns.
    xs = np.arange(WIDTH) + .5
    ys = np.arange(HEIGHT) + .5
    noise_rng = np.random.default_rng(1940)

    def noise(cols, rows):
        pixels = noise_rng.integers(0, 256, (rows, cols), dtype='uint8')
        swatch = Image.fromarray(pixels).resize((WIDTH, HEIGHT), Image.Resampling.BICUBIC)
        return np.asarray(swatch, dtype='float32') / 255

    density = (.38 * noise(24, 18) + .36 * noise(54, 67)
               + .19 * noise(141, 128) + .07 * noise(487, 430))
    for lon, lat, rx, ry in [(5.6,50.15,37,29),(7.1,48.2,16,38),(8.2,48.25,15,36),
                             (-.8,48.65,34,25),(1.6,47.6,25,25),(14,62,160,235),(28,58,180,120)]:
        x, y = project(lon, lat)
        density += .31 * np.exp(-((xs[None, :] - x) / rx)**2 - ((ys[:, None] - y) / ry)**2)

    cover = np.clip((density - .40) / .43, 0, 1)
    feather = np.rint(255 * cover**2 * (3 - 2 * cover)).astype('uint8')
    mask = element(defs, 'mask', id='woodland-density', maskUnits='userSpaceOnUse',
                   x=0, y=0, width=WIDTH, height=HEIGHT, color_interpolation='sRGB')
    element(mask, 'image', width=WIDTH, height=HEIGHT, href=bitmap(Image.fromarray(feather)))


def contours():
    cg=smooth_grid(heights)
    # Regional generalization: fine lowland intervals and fewer lines in the Alps.
    for level in (50,100,200,400,600,1000,1500,2000,2500,3000):
        lines=[line for line in cg.lines(level) if len(line)>=5]
        element(ground,'path',d=''.join(path_data(line) for line in lines),fill='none',
                stroke='#897b59',stroke_width=.42 if level in (200,1000) else .28,opacity=.65)
        # Label a few long contours along their local tangent, in meters.
        for line in lines:
            if len(line)<75 or level not in (100,200,600,1000):
                continue
            i=len(line)//2
            x,y=line[i]
            if any((x-px)**2+(y-py)**2<85**2 for px,py in label_sites):
                continue
            dx,dy=line[i+1]-line[i-1]
            angle=(np.degrees(np.arctan2(dy,dx))+90)%180-90
            element(ground,'text',x=0,y=0,transform=f'translate({x:.1f} {y:.1f}) rotate({angle:.1f})',
                    fill='#706b53',font_family='sans-serif',font_size=3.5,text_anchor='middle',
                    stroke='#e7dfc2',stroke_width=1.1,paint_order='stroke').text=str(level)
            label_sites.append((x,y))


def settlements():
    towns=[(2.35,48.86,2),(4.35,50.85,1.3),(3.06,50.63,1),(.17,49.49,.8),
           (1.09,49.44,1),(-.37,49.18,.8),(1.9,47.9,.8),(-.58,44.84,1.1),
           (4.9,52.36,1.2),(6.96,50.94,1.25),(-.12,51.51,2),(13.41,52.52,1.7),
           (12.5,41.9,1.4),(21,52.23,1.3),(4.84,45.76,1.1),(6.18,48.69,.8)]
    for lon,lat,size in towns:
        x,y=project(lon,lat)
        town=element(ground,'g',transform=f'translate({x:.1f} {y:.1f}) rotate({rng.randrange(-30,31)})')
        blocks=set()
        for i in range(round(52*size)):
            blocks.add((round(rng.gauss(0,2.4*size)), round(rng.gauss(0,2*size))))
        for col,row in sorted(blocks):
            element(town,'rect',x=f'{col*1.8:.1f}',y=f'{row*1.5:.1f}',width=rng.choice([.8,1.1,1.3]),
                    height=rng.choice([.55,.8,.95]),fill=rng.choice(['#55564e','#68695d','#797669']))


source=ET.parse(ART/'geography.svg').getroot()
atlas=ET.Element('{%s}svg'%NS,{'viewBox':f'0 0 {WIDTH} {HEIGHT}','width':str(WIDTH),'height':str(HEIGHT)})
defs=element(atlas,'defs')
sheet=Image.open(ART/'staff-swatches.webp').convert('RGB')
geography=list(source.findall('{%s}path'%NS))
land_path=next(p.get('d') for p in geography if p.get('fill')=='#e4dec4')
element(element(defs,'clipPath',id='land'),'path',d=land_path)
land_mask = land_silhouette(land_path)
heights = np.load(ART/'europe-relief-06m.npz')['half_meters'].astype('float32') * .5
sea_plate(land_mask, heights)
element(atlas,'path',d=land_path,fill='none',stroke='#e1dcc1',stroke_width=1.9,opacity=.92)
ground=element(atlas,'g',clip_path='url(#land)')
element(ground,'rect',width=WIDTH,height=HEIGHT,fill='#e7dfc5')
paint_material(ground, 'fields', 0, 0, 58, '#efe9d1', .37, land_mask, 1942)
uplands=smooth_grid(heights)
polygons,cuts=uplands.filled(460,10000)
upland_paths=[path_data(poly[a:b])+'Z' for poly,offsets in zip(polygons,cuts) for a,b in zip(offsets[:-1],offsets[1:])]
element(element(defs, 'clipPath', id='high-ground'), 'path', d=''.join(upland_paths), clip_rule='evenodd')
high_ground = element(ground, 'g', clip_path='url(#high-ground)')
element(high_ground, 'rect', width=WIDTH, height=HEIGHT, fill='#d8d6bb')
hill_mask = Image.fromarray((heights > 430).astype('uint8') * 255).resize((WIDTH, HEIGHT))
paint_material(high_ground, 'upland', 0, 1, 60, '#d8d6bb', .37, hill_mask, 1943)
woodland_mask()
woods = element(ground, 'g', mask='url(#woodland-density)')
paint_material(woods, 'woods', 1, 0, 51, '#a9b994', .24, land_mask, 1944)
relief=Image.open(ART/'relief.webp').convert('RGBA')
element(ground,'image',href=bitmap(relief),width=WIDTH,height=HEIGHT,opacity=.58)
bake_pigment(atlas)
defs = element(atlas, 'defs')
element(element(defs, 'clipPath', id='land'), 'path', d=land_path)
element(element(defs, 'clipPath', id='water'), 'path',
        d=f'M0,0H{WIDTH}V{HEIGHT}H0Z'+land_path, clip_rule='evenodd')
sea_contours(element(atlas, 'g', clip_path='url(#water)'), heights)
ground = element(atlas, 'g', clip_path='url(#land)')
label_sites=[]
contours()
# Generalized main roads in the western exercise; bends are independent of parcel edges.
roads=[
    [(-.37,49.18),(.17,49.14),(.69,49.14),(1.15,49.02),(1.72,48.99),(2.35,48.86)],
    [(1.85,50.95),(2.24,50.75),(2.27,50.29),(2.3,49.89),(2.5,49.45),(2.58,49.21),(2.35,48.86)],
    [(3.06,50.63),(3.39,50.61),(3.82,50.63),(4.08,50.74),(4.35,50.85)],
    [(4.40,51.22),(4.48,51.03),(4.35,50.85),(4.62,50.70),(4.87,50.47),(5.22,50.26),(5.72,49.92),(6.13,49.61)],
    [(2.35,48.86),(2.93,48.96),(3.40,49.05),(4.03,49.26),(4.68,49.08),(5.38,49.16),(6.18,49.12)],
]
def rounded_route(points):
    parts=['M%.2f,%.2f'%tuple(points[0])]
    for prev,p,nxt in zip(points,points[1:],points[2:]):
        parts.append('L%.2f,%.2f Q%.2f,%.2f %.2f,%.2f'%(
            *(p*.85+prev*.15),*p,*(p*.85+nxt*.15)))
    return ' '.join(parts)+' L%.2f,%.2f'%tuple(points[-1])

settlements()
for road in roads:
    d=rounded_route(np.array([project(*p) for p in road]))
    element(ground,'path',d=d,fill='none',stroke='#938c78',stroke_width=1.28)
    element(ground,'path',d=d,fill='none',stroke='#f7f1db',stroke_width=.88)
# Geographic linework stays as native paths at every zoom, including standalone downloads.
for source_path in geography:
    attrs=dict(source_path.attrib)
    fill,stroke=attrs.get('fill'),attrs.get('stroke')
    if fill=='#e5dfc5':
        continue
    if fill=='#e4dec4':
        attrs.update(fill='none',stroke='#59625b',**{'stroke-width':'.68'})
    elif stroke=='#605c4b':
        attrs.update(stroke='#726b52',**{'stroke-width':'1.10','fill-opacity':'.14'})
    elif stroke=='#849d9e':
        element(atlas,'path',d=attrs['d'],fill='none',stroke='#577b86',stroke_width=1.35)
        attrs.update(stroke='#a6c0c3',**{'stroke-width':'.72'})
    elif fill=='#b4c6c4':
        attrs.update(fill='#8eafbb',stroke='#5f7c82')
    elif stroke=='#826f53':
        # Fine charcoal rails plus transverse ties, with paper ballast for contrast.
        coords=np.array([tuple(map(float,p.split(','))) for p in attrs['d'][1:].split()])
        attrs['d']=rounded_route(coords)
        if 'stroke-dasharray' not in attrs:
            element(atlas,'path',d=attrs['d'],fill='none',stroke='#eee6cd',stroke_width=2.25)
            attrs.update(stroke='#454943',opacity='.93',**{'stroke-width':'.70'})
        else:
            attrs.update(stroke='#454943',opacity='.93',**{'stroke-width':'1.85','stroke-dasharray':'.36 1.65'})
    ET.SubElement(atlas,'{%s}path'%NS,attrs)
ET.ElementTree(atlas).write(OUTPUT, encoding='utf-8')

# At overview scale the whole theater fits in a single draw.
with rasterize(atlas) as crop:
    overview = crop(0, 0, WIDTH, HEIGHT, 2, .81)
    OUTPUT.with_name('staff-overview.webp').write_bytes(base64.b64decode(overview.split(',')[1]))
