// 렌더러: 내 캐릭터와 친구 캐릭터를 그리고, 클릭 패널과 말풍선 채팅을 처리한다.
// 외부 에셋 없이 코드로 그린 16x16 스프라이트를 사용한다.
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

// ---------- 스프라이트 정의 ----------
// 문자 → 색. "." 은 투명. o/d/w/k 는 캐릭터 색에 따라 바뀐다.
const BASE_PALETTE: Record<string, string> = {
  o: "#f2a65a", // 몸통
  d: "#c7773a", // 외곽
  w: "#fff4e0", // 배
  k: "#2b2b2b", // 눈, 코
  p: "#ff9fb3", // 귀 안쪽
  s: "#555c66", // 기기 회색
  b: "#5ab0ff", // 화면 파랑
  n: "#1e2a3a", // 폰
  z: "#8fb4ff", // zzz
  y: "#f7c75a", // 책 표지
};

const COLOR_VARIANTS: Record<string, Record<string, string>> = {
  orange: {},
  gray: { o: "#9aa0a8", d: "#6b7079", w: "#e8eaee" },
  black: { o: "#3d3d47", d: "#22222a", w: "#8c8c99", k: "#f2e36b" },
  white: { o: "#f5f5f0", d: "#c2c0b4", w: "#ffffff" },
  pink: { o: "#f4a3b5", d: "#c9718a", w: "#ffe6ec" },
  brown: { o: "#9c6b45", d: "#6e4830", w: "#e3cdb6" },
};

type Frame = string[];
const EMPTY = "................";

const IDLE_1: Frame = [
  "................",
  "...dd......dd...",
  "..dpod....dopd..",
  "..doood..doood..",
  "..dooooooooood..",
  "..dooooooooood..",
  "..dokooooookod..",
  "..doooookooood..",
  "..doowwwwwwood..",
  "...dowwwwwwod...",
  "..ddooooooooodd.",
  ".dooooooooooood.",
  ".dooddoooodoood.",
  ".doodooooodoood.",
  "..dd.dd..dd.dd..",
  "................",
];
const IDLE_2: Frame = IDLE_1.map((row, y) => (y === 6 ? "..dodoooooodod.." : row));
const WALK_1: Frame = IDLE_1.map((row, y) => {
  if (y === 13) return ".dodooooooodood.";
  if (y === 14) return "..dd..dd.dd..dd.";
  return row;
});
const WALK_2: Frame = IDLE_1.map((row, y) => {
  if (y === 13) return ".dooodoooodoood.";
  if (y === 14) return ".dd..dd..dd.dd..";
  return row;
});
const SIT: Frame = [
  "................",
  "................",
  "...dd......dd...",
  "..dpod....dopd..",
  "..doood..doood..",
  "..dooooooooood..",
  "..dooooooooood..",
  "..dokooooookod..",
  "..doooookooood..",
  "..doowwwwwwood..",
  "...dowwwwwwod...",
  "..ddooooooooodd.",
  ".dooowwwwwwoood.",
  ".dooowwwwwwoood.",
  "..dddddddddddd..",
  "................",
];
const LIE: Frame = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "..dd..dd........",
  ".dpod.dopd......",
  ".dooooooodddddd.",
  ".dokoooookoooood",
  ".doooookoooooood",
  ".doowwwwwooooood",
  "..dowwwwooooood.",
  "...dddddddddddd.",
  "................",
  "................",
];
const LIE_SLEEP: Frame = LIE.map((row, y) => (y === 9 ? ".dodooooodoooood" : row));

