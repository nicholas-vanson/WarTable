"""Check the map in Chromium. Pass the URL of a running WarTable PWA."""
import shutil
import sys

from playwright.sync_api import sync_playwright


def formation(page):
    return page.evaluate("""() => ({
      arrows: Array.from(document.querySelectorAll('#routes > g'), g => {
        const ink = g.querySelector('g[opacity] > path');
        return [g.dataset.branches || '1', ink.getAttribute('d'), ink.getAttribute('stroke-width')];
      }),
      garrison: Array.from(document.querySelectorAll('#forces [data-role="home"][data-place="fr"]'), g =>
        [g.dataset.nation, g.dataset.unit, g.getAttribute('transform')]),
      arrivals: Array.from(document.querySelectorAll('#forces [data-origin]'), g =>
        [g.dataset.origin, g.dataset.unit, g.dataset.count, g.getAttribute('transform')])
    })""")


def check_zoom(url):
    with sync_playwright() as driver:
        browser = driver.chromium.launch(executable_path=shutil.which("chromium"))
        page = browser.new_page(viewport={"width": 412, "height": 894}, is_mobile=True,
                                has_touch=True, reduced_motion="reduce", service_workers="block")
        page.goto(url.rstrip("/") + "/#global")
        page.locator('[data-act="begin-turn"]').click()
        page.locator("#confirmOrder").focus()
        page.keyboard.down("Enter")
        page.locator("#hold").wait_for(state="attached")
        page.keyboard.up("Enter")
        page.evaluate("""async () => {
          const {globalKey} = await import('./global-game.js');
          const {plan} = await import('./rules.js');
          const match = JSON.parse(localStorage.getItem(globalKey));
          plan(match.combat.game, 'hb', 'fr', {inf: 4, tank: 3, artillery: 2});
          plan(match.combat.game, 'wg', 'fr', {inf: 3, mech_infantry: 4, artillery: 1});
          match.combat.view = {x: 3655, y: 2282, z: 1.4, projection: 'printed-1940', surveyZoom: true};
          localStorage.setItem(globalKey, JSON.stringify(match));
        }""")
        page.reload()
        page.locator('#forces [data-origin="hb"]').first.wait_for(state="attached")
        baseline = formation(page)
        assert len(baseline["arrivals"]) == 6
        assert any(int(n) > 1 for n, _, _ in baseline["arrows"])
        zoom_in = page.locator("#zoomIn")
        while zoom_in.is_enabled():
            previous = page.locator("#scale").inner_text()
            zoom_in.click()
            assert page.locator("#scale").inner_text() != previous
            assert formation(page) == baseline
        assert page.locator("#scale").inner_text() == "200%"
        page.locator("#zoomOut").click()
        assert formation(page) == baseline
        browser.close()


if __name__ == "__main__":
    check_zoom(sys.argv[1])
