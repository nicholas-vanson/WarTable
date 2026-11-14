"""Bake offline world relief and territory masks from GEBCO_08 elevation.

Run with Python 3, numpy, scipy and Pillow. The game uses the resulting PNGs;
it never downloads terrain or needs these Python packages at runtime.
See game/art/terrain/SOURCES.md for provenance and alignment limitations.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA256 = "4a70590d40dd7b9c69b9ab359d1dc4475ce97c1d2d13625223b248364112c699"
SOURCE_URL = "https://raw.githubusercontent.com/doleckijakub/earth-heightmap-normal-calculator/a3ee496d149f90f897f67b64bb54a494d48b80a7/gebco_08_rev_elev_21600x10800.png"

# Longitude/latitude control points register real elevation to the deliberately
# distorted game board. These are approximate regional centers, NOT new borders.
COORDS = {
    "Caroline Islands": [158, 7], "Iwo Jima": [141.3, 24.8], "Paulau Island": [134.5, 7.5],
    "Marshall Islands": [168, 8], "Shantung": [118, 36], "Formosa": [121, 23.7],
    "Kwangsi": [109, 23.5], "Korea": [127.5, 38], "Kiangsu": [119, 32.5],
    "Kiangsi": [116, 28], "Japan": [138, 37], "Jehol": [118, 41.5], "Okinawa": [127.8, 26.5],
    "Marianas": [145.7, 16], "Siam": [101, 16], "Manchuria": [126, 45], "Hainan": [109.5, 19],
    "Shensi": [108.5, 35], "Yunnan": [101, 25], "Suiyuyan": [111, 41], "Kweichow": [106.5, 27],
    "Hunan": [112, 27.5], "Kansu": [103, 38], "Hopei": [115, 37.5], "Tsinghai": [97, 35.5],
    "Szechwan": [103, 30.5], "Chahar": [114, 40.8], "Sikang": [98, 30], "Anhwe": [117, 32],
    "Gilbert Islands": [173, 1], "Fiji": [178, -18], "Ceylon": [80.7, 7.5], "Samoa": [188, -14],
    "Shan State": [98, 21], "Burma": [95, 22], "British Columbia": [235, 54],
    "India": [80, 24], "West India": [73, 23], "Malaya": [102, 4], "Borneo": [114, 1],
    "Kwangtung": [113, 23], "Queensland": [145, -22], "Victoria": [144, -37],
    "New Britain": [151, -5.5], "Northern Territory": [133, -19], "New Zealand": [173, -41],
    "New South Wales": [147, -32], "South Australia": [135, -30], "Western Australia": [122, -26],
    "Solomon Islands": [160, -9], "New Guinea": [145, -6], "Philippines": [123, 12],
    "Line Islands": [203, 2], "Mexico": [253, 27], "Guam": [144.8, 13.4],
    "Wake Island": [166.6, 19.3], "Western United States": [240, 40], "Alaska": [208, 65],
    "Aleutian Islands": [185, 52], "Johnston Island": [190.5, 16.7], "Hawaiian Islands": [204.5, 20.5],
    "Midway": [182.6, 28.2], "Sakha": [129, 67], "Evenkiyskiy": [95, 65],
    "Yenisey": [102, 60], "Soviet Far East": [165, 66], "Amur": [132, 52],
    "Yakut S.S.R.": [115, 64], "Timguska": [91, 57], "Siberia": [147, 65],
    "Kazakhstan": [68, 48], "Buryatia": [109, 53], "French Indo China": [106, 16],
    "New Hebrides": [167, -16], "Celebes": [121, -2], "Java": [110, -7],
    "Dutch New Guinea": [136, -4], "Sumatra": [102, -1], "Olgiy": [89, 49],
    "Dzavhan": [96, 49], "Central Mongolia": [102, 46], "Himalayas": [85, 28],
    "Buyant-Uhaa": [109, 46], "Ulaanbaatar": [107, 48], "Tsagaan Olom": [96, 46],
    "West Indies": [-75, 20], "Central United States": [-98, 39], "Central America": [-86, 13],
    "Greenland": [-42, 73], "Southeast Mexico": [-99, 20], "Eastern United States": [-81, 38],
    "Belgian Congo": [24, -4], "Iceland": [-19, 65], "Quebec": [-71, 52],
    "Alberta Saskatchewan Manitoba": [-103, 54], "Trans-Jordan": [36, 31],
    "British Somaliland": [45, 10], "Alexandria": [29, 31], "Gibraltar": [-5.4, 36.1],
    "New Brunswick Nova Scotia": [-64, 46], "Egypt": [30, 27], "Union of South Africa": [25, -29],
    "Cyprus": [33, 35], "British Guiana": [-59, 5], "Gold Coast": [-2, 8],
    "Rio de Oro": [-13, 25], "Ontario": [-85, 50], "Scotland": [-4, 57],
    "South West Africa": [17, -23], "Nigeria": [8, 10], "Kenya": [38, 0], "Malta": [14.4, 35.9],
    "United Kingdom": [-2, 53], "Anglo Egyptian Sudan": [30, 14], "Rhodesia": [28, -16],
    "Tanganyika Territory": [35, -6], "Newfoundland Labrador": [-59, 54], "Morocco": [-6, 32],
    "French Equatorial Africa": [17, 3], "Normandy Bordeaux": [-0.5, 46.5],
    "French Central Africa": [12, 15], "French Madagascar": [47, -20], "French Guiana": [-53, 4],
    "Algeria": [3, 28], "Southern France": [5, 44.5], "Syria": [38, 35],
    "French West Africa": [-7, 16], "France": [3, 48], "Tunisia": [10, 34],
    "Greater Southern Germany": [11, 47.8], "Slovakia Hungary": [20, 48],
    "Western Germany": [7, 51], "Romania": [25, 46], "Poland": [20, 52], "Germany": [13, 52.5],
    "Norway": [10, 65], "Denmark": [10, 56], "Holland Belgium": [5, 51.5],
    "Tobruk": [24, 31], "Albania": [20, 41], "Northern Italy": [10, 45],
    "Libya": [17, 28], "Sicily": [14, 37.5], "Italian Somaliland": [46, 5],
    "Southern Italy": [15, 41], "Ethiopia": [39, 9], "Sardinia": [9, 40],
    "Belarus": [28, 54], "Karelia": [33, 65], "Baltic States": [25, 57],
    "Bryansk": [34, 53], "Rostov": [40, 47], "Nenetsia": [54, 68], "Urals": [60, 65],
    "Vyborg": [29, 61], "Archangel": [41, 64], "Eastern Poland": [25, 52],
    "Bessarabia": [29, 47], "Russia": [38, 56], "Tambov": [42, 52], "Ukraine": [33, 48],
    "Western Ukraine": [27, 50], "Novosibirsk": [83, 55], "Vologda": [42, 60],
    "Volgograd": [45, 49], "Turkmenistan": [59, 39], "Novgorod": [31, 59],
    "Caucasus": [44, 43], "Smolensk": [32, 55], "Samara": [50, 53],
    "Portugal": [-8, 39], "Portuguese Guinea": [-15, 12], "Ecuador": [-78, -1],
    "Chile": [-71, -30], "Afghanistan": [66, 34], "Sierra Leone": [-12, 8.5],
    "Turkey": [35, 39], "Mozambique": [35, -18], "Saudi Arabia": [45, 24],
    "Paraguay": [-58, -23], "Switzerland": [8, 47], "Pripet Marshes": [28, 52],
    "Eire": [-8, 53], "Crete": [25, 35], "Argentina": [-65, -35], "Bulgaria": [25, 43],
    "Angola": [18, -12], "Greece": [23, 39], "Iraq": [44, 33],
    "Eastern Persia": [58, 32], "Uruguay": [-56, -33], "Brazil": [-52, -12],
    "Venezuela": [-66, 8], "Northwest Persia": [47, 37], "Persia": [51, 32],
    "Sweden": [16, 62], "Yugoslavia": [18, 44], "Spain": [-4, 40], "Colombia": [-73, 5],
    "Bolivia": [-64, -17], "Liberia": [-9, 6], "Peru": [-75, -10], "Finland": [26, 65],
    "Suriname": [-56, 4],
}


def build(source, output, width=2048):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA256:
        raise ValueError("GEBCO source checksum mismatch")
    Image.MAX_IMAGE_PIXELS = 250_000_000  # known 21600 x 10800 source, bounded memory
    elevation = np.asarray(Image.open(source).resize((5400, 2700), Image.Resampling.BILINEAR))
    data = json.loads((ROOT / 'game/global_1940.json').read_text())
    world_w, world_h = data['size']
    height = round(width * world_h / world_w)
    sx, sy = width / world_w, height / world_h
    ids = Image.new('I', (width, height))
    draw = ImageDraw.Draw(ids)
    names = list(data['regions'])
    for water in [True, False]:
        for ident, name in enumerate(names, 1):
            r = data['regions'][name]
            if r['water'] != water:
                continue
            for polygon in r['detail']:
                draw.polygon([(polygon[i]*sx, polygon[i+1]*sy) for i in range(0, len(polygon), 2)], fill=ident)
    region_ids = np.asarray(ids)
    land_ids = [i for i,n in enumerate(names,1) if not data['regions'][n]['water']]
    land = np.isin(region_ids,land_ids)
    points, coords = [], []
    for name, r in data['regions'].items():
        if r['water']:
            continue
        if name not in COORDS:
            raise ValueError('Missing geographic anchor: '+name)
        for shift in [-1, 0, 1]:
            points.append([r['center'][0]+shift*world_w,r['center'][1]])
            coords.append([COORDS[name][0]+shift*360,COORDS[name][1]])
    yy, xx = np.mgrid[:height,:width]
    target = np.stack([xx.ravel()/sx,yy.ravel()/sy],axis=-1)
    geo = LinearNDInterpolator(points,coords)(target)
    missing = ~np.isfinite(geo[:,0])
    geo[missing] = NearestNDInterpolator(points,coords)(target[missing])
    lon, lat = geo[:,0].reshape(height,width),geo[:,1].reshape(height,width)
    dem = map_coordinates(elevation.astype(np.float32),[(90-lat)/180*2699,((lon+180)%360)/360*5399],order=1,mode='nearest')/255
    coast = np.clip(distance_transform_edt(land)/2.0,0,1)
    dem = gaussian_filter(np.maximum(dem,0.008)*land,0.6)*coast
    image_h = np.uint8(np.clip(dem**0.85*255,0,255))
    dist_norm, dist_edge = np.zeros_like(dem), np.zeros_like(dem)
    for ident in range(1,len(names)+1):
        mask = region_ids==ident
        if not mask.any():
            continue
        distance = distance_transform_edt(mask)
        dist_norm[mask] = distance[mask]/max(distance.max(),1)
        dist_edge[mask] = np.minimum(distance[mask]/16,1)
    territory = np.stack([region_ids%256,region_ids//256,np.uint8(dist_norm*255),np.uint8(dist_edge*255)],axis=-1).astype(np.uint8)
    # Natural land cover, independent of controller; elevation and latitude set
    # the survey-model palette. No baked lighting: Godot lights the actual mesh.
    t = np.clip(dem[...,None]*3,0,1)
    low,high=np.array([177,178,146]),np.array([153,137,112])
    color=low*(1-t)+high*t
    desert=((abs(lat)<33)&(abs(lat)>12)&(((lon>-20)&(lon<65))|((lon>112)&(lon<145))))
    color[desert]=color[desert]*.45+np.array([211,185,139])*.55
    snow=np.clip((dem-.42)/.4,0,1)[...,None]
    color=color*(1-snow)+np.array([233,225,207])*snow
    color[~land]=[35,65,79]
    output.mkdir(parents=True,exist_ok=True)
    Image.fromarray(image_h).save(output/'global_height.png')
    Image.fromarray(np.uint8(color)).save(output/'global_geography.png')
    Image.fromarray(territory).save(output/'global_territories.png')
    (output/'registration.json').write_text(json.dumps({'source_sha256':SOURCE_SHA256,'size':[width,height],'region_names':names,'anchors':COORDS},indent=2)+'\n')
    print(f'Baked {width}x{height} relief for {len(names)} territories; {len(COORDS)} geographic anchors.')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--download',action='store_true')
    parser.add_argument('--output',type=Path,default=ROOT/'game/art/terrain')
    args=parser.parse_args()
    if args.download:
        args.source.parent.mkdir(parents=True,exist_ok=True)
        with urllib.request.urlopen(SOURCE_URL,timeout=90) as r:
            args.source.write_bytes(r.read())
    build(args.source,args.output)
