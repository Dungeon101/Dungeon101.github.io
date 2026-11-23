# Cuts a Gemini illustration into a round token, the way the older pictures in assets/img are cut:
# the square corners of the plain black background are made transparent, the circle is feathered by 3 px.
#
#   python docs/art/make-tokens.py                 # every picture in docs/art/raw -> assets/img
#   python docs/art/make-tokens.py hero-cleric ... # only the ones named
#
# A picture is trusted to have its own round plate when a dark ring lies inside the band it is searched in;
# otherwise the fixed circle (47.1% of the side) is used, which is what the first tokens were cut at.
import sys, os
import numpy as np
from PIL import Image

RAW, OUT = 'docs/art/raw', 'assets/img'
SKIP = {'death', 'victory', 'icon', 'key-art'}   # whole pictures, not tokens
FEATHER = 3.0                                    # the transparent rim sits inside the circle, so the silhouette stays round
DEFAULT_R = float(os.environ.get('D101_R', 0.471))  # 47.1% of the side: how the first tokens were cut


def cut(src, dst):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    n = min(w, h)
    lum = a.mean(2)
    yy, xx = np.mgrid[0:h, 0:w]

    # the centre of the picture is close enough to the centre of the subject
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    d0 = np.hypot(xx - cx, yy - cy)

    ang = np.linspace(0, 2 * np.pi, 720, endpoint=False)

    def bright_share(rr):
        xs = np.clip((cx + rr * np.cos(ang)).astype(int), 0, w - 1)
        ys = np.clip((cy + rr * np.sin(ang)).astype(int), 0, h - 1)
        return (lum[ys, xs] > 34).mean()

    best = None
    for rr in np.arange(n * 0.494, n * 0.30, -1.0):
        if bright_share(rr) < 0.06:
            best = rr
            break
    # the band found must sit inside the picture's own plate, not on the last black pixels of the corners
    r = best if best is not None and best <= n * 0.478 else n * DEFAULT_R

    alpha = np.clip((r - d0) / FEATHER, 0.0, 1.0)
    out = Image.fromarray(np.dstack([a, alpha * 255.0]).astype(np.uint8), 'RGBA')
    out = out.resize((256, 256), Image.LANCZOS)
    out.save(dst, 'WEBP', quality=90, method=6)
    print('%-22s raggio %.1fpx (%.1f%% del lato)%s' % (os.path.basename(dst), r, 100 * r / n, '' if best else '  [fisso]'))


if __name__ == '__main__':
    names = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(RAW) if f.endswith('.webp') and not f.startswith('_'))
    for name in names:
        if name in SKIP:
            continue
        cut(os.path.join(RAW, name + '.webp'), os.path.join(OUT, name + '.webp'))
