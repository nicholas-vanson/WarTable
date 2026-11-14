"""Build the atlas data from the TripleA Global 1940 Second Edition map directory."""

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree


POINT = re.compile(r"\((-?\d+),\s*(-?\d+)\)")
POLYGON = re.compile(r"<([^>]+)>")


def points(text):
    return [(int(x), int(y)) for x, y in POINT.findall(text)]


def segment_distance_squared(point, start, end):
    dx, dy = end[0] - start[0], end[1] - start[1]
    px, py = point[0] - start[0], point[1] - start[1]
    length = dx * dx + dy * dy
    if length == 0:
        return px * px + py * py
    along = max(0, min(1, (px * dx + py * dy) / length))
    return (px - dx * along) ** 2 + (py - dy * along) ** 2


def simplify(line, tolerance):
    if len(line) <= 2:
        return line
    farthest = max(range(1, len(line) - 1), key=lambda i: segment_distance_squared(line[i], line[0], line[-1]))
    if segment_distance_squared(line[farthest], line[0], line[-1]) <= tolerance ** 2:
        return [line[0], line[-1]]
    return simplify(line[:farthest + 1], tolerance)[:-1] + simplify(line[farthest:], tolerance)


def simplify_ring(ring, tolerance):
    ring = [point for index, point in enumerate(ring) if point != ring[index - 1]]
    if len(ring) < 3:
        return []
    split = max(range(1, len(ring)), key=lambda i: segment_distance_squared(ring[i], ring[0], ring[0]))
    result = simplify(ring[:split + 1], tolerance)[:-1] + simplify(ring[split:] + [ring[0]], tolerance)[:-1]
    if len(result) < 3:
        result = ring
    return [coord for point in result for coord in point]


def build(source, output):
    game = ElementTree.parse(source / "ww2global40_2nd_edition.xml").getroot()
    properties = dict(line.split("=", 1) for line in (source / "map.properties").read_text().splitlines() if "=" in line and not line.startswith("#"))
    centers = {}
    for line in (source / "centers.txt").read_text().splitlines():
        match = POINT.search(line)
        if match:
            centers[line[:match.start()].strip()] = tuple(map(int, match.groups()))
    geometry = {}
    for line in (source / "polygons.txt").read_text().splitlines():
        if "<" in line:
            geometry[line.split("<", 1)[0].strip()] = [points(part) for part in POLYGON.findall(line)]
    owners = {item.attrib["territory"]: item.attrib["owner"] for item in game.findall(".//territoryOwner")}
    options = {item.attrib["attachTo"]: {opt.attrib["name"]: opt.get("value") for opt in item.findall("option")}
               for item in game.findall("./attachmentList/attachment[@name='territoryAttachment']")}
    links = defaultdict(set)
    for connection in game.findall("./map/connection"):
        left, right = connection.get("t1"), connection.get("t2")
        links[left].add(right)
        links[right].add(left)
    pieces = defaultdict(list)
    for item in game.findall(".//unitPlacement"):
        pieces[item.get("territory")].append([item.get("owner"), item.get("unitType"), int(item.get("quantity"))])
    regions = {}
    for item in game.findall("./map/territory"):
        name = item.attrib["name"]
        info = options.get(name, {})
        rings = [ring for ring in geometry[name] if len(set(ring)) >= 3]
        if not rings:
            raise ValueError(f"No polygon for {name}")
        regions[name] = {
            "center": centers[name], "water": item.get("water") == "true", "owner": owners.get(name, ""),
            "ipc": int(info.get("production", 0)), "city": info.get("victoryCity") == "1",
            "landmark": info.get("capital", ""), "links": sorted(links[name]), "units": pieces[name],
            "original": info.get("originalOwner", owners.get(name, "")), "blocked": info.get("isImpassable") == "true",
            "overview": [simplify_ring(ring, 5.0) for ring in rings],
            "detail": [simplify_ring(ring, 1.4) for ring in rings],
        }
    assert all(set(region["links"]) <= regions.keys() for region in regions.values())
    diplomacy = [[r.get("player1"), r.get("player2"), r.get("type")] for r in game.findall(".//relationshipInitialize/relationship")]
    treasury = {r.get("player"): int(r.get("quantity")) for r in game.findall(".//resourceGiven") if r.get("resource") == "PUs"}
    output.write_text(json.dumps({"size": [int(properties["map.width"]), int(properties["map.height"])],
                                 "regions": regions, "diplomacy": diplomacy, "treasury": treasury}, separators=(",", ":")), encoding="utf-8")
    print(f"Imported {len(regions)} regions and {sum(len(v['links']) for v in regions.values()) // 2} undirected connections.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="directory containing the map text files and Second Edition XML")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.source, args.output)
