// 렌더러: 내 캐릭터와 친구 캐릭터를 그리고, 상호작용, 클릭 패널, 말풍선 채팅을 처리한다.
// 스프라이트 데이터는 sprites.ts (자동 생성, 같은 전역) 에 있다.
// 스크립트(비모듈) 파일이므로 전역 타입을 직접 선언한다.

interface ActivityPayload {
  category: string;
  label: string;
  idleSec: number;
  showLabel: boolean;
}
interface MemberState {
  userId: string;
  code: string;
  friends: string[];
  nickname: string;
  species: string;
  color: string;
  category: string;
  sharing: boolean;
  since: string;
  lastActive: string;
}
interface ChatMessage {
  id: string;
  from: string;
  fromName: string;
  to: string;
  text: string;
  at: string;
}
interface LocalePayload {
  lang: string;
  dict: Record<string, string>;
}
interface InitData {
  me: MemberState;
  showLabel: boolean;
  status: string;
  friends: MemberState[];
  history: ChatMessage[];
  locale: LocalePayload;
}
interface Window {
  petApi: {
    setIgnoreMouse: (ignore: boolean) => void;
    setFocusable: (focusable: boolean) => void;
    getInit: () => Promise<InitData>;
    sendChat: (to: string, text: string) => Promise<{ ok: boolean; error?: string; msg?: ChatMessage }>;
    toggleShare: () => void;
    onActivity: (cb: (d: ActivityPayload) => void) => void;
    onMe: (cb: (d: { me: MemberState; showLabel: boolean }) => void) => void;
    onFriends: (cb: (d: MemberState[]) => void) => void;
    onChat: (cb: (d: ChatMessage) => void) => void;
    onStatus: (cb: (d: string) => void) => void;
    onLocale: (cb: (d: LocalePayload) => void) => void;
  };
}

// ---------- 팔레트 ----------
// 몸 색 톤 (o 기본, l 밝음, a 어두움, d 외곽선)
const COLOR_TONES: Record<string, Record<string, string>> = {
  orange: { o: "#f6b26b", l: "#ffd09a", a: "#d98b45", d: "#8c4a1f" },
  red: { o: "#f08a3c", l: "#ffb270", a: "#c9671f", d: "#7d3e12" },
  tan: { o: "#e0b57c", l: "#f3d3a2", a: "#b98a52", d: "#6e4a26" },
  brown: { o: "#a9754d", l: "#c9966c", a: "#86593a", d: "#4e3220" },
  white: { o: "#f8f4ee", l: "#ffffff", a: "#ddd2c6", d: "#9c8b7d" },
  cream: { o: "#f3e2c3", l: "#fff3dd", a: "#d6c09a", d: "#8f7a52" },
  gray: { o: "#a6abb3", l: "#c9cdd3", a: "#7f858e", d: "#4b5059" },
  black: { o: "#3d3d47", l: "#55556a", a: "#2a2a33", d: "#15151b", k: "#f2e36b" },
  pink: { o: "#f6a9ba", l: "#ffd0da", a: "#d8849a", d: "#9a4f66" },
  navy: { o: "#34455a", l: "#4c6079", a: "#243242", d: "#111a24" },
  mint: { o: "#9fd8c3", l: "#c9f0e0", a: "#6fb59c", d: "#3a7a63" },
};
const SPECIES_DEFAULT_COLOR: Record<string, string> = {
  cat: "orange", dog: "tan", rabbit: "white", bear: "brown", penguin: "navy", fox: "red",
};
const SPECIES_NOSE: Record<string, string> = {
  cat: "#4a2c2a", dog: "#2b2b2b", rabbit: "#f48aa4", bear: "#2b2b2b", penguin: "#2b2b2b", fox: "#3a2a2a",
};
const COMMON_PALETTE: Record<string, string> = {
  w: "#fff7ea", k: "#2b2b2b", h: "#ffffff", p: "#ff9fb3", y: "#f2a63a", z: "#8fb4ff", e: "#ff6b8a", x: "#ffd43b", c: "#7cc8ff",
};

