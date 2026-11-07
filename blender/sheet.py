"""Build a contact sheet PNG from a glob of images: sheet.py <out.png> <cell> <cols> <glob>"""
import glob, sys
from PIL import Image
out, cell, cols, pattern = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
files = sorted(glob.glob(pattern))
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cell * cols, cell * rows), (18, 16, 34))
for i, f in enumerate(files):
    im = Image.open(f).convert("RGBA")
    im.thumbnail((cell, cell))
    sheet.paste(im, ((i % cols) * cell, (i // cols) * cell), im)
sheet.save(out)
