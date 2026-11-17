"""Create 4K phone terrain without losing the packed 16-bit elevation format.

Run when the desktop height or surface changes. Dependencies: numpy and Pillow.
This resamples the geographic data, not game screenshots or concept artwork.
"""
from pathlib import Path
import hashlib
import re

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TERRAIN = ROOT / "game/art/terrain"


def build():
    output = TERRAIN / "mobile"
    output.mkdir(exist_ok=True)
    packed = np.asarray(Image.open(TERRAIN / "global_height.png"))
    size = (4096, round(packed.shape[0] * 4096 / packed.shape[1]))
    elevation = packed[..., 0].astype(np.float32) * 256 + packed[..., 1]
    height = np.asarray(Image.fromarray(elevation).resize(size, Image.Resampling.BILINEAR))
    land = np.asarray(Image.fromarray(packed[..., 2]).resize(size, Image.Resampling.NEAREST)) > 127
    height = np.where(land, np.rint(height), 0).astype(np.uint16)
    result = np.stack([height >> 8, height & 255, land.astype(np.uint8) * 255], axis=-1).astype(np.uint8)
    Image.fromarray(result).save(output / "global_height.png")
    Image.open(TERRAIN / "global_surface.png").resize(size, Image.Resampling.LANCZOS).save(output / "global_surface.png")
    # Keep data textures lossless, and preserve the surface's mipmaps. Reuse
    # import options only; the mobile resource gets its own path, hash and UID.
    for filename in ["global_height.png", "global_surface.png"]:
        source = "res://game/art/terrain/" + filename
        target = "res://game/art/terrain/mobile/" + filename
        old_hash = hashlib.md5(source.encode()).hexdigest()
        new_hash = hashlib.md5(target.encode()).hexdigest()
        settings = (TERRAIN / (filename + ".import")).read_text()
        settings = settings.replace(source, target).replace(old_hash, new_hash)
        settings = re.sub(r'^uid=.*\n', '', settings, flags=re.MULTILINE)
        import_file = output / (filename + ".import")
        if import_file.exists():
            uid = re.search(r'^uid=.*\n', import_file.read_text(), flags=re.MULTILINE)
            if uid:
                settings = settings.replace('type="CompressedTexture2D"\n', 'type="CompressedTexture2D"\n' + uid.group())
        import_file.write_text(settings)
    print(f"Mobile terrain: {size[0]}x{size[1]}, RG16 elevation and satellite color")


if __name__ == "__main__":
    build()