function overlay(rows: Record<number, string>): Frame {
  const f: Frame = [];
  for (let y = 0; y < 16; y++) f.push(rows[y] ?? EMPTY);
  return f;
}
const LAPTOP_A = overlay({ 10: "....ssssssss....", 11: "....sbbbbbbs....", 12: "....sbbbbbbs....", 13: "...sossssssos..." });
const LAPTOP_B = overlay({ 10: "....ssssssss....", 11: "....sbbbbbbs....", 12: "...osbbbbbbso...", 13: "...ssssssssss..." });
const GAMEPAD_A = overlay({ 11: "....ssssssss....", 12: "...sskssssks....", 13: "....ss....ss...." });
const GAMEPAD_B = overlay({ 11: "....ssssssss....", 12: "...sspssssps....", 13: "....ss....ss...." });
const BOOK_A = overlay({ 10: "....yyyyyyyy....", 11: "....ywwwwwwy....", 12: "....ywkwwkwy....", 13: "....yyyyyyyy...." });
const BOOK_B = overlay({ 10: "....yyyyyyyy....", 11: "....ywwwwwwy....", 12: "....ywwkwkwy....", 13: "....yyyyyyyy...." });
const PHONE_A = overlay({ 0: "....k.k.k.......", 10: "......nnnn......", 11: "......nbbn......", 12: "......nnnn......" });
const PHONE_B = overlay({ 0: "....k.k.........", 10: "......nnnn......", 11: "......nbbn......", 12: "......nnnn......" });
const TV_A = overlay({ 2: "...........sssss", 3: "...........sbbbs", 4: "...........sbbbs", 5: "...........sssss" });
const TV_B = overlay({ 2: "...........sssss", 3: "...........swbbs", 4: "...........sbbws", 5: "...........sssss" });
const ZZZ_A = overlay({ 3: "...........zz...", 5: ".........z......" });
const ZZZ_B = overlay({ 2: "............zz..", 4: "..........z....." });

const SPRITE = 16;
const SCALE = 4;
const SIZE = SPRITE * SCALE;

interface Anim {
  frames: HTMLCanvasElement[];
  interval: number; // ms
}
interface AnimSet {
  anims: Record<string, Anim>;
  poses: Record<string, Anim>;
}

