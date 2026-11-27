# make-demo-scan.py - writes public/demo-scan.ply, a small SYNTHETIC splat room for the SplatTour demo
# (not a real scan). Stored upside down (y down), the way COLMAP and Brush write phone scans, so the
# demo exercises SplatTour's default flipY. Usage: python3 scripts/make-demo-scan.py public/demo-scan.ply
import math, random, struct, sys
random.seed(7)
pts = []
def add(x, y, z, c, s=0.05):  # x right, y depth (back wall at +2.5), z up
    pts.append((x, y, z, c, s))
for _ in range(6000): add(random.uniform(-3, 3), random.uniform(-2.5, 2.5), 0, (0.55, 0.35, 0.2))          # floor
for _ in range(5000): add(random.uniform(-3, 3), 2.5, random.uniform(0, 2.6), (0.85, 0.7, 0.5))            # back wall
for _ in range(4000): add(random.choice((-3, 3)), random.uniform(-2.5, 2.5), random.uniform(0, 2.6), (0.8, 0.62, 0.42))
for _ in range(2000): add(random.uniform(-1.2, 1.2), random.uniform(-0.9, 0.9), 0.02, (0.65, 0.12, 0.1))    # rug
for _ in range(3000): add(random.uniform(-1.1, 1.1), random.uniform(1.3, 2.1), random.uniform(0.05, 0.8), (0.3, 0.38, 0.32))  # sofa
for _ in range(1000):
    a = random.uniform(0, 6.28); r = random.uniform(0, 0.15)
    add(2.3 + r * math.cos(a), 1.9 + r * math.sin(a), random.uniform(0.9, 1.3), (1.0, 0.8, 0.45), 0.03)  # lamp
SH = 0.28209479177387814
with open(sys.argv[1], "wb") as f:
    f.write(("ply\nformat binary_little_endian 1.0\nelement vertex %d\n" % len(pts)).encode())
    for n in ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]:
        f.write(("property float %s\n" % n).encode())
    f.write(b"end_header\n")
    for x, y, z, c, s in pts:
        j = lambda v: min(1, max(0, v + random.uniform(-0.05, 0.05)))
        dc = [(j(v) - 0.5) / SH for v in c]
        ls = math.log(s)
        # z-up room to y-down file: X = x, Y = -z, Z = y; SplatTour's flip turns it back to y up, back wall ahead (-Z).
        f.write(struct.pack("<14f", x, -z, y, dc[0], dc[1], dc[2], 4.0, ls, ls, ls, 1, 0, 0, 0))
print("wrote", sys.argv[1], len(pts), "points")
