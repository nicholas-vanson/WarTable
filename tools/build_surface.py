"""Register Blue Marble surface color to the existing Global 1940 relief.

This is a geospatial texture bake, not a new terrain mesh or rules map.
Python dependencies: numpy, scipy, Pillow. See game/art/terrain/SOURCES.md.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

import numpy as np
from PIL import Image
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
from scipy.ndimage import binary_erosion, distance_transform_edt, gaussian_filter, map_coordinates

from build_relief import COORDS, ROOT, SOURCE_SHA256 as ELEVATION_SHA256

SOURCE_URL = "https://raw.githubusercontent.com/vasturiano/three-globe/1e1f4400b80179809f761e632e207d9a3cfc298e/example/img/earth-blue-marble.jpg"
SOURCE_SHA256 = "228deba2e4b600146bdcb6cfa359b8ead6aacc2b1c13550a29cd82824cfa1c01"


def build(source, elevation_source, output, width=8192):
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("Blue Marble source checksum mismatch")
    rgb = np.asarray(Image.open(source).convert("RGB"), dtype=np.float32)
    # The board enlarges islands and distorts coasts. Extend nearby land color
    # into source water before registering so land cannot acquire blue wedges.
    if hashlib.sha256(elevation_source.read_bytes()).hexdigest() != ELEVATION_SHA256:
        raise ValueError("GEBCO land-mask source checksum mismatch")
    Image.MAX_IMAGE_PIXELS = 250_000_000
    source_height = np.asarray(Image.open(elevation_source).resize((rgb.shape[1], rgb.shape[0]), Image.Resampling.NEAREST))
    # Use actual source land coverage, not a color threshold: pale shallow sea
    # pixels otherwise become false land and leave angular grey fill patches.
    reliable_land = binary_erosion(source_height > 0, iterations=2)
    reliable_land &= ~((rgb[..., 2] > rgb[..., 0] * 1.16) & (rgb[..., 2] > rgb[..., 1] * 1.07))
    water = ~reliable_land
    nearest_land = distance_transform_edt(water, return_distances=False, return_indices=True)
    for channel in range(3):
        plane = rgb[..., channel]
        plane[water] = plane[tuple(nearest_land[:, water])]
        smoothed = gaussian_filter(plane, 2.0)
        plane[water] = smoothed[water]
    del nearest_land
    # Lift dark satellite imagery just enough to read as a physical board.
    # No parchment tint: retain the source's natural vegetation/desert contrast.
    rgb = np.clip((rgb / 255.0) ** 0.78 * 255.0, 0, 255)
    data = json.loads((ROOT / "game/global_1940.json").read_text())
    world_w, world_h = data["size"]
    height = round(width * world_h / world_w)
    packed = np.asarray(Image.open(ROOT / "game/art/terrain/global_height.png").resize((width, height), Image.Resampling.NEAREST))
    land = packed[..., 2] > 127
    elevation = (packed[..., 0].astype(np.float32) * 256 + packed[..., 1]) / 65535
    points, coords = [], []
    for name, region in data["regions"].items():
        if region["water"]:
            continue
        for shift in [-1, 0, 1]:
            points.append([region["center"][0] + shift * world_w, region["center"][1]])
            coords.append([COORDS[name][0] + shift * 360, COORDS[name][1]])
    interpolate = LinearNDInterpolator(points, coords)
    nearest = NearestNDInterpolator(points, coords)
    color = np.empty((height, width, 3), np.float32)
    for y0 in range(0, height, 128):
        y1 = min(y0 + 128, height)
        yy, xx = np.mgrid[y0:y1, :width]
        target = np.stack([xx.ravel() * world_w / width, yy.ravel() * world_h / height], axis=-1)
        geo = interpolate(target)
        missing = ~np.isfinite(geo[:, 0])
        geo[missing] = nearest(target[missing])
        lon, lat = geo[:, 0].reshape(y1-y0, width), geo[:, 1].reshape(y1-y0, width)
        sample = [(90-lat) / 180 * (rgb.shape[0]-1), ((lon+180) % 360) / 360 * (rgb.shape[1]-1)]
        for channel in range(3):
            color[y0:y1, :, channel] = map_coordinates(rgb[..., channel], sample, order=1, mode="nearest")
    # Let the highest physical ridges reveal rock/ice even where the stylized
    # registration samples a nearby valley. Preserve the photographic color below.
    alpine = np.clip((elevation - 0.48) / 0.35, 0, 1)[..., None] * 0.6
    color = color * (1-alpine) + np.array([193, 194, 179]) * alpine
    sea_distance = distance_transform_edt(~land) / (width / world_w)
    shelf = np.exp(-sea_distance / 7)[..., None]
    sea = np.array([17, 43, 65]) * (1-shelf) + np.array([36, 83, 103]) * shelf
    color[~land] = sea[~land]
    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.uint8(np.clip(color, 0, 255))).save(output)
    print(f"Baked {width}x{height} satellite surface from verified 4096x2048 source: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--elevation-source", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "game/art/terrain/global_surface.png")
    args = parser.parse_args()
    if args.download:
        args.source.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(SOURCE_URL, timeout=90) as response:
            args.source.write_bytes(response.read())
    build(args.source, args.elevation_source, args.output)