function paletteFor(species: string, color: string): Record<string, string> {
  const tones = COLOR_TONES[color] ?? COLOR_TONES[SPECIES_DEFAULT_COLOR[species] ?? "orange"];
  return { ...COMMON_PALETTE, m: SPECIES_NOSE[species] ?? "#2b2b2b", ...tones };
}

const SPRITE = SPR_W; // 32
const SCALE = 3;
const SIZE = SPRITE * SCALE; // 96
const GROUND_PAD = 3; // 스프라이트 바닥(30행) 아래 여백

interface Anim {
  frames: HTMLCanvasElement[];
  interval: number;
  offsets?: number[];
  once?: boolean;
}
type AnimSet = Record<string, Anim>;

function bakeFrame(palette: Record<string, string>, rows: string[]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPRITE;
  c.height = SPRITE;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < SPRITE; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < SPRITE; x++) {
      const ch = row[x];
      if (!ch || ch === ".") continue;
      ctx.fillStyle = palette[ch] ?? "#f0f";
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

const animCache = new Map<string, AnimSet>();
function getAnimSet(species: string, color: string): AnimSet {
  const sp = SPR_DATA[species] ? species : "cat";
  const key = `${sp}/${color}`;
  const cached = animCache.get(key);
  if (cached) return cached;
  const pal = paletteFor(sp, color);
  const set: AnimSet = {};
  for (const [name, a] of Object.entries(SPR_DATA[sp])) {
    set[name] = { frames: a.frames.map((rows) => bakeFrame(pal, rows)), interval: a.ms, offsets: a.offsets, once: a.once };
  }
  animCache.set(key, set);
  return set;
}

// 카테고리 → 포즈 애니메이션과 아이콘
const CATEGORY_POSE: Record<string, { anim: string; icon: string }> = {
  coding: { anim: "sit", icon: "💻" },
  game: { anim: "sit", icon: "🎮" },
  video: { anim: "lie", icon: "📺" },
  document: { anim: "sit", icon: "📄" },
  chat: { anim: "idle", icon: "💬" },
  away: { anim: "sleep", icon: "" },
};

// ---------- 캔버스 ----------
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let petsReady = false;
function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
  if (petsReady) {
    for (const pet of allPets()) {
      pet.x = Math.max(0, Math.min(canvas.width - SIZE, pet.x));
      pet.y = Math.min(pet.y, floorY());
    }
  }
}
window.addEventListener("resize", resize);
resize();

function floorY(): number {
  return canvas.height - SIZE + GROUND_PAD;
}

const WALK_SPEED = 50; // px/s
const RUN_SPEED = 130;
let DICT: Record<string, string> = {};
let showLabel = true;

