"""Check the map in Chromium. Pass the URL of a running WarTable PWA."""
from math import dist
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


def arrow_colors(page):
    arrows = page.locator('#routes > g').evaluate_all("""groups => groups.map(g => [
      g.dataset.category, Number(g.dataset.branches || 1), g.querySelector('g[opacity] > path').getAttribute('fill')
    ])""")
    by_category = {}
    for category, count, color in arrows:
        by_category.setdefault(category, []).append((count, color))
    return {category: sorted(values) for category, values in by_category.items()}


def check_crowded_front(page):
    # Include the Holland Belgium fighter and the separate southern bomber route.
    original = page.evaluate("""async () => {
      const {globalKey} = await import('./global-game.js');
      const {plan} = await import('./rules.js');
      const original = localStorage.getItem(globalKey), match = JSON.parse(original);
      const {game} = match.combat;
      plan(game, 'hb', 'fr', {inf: 4, tank: 3, artillery: 2, fighter: 1});
      plan(game, 'wg', 'fr', {inf: 3, mech_infantry: 4, artillery: 1, fighter: 2, tactical_bomber: 3});
      plan(game, 'world-germany', 'fr', {bomber: 2}, ['wg', 'world-greater-southern-germany', 'ni', 'sf']);
      match.combat.layoutSeed = 12345;
      match.combat.view = {x: 3820.18, y: 2270.88, z: 1.51, projection: 'printed-1940', surveyZoom: true};
      localStorage.setItem(globalKey, JSON.stringify(match));
      return [globalKey, original];
    }""")
    page.reload()
    page.locator('#forces [data-origin="hb"]').first.wait_for(state="attached")
    front = formation(page)
    assert len(front["arrivals"]) == 10
    assert arrow_colors(page) == {
        'land': [(1, '#a6352d'), (2, '#a6352d'), (3, '#a6352d')],
        'air': [(1, '#305f98'), (1, '#305f98'), (2, '#305f98')],
    }
    facilities = page.locator('#forces [data-place="wg"][data-role="home"]').evaluate_all("""groups => groups
      .filter(g => ['factory_major', 'harbour', 'airfield'].includes(g.dataset.unit))
      .map(g => {
        const m = g.transform.baseVal.consolidate().matrix;
        return [m.e, m.f, m.a];
      })""")
    assert len(facilities) == 3
    scale = facilities[0][2]
    for n, ink, _ in front["arrows"]:
        if n == '1':
            continue
        # A ribbon's two edges run in opposite directions around its centerline.
        shapes = [[tuple(map(float, xy.split())) for xy in part.strip()[1:].split(" L")]
                  for part in ink.split(" Z") if part.strip()]
        tip = shapes[0][len(shapes[0]) // 2]
        for points in shapes:
            centers = [((x + u) / 2, (y + v) / 2)
                       for (x, y), (u, v) in zip(points[:len(points) // 2], reversed(points))]
            assert dist(centers[0], tip) > 18 * scale
            covered = sum(any(abs(x-u) < 18*k and abs(y-v) < 10*k for u, v, k in facilities)
                          for x, y in centers)
            assert covered / len(centers) < .16
    page.locator("#zoomIn").click()
    assert formation(page) == front
    # Two submarines share an approach while aircraft enter the same sea battle.
    page.evaluate("""async ([key, original]) => {
      const {plan} = await import('./rules.js');
      const match = JSON.parse(original), game = match.combat.game;
      const sea = n => 'world-' + n + '-sea-zone', target = sea(110);
      plan(game, sea(113), target, {battleship: 1}, [sea(112)]);
      plan(game, sea(108), target, {submarine: 1}, [sea(104)]);
      plan(game, sea(103), target, {submarine: 1}, [sea(104)]);
      plan(game, 'hb', target, {fighter: 1});
      plan(game, 'wg', target, {fighter: 2, tactical_bomber: 3}, ['hb']);
      localStorage.setItem(key, JSON.stringify(match));
    }""", original)
    page.reload()
    page.locator('#routes > g[data-category="sea"]').first.wait_for(state="attached")
    assert arrow_colors(page) == {
        'air': [(1, '#305f98'), (2, '#305f98')],
        'sea': [(1, '#90600f'), (2, '#90600f')],
    }
    page.locator("#hold").focus()
    page.keyboard.down("Enter")
    page.locator('#routes path[fill="#724a0a"]').first.wait_for(state="attached")
    page.keyboard.up("Enter")
    assert arrow_colors(page) == {
        'air': [(1, '#234979'), (2, '#234979')],
        'sea': [(1, '#724a0a'), (2, '#724a0a')],
    }
    page.evaluate("([key, original]) => localStorage.setItem(key, original)", original)
    page.reload()
    page.locator("#hold").wait_for(state="attached")


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
        check_crowded_front(page)
        page.evaluate("""async () => {
          const {globalKey} = await import('./global-game.js');
          const {plan} = await import('./rules.js');
          const match = JSON.parse(localStorage.getItem(globalKey));
          plan(match.combat.game, 'hb', 'fr', {inf: 2, tank: 3, artillery: 2});
          plan(match.combat.game, 'wg', 'fr', {inf: 3, mech_infantry: 4, artillery: 1});
          match.combat.view = {x: 3655, y: 2282, z: 1.4, projection: 'printed-1940', surveyZoom: true};
          localStorage.setItem(globalKey, JSON.stringify(match));
        }""")
        page.reload()
        page.locator('#forces [data-origin="hb"]').first.wait_for(state="attached")
        baseline = formation(page)
        assert len(baseline["arrivals"]) == 6
        assert any(int(n) > 1 for n, _, _ in baseline["arrows"])
        incoming = page.locator('#forces [data-origin="hb"][data-unit="inf"]')
        at_home = page.locator('#forces [data-place="hb"][data-role="home"][data-unit="inf"]')
        assert incoming.get_attribute("data-moved") == "2"
        assert at_home.get_attribute("data-moved") is None
        assert incoming.get_attribute("data-nation") == at_home.get_attribute("data-nation")
        face = "g => getComputedStyle(g.querySelector('rect')).fill"
        assert incoming.evaluate(face) != at_home.evaluate(face)
        zoom_in = page.locator("#zoomIn")
        while zoom_in.is_enabled():
            previous = page.locator("#scale").inner_text()
            zoom_in.click()
            assert page.locator("#scale").inner_text() != previous
            assert formation(page) == baseline
        assert page.locator("#scale").inner_text() == "200%"
        page.locator("#zoomOut").click()
        assert formation(page) == baseline
        # A retreat pools five attacking infantry with two that stayed at home.
        page.evaluate("""async () => {
          const {globalKey} = await import('./global-game.js');
          const {commit, chooseBattle, rollAttack, rollDefense, casualties, retreat} = await import('./rules.js');
          const match = JSON.parse(localStorage.getItem(globalKey)), game = match.combat.game;
          commit(game);
          chooseBattle(game, 'fr');
          rollAttack(game, () => 6);
          rollDefense(game, () => 6);
          casualties(game, {});
          retreat(game, 'hb');
          localStorage.setItem(globalKey, JSON.stringify(match));
        }""")
        page.reload()
        at_home.wait_for(state="attached")
        assert at_home.get_attribute("data-count") == "7"
        assert at_home.get_attribute("data-moved") == "5"
        assert "5 of 7 moved in combat" in at_home.get_attribute("aria-label")
        assert page.locator('#forces [data-nation="France"][data-moved]').count() == 0
        browser.close()


if __name__ == "__main__":
    check_zoom(sys.argv[1])
