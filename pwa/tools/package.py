"""Write the static PWA and a self-contained HTML edition to the output directory."""
import base64
import json
import shutil
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
site = out / "site"
site.mkdir(exist_ok=True)
names = ["index.html", "style.css", "rules.js", "map.js", "app.js", "manifest.webmanifest", "sw.js"]
for name in names:
    shutil.copyfile(root / name, site / name)
shutil.copytree(root / "assets", site / "assets", dirs_exist_ok=True)

def uri(name, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode((root / name).read_bytes()).decode()

page = (site / 'index.html').read_text()
page = page.replace('<link rel="manifest" href="./manifest.webmanifest">', '')
page = page.replace('<link rel="stylesheet" href="./style.css">', '<style>'+(site/'style.css').read_text()+'</style>')
for name,mime in [('staff-map.svg','image/svg+xml'),('staff-overview.webp','image/webp'),('icon-192.png','image/png')]:
    page=page.replace('./assets/'+name,uri('assets/'+name,mime))
code=[]
for module in ['rules.js','map.js','app.js']:
    js=(site/module).read_text()
    js='\n'.join(line.removeprefix('export ') for line in js.splitlines() if not line.startswith('import '))
    js=js.replace("await (await fetch('./assets/territories.json')).json()", (site/'assets/territories.json').read_text())
    js=js.replace("if('serviceWorker' in navigator)", "if(false)")
    code.append(js)
html = page.replace('<script type="module" src="./app.js"></script>', '<script type="module">'+'\n'.join(code)+'</script>')
(out/'WarTable-Playtest.html').write_text(html)
with zipfile.ZipFile(out/'WarTable-PWA.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in sorted(site.rglob('*')):
        if f.is_file(): z.write(f,f.relative_to(site))