function tr(key: string, params?: Record<string, string | number>): string {
  let s = DICT[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
  return s;
}

// ---------- 캐릭터 ----------
type State = "idle" | "walk" | "sit" | "lie" | "groom" | "stretch" | "pose" | "interact";

interface Interaction {
  type: "nuzzle" | "highfive" | "dance" | "sittogether" | "chase" | "wave";
  partner: Pet;
  phase: "approach" | "play" | "chase";
  until: number; // play/chase 종료 시각
  started: number;
  role: "a" | "b";
}

class Pet {
  x: number;
  y: number;
  dir: 1 | -1 = 1;
  state: State = "idle";
  anim = "idle";
  stateUntil = 0;
  frame = 0;
  frameTimer = 0;
  dragging = false;
  dragOffX = 0;
  dragOffY = 0;
  frozen = false;
  bubble: { text: string; until: number } | null = null;
  oneShot: { anim: Anim; name: string; until: number; frame: number; timer: number } | null = null;
  queue: { name: string; durationMs: number }[] = [];
  interaction: Interaction | null = null;
  lastInteractionAt = 0;

  constructor(public member: MemberState, public isMe: boolean, x: number) {
    this.x = x;
    this.y = floorY();
  }

  get id(): string {
    return this.member.userId;
  }
  get category(): string {
    return this.member.sharing ? this.member.category : "unknown";
  }
  get species(): string {
    return this.member.species || "cat";
  }
  get set(): AnimSet {
    return getAnimSet(this.species, this.member.color);
  }

  labelText(): string {
    const status = this.member.sharing ? tr(`cat.${this.member.category}`) : tr("label.private");
    return this.isMe ? status : `${this.member.nickname} · ${status}`;
  }

  setMember(m: MemberState): void {
    const changed = m.category !== this.member.category || m.sharing !== this.member.sharing;
    const lookChanged = m.species !== this.member.species || m.color !== this.member.color;
    this.member = m;
    if (lookChanged) this.frame = 0;
    if (changed && !this.dragging && !this.frozen && !this.interaction) this.stateUntil = 0;
  }

  say(text: string): void {
    this.bubble = { text, until: performance.now() + 6000 + Math.min(text.length, 100) * 60 };
    this.play("talk", 1200);
  }

  /** 일회성 모션 재생. durationMs 를 주면 그 시간 동안 반복 */
  play(name: string, durationMs?: number): void {
    const anim = this.set[name];
    if (!anim) return;
    const dur = durationMs ?? anim.interval * anim.frames.length;
    this.oneShot = { anim, name, until: performance.now() + dur, frame: 0, timer: 0 };
  }

  /** 순서대로 재생할 모션을 예약 */
  enqueue(...items: { name: string; durationMs: number }[]): void {
    this.queue.push(...items);
  }

  busy(): boolean {
    return this.dragging || this.frozen || this.interaction !== null || this.oneShot !== null;
  }

  private setState(state: State, anim: string, durationMs: number, now: number): void {
    this.state = state;
    this.anim = anim;
    this.stateUntil = now + durationMs;
    this.frame = 0;
    this.frameTimer = 0;
  }

  private pickNextState(now: number): void {
    const pose = CATEGORY_POSE[this.category];
    if (pose && this.category === "away") return this.setState("pose", pose.anim, 15000, now);
    if (pose && Math.random() < 0.7) return this.setState("pose", pose.anim, 6000 + Math.random() * 10000, now);
    const r = Math.random();
    if (r < 0.35) {
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.setState("walk", "walk", 1500 + Math.random() * 4000, now);
    } else if (r < 0.6) {
      this.setState("idle", "idle", 1500 + Math.random() * 3000, now);
    } else if (r < 0.72) {
      this.setState("groom", "groom", 1800 + Math.random() * 1500, now);
    } else if (r < 0.8) {
      this.setState("stretch", "stretch", 1200, now);
    } else if (r < 0.92) {
      this.setState("sit", "sit", 3000 + Math.random() * 5000, now);
    } else {
      this.setState("lie", "lie", 3000 + Math.random() * 4000, now);
    }
  }

  private currentAnim(): Anim {
    return this.set[this.anim] ?? this.set.idle;
  }

  moveToward(targetX: number, speed: number, dt: number): boolean {
    const dx = targetX - this.x;
    if (Math.abs(dx) < 2) return true;
    this.dir = dx > 0 ? 1 : -1;
    const step = Math.min(Math.abs(dx), speed * dt);
    this.x = Math.max(0, Math.min(canvas.width - SIZE, this.x + Math.sign(dx) * step));
    return Math.abs(targetX - this.x) < 2;
  }

  update(dt: number, now: number): void {
    if (!this.dragging) {
      if (this.interaction) {
        this.updateInteraction(dt, now);
      } else if (this.frozen) {
        if (this.state === "walk" || now >= this.stateUntil) {
          const pose = CATEGORY_POSE[this.category];
          this.setState(pose ? "pose" : "sit", pose ? pose.anim : "sit", 1e9, now);
        }
      } else if (now >= this.stateUntil) {
        this.pickNextState(now);
      }
      if (this.state === "walk" && !this.oneShot && !this.interaction) {
        this.x += this.dir * WALK_SPEED * dt;
        if (this.x < 0) {
          this.x = 0;
          this.dir = 1;
        } else if (this.x > canvas.width - SIZE) {
          this.x = canvas.width - SIZE;
          this.dir = -1;
        }
      }
      const floor = floorY();
      if (this.y < floor) this.y = Math.min(floor, this.y + 600 * dt);
    }

    // 예약된 모션
    if (!this.oneShot && this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.play(next.name, next.durationMs);
    }

    if (this.oneShot) {
      const o = this.oneShot;
      o.timer += dt * 1000;
      if (o.timer >= o.anim.interval) {
        o.timer = 0;
        o.frame += 1;
        if (o.frame >= o.anim.frames.length) {
          if (o.anim.once) this.oneShot = null;
          else o.frame = 0;
        }
      }
      if (this.oneShot && now > o.until) this.oneShot = null;
    } else {
      const anim = this.currentAnim();
      this.frameTimer += dt * 1000;
      if (this.frameTimer >= anim.interval) {
        this.frameTimer = 0;
        this.frame = (this.frame + 1) % anim.frames.length;
      }
    }
    if (this.bubble && now > this.bubble.until) this.bubble = null;
  }

  private updateInteraction(dt: number, now: number): void {
    const it = this.interaction!;
    const partner = it.partner;
    if (!partner.interaction || partner.interaction.partner !== this) {
      this.interaction = null;
      this.stateUntil = 0;
      return;
    }
    if (it.phase === "approach") {
      // 서로 마주 보고 설 자리로 걸어간다 (a 가 왼쪽, b 가 오른쪽)
      const gap = it.type === "nuzzle" ? SIZE * 0.82 : SIZE * 0.98;
      const mid = (this.x + partner.x) / 2;
      const target = it.role === "a" ? mid - gap / 2 : mid + gap / 2;
      // 멀면 달려가고 가까우면 걸어간다
      const far = Math.abs(target - this.x) > 220;
      this.anim = far ? "run" : "walk";
      const arrived = this.moveToward(target, far ? RUN_SPEED : WALK_SPEED * 1.3, dt);
      if (arrived || now - it.started > 12000) {
        this.dir = partner.x >= this.x ? 1 : -1;
        if (it.type === "chase") {
          it.phase = "chase";
          it.until = now + 3500;
        } else {
          it.phase = "play";
          const dur = { nuzzle: 2600, highfive: 1600, dance: 3600, sittogether: 7000, wave: 1800, chase: 0 }[it.type];
          it.until = now + dur;
          this.anim = it.type;
          this.frame = 0;
          this.frameTimer = 0;
          if (it.type === "sittogether") this.dir = 1;
        }
      }
    } else if (it.phase === "play") {
      if (now >= it.until) {
        this.interaction = null;
        this.lastInteractionAt = now;
        this.stateUntil = 0;
      }
    } else if (it.phase === "chase") {
      this.anim = "run";
      if (it.role === "b") {
        // 도망: 상대 반대쪽으로
        const away = this.x >= partner.x ? 1 : -1;
        this.dir = away as 1 | -1;
        this.x += away * RUN_SPEED * dt;
        if (this.x <= 0 || this.x >= canvas.width - SIZE) {
          this.x = Math.max(0, Math.min(canvas.width - SIZE, this.x));
        }
      } else {
        this.moveToward(partner.x - (partner.x >= this.x ? SIZE * 0.6 : -SIZE * 0.6), RUN_SPEED * 0.95, dt);
      }
      if (now >= it.until) {
        this.interaction = null;
        this.lastInteractionAt = now;
        this.stateUntil = 0;
        this.play("happy", 1200);
      }
    }
  }

  draw(now: number): void {
    let img: HTMLCanvasElement;
    let yOff = 0;
    if (this.oneShot) {
      const o = this.oneShot;
      const i = Math.min(o.frame, o.anim.frames.length - 1);
      img = o.anim.frames[i];
      yOff = o.anim.offsets?.[i] ?? 0;
    } else {
      const anim = this.currentAnim();
      const i = this.frame % anim.frames.length;
      img = anim.frames[i];
      yOff = anim.offsets?.[i] ?? 0;
    }
    const px = Math.round(this.x);
    const py = Math.round(this.y) + yOff * SCALE;
    ctx.save();
    if (this.dir === -1) {
      ctx.translate(px + SIZE, py);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
    } else {
      ctx.drawImage(img, px, py, SIZE, SIZE);
    }
    ctx.restore();

    // 상태 아이콘 생각풍선
    const pose = CATEGORY_POSE[this.category];
    if (this.state === "pose" && pose && pose.icon && !this.oneShot && !this.bubble) {
      drawThought(px + (this.dir === 1 ? SIZE * 0.78 : SIZE * 0.22), py + 10, pose.icon);
    }

    let top = py + 2;
    if (this.bubble) top = drawBubble(px + SIZE / 2, top, this.bubble.text) - 4;
    if (showLabel) drawLabel(px + SIZE / 2, top, this.labelText());
  }

  hit(mx: number, my: number): boolean {
    return mx >= this.x + 6 && mx < this.x + SIZE - 6 && my >= this.y + 8 && my < this.y + SIZE;
  }
}

/** 작은 생각풍선 + 이모지. (cx, by) 는 풍선 꼬리 쪽 기준점 */
function drawThought(cx: number, by: number, icon: string): void {
  const w = 30;
  const h = 26;
  const x = Math.round(cx - w / 2);
  const y = Math.round(by - h - 10);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.strokeStyle = "rgba(40,40,40,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - 4, y + h + 4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - 8, y + h + 9, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = "15px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#000";
  ctx.fillText(icon, cx, y + h / 2 + 1);
  ctx.textAlign = "left";
}

const labelRects: { x: number; y: number; w: number; h: number }[] = [];

/** 캐릭터 머리 위 라벨. bottom 은 라벨 아래쪽 y. 반환값은 라벨 위쪽 y. 다른 라벨과 겹치면 위로 올린다. */
function drawLabel(cx: number, bottom: number, text: string): number {
  if (!text) return bottom;
  ctx.font = "12px 'Malgun Gothic', 'Segoe UI', 'Yu Gothic UI', sans-serif";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 14;
  const h = 19;
  let x = Math.round(cx - w / 2);
  x = Math.max(2, Math.min(canvas.width - w - 2, x));
  let y = Math.round(bottom - h);
  for (let guard = 0; guard < 6; guard++) {
    const clash = labelRects.find((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
    if (!clash) break;
    y = clash.y - h - 2;
  }
  labelRects.push({ x, y, w, h });
  ctx.fillStyle = "rgba(28, 30, 36, 0.82)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + 7, y + h / 2 + 1);
  return y;
}

function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines.slice(0, 5);
}

/** 말풍선. bottom 은 꼬리 끝 y. 반환값은 풍선 위쪽 y. */
function drawBubble(cx: number, bottom: number, text: string): number {
  ctx.font = "13px 'Malgun Gothic', 'Segoe UI', 'Yu Gothic UI', sans-serif";
  ctx.textBaseline = "top";
  const pad = 9;
  const lineH = 17;
  const lines = wrapText(text, 180);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
  const h = lines.length * lineH + pad * 2 - 3;
  const tail = 7;
  let x = Math.round(cx - w / 2);
  x = Math.max(4, Math.min(canvas.width - w - 4, x));
  const y = Math.round(bottom - tail - h);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + h - 1);
  ctx.lineTo(cx, y + h + tail);
  ctx.lineTo(cx + 6, y + h - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1e1e1e";
  lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad - 1 + i * lineH));
  return y;
}

