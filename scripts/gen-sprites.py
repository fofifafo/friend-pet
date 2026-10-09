# -*- coding: utf-8 -*-
"""
캐릭터 스프라이트 생성기 v3 — 도형 기반.
 - 타원/사각형/선으로 부위를 그리고, 부위마다 외곽선과 명암을 자동으로 입힌다.
 - 종류(cat, dog, rabbit, bear, penguin, fox) × 포즈 × 프레임을 모두 미리 렌더링해
   src/renderer/sprites.ts 에 문자열 행으로 내보낸다.
 - --preview <폴더> 를 주면 미리보기 PNG 를 만든다.

문자 → 색
 .  투명   d 외곽선   o 몸통 기본   l 밝은 톤   a 어두운 톤   w 흰 부분
 k 눈      h 눈 하이라이트   m 코   p 분홍(볼, 귀 안쪽, 혀)   y 노랑/주황(부리, 발)
 z zzz     e 하트/이펙트(분홍)   x 이펙트(노랑)   c 이펙트(하늘)
"""
import io, os, sys, struct, zlib, math

W = 32
H = 32
SPECIES = ["cat", "dog", "rabbit", "bear", "penguin", "fox"]


# ---------------------------------------------------------------------------
# 캔버스
# ---------------------------------------------------------------------------
class Canvas:
    def __init__(self):
        self.g = [["." for _ in range(W)] for _ in range(H)]

    def put(self, x, y, ch):
        if 0 <= x < W and 0 <= y < H:
            self.g[y][x] = ch

    def get(self, x, y):
        if 0 <= x < W and 0 <= y < H:
            return self.g[y][x]
        return "."

    def ellipse(self, cx, cy, rx, ry, ch="o"):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x - cx) / rx
                dy = (y - cy) / ry
                if dx * dx + dy * dy <= 1.0:
                    self.put(x, y, ch)

    def rect(self, x0, y0, x1, y1, ch="o"):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, ch)

    def line(self, x0, y0, x1, y1, ch="o", thick=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            t = i / n
            x = round(x0 + (x1 - x0) * t)
            y = round(y0 + (y1 - y0) * t)
            for ty in range(thick):
                for tx in range(thick):
                    self.put(x + tx, y + ty, ch)

    def curve(self, pts, ch="o", thick=2):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            self.line(x0, y0, x1, y1, ch, thick)

    def merge(self, other):
        for y in range(H):
            for x in range(W):
                if other.g[y][x] != ".":
                    self.g[y][x] = other.g[y][x]

    def rows(self):
        return ["".join(r) for r in self.g]


def finish_part(c, light=True, outline="d", fills=("o", "w", "a", "l")):
    """부위 캔버스에 외곽선과 명암(l/a)을 입힌다. fills 에 있는 문자로 칠한 부분만 대상."""
    src = [row[:] for row in c.g]

    def filled(x, y):
        return 0 <= x < W and 0 <= y < H and src[y][x] != "."

    for y in range(H):
        for x in range(W):
            ch = src[y][x]
            if ch == ".":
                continue
            edge = not (filled(x - 1, y) and filled(x + 1, y) and filled(x, y - 1) and filled(x, y + 1))
            if edge and ch in fills:
                c.g[y][x] = outline
            elif ch == "o" and light:
                # 위쪽/왼쪽이 외곽선이면 밝게, 아래쪽이 외곽선이면 어둡게
                up_edge = not (filled(x, y - 2) and filled(x - 1, y - 1))
                down_edge = not filled(x, y + 2)
                if up_edge:
                    c.g[y][x] = "l"
                elif down_edge:
                    c.g[y][x] = "a"
    return c


# ---------------------------------------------------------------------------
# 캐릭터 조립
# ---------------------------------------------------------------------------
# 기본 배치 (오른쪽을 보는 3/4 시점)
HEAD = (19, 13, 9.5, 8.5)   # cx, cy, rx, ry
BODY = (14, 23, 8.5, 5)


def part():
    return Canvas()


def draw_tail(sp, pose, phase):
    c = part()
    if sp == "cat":
        pts = {0: [(6, 22), (3, 20), (2, 16), (3, 12)], 1: [(6, 22), (3, 21), (1, 18), (2, 14)], 2: [(6, 22), (3, 23), (1, 21), (2, 17)]}[phase]
        if pose in ("lie", "sleep"):
            pts = [(5, 27), (2, 27), (1, 24), (3, 22)]
        c.curve(pts, "o", 2)
    elif sp == "fox":
        pts = {0: [(6, 22), (2, 21), (1, 16), (3, 13)], 1: [(6, 23), (2, 23), (1, 18), (3, 15)], 2: [(6, 23), (2, 24), (1, 20), (3, 17)]}[phase]
        if pose in ("lie", "sleep"):
            pts = [(5, 27), (1, 27), (0, 24), (2, 22)]
        c.curve(pts, "o", 3)
        # 꼬리 끝 흰색
        x, y = pts[-1]
        c.ellipse(x + 1, y, 1.6, 1.6, "w")
    elif sp == "dog":
        pts = {0: [(6, 21), (4, 18), (5, 15)], 1: [(6, 21), (3, 19), (3, 16)], 2: [(6, 21), (4, 18), (5, 15)]}[phase]
        if pose in ("lie", "sleep"):
            pts = [(5, 27), (2, 26), (1, 24)]
        c.curve(pts, "o", 2)
    elif sp == "rabbit":
        y = 26 if pose in ("lie", "sleep") else 21
        c.ellipse(5, y, 2.2, 2.2, "w")
    elif sp == "bear":
        y = 27 if pose in ("lie", "sleep") else 22
        c.ellipse(5, y, 1.6, 1.6, "o")
    return finish_part(c)


def make_leg(x, y0, y1, far=False, w=4, paw=1):
    """다리 하나: w칸 기둥 + 앞으로 paw칸 나온 발. 외곽선 포함. far 면 한 톤 어둡다."""
    c = part()
    c.rect(x, y0, x + w - 1, y1, "o")
    finish_part(c, light=False)
    # 발 끝 둥글게: 바닥 모서리 비우기
    c.put(x, y1, ".")
    c.put(x + w - 1, y1, ".")
    c.put(x + 1, y1, "d")
    c.put(x + w - 2, y1, "d")
    if far:
        for y in range(H):
            for xx in range(W):
                if c.g[y][xx] == "o":
                    c.g[y][xx] = "a"
    return c


def attach_legs(main, body_fill, legs):
    """다리를 몸통에 붙인다. 몸통 안쪽에 있는 다리 픽셀은 버리고,
    몸통 아래 외곽선과 만나는 자리는 다리 색으로 열어 이어지게 한다."""
    bottom = {}
    for x in range(W):
        ys = [y for y in range(H) if body_fill.g[y][x] != "."]
        bottom[x] = max(ys) if ys else -1
    for leg in legs:
        for y in range(H):
            for x in range(W):
                ch = leg.g[y][x]
                if ch == ".":
                    continue
                if y < bottom[x]:
                    continue          # 몸통 안쪽: 몸통이 가린다
                if y == bottom[x] and ch == "d":
                    # 몸통 외곽선 줄: 다리 옆선만 남기고 윗선은 열어둔다
                    if leg.g[y + 1][x] == "d":
                        main.put(x, y, "d")
                    else:
                        main.put(x, y, "o" if leg.g[y + 1][x] == "o" else "a")
                    continue
                main.put(x, y, ch)


def draw_main(sp, pose, frame, bob, wave=False, highfive=False, tilt_x=0, tilt_y=0, ear_tilt=0):
    """몸통 + 머리 + 귀는 한 실루엣, 다리는 따로 그려 붙인다."""
    c = part()
    hx, hy = HEAD[0] + tilt_x, HEAD[1] + bob + tilt_y
    rx, ry = HEAD[2], HEAD[3]
    if pose in ("lie", "sleep"):
        hx, hy = 19 + tilt_x, 16 + bob + tilt_y

    body = part()   # 몸통 채움 (다리 부착 기준)
    if sp == "penguin":
        if pose in ("lie", "sleep"):
            body.ellipse(15, 24, 11, 5.5, "o")
        else:
            body.ellipse(16, 18 + bob, 8.5, 10, "o")
            if highfive:
                body.ellipse(24, 14, 2, 4.5, "o")
            elif wave:
                body.ellipse(24, 17, 2, 4, "o")
            else:
                body.ellipse(9, 19, 2, 5, "o")
                body.ellipse(23, 19, 2, 5, "o")
        c.merge(body)
        finish_part(c)
        hp = (18 + tilt_x, (19 + bob + tilt_y) if pose in ("lie", "sleep") else (11 + bob + tilt_y))
        return c, hp, body

    # --- 몸통 ---
    if pose == "sit":
        body.ellipse(14, 22 + bob, 7, 7.5, "o")
        body.ellipse(9, 26, 4.5, 3.5, "o")      # 뒷다리 허벅지
    elif pose in ("lie", "sleep"):
        body.ellipse(13, 26, 10, 4, "o")
    else:
        body.ellipse(18, 24 + bob, 6, 4.2, "o")     # 가슴
        body.ellipse(11, 25 + bob, 5.2, 4.2, "o")   # 엉덩이(허벅지)
        body.rect(11, 22 + bob, 18, 27 + bob, "o")  # 등 연결
    c.merge(body)

    # --- 귀 (머리 뒤) ---
    if sp == "cat":
        for x in (12, 24):
            c.curve([(x - 2, hy - 6), (x + 1, hy - 13 + ear_tilt), (x + 4, hy - 6)], "o", 2)
            c.rect(x - 1, hy - 8, x + 4, hy - 5, "o")
    elif sp == "fox":
        for x in (11, 24):
            c.curve([(x - 2, hy - 6), (x + 1, hy - 13 + ear_tilt), (x + 4, hy - 6)], "o", 3)
            c.rect(x - 1, hy - 8, x + 5, hy - 5, "o")
    elif sp == "rabbit":
        # 뒤로 살짝 기울어진 긴 귀
        for x in (15, 21):
            c.curve([(x, hy - 5), (x - 3, hy - 13 + ear_tilt)], "o", 3)
            c.ellipse(x - 3, hy - 13 + ear_tilt, 1.8, 1.8, "o")
    elif sp == "bear":
        c.ellipse(12, hy - 7, 3.2, 3.2, "o")
        c.ellipse(26, hy - 7, 3.2, 3.2, "o")

    # --- 머리 ---
    c.ellipse(hx, hy, rx, ry, "o")
    finish_part(c)

    # 턱 밑 경계선: 머리 타원의 테두리 중 몸통 안쪽 부분만 어둡게
    for y in range(H):
        for x in range(W):
            dx, dy = (x - hx) / rx, (y - hy) / ry
            d2 = dx * dx + dy * dy
            if 0.80 <= d2 <= 1.0 and body.get(x, y) != "." and c.get(x, y) in ("o", "l", "a") and y > hy + 2:
                c.put(x, y, "a")
    if sp == "bear":
        m = part(); m.ellipse(hx + 3, hy + 3, 4.5, 3.2, "w"); c.merge(m)

    # --- 다리 ---
    ground = 30
    legs = []
    if pose in ("lie", "sleep"):
        for x in (18, 23):
            l = part(); l.rect(x, 27, x + 3, 28, "o"); finish_part(l, light=False); legs.append(l)
    elif pose == "sit":
        legs.append(make_leg(16, 24 + bob, ground, far=True, w=3))
        legs.append(make_leg(20, 24 + bob, ground, w=4))
    else:
        fn, ff, bn, bf = [(0, 0, 0, 0), (2, -1, -2, 1), (0, 0, 0, 0), (-2, 1, 2, -1)][frame]
        legs.append(make_leg(6 + bf, 27 + bob, ground, far=True, w=3))     # 뒤-먼 발
        legs.append(make_leg(18 + ff, 26 + bob, ground, far=True, w=3))    # 앞-먼 다리
        legs.append(make_leg(9 + bn, 27 + bob, ground, w=4))               # 뒤-가까운 발
        if wave:
            arm = part(); arm.rect(23, 16 + bob, 25, 22 + bob, "o"); arm.rect(23, 16 + bob, 26, 17 + bob, "o")
            finish_part(arm, light=False); legs.append(arm)
        elif highfive:
            arm = part(); arm.rect(24, 12 + bob, 26, 20 + bob, "o"); arm.rect(24, 12 + bob, 27, 13 + bob, "o")
            finish_part(arm, light=False); legs.append(arm)
        else:
            legs.append(make_leg(21 + fn, 26 + bob, ground, w=4))          # 앞-가까운 다리
    attach_legs(c, body if pose != "sit" else body, legs)
    return c, (hx, hy), body


def draw_ears_front(sp, hx, hy):
    """머리 위에 그리는 귀 안쪽/늘어진 귀"""
    c = part()
    if sp == "cat":
        for x in (12, 24):
            c.put(x + 1, hy - 10, "p")
            c.rect(x, hy - 9, x + 2, hy - 8, "p")
    elif sp == "fox":
        for x in (11, 24):
            c.rect(x + 1, hy - 9, x + 2, hy - 7, "w")
    elif sp == "rabbit":
        for x in (15, 21):
            c.curve([(x - 1, hy - 7), (x - 3, hy - 12)], "p", 1)
    elif sp == "bear":
        c.ellipse(12, hy - 7, 1.4, 1.4, "l")
        c.ellipse(26, hy - 7, 1.4, 1.4, "l")
    elif sp == "dog":
        d = part()
        d.ellipse(11, hy + 1, 2.5, 5, "a")
        d.ellipse(27, hy + 1, 2.5, 5, "a")
        finish_part(d, light=False)
        c.merge(d)
    return c


def draw_head(sp, pose, bob, tilt_x=0, tilt_y=0):
    cx, cy, rx, ry = HEAD
    if pose in ("lie", "sleep"):
        cx, cy = 19, 16
    cx += tilt_x
    cy += bob + tilt_y
    c = part()
    if sp == "penguin":
        return c, (cx, cy)
    c.ellipse(cx, cy, rx, ry, "o")
    if sp == "bear":
        c.ellipse(cx + 3, cy + 3, 4.5, 3.2, "w")
    return finish_part(c), (cx, cy)


def draw_face(sp, hx, hy, eyes, extra=None):
    """눈, 코, 입, 볼. hx, hy 는 머리 중심."""
    c = part()
    ex_l, ex_r = hx - 3, hx + 4  # 눈 중심 x
    ey = hy - 1
    if sp == "penguin":
        ex_l, ex_r, ey = hx - 2, hx + 4, hy - 2
    # 눈
    if eyes == "open":
        for x in (ex_l, ex_r):
            c.rect(x - 1, ey - 1, x + 1, ey + 2, "k")   # 3x4
            c.rect(x - 1, ey - 1, x, ey, "h")            # 큰 하이라이트 2x2
            c.put(x + 1, ey + 2, "h")                     # 작은 하이라이트
    elif eyes == "blink":
        for x in (ex_l, ex_r):
            c.rect(x - 1, ey + 2, x + 1, ey + 2, "d")
    elif eyes == "sleep":
        for x in (ex_l, ex_r):
            c.rect(x - 1, ey + 1, x + 1, ey + 1, "d")
    elif eyes == "happy":
        for x in (ex_l, ex_r):
            c.put(x - 1, ey + 1, "k")
            c.put(x, ey, "k")
            c.put(x + 1, ey, "k")
            c.put(x + 2, ey + 1, "k")
    elif eyes == "wow":
        for x in (ex_l, ex_r):
            c.rect(x - 1, ey - 1, x + 2, ey + 2, "k")
            c.put(x, ey, "h")
            c.put(x + 1, ey + 1, "h")
    elif eyes == "wink":
        c.rect(ex_l, ey, ex_l + 1, ey + 2, "k")
        c.put(ex_l + 1, ey, "h")
        c.put(ex_r - 1, ey + 1, "k")
        c.put(ex_r, ey, "k")
        c.put(ex_r + 1, ey, "k")
        c.put(ex_r + 2, ey + 1, "k")
    # 볼
    if True:
        c.rect(hx - 6, hy + 2, hx - 5, hy + 2, "p")
        c.rect(hx + 7, hy + 2, hx + 8, hy + 2, "p")
    # 코와 입
    nx, ny = hx + 1, hy + 2
    if sp == "cat":
        c.rect(nx, ny, nx + 1, ny, "m")
        c.put(nx - 1, ny + 2, "d"); c.put(nx, ny + 1, "d"); c.put(nx + 1, ny + 1, "d"); c.put(nx + 2, ny + 2, "d")
    elif sp == "fox":
        c.rect(nx, ny, nx + 1, ny, "m")
        c.put(nx, ny + 2, "d"); c.put(nx + 1, ny + 2, "d")
    elif sp == "dog":
        c.rect(nx - 1, ny, nx + 1, ny + 1, "m")
        c.rect(nx, ny + 3, nx + 1, ny + 4, "p")
    elif sp == "rabbit":
        c.rect(nx, ny, nx + 1, ny, "p")
        c.rect(nx, ny + 2, nx + 1, ny + 3, "w")
        c.put(nx - 1, ny + 2, "d"); c.put(nx + 2, ny + 2, "d")
    elif sp == "bear":
        c.rect(nx, ny, nx + 1, ny + 1, "m")
        c.put(nx - 1, ny + 3, "d"); c.put(nx, ny + 3, "d"); c.put(nx + 1, ny + 3, "d")
    elif sp == "penguin":
        c.curve([(hx + 5, hy + 1), (hx + 9, hy + 2)], "y", 2)
        c.put(hx + 5, hy + 3, "y")
    return c


def draw_markings(sp, hx, hy, pose):
    c = part()
    if sp not in ("penguin",) and pose not in ("lie", "sleep"):
        if pose == "sit":
            c.ellipse(16, 26, 3.5, 3.5, "l")
        else:
            c.ellipse(16, 26, 3.5, 2.2, "l")
    if sp == "cat":
        for dx in (-3, 0, 3):
            c.put(hx + dx - 2, hy - 6, "a")
            c.put(hx + dx - 2, hy - 5, "a")
        if pose not in ("lie", "sleep"):
            c.put(9, 18, "a"); c.put(10, 18, "a"); c.put(12, 17, "a"); c.put(13, 17, "a")
    elif sp == "fox":
        # 흰 가슴/뺨
        c.ellipse(hx + 2, hy + 4, 5, 2.5, "w")
        if pose not in ("lie", "sleep"):
            c.ellipse(15, 23, 3, 3, "w")
    elif sp == "dog":
        c.ellipse(hx + 4, hy - 1, 3.5, 3.2, "a")
    elif sp == "penguin":
        c.ellipse(hx + 1, hy, 5.5, 5, "w")      # 얼굴
        if pose in ("lie", "sleep"):
            c.ellipse(14, 25, 7, 3, "w")
        else:
            c.ellipse(15, 22, 5.5, 6, "w")      # 배
    return c


def draw_prop(kind, frame):
    """활동 소품. 캐릭터 앞(오른쪽)에 그린다."""
    c = part()
    if kind == "laptop":
        dev = part()
        dev.rect(22, 17, 30, 25, "s")          # 화면 테두리
        dev.rect(23, 18, 29, 24, "b")          # 화면
        dev.rect(21, 26, 31, 28, "s")          # 본체
        finish_part(dev, light=False, outline="q", fills=("s", "n", "b", "y", "a"))
        c.merge(dev)
        for i, (x, y) in enumerate([(24, 19), (26, 19), (24, 21), (27, 21), (25, 23)]):
            c.put(x, y, "w" if (i + frame) % 2 == 0 else "b")   # 코드 줄
        c.rect(23, 27, 29, 27, "a")            # 키보드
        # 두드리는 앞발 (번갈아)
        px = 23 if frame % 2 == 0 else 27
        paw = part(); paw.rect(px, 24, px + 1, 26, "o"); finish_part(paw, light=False); c.merge(paw)
    elif kind == "gamepad":
        dy = 0 if frame % 2 == 0 else 1
        dev = part(); dev.rect(20, 21 + dy, 28, 24 + dy, "s"); dev.rect(19, 22 + dy, 19, 23 + dy, "s"); dev.rect(29, 22 + dy, 29, 23 + dy, "s")
        finish_part(dev, light=False, outline="q", fills=("s", "n", "b", "y", "a")); c.merge(dev)
        c.put(21, 22 + dy, "k"); c.put(22, 21 + dy, "k"); c.put(22, 23 + dy, "k"); c.put(23, 22 + dy, "k")   # 십자키
        c.put(26, 22 + dy, "e"); c.put(27, 23 + dy, "x")                                                     # 버튼
        for x in (18, 29):
            paw = part(); paw.rect(x, 22 + dy, x + 1, 24 + dy, "o"); finish_part(paw, light=False); c.merge(paw)
    elif kind == "tv":
        dev = part()
        dev.rect(23, 16, 31, 27, "s")
        dev.rect(24, 17, 30, 25, "b")
        dev.rect(26, 28, 28, 28, "s")
        dev.rect(25, 29, 29, 29, "s")
        finish_part(dev, light=False, outline="q", fills=("s", "n", "b", "y", "a"))
        c.merge(dev)
        pts = [(25, 18), (27, 20), (29, 22), (26, 23)] if frame % 2 == 0 else [(28, 18), (25, 21), (29, 19), (27, 24)]
        for x, y in pts:
            c.put(x, y, "w")
    elif kind == "book":
        dev = part()
        dev.rect(19, 24, 30, 28, "y")          # 표지
        dev.rect(20, 23, 29, 27, "w")          # 페이지
        finish_part(dev, light=False, outline="q", fills=("y", "w")); c.merge(dev)
        c.rect(24, 23, 24, 27, "a")            # 가운데
        for y in (24, 25, 26):
            if (y + frame) % 2 == 0:
                c.rect(21, y, 23, y, "a"); c.rect(26, y, 28, y, "a")
        for x in (19, 30):
            paw = part(); paw.rect(x, 26, x + 1, 28, "o"); finish_part(paw, light=False); c.merge(paw)
    elif kind == "phone":
        dy = 0 if frame % 2 == 0 else -1
        dev = part(); dev.rect(24, 15 + dy, 27, 21 + dy, "n"); finish_part(dev, light=False, outline="q", fills=("s", "n", "b", "y", "a")); c.merge(dev)
        c.rect(25, 16 + dy, 26, 20 + dy, "b")
        c.put(25, 17 + dy, "w"); c.put(26, 19 + dy, "w")
        paw = part(); paw.rect(23, 20 + dy, 24, 22 + dy, "o"); finish_part(paw, light=False); c.merge(paw)
    return c


def draw_effect(kind, frame):
    c = part()
    if kind == "heart":
        y = 2 - frame
        for x in (26,):
            c.put(x, y, "e"); c.put(x + 2, y, "e")
            c.rect(x - 1, y + 1, x + 3, y + 1, "e")
            c.rect(x, y + 2, x + 2, y + 2, "e")
            c.put(x + 1, y + 3, "e")
    elif kind == "zzz":
        pts = [(27, 3), (29, 1), (26, 5)] if frame == 0 else [(28, 2), (30, 0), (27, 4)]
        for x, y in pts:
            c.put(x, y, "z"); c.put(x + 1, y, "z")
            c.put(x + 1, y + 1, "z")
            c.put(x, y + 2, "z"); c.put(x + 1, y + 2, "z")
    elif kind == "spark":
        pts = [(27, 3), (29, 6), (25, 7)] if frame == 0 else [(28, 2), (30, 5), (26, 8)]
        for x, y in pts:
            c.put(x, y, "x"); c.put(x - 1, y + 1, "x"); c.put(x + 1, y + 1, "x"); c.put(x, y + 2, "x")
    elif kind == "note":
        x, y = (26, 2 - frame)
        c.rect(x + 2, y, x + 2, y + 5, "c"); c.rect(x + 2, y, x + 5, y, "c"); c.rect(x + 5, y, x + 5, y + 5, "c")
        c.rect(x, y + 5, x + 2, y + 6, "c"); c.rect(x + 3, y + 5, x + 5, y + 6, "c")
    elif kind == "excl":
        c.rect(27, 1, 28, 6, "x"); c.rect(27, 8, 28, 9, "x")
    elif kind == "sweat":
        c.put(27, 4 + frame, "c"); c.rect(26, 5 + frame, 28, 6 + frame, "c")
    return c


def render(sp, pose="stand", frame=0, eyes="open", tail_phase=0, bob=0, effect=None, effect_frame=0,
           wave=False, highfive=False, tilt_x=0, tilt_y=0, blush=False, ear_tilt=0, prop=None, prop_frame=0, shift_x=0):
    """하나의 프레임을 만든다."""
    if shift_x:
        rows = render(sp, pose, frame, eyes, tail_phase, bob, None, 0, wave, highfive, tilt_x, tilt_y, blush, ear_tilt)
        n = -shift_x
        rows = [r[n:] + "." * n for r in rows]
        main = Canvas()
        for y, r in enumerate(rows):
            main.g[y] = list(r)
        if prop:
            main.merge(draw_prop(prop, prop_frame))
        if effect:
            main.merge(draw_effect(effect, effect_frame))
        return main.rows()
    main = Canvas()
    main.merge(draw_tail(sp, pose, tail_phase))
    body, (hx, hy), _ = draw_main(sp, pose, frame, bob, wave, highfive, tilt_x, tilt_y, ear_tilt)
    main.merge(body)
    if sp == "penguin" and pose not in ("lie", "sleep"):
        f = part(); f.rect(11, 29, 14, 30, "y"); f.rect(17, 29, 20, 30, "y"); main.merge(f)
    main.merge(draw_markings(sp, hx, hy, pose))
    main.merge(draw_ears_front(sp, hx, hy))
    main.merge(draw_face(sp, hx, hy, eyes, "blush" if blush else None))
    if prop:
        main.merge(draw_prop(prop, prop_frame))
    if effect:
        main.merge(draw_effect(effect, effect_frame))
    return main.rows()


# ---------------------------------------------------------------------------
# 애니메이션 정의: 이름 → [(프레임 인자), ...], 간격(ms), 세로 오프셋
# ---------------------------------------------------------------------------
def anim_frames(sp):
    A = {}
    A["idle"] = dict(ms=380, frames=[
        dict(tail_phase=0), dict(tail_phase=1), dict(tail_phase=2), dict(tail_phase=1, eyes="blink"),
    ])
    A["walk"] = dict(ms=130, offsets=[0, -1, 0, -1], frames=[
        dict(frame=0, tail_phase=1), dict(frame=1, tail_phase=0), dict(frame=2, tail_phase=1), dict(frame=3, tail_phase=2),
    ])
    A["run"] = dict(ms=90, offsets=[0, -2, 0, -2], frames=[
        dict(frame=1, tail_phase=2, eyes="happy"), dict(frame=3, tail_phase=2, eyes="happy"),
    ])
    A["sit"] = dict(ms=600, frames=[
        dict(pose="sit", tail_phase=2), dict(pose="sit", tail_phase=2), dict(pose="sit", tail_phase=1), dict(pose="sit", tail_phase=2, eyes="blink"),
    ])
    A["lie"] = dict(ms=700, frames=[
        dict(pose="lie", tail_phase=0), dict(pose="lie", tail_phase=0), dict(pose="lie", tail_phase=0, eyes="blink"),
    ])
    A["sleep"] = dict(ms=900, frames=[
        dict(pose="sleep", eyes="sleep", effect="zzz", effect_frame=0), dict(pose="sleep", eyes="sleep", effect="zzz", effect_frame=1),
    ])
    A["groom"] = dict(ms=260, frames=[
        dict(pose="sit", eyes="happy", wave=True, tilt_x=-1), dict(pose="sit", eyes="happy", wave=True, tilt_x=-1, tilt_y=1),
    ])
    A["stretch"] = dict(ms=300, frames=[
        dict(pose="lie", eyes="blink", tilt_y=-2), dict(pose="lie", eyes="blink", tilt_y=-3), dict(pose="lie", eyes="open", tilt_y=-2),
    ])
    A["happy"] = dict(ms=160, offsets=[-2, 0], frames=[
        dict(eyes="happy", tail_phase=0, blush=True, ear_tilt=-1), dict(eyes="happy", tail_phase=1, blush=True),
    ])
    A["jump"] = dict(ms=110, offsets=[-5, -10, -5, 0], once=True, frames=[
        dict(eyes="happy", tail_phase=0, frame=1), dict(eyes="happy", tail_phase=0, frame=1), dict(eyes="happy", tail_phase=0, frame=1), dict(eyes="open", tail_phase=1),
    ])
    A["wave"] = dict(ms=220, frames=[
        dict(eyes="happy", wave=True, tail_phase=0), dict(eyes="happy", wave=True, tail_phase=1, tilt_y=-1),
    ])
    A["highfive"] = dict(ms=180, frames=[
        dict(eyes="happy", highfive=True, tail_phase=0, effect="spark", effect_frame=0),
        dict(eyes="happy", highfive=True, tail_phase=1, effect="spark", effect_frame=1),
    ])
    A["nuzzle"] = dict(ms=240, frames=[
        dict(eyes="happy", tilt_x=2, tilt_y=1, blush=True, effect="heart", effect_frame=0),
        dict(eyes="blink", tilt_x=3, tilt_y=2, blush=True, effect="heart", effect_frame=1),
        dict(eyes="happy", tilt_x=2, tilt_y=1, blush=True, effect="heart", effect_frame=2),
    ])
    A["dance"] = dict(ms=170, offsets=[-2, 0, -2, 0], frames=[
        dict(eyes="happy", tilt_x=-1, tail_phase=0, effect="note", effect_frame=0, frame=1),
        dict(eyes="happy", tilt_x=1, tail_phase=2, effect="note", effect_frame=1, frame=3),
        dict(eyes="wink", tilt_x=-1, tail_phase=0, effect="note", effect_frame=2, frame=1),
        dict(eyes="happy", tilt_x=1, tail_phase=2, effect="note", effect_frame=1, frame=3),
    ])
    A["talk"] = dict(ms=150, offsets=[-2, 0], frames=[
        dict(eyes="happy", tail_phase=0, tilt_y=-1), dict(eyes="open", tail_phase=1),
    ])
    A["surprised"] = dict(ms=200, offsets=[-3, 0], frames=[
        dict(eyes="wow", effect="excl", ear_tilt=-2), dict(eyes="wow", effect="excl", ear_tilt=-2),
    ])
    A["love"] = dict(ms=220, frames=[
        dict(eyes="happy", blush=True, effect="heart", effect_frame=0), dict(eyes="happy", blush=True, effect="heart", effect_frame=1), dict(eyes="happy", blush=True, effect="heart", effect_frame=2),
    ])
    A["sweat"] = dict(ms=300, frames=[
        dict(eyes="blink", effect="sweat", effect_frame=0, tilt_y=1), dict(eyes="open", effect="sweat", effect_frame=1, tilt_y=1),
    ])
    A["coding"] = dict(ms=170, frames=[
        dict(pose="sit", prop="laptop", prop_frame=0, tail_phase=2), dict(pose="sit", prop="laptop", prop_frame=1, tail_phase=2),
        dict(pose="sit", prop="laptop", prop_frame=0, tail_phase=1), dict(pose="sit", prop="laptop", prop_frame=1, tail_phase=2, eyes="blink"),
    ])
    A["gaming"] = dict(ms=200, frames=[
        dict(pose="sit", prop="gamepad", prop_frame=0, tail_phase=0), dict(pose="sit", prop="gamepad", prop_frame=1, tail_phase=1),
        dict(pose="sit", prop="gamepad", prop_frame=0, tail_phase=2, eyes="wow"), dict(pose="sit", prop="gamepad", prop_frame=1, tail_phase=1),
    ])
    A["watching"] = dict(ms=420, frames=[
        dict(pose="lie", prop="tv", prop_frame=0, shift_x=-5), dict(pose="lie", prop="tv", prop_frame=1, shift_x=-5),
        dict(pose="lie", prop="tv", prop_frame=0, shift_x=-5, eyes="blink"), dict(pose="lie", prop="tv", prop_frame=1, shift_x=-5),
    ])
    A["reading"] = dict(ms=800, frames=[
        dict(pose="sit", prop="book", prop_frame=0, tail_phase=2), dict(pose="sit", prop="book", prop_frame=1, tail_phase=2),
        dict(pose="sit", prop="book", prop_frame=0, tail_phase=1, eyes="blink"),
    ])
    A["phone"] = dict(ms=420, frames=[
        dict(pose="sit", prop="phone", prop_frame=0, tail_phase=1), dict(pose="sit", prop="phone", prop_frame=1, tail_phase=2, eyes="happy"),
        dict(pose="sit", prop="phone", prop_frame=0, tail_phase=1), dict(pose="sit", prop="phone", prop_frame=1, tail_phase=0),
    ])
    A["sittogether"] = dict(ms=800, frames=[
        dict(pose="sit", eyes="happy", tail_phase=1, blush=True), dict(pose="sit", eyes="happy", tail_phase=2, blush=True), dict(pose="sit", eyes="blink", tail_phase=1, blush=True),
    ])
    return A


def build_all():
    """species -> anim -> {ms, offsets?, once?, frames: [rows]}"""
    out = {}
    for sp in SPECIES:
        out[sp] = {}
        for name, a in anim_frames(sp).items():
            frames = [render(sp, **f) for f in a["frames"]]
            out[sp][name] = dict(ms=a["ms"], offsets=a.get("offsets"), once=a.get("once", False), frames=frames)
    return out


# ---------------------------------------------------------------------------
# TS 출력
# ---------------------------------------------------------------------------
def emit_ts(path, data):
    out = io.StringIO()
    out.write("// 자동 생성 파일. 수정하려면 scripts/gen-sprites.py 를 고치고 다시 실행한다.\n")
    out.write("// 캐릭터 스프라이트 (32x32, 종류별 애니메이션 프레임). 비모듈 스크립트라 전역에 둔다.\n\n")
    out.write("const SPR_W = %d;\nconst SPR_H = %d;\n" % (W, H))
    out.write("const SPR_SPECIES: string[] = %s;\n" % str(SPECIES).replace("'", '"'))
    out.write("interface SprAnimData { ms: number; offsets?: number[]; once?: boolean; frames: string[][] }\n")
    out.write("const SPR_DATA: Record<string, Record<string, SprAnimData>> = {\n")
    for sp, anims in data.items():
        out.write("  %s: {\n" % sp)
        for name, a in anims.items():
            out.write("    %s: { ms: %d" % (name, a["ms"]))
            if a["offsets"]:
                out.write(", offsets: %s" % a["offsets"])
            if a["once"]:
                out.write(", once: true")
            out.write(", frames: [\n")
            for rows in a["frames"]:
                out.write("      [" + ", ".join('"%s"' % r for r in rows) + "],\n")
            out.write("    ] },\n")
        out.write("  },\n")
    out.write("};\n")
    io.open(path, "w", encoding="utf-8", newline="\n").write(out.getvalue())


# ---------------------------------------------------------------------------
# 미리보기 PNG
# ---------------------------------------------------------------------------
PALETTES = {
    "cat": {"o": "#f6b26b", "l": "#ffd09a", "a": "#d98b45", "d": "#8c4a1f", "w": "#fff7ea", "m": "#4a2c2a"},
    "dog": {"o": "#e0b57c", "l": "#f3d3a2", "a": "#b98a52", "d": "#6e4a26", "w": "#fff7ea", "m": "#2b2b2b"},
    "rabbit": {"o": "#f8f4ee", "l": "#ffffff", "a": "#ddd2c6", "d": "#9c8b7d", "w": "#ffffff", "m": "#f48aa4"},
    "bear": {"o": "#a9754d", "l": "#c9966c", "a": "#86593a", "d": "#4e3220", "w": "#f0dcc0", "m": "#2b2b2b"},
    "penguin": {"o": "#34455a", "l": "#4c6079", "a": "#243242", "d": "#111a24", "w": "#ffffff", "m": "#2b2b2b"},
    "fox": {"o": "#f08a3c", "l": "#ffb270", "a": "#c9671f", "d": "#7d3e12", "w": "#fff7ea", "m": "#3a2a2a"},
}
COMMON = {"k": "#2b2b2b", "h": "#ffffff", "p": "#ff9fb3", "y": "#f2a63a", "z": "#8fb4ff", "e": "#ff6b8a", "x": "#ffd43b", "c": "#7cc8ff", "s": "#555c66", "b": "#5ab0ff", "n": "#1e2a3a", "q": "#262b35"}


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def write_png(path, pixels, width, height):
    raw = b"".join(b"\x00" + bytes(pixels[y]) for y in range(height))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)


