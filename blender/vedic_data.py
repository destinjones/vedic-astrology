"""Rashi, nakshatra and graha tables, free of Blender imports so plain Python can use them too."""

RASHIS = [
    ("mesha", "Mesha", "Aries", "\u2648"),
    ("vrishabha", "Vrishabha", "Taurus", "\u2649"),
    ("mithuna", "Mithuna", "Gemini", "\u264a"),
    ("karka", "Karka", "Cancer", "\u264b"),
    ("simha", "Simha", "Leo", "\u264c"),
    ("kanya", "Kanya", "Virgo", "\u264d"),
    ("tula", "Tula", "Libra", "\u264e"),
    ("vrischika", "Vrischika", "Scorpio", "\u264f"),
    ("dhanu", "Dhanu", "Sagittarius", "\u2650"),
    ("makara", "Makara", "Capricorn", "\u2651"),
    ("kumbha", "Kumbha", "Aquarius", "\u2652"),
    ("meena", "Meena", "Pisces", "\u2653"),
]

NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]

GRAHAS = ["surya", "chandra", "mangala", "budha", "guru", "shukra", "shani", "rahu", "ketu"]