// ---------- 월드 ----------
let me: Pet | null = null;
let dragPet: Pet | null = null;
const friends = new Map<string, Pet>();
let chatHistory: ChatMessage[] = [];
let connStatus = "connecting";

function allPets(): Pet[] {
  return [...friends.values(), ...(me ? [me] : [])];
}

function randomX(): number {
  return 80 + Math.random() * Math.max(100, canvas.width - 160);
}

const lastPositions = new Map<string, { x: number; at: number }>();

function applyFriends(list: MemberState[]): void {
  const seen = new Set<string>();
  for (const m of list) {
    seen.add(m.userId);
    const existing = friends.get(m.userId);
    if (existing) {
      existing.setMember(m);
    } else {
      const remembered = lastPositions.get(m.userId);
      const returning = remembered !== undefined && performance.now() - remembered.at < 10 * 60_000;
      const pet = new Pet(m, false, returning ? remembered.x : randomX());
      friends.set(m.userId, pet);
      if (petsReady && !returning) {
        // 새 친구는 손을 흔들고, 모두 폴짝 뛰며 반긴다
        pet.enqueue({ name: "jump", durationMs: 450 }, { name: "wave", durationMs: 1800 });
        for (const p of allPets()) if (p !== pet && !p.busy()) p.play("jump");
      }
    }
  }
  for (const id of [...friends.keys()]) {
    if (!seen.has(id)) {
      const pet = friends.get(id)!;
      lastPositions.set(id, { x: pet.x, at: performance.now() });
      if (panelPet?.id === id) closePanel();
      if (dragPet?.id === id) dragPet = null;
      if (pet.interaction) {
        const partner = pet.interaction.partner;
        partner.interaction = null;
        partner.stateUntil = 0;
      }
      friends.delete(id);
    }
  }
}