def render_sheet(path, frames, scale=4, gap=4, bg=(70, 90, 110)):
    cols = len(frames)
    width = cols * (W * scale + gap) + gap
    height = W * scale + gap * 2
    pixels = [[*bg, 255] * width for _ in range(height)]
    for ci, (species, rows) in enumerate(frames):
        pal = dict(PALETTES[species]); pal.update(COMMON)
        ox = gap + ci * (W * scale + gap)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == ".":
                    continue
                r, g, b = hexrgb(pal.get(ch, "#ff00ff"))
                for sy in range(scale):
                    line = pixels[gap + y * scale + sy]
                    for sx in range(scale):
                        px = (ox + x * scale + sx) * 4
                        line[px:px + 4] = [r, g, b, 255]
    write_png(path, pixels, width, height)


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data = build_all()
    emit_ts(os.path.join(root, "src", "renderer", "sprites.ts"), data)
    total = sum(len(a["frames"]) for sp in data.values() for a in sp.values())
    print("sprites.ts generated: %d species, %d frames" % (len(data), total))
    if "--preview" in sys.argv:
        outdir = sys.argv[sys.argv.index("--preview") + 1]
        os.makedirs(outdir, exist_ok=True)
        render_sheet(os.path.join(outdir, "v3_stand.png"), [(sp, data[sp]["idle"]["frames"][0]) for sp in SPECIES])
        render_sheet(os.path.join(outdir, "v3_walk.png"), [(sp, data[sp]["walk"]["frames"][1]) for sp in SPECIES])
        render_sheet(os.path.join(outdir, "v3_sit.png"), [(sp, data[sp]["sit"]["frames"][0]) for sp in SPECIES])
        render_sheet(os.path.join(outdir, "v3_sleep.png"), [(sp, data[sp]["sleep"]["frames"][0]) for sp in SPECIES])
        render_sheet(os.path.join(outdir, "v3_props.png"), [
            ("cat", data["cat"]["coding"]["frames"][0]), ("dog", data["dog"]["gaming"]["frames"][0]), ("rabbit", data["rabbit"]["watching"]["frames"][0]),
            ("bear", data["bear"]["reading"]["frames"][0]), ("fox", data["fox"]["phone"]["frames"][1]), ("penguin", data["penguin"]["coding"]["frames"][1]),
        ])
        render_sheet(os.path.join(outdir, "v3_cat_walk.png"), [("cat", f) for f in data["cat"]["walk"]["frames"]] + [("dog", f) for f in data["dog"]["walk"]["frames"]])
        render_sheet(os.path.join(outdir, "v3_cat_anims.png"), [("cat", data["cat"][n]["frames"][0]) for n in ["happy", "wave", "highfive", "nuzzle", "dance", "surprised", "love", "groom", "stretch", "sweat"]])
        render_sheet(os.path.join(outdir, "v3_dog_anims.png"), [("dog", data["dog"][n]["frames"][0]) for n in ["happy", "wave", "highfive", "nuzzle", "dance", "surprised", "love", "groom", "stretch", "sweat"]])
        print("previews written to", outdir)
