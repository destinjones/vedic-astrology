"""Write assets/3d/manifest.json describing every asset and the shared conventions. Plain Python 3."""
import json
import os

from vedic_data import GRAHAS, NAKSHATRAS, RASHIS

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "3d")

GRAHA_META = {
    "surya": ("Surya", "Sun", "#ff8a1e"),
    "chandra": ("Chandra", "Moon", "#c7d4ff"),
    "mangala": ("Mangala", "Mars", "#ff6a3a"),
    "budha": ("Budha", "Mercury", "#58e0a2"),
    "guru": ("Guru", "Jupiter", "#ffd68a"),
    "shukra": ("Shukra", "Venus", "#fff0d0"),
    "shani": ("Shani", "Saturn", "#7c9bff"),
    "rahu": ("Rahu", "North lunar node", "#ff5a14"),
    "ketu": ("Ketu", "South lunar node", "#6fc7c7"),
}


def size_of(rel):
    path = os.path.join(ROOT, rel)
    return os.path.getsize(path) if os.path.exists(path) else None


def entry(rel):
    return {"path": rel, "bytes": size_of(rel)}


def main():
    span = 360 / 27
    manifest = {
        "version": 1,
        "conventions": {
            "wheelPlate": "wheel/wheel-top.webp is an orthographic plate: the wheel's rim (radius 10 units) fills 20/20.4 of the "
                          "image width. 0 deg sidereal Aries is at 3 o'clock and longitude increases counterclockwise.",
            "pointOnWheelPlate": "x = 0.5 + r/20.4 * cos(lon), y = 0.5 - r/20.4 * sin(lon) in image fractions (y down); r in wheel units.",
            "rotatingThePlate": "Rotating the image clockwise by a degrees moves longitude lon to screen angle lon - a "
                                "(counterclockwise from 3 o'clock). To put the ascendant at 9 o'clock, use a = ascendant - 180.",
            "wheelRadii": {"grahaTrackInner": 3.19, "grahaTrackOuter": 4.15, "rashiInner": 4.25, "rashiOuter": 6.75,
                           "nakshatraInner": 6.95, "nakshatraOuter": 9.35, "padaOuter": 9.75, "rim": 10.0},
            "gltf": "Models are Y-up with the wheel in the XZ plane. Longitude lon on the wheel maps to three.js position "
                    "(r*cos(lon), h, -r*sin(lon)). Graha models have radius 1 (Shani's ring reaches 2.35); wheel.glb has radius 10.",
            "materials": "Surya and the wheel use emissive maps, so they read without lights. Other grahas need scene lighting.",
            "sky": "backgrounds/sky-equirect.webp is decorative procedural art, not a real star catalogue. Do not present it as actual star positions.",
        },
        "grahas": [
            {
                "id": g, "name": GRAHA_META[g][0], "english": GRAHA_META[g][1], "glow": GRAHA_META[g][2],
                "image": entry(f"grahas/{g}.webp"), "model": entry(f"models/{g}.glb"),
            }
            for g in GRAHAS
        ],
        "rashis": [
            {"id": key, "name": name, "english": western, "startLongitude": i * 30, "endLongitude": (i + 1) * 30,
             "image": entry(f"rashis/{key}.webp")}
            for i, (key, name, western, _glyph) in enumerate(RASHIS)
        ],
        "nakshatras": [
            {"id": name.lower().replace(" ", "-"), "number": i + 1, "name": name,
             "startLongitude": round(i * span, 6), "endLongitude": round((i + 1) * span, 6),
             "image": entry(f"nakshatras/{name.lower().replace(' ', '-')}.webp")}
            for i, name in enumerate(NAKSHATRAS)
        ],
        "wheel": {"top": entry("wheel/wheel-top.webp"), "hero": entry("wheel/wheel-hero.webp"), "model": entry("models/wheel.glb")},
        "backgrounds": {
            "cosmosDesktop": entry("backgrounds/cosmos-desktop.webp"),
            "cosmosMobile": entry("backgrounds/cosmos-mobile.webp"),
            "heroDesktop": entry("backgrounds/navagraha-hero.webp"),
            "heroMobile": entry("backgrounds/navagraha-hero-mobile.webp"),
            "skyEquirect": entry("backgrounds/sky-equirect.webp"),
        },
    }
    out = os.path.join(ROOT, "manifest.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    total = 0
    for folder, _dirs, files in os.walk(ROOT):
        total += sum(os.path.getsize(os.path.join(folder, f)) for f in files)
    print(f"wrote {out}; assets total {total / 1e6:.1f} MB")


main()