// ---------- 상호작용 매니저 ----------
let nextInteractionCheck = 0;
const INTERACTION_TYPES: Interaction["type"][] = ["nuzzle", "highfive", "dance", "sittogether", "chase", "wave"];

function maybeStartInteraction(now: number): void {
  if (now < nextInteractionCheck) return;
  nextInteractionCheck = now + 5000;
  const free = allPets().filter((p) => !p.busy() && now - p.lastInteractionAt > 20000 && p.category !== "away");
  if (free.length < 2 || Math.random() > 0.45) return;
  // 가까운 둘을 고른다 (나를 우선)
  const first = free.find((p) => p.isMe) ?? free[Math.floor(Math.random() * free.length)];
  const others = free.filter((p) => p !== first).sort((p, q) => Math.abs(p.x - first.x) - Math.abs(q.x - first.x));
  const second = others[0];
  if (!second) return;
  const type = INTERACTION_TYPES[Math.floor(Math.random() * INTERACTION_TYPES.length)];
  const left = first.x <= second.x ? first : second;
  const right = left === first ? second : first;
  left.interaction = { type, partner: right, phase: "approach", until: 0, started: now, role: "a" };
  right.interaction = { type, partner: left, phase: "approach", until: 0, started: now, role: "b" };
  left.state = right.state = "interact";
}

