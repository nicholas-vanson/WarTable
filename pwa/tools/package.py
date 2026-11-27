"""Write the static PWA and a self-contained HTML edition to the output directory."""
import base64
import json
import mimetypes
import re
import shutil
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
site = out / "site"
site.mkdir(parents=True, exist_ok=True)
modules = ["preferences", "neutral-rules", "movement", "assault", "rules", "noncombat", "formation-names", "front-layout", "map", "politics", "occupation", "global-game", "income", "mobilize", "app", "menu"]
for name in ["LICENSE.txt", "index.html", "style.css", "sw.js", "manifest.webmanifest", *(m + ".js" for m in modules)]:
    shutil.copyfile(root / name, site / name)
shutil.copytree(root / "assets", site / "assets", dirs_exist_ok=True)


def uri(name):
    mime = mimetypes.guess_type(name)[0]
    return "data:" + mime + ";base64," + base64.b64encode((site / name).read_bytes()).decode()


def inline_module(name):
    source = (site / (name + ".js")).read_text()
    source = "\n".join(line.removeprefix("export ") for line in source.splitlines() if not line.startswith("import "))
    source = re.sub(r"await \(await fetch\('\./(assets/[\w-]+\.json)'\)\)\.json\(\)",
                    lambda match: (site / match[1]).read_text().strip(), source)
    if name == "map":
        layout = json.loads((site / "assets/world-terrain.json").read_text())
        tiles = [uri(f"assets/world-tiles/{col}-{row}.webp") for row in range(layout["rows"]) for col in range(layout["columns"])]
        source = source.replace("const embeddedSheets=null;", "const embeddedSheets=" + json.dumps(tiles, separators=(",", ":")) + ";")
    if name == "app":
        return "async function loadExercise(){\n" + source + "\n}"
    if name == "menu":
        source = source.replace("if('serviceWorker' in navigator)", "if(false)")
        source = source.replace("await import('./app.js')", "await loadExercise()")
        source = source.replace("fetch('./LICENSE.txt')", "fetch(" + json.dumps(uri("LICENSE.txt")) + ")")
    return source


page = (site / "index.html").read_text()
license_text = (site / "LICENSE.txt").read_text()
page = page.replace("<!doctype html>", "<!doctype html>\n<!--\n" + license_text.rstrip() + "\n-->")
page = page.replace('<link rel="manifest" href="./manifest.webmanifest">', "")
page = page.replace('<link rel="stylesheet" href="./style.css">', "<style>" + (site / "style.css").read_text() + "</style>")
page = re.sub(r'"\./(assets/[^"]+)"', lambda match: '"' + uri(match[1]) + '"', page)
code = "\n".join(inline_module(module) for module in modules)
page = page.replace('<script type="module" src="./menu.js"></script>', '<script type="module">' + code + "</script>")
(out / "WarTable-Playtest.html").write_text(page)

with zipfile.ZipFile(out / "WarTable-PWA.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(site.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(site))
