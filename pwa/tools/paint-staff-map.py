"""Compose the self-contained European survey plate from registered geography and painted inks."""
import base64
from io import BytesIO
from pathlib import Path
import random
import xml.etree.ElementTree as ET

import contourpy
import numpy as np
from PIL import Image
from scipy.ndimage import zoom
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


def bitmap(image):
    data = BytesIO()
    image.save(data, 'WEBP', quality=90, method=6)
    return 'data:image/webp;base64,'+base64.b64encode(data.getvalue()).decode()


def join_edges(rgb):
    # Wrap the swatch through a low-contrast seam to preserve parcel shapes and compass direction.
    height,width,_=rgb.shape
    overlap=width//6
    left=rgb[:,:overlap].astype(float)
    right=rgb[:,width-overlap:].astype(float)
    cost=np.mean((left-right)**2,axis=2)
    parents=np.zeros((height,overlap),dtype=int)
    totals=cost[0].copy()
    for y in range(1,height):
        padded=np.pad(totals,(1,1),constant_values=np.inf)
        choices=np.stack([padded[i:i+overlap] for i in range(3)])
        parents[y]=choices.argmin(axis=0)-1
        totals=cost[y]+choices.min(axis=0)
    x=int(totals.argmin())
    result=rgb[:,:width-overlap].copy()
    for y in reversed(range(height)):
        result[y,:x]=right[y,:x]
        x+=parents[y,x]
    return result


def texture(name, column, row, pitch, paper, tint, angle):
    w,h=sheet.size
    piece=sheet.crop((column*w//2+5,row*h//2+5,(column+1)*w//2-5,(row+1)*h//2-5))
    piece=Image.blend(piece,Image.new('RGB',piece.size,paper),tint)
    sample=join_edges(np.asarray(piece))
    sample=join_edges(sample.transpose(1,0,2)).transpose(1,0,2)
    pattern=element(defs,'pattern',id=name,patternUnits='userSpaceOnUse',width=pitch,
                    height=pitch,patternTransform=f'rotate({angle})')
    if name == 'woods':
        # Expose the field or upland through gaps in the original painted tree canopy.
        green = sample[:, :, 1].astype(float)
        coverage = np.clip((200 - green) / 47, 0, 1)
        alpha = np.rint(255 * coverage**2 * (3 - 2 * coverage)).astype('uint8')
        sample = np.dstack((sample, alpha))
    else:
        element(pattern,'rect',width=pitch,height=pitch,fill=paper)
    element(pattern,'image',width=pitch+.03,height=pitch+.03,
            href=bitmap(Image.fromarray(sample)),preserveAspectRatio='none')


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


def woodland_mask():
    # The mask carries only density. Individual crowns keep the resolution of the painted swatch.
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
    altitude=np.load(ART/'europe-relief-06m.npz')['half_meters']*.5
    cg=smooth_grid(altitude)
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
texture('fields',0,0,51,'#efe9d1',.37,-11)
texture('woods',1,0,40,'#a9b994',.24,7)
texture('upland',0,1,48,'#d8d6bb',.37,-7)
texture('sea',1,1,39,'#789eb5',.30,0)

geography=list(source.findall('{%s}path'%NS))
land_path=next(p.get('d') for p in geography if p.get('fill')=='#e4dec4')
element(element(defs,'clipPath',id='land'),'path',d=land_path)
element(atlas,'rect',width=WIDTH,height=HEIGHT,fill='url(#sea)')
element(atlas,'path',d=land_path,fill='none',stroke='#b8c7b4',stroke_width=4.5,opacity=.80)
ground=element(atlas,'g',clip_path='url(#land)')
element(ground,'rect',width=WIDTH,height=HEIGHT,fill='url(#fields)')
height_data=np.load(ART/'europe-relief-06m.npz')['half_meters']
uplands=smooth_grid(height_data*.5)
polygons,cuts=uplands.filled(460,10000)
upland_paths=[path_data(poly[a:b])+'Z' for poly,offsets in zip(polygons,cuts) for a,b in zip(offsets[:-1],offsets[1:])]
element(ground,'path',d=''.join(upland_paths),fill='url(#upland)',fill_rule='evenodd')
woodland_mask()
element(ground,'rect',width=WIDTH,height=HEIGHT,fill='url(#woods)',mask='url(#woodland-density)')
relief=Image.open(ART/'relief.webp').convert('RGBA')
element(ground,'image',href=bitmap(relief),width=WIDTH,height=HEIGHT,opacity=.58)
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