// ---------- 패널 ----------
const panel = document.getElementById("panel") as HTMLDivElement;
const panelName = document.getElementById("panel-name")!;
const panelStatus = document.getElementById("panel-status")!;
const panelMeta = document.getElementById("panel-meta")!;
const panelActions = document.getElementById("panel-actions")!;
const panelLog = document.getElementById("panel-log")!;
const panelForm = document.getElementById("panel-form") as HTMLFormElement;
const panelInput = document.getElementById("panel-input") as HTMLInputElement;
let panelPet: Pet | null = null;

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return tr("time.now");
  if (m < 60) return tr("time.min", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tr("time.hour", { n: h });
  return tr("time.day", { n: Math.floor(h / 24) });
}

function openPanel(pet: Pet): void {
  if (panelPet && panelPet !== pet) panelPet.frozen = false;
  panelPet = pet;
  pet.frozen = true;
  if (pet.interaction) {
    pet.interaction.partner.interaction = null;
    pet.interaction = null;
  }
  pet.stateUntil = 0;
  panel.classList.remove("hidden");
  renderPanel();
  positionPanel();
  window.petApi.setFocusable(true);
  setTimeout(() => panelInput.focus(), 50);
}

function closePanel(): void {
  if (panelPet) panelPet.frozen = false;
  panelPet = null;
  panel.classList.add("hidden");
  panelInput.blur();
  window.petApi.setFocusable(false);
  setIgnore(true);
}