function bakeFrame(palette: Record<string, string>, ...layers: Frame[]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPRITE;
  c.height = SPRITE;
  const ctx = c.getContext("2d")!;
  for (const frame of layers) {
    for (let y = 0; y < SPRITE; y++) {
      const row = frame[y] ?? EMPTY;
      for (let x = 0; x < SPRITE; x++) {
        const ch = row[x];
        if (!ch || ch === ".") continue;
        ctx.fillStyle = palette[ch] ?? "#f0f";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

const animCache = new Map<string, AnimSet>();
function getAnimSet(color: string): AnimSet {
  const cached = animCache.get(color);
  if (cached) return cached;
  const pal = { ...BASE_PALETTE, ...(COLOR_VARIANTS[color] ?? {}) };
  const b = (...layers: Frame[]) => bakeFrame(pal, ...layers);
  const set: AnimSet = {
    anims: {
      idle: { frames: [b(IDLE_1), b(IDLE_2)], interval: 900 },
      walk: { frames: [b(WALK_1), b(IDLE_1), b(WALK_2), b(IDLE_1)], interval: 150 },
      sit: { frames: [b(SIT)], interval: 1000 },
    },
    poses: {
      coding: { frames: [b(SIT, LAPTOP_A), b(SIT, LAPTOP_B)], interval: 220 },
      game: { frames: [b(SIT, GAMEPAD_A), b(SIT, GAMEPAD_B)], interval: 300 },
      document: { frames: [b(SIT, BOOK_A), b(SIT, BOOK_B)], interval: 1400 },
      chat: { frames: [b(SIT, PHONE_A), b(SIT, PHONE_B)], interval: 450 },
      video: { frames: [b(LIE, TV_A), b(LIE, TV_B)], interval: 400 },
      away: { frames: [b(LIE_SLEEP, ZZZ_A), b(LIE_SLEEP, ZZZ_B)], interval: 900 },
    },
  };
  animCache.set(color, set);
  return set;
}

// ---------- 캔버스 ----------
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let petsReady = false; // init() 이후 true. 그 전에는 캐릭터 목록이 아직 없다.
function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
  // 해상도나 작업표시줄이 바뀌면 캐릭터가 화면 밖에 남지 않게 한다.
  if (petsReady) {
    for (const pet of allPets()) {
      pet.x = Math.max(0, Math.min(canvas.width - SIZE, pet.x));
      pet.y = Math.min(pet.y, canvas.height - SIZE);
    }
  }
}
window.addEventListener("resize", resize);
resize();

const WALK_SPEED = 60; // px/s
let DICT: Record<string, string> = {};
let showLabel = true;

/** 사전 문자열 조회. {name} 자리표시자를 채운다. */
function tr(key: string, params?: Record<string, string | number>): string {
  let s = DICT[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
  return s;
}

// ---------- 캐릭터 ----------
type State = "idle" | "walk" | "sit" | "pose";

class Pet {
  x: number;
  y: number;
  dir: 1 | -1 = 1;
  state: State = "idle";
  stateUntil = 0;
  frame = 0;
  frameTimer = 0;
  dragging = false;
  dragOffX = 0;
  dragOffY = 0;
  frozen = false; // 패널이 열려 있는 동안 제자리에 있는다
  bubble: { text: string; until: number } | null = null;

  constructor(public member: MemberState, public isMe: boolean, x: number) {
    this.x = x;
    this.y = canvas.height - SIZE;
  }

  get id(): string {
    return this.member.userId;
  }

  get category(): string {
    return this.member.sharing ? this.member.category : "unknown";
  }

  labelText(): string {
    const status = this.member.sharing ? tr(`cat.${this.member.category}`) : tr("label.private");
    return this.isMe ? status : `${this.member.nickname} · ${status}`;
  }

  setMember(m: MemberState): void {
    const changed = m.category !== this.member.category || m.sharing !== this.member.sharing;
    this.member = m;
    if (changed && !this.dragging && !this.frozen) this.stateUntil = 0;
  }

  say(text: string): void {
    this.bubble = { text, until: performance.now() + 6000 + Math.min(text.length, 100) * 60 };
  }

  private setState(state: State, durationMs: number, now: number): void {
    this.state = state;
    this.stateUntil = now + durationMs;
    this.frame = 0;
    this.frameTimer = 0;
  }

  private pickNextState(now: number): void {
    const poses = getAnimSet(this.member.color).poses;
    const pose = poses[this.category];
    if (pose && this.category === "away") return this.setState("pose", 15000, now);
    if (pose && Math.random() < 0.75) return this.setState("pose", 6000 + Math.random() * 10000, now);
    const r = Math.random();
    if (r < 0.45) {
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.setState("walk", 1500 + Math.random() * 4000, now);
    } else if (r < 0.8) {
      this.setState("idle", 1000 + Math.random() * 3000, now);
    } else {
      this.setState("sit", 3000 + Math.random() * 5000, now);
    }
  }

  private currentAnim(): Anim {
    const set = getAnimSet(this.member.color);
    if (this.state === "pose") return set.poses[this.category] ?? set.anims.sit;
    return set.anims[this.state];
  }

  update(dt: number, now: number): void {
    if (!this.dragging) {
      if (this.frozen) {
        if (this.state === "walk" || now >= this.stateUntil) {
          const pose = getAnimSet(this.member.color).poses[this.category];
          this.setState(pose ? "pose" : "sit", 1e9, now);
        }
      } else if (now >= this.stateUntil) {
        this.pickNextState(now);
      }
      if (this.state === "walk") {
        this.x += this.dir * WALK_SPEED * dt;
        if (this.x < 0) {
          this.x = 0;
          this.dir = 1;
        } else if (this.x > canvas.width - SIZE) {
          this.x = canvas.width - SIZE;
          this.dir = -1;
        }
      }
      const floor = canvas.height - SIZE;
      if (this.y < floor) this.y = Math.min(floor, this.y + 600 * dt);
    }
    const anim = this.currentAnim();
    this.frameTimer += dt * 1000;
    if (this.frameTimer >= anim.interval) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % anim.frames.length;
    }
    if (this.bubble && now > this.bubble.until) this.bubble = null;
  }

  draw(): void {
    const anim = this.currentAnim();
    const img = anim.frames[this.frame % anim.frames.length];
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    ctx.save();
    if (this.dir === -1) {
      ctx.translate(px + SIZE, py);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
    } else {
      ctx.drawImage(img, px, py, SIZE, SIZE);
    }
    ctx.restore();

    let top = py - 4;
    if (this.bubble) top = drawBubble(px + SIZE / 2, top, this.bubble.text) - 4;
    if (showLabel) drawLabel(px + SIZE / 2, top, this.labelText());
  }

  hit(mx: number, my: number): boolean {
    return mx >= this.x && mx < this.x + SIZE && my >= this.y && my < this.y + SIZE;
  }
}

/** 캐릭터 머리 위 라벨. bottom 은 라벨 아래쪽 y. 반환값은 라벨 위쪽 y. */
function drawLabel(cx: number, bottom: number, text: string): number {
  if (!text) return bottom;
  ctx.font = "12px 'Malgun Gothic', 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 12;
  const h = 18;
  const x = Math.round(cx - w / 2);
  const y = Math.round(bottom - h);
  ctx.fillStyle = "rgba(30, 30, 30, 0.8)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + 6, y + h / 2 + 1);
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
  ctx.font = "13px 'Malgun Gothic', 'Segoe UI', sans-serif";
  ctx.textBaseline = "top";
  const pad = 8;
  const lineH = 17;
  const lines = wrapText(text, 170);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
  const h = lines.length * lineH + pad * 2 - 3;
  const tail = 7;
  let x = Math.round(cx - w / 2);
  x = Math.max(4, Math.min(canvas.width - w - 4, x));
  const y = Math.round(bottom - tail - h);

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  // 꼬리
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + h - 1);
  ctx.lineTo(cx, y + h + tail);
  ctx.lineTo(cx + 6, y + h - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - 5, y + h - 3, 10, 4);

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

// 최근에 사라진 친구의 위치. 접속이 잠깐 끊겼다 돌아오면 같은 자리에 둔다.
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
      const x = remembered && performance.now() - remembered.at < 10 * 60_000 ? remembered.x : randomX();
      friends.set(m.userId, new Pet(m, false, x));
    }
  }
  for (const id of [...friends.keys()]) {
    if (!seen.has(id)) {
      const pet = friends.get(id)!;
      lastPositions.set(id, { x: pet.x, at: performance.now() });
      if (panelPet?.id === id) closePanel();
      if (dragPet?.id === id) dragPet = null;
      friends.delete(id);
    }
  }
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
  if (pet.isMe) {
    metaParts.push(tr("panel.connection", { s: tr(`conn.${connStatus}`) }));
  }
  panelMeta.textContent = metaParts.join(" · ");

  panelActions.innerHTML = "";
  if (pet.isMe) {
    const btn = document.createElement("button");
    btn.textContent = m.sharing ? tr("panel.shareOff") : tr("panel.shareOn");
    btn.addEventListener("click", () => window.petApi.toggleShare());
    panelActions.appendChild(btn);
    panelInput.placeholder = tr("panel.toAll");
  } else {
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

function positionPanel(): void {
  const pet = panelPet;
  if (!pet) return;
  const w = panel.offsetWidth;
  const h = panel.offsetHeight;
  // 말풍선과 라벨을 가리지 않도록 캐릭터 옆에 붙인다. 오른쪽에 자리가 없으면 왼쪽.
  let left = Math.round(pet.x + SIZE + 12);
  if (left + w > canvas.width - 8) left = Math.round(pet.x - w - 12);
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
  if (!res.ok) {
    me?.say(tr("panel.sendFail", { e: res.error ?? "" }));
  }
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
  for (const pet of allPets()) {
    pet.update(dt, now);
    pet.draw();
  }
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
  // 나중에 그려지는(위에 있는) 캐릭터부터 검사한다.
  const pets = allPets();
  for (let i = pets.length - 1; i >= 0; i--) if (pets[i].hit(mx, my)) return pets[i];
  return null;
}

let dragStart = { x: 0, y: 0, moved: false };

window.addEventListener("mousemove", (e) => {
  if (dragPet) {
    dragPet.x = Math.max(0, Math.min(canvas.width - SIZE, e.clientX - dragPet.dragOffX));
    dragPet.y = Math.max(0, Math.min(canvas.height - SIZE, e.clientY - dragPet.dragOffY));
    if (Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y) > 4) dragStart.moved = true;
    return;
  }
  // forward: true 덕분에 클릭 통과 중에도 mousemove 는 들어온다.
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
  pet.state = "idle";
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
    // 끌지 않고 눌렀다 떼면 클릭: 패널 열기/닫기
    if (panelPet === pet) closePanel();
    else openPanel(pet);
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