function renderPanel(): void {
  const pet = panelPet;
  if (!pet) return;
  const m = pet.member;
  panelName.textContent = pet.isMe ? tr("panel.me", { name: m.nickname }) : m.nickname;
  panelStatus.textContent = m.sharing ? tr(`cat.${m.category}`) : tr("panel.private");
  const metaParts: string[] = [];
  if (m.sharing) metaParts.push(tr("panel.since", { t: relTime(m.since) }));
  metaParts.push(tr("panel.lastActive", { t: relTime(m.lastActive) }));
  if (pet.isMe) metaParts.push(tr("panel.connection", { s: tr(`conn.${connStatus}`) }));
  panelMeta.textContent = metaParts.join(" · ");

  panelActions.innerHTML = "";
  if (pet.isMe) {
    const btn = document.createElement("button");
    btn.textContent = m.sharing ? tr("panel.shareOff") : tr("panel.shareOn");
    btn.addEventListener("click", () => window.petApi.toggleShare());
    panelActions.appendChild(btn);
    panelInput.placeholder = tr("panel.toAll");
  } else {
    // 친구에게 장난 걸기 버튼
    for (const [label, type] of [["👋", "wave"], ["🤝", "highfive"], ["💃", "dance"], ["🏃", "chase"]] as const) {
      const b = document.createElement("button");
      b.textContent = label;
      b.title = type;
      b.addEventListener("click", () => startInteractionWith(pet, type));
      panelActions.appendChild(b);
    }
    panelInput.placeholder = tr("panel.toOne", { name: m.nickname });
  }
  (document.getElementById("panel-send") as HTMLButtonElement).textContent = tr("panel.send");

  panelLog.innerHTML = "";
  const myId = me?.id;
  const related = chatHistory.filter((msg) =>
    pet.isMe
      ? msg.to === "all"
      : msg.from === pet.id || msg.to === pet.id || (msg.from === myId && msg.to === "all"),
  );
  for (const msg of related.slice(-20)) {
    const div = document.createElement("div");
    const mine = msg.from === myId;
    div.className = `msg ${mine ? "mine" : "theirs"}`;
    if (!mine) {
      const who = document.createElement("span");
      who.className = "who";
      who.textContent = msg.fromName;
      div.appendChild(who);
    }
    div.appendChild(document.createTextNode(msg.text));
    panelLog.appendChild(div);
  }
  panelLog.scrollTop = panelLog.scrollHeight;
}

/** 패널 버튼으로 내 캐릭터가 친구에게 다가가 상호작용 */
function startInteractionWith(friend: Pet, type: Interaction["type"]): void {
  if (!me) return;
  closePanel();
  const now = performance.now();
  for (const p of [me, friend]) {
    if (p.interaction) {
      p.interaction.partner.interaction = null;
      p.interaction = null;
    }
    p.oneShot = null;
    p.queue = [];
  }
  const left = me.x <= friend.x ? me : friend;
  const right = left === me ? friend : me;
  left.interaction = { type, partner: right, phase: "approach", until: 0, started: now, role: "a" };
  right.interaction = { type, partner: left, phase: "approach", until: 0, started: now, role: "b" };
  left.state = right.state = "interact";
}

function positionPanel(): void {
  const pet = panelPet;
  if (!pet) return;
  const w = panel.offsetWidth;
  const h = panel.offsetHeight;
  let left = Math.round(pet.x + SIZE + 8);
  if (left + w > canvas.width - 8) left = Math.round(pet.x - w - 8);
  left = Math.max(8, left);
  let top = Math.round(pet.y + SIZE - h);
  top = Math.max(8, Math.min(canvas.height - h - 8, top));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

document.getElementById("panel-close")!.addEventListener("click", () => closePanel());
panelForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = panelInput.value.trim();
  if (!text || !panelPet) return;
  const to = panelPet.isMe ? "all" : panelPet.id;
  panelInput.value = "";
  const res = await window.petApi.sendChat(to, text);
  if (!res.ok) me?.say(tr("panel.sendFail", { e: res.error ?? "" }));
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && panelPet) closePanel();
});

// ---------- 메인 루프 ----------
let last = performance.now();
function tick(now: number): void {
  const dt = Math.min(now - last, 100) / 1000;
  last = now;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  labelRects.length = 0;
  maybeStartInteraction(now);
  // 뒤에 있는(왼쪽) 캐릭터부터 그려 겹칠 때 자연스럽게
  const pets = allPets().sort((a, b) => a.x - b.x);
  for (const pet of pets) pet.update(dt, now);
  for (const pet of pets) pet.draw(now);
  if (panelPet) positionPanel();
  requestAnimationFrame(tick);
}

// ---------- 마우스 ----------
let ignoring = true;
function setIgnore(v: boolean): void {
  if (ignoring === v) return;
  ignoring = v;
  window.petApi.setIgnoreMouse(v);
}

function overPanel(mx: number, my: number): boolean {
  if (!panelPet) return false;
  const r = panel.getBoundingClientRect();
  return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
}

function petAt(mx: number, my: number): Pet | null {
  const pets = allPets();
  // 내 캐릭터를 우선, 그 다음 오른쪽(앞)에 있는 캐릭터
  if (me?.hit(mx, my)) return me;
  const hits = pets.filter((p) => p.hit(mx, my)).sort((a, b) => b.x - a.x);
  return hits[0] ?? null;
}

let dragStart = { x: 0, y: 0, moved: false };

window.addEventListener("mousemove", (e) => {
  if (dragPet) {
    dragPet.x = Math.max(0, Math.min(canvas.width - SIZE, e.clientX - dragPet.dragOffX));
    dragPet.y = Math.max(0, Math.min(floorY(), e.clientY - dragPet.dragOffY));
    if (Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y) > 4) dragStart.moved = true;
    return;
  }
  setIgnore(!(petAt(e.clientX, e.clientY) || overPanel(e.clientX, e.clientY)));
});

window.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (overPanel(e.clientX, e.clientY)) return;
  const pet = petAt(e.clientX, e.clientY);
  if (!pet) return;
  dragPet = pet;
  pet.dragging = true;
  pet.dragOffX = e.clientX - pet.x;
  pet.dragOffY = e.clientY - pet.y;
  if (pet.interaction) {
    pet.interaction.partner.interaction = null;
    pet.interaction = null;
  }
  pet.state = "idle";
  pet.anim = "idle";
  pet.frame = 0;
  dragStart = { x: e.clientX, y: e.clientY, moved: false };
});

window.addEventListener("mouseup", () => {
  if (!dragPet) return;
  const pet = dragPet;
  dragPet = null;
  pet.dragging = false;
  pet.stateUntil = performance.now() + 800;
  if (!dragStart.moved) {
    if (panelPet === pet) closePanel();
    else openPanel(pet);
  } else {
    pet.play("surprised", 600);
  }
});

window.addEventListener("mouseleave", () => {
  if (!panelPet) setIgnore(true);
});

// ---------- IPC ----------
window.petApi.onActivity((data) => {
  showLabel = data.showLabel;
});
window.petApi.onMe(({ me: m, showLabel: sl }) => {
  showLabel = sl;
  if (me) me.setMember(m);
  if (panelPet?.isMe) renderPanel();
});
window.petApi.onFriends((list) => {
  applyFriends(list);
  if (panelPet && !panelPet.isMe) renderPanel();
});
window.petApi.onChat((msg) => {
  chatHistory.push(msg);
  if (chatHistory.length > 100) chatHistory = chatHistory.slice(-100);
  const speaker = msg.from === me?.id ? me : friends.get(msg.from);
  speaker?.say(msg.text);
  if (speaker && !speaker.isMe && me) {
    // 듣는 쪽: 놀랐다가 좋아한다
    if (speaker.x !== me.x) me.dir = speaker.x > me.x ? 1 : -1;
    me.queue = [];
    me.enqueue({ name: "surprised", durationMs: 700 }, { name: "love", durationMs: 1800 });
  }
  if (panelPet) renderPanel();
});
window.petApi.onStatus((s) => {
  connStatus = s;
  if (panelPet?.isMe) renderPanel();
});
window.petApi.onLocale((d) => {
  DICT = d.dict;
  if (panelPet) renderPanel();
});

async function init(): Promise<void> {
  const data = await window.petApi.getInit();
  DICT = data.locale.dict;
  showLabel = data.showLabel;
  connStatus = data.status;
  chatHistory = data.history;
  me = new Pet(data.me, true, Math.floor(canvas.width / 2));
  applyFriends(data.friends);
  petsReady = true;
  requestAnimationFrame(tick);
}
void init();
