// 설정 창: 언어, 이름, 캐릭터 종류/색, 초대 코드, 친구 목록, 옵션, 고급 설정.
// 스크립트(비모듈) 파일이므로 전역 타입을 직접 선언한다. 이름이 renderer.ts 와 겹치지 않게 Setup 접두어를 쓴다.

interface SetupLocale {
  lang: string;
  dict: Record<string, string>;
}
interface SetupValues {
  language: string;
  nickname: string;
  species: string;
  color: string;
  room: string;
  demo: boolean;
  friends: string[];
  shareActivity: boolean;
  showLabel: boolean;
  autostart: boolean;
  serverUrl: string;
  serverKey: string;
  pollSec: number;
  idleMin: number;
}
interface SetupData {
  locale: SetupLocale;
  dicts: Record<string, Record<string, string>>;
  langs: { code: string; name: string }[];
  species: string[];
  colors: string[];
  myCode: string;
  values: SetupValues;
}
interface SetupWindowApi {
  setupGet: () => Promise<SetupData>;
  setupSave: (values: unknown) => Promise<{ ok: boolean; error?: string }>;
  setupCancel: () => void;
  onLocale: (cb: (d: SetupLocale) => void) => void;
}

const setupApi = (window as unknown as { petApi: SetupWindowApi }).petApi;

// renderer.ts 와 같은 팔레트
const SETUP_TONES: Record<string, Record<string, string>> = {
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
const SETUP_DEFAULT_COLOR: Record<string, string> = {
  cat: "orange", dog: "tan", rabbit: "white", bear: "brown", penguin: "navy", fox: "red",
};
const SETUP_NOSE: Record<string, string> = {
  cat: "#4a2c2a", dog: "#2b2b2b", rabbit: "#f48aa4", bear: "#2b2b2b", penguin: "#2b2b2b", fox: "#3a2a2a",
};
const SETUP_COMMON: Record<string, string> = {
  w: "#fff7ea", k: "#2b2b2b", h: "#ffffff", p: "#ff9fb3", y: "#f2a63a", z: "#8fb4ff", e: "#ff6b8a", x: "#ffd43b", c: "#7cc8ff", s: "#555c66", b: "#5ab0ff", n: "#1e2a3a", q: "#262b35",
};

function setupPalette(species: string, color: string): Record<string, string> {
  const tones = SETUP_TONES[color] ?? SETUP_TONES[SETUP_DEFAULT_COLOR[species] ?? "orange"];
  return { ...SETUP_COMMON, m: SETUP_NOSE[species] ?? "#2b2b2b", ...tones };
}

function drawPreview(species: string, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPR_W;
  c.height = SPR_H;
  const ctx = c.getContext("2d")!;
  const pal = setupPalette(species, color);
  const rows = (SPR_DATA[species] ?? SPR_DATA.cat).idle.frames[0];
  rows.forEach((row, y) => {
    for (let x = 0; x < SPR_W; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      ctx.fillStyle = pal[ch] ?? "#f0f";
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

let setupData: SetupData | null = null;
let dict: Record<string, string> = {};
let selectedSpecies = "cat";
let selectedColor = "";
let friendCodes: string[] = [];

function setupTr(key: string, params?: Record<string, string | number>): string {
  let s = dict[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
  return s;
}

const $ = (id: string) => document.getElementById(id)!;
const input = (id: string) => $(id) as HTMLInputElement;

function applyStrings(): void {
  document.title = setupTr("setup.title");
  $("intro").textContent = setupTr("setup.intro");
  $("l-language").textContent = setupTr("setup.language");
  $("l-nickname").textContent = setupTr("setup.nickname");
  $("l-species").textContent = setupTr("setup.species");
  $("l-color").textContent = setupTr("setup.color");
  $("l-room").textContent = setupTr("setup.room");
  $("room-hint").textContent = setupTr("setup.roomHint");
  $("l-mycode").textContent = setupTr("setup.myCode");
  $("copy").textContent = setupTr("setup.copy");
  $("l-friends").textContent = setupTr("setup.friends");
  $("friends-hint").textContent = setupTr("setup.friendsHint");
  input("friend-input").placeholder = setupTr("setup.friendPlaceholder");
  $("friend-add").textContent = setupTr("setup.add");
  $("l-options").textContent = setupTr("setup.options");
  $("l-share").textContent = setupTr("setup.share");
  $("l-showLabel").textContent = setupTr("setup.showLabel");
  $("l-autostart").textContent = setupTr("setup.autostart");
  $("l-demo").textContent = setupTr("setup.demo");
  $("l-advanced").textContent = setupTr("setup.advanced");
  $("l-serverUrl").textContent = setupTr("setup.serverUrl");
  $("l-serverKey").textContent = setupTr("setup.serverKey");
  $("server-hint").textContent = setupTr("setup.serverHint");
  $("l-poll").textContent = setupTr("setup.poll");
  $("l-idle").textContent = setupTr("setup.idle");
  $("save").textContent = setupTr("setup.save");
  $("cancel").textContent = setupTr("setup.cancel");
  document.querySelectorAll<HTMLElement>("#species .swatch").forEach((el) => {
    el.querySelector("span")!.textContent = setupTr(`species.${el.dataset.species}`);
  });
  document.querySelectorAll<HTMLElement>("#colors .swatch").forEach((el) => {
    el.querySelector("span")!.textContent = setupTr(`color.${el.dataset.color || "default"}`);
  });
  renderFriends();
}

function renderSpecies(list: string[]): void {
  const box = $("species");
  box.innerHTML = "";
  for (const sp of list) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch" + (sp === selectedSpecies ? " selected" : "");
    btn.dataset.species = sp;
    btn.appendChild(drawPreview(sp, selectedColor));
    btn.appendChild(document.createElement("span"));
    btn.addEventListener("click", () => {
      selectedSpecies = sp;
      renderSpecies(list);
      renderColors(setupData!.colors);
      applyStrings();
    });
    box.appendChild(btn);
  }
}

function renderColors(colors: string[]): void {
  const box = $("colors");
  box.innerHTML = "";
  for (const color of colors) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch" + (color === selectedColor ? " selected" : "");
    btn.dataset.color = color;
    btn.appendChild(drawPreview(selectedSpecies, color));
    btn.appendChild(document.createElement("span"));
    btn.addEventListener("click", () => {
      selectedColor = color;
      renderColors(colors);
      renderSpecies(setupData!.species);
      applyStrings();
    });
    box.appendChild(btn);
  }
}

function renderFriends(): void {
  const ul = $("friend-list");
  ul.innerHTML = "";
  for (const code of friendCodes) {
    const li = document.createElement("li");
    li.appendChild(document.createTextNode(code));
    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = setupTr("setup.remove");
    rm.addEventListener("click", () => {
      friendCodes = friendCodes.filter((c) => c !== code);
      renderFriends();
    });
    li.appendChild(rm);
    ul.appendChild(li);
  }
}

function addFriend(): void {
  const raw = input("friend-input").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  input("friend-input").value = "";
  if (!raw || raw === setupData?.myCode || friendCodes.includes(raw)) return;
  friendCodes.push(raw);
  renderFriends();
}

async function initSetup(): Promise<void> {
  setupData = await setupApi.setupGet();
  dict = setupData.locale.dict;
  selectedSpecies = setupData.values.species || "cat";
  selectedColor = setupData.values.color || "";
  friendCodes = setupData.values.friends.slice();

  const langSel = $("language") as HTMLSelectElement;
  langSel.innerHTML = "";
  for (const l of setupData.langs) {
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.textContent = l.name;
    langSel.appendChild(opt);
  }
  langSel.value = setupData.values.language;
  langSel.addEventListener("change", () => {
    dict = setupData!.dicts[langSel.value] ?? dict;
    applyStrings();
  });

  const v = setupData.values;
  input("nickname").value = v.nickname;
  input("room").value = v.room;
  input("mycode").value = setupData.myCode;
  input("share").checked = v.shareActivity;
  input("showLabel").checked = v.showLabel;
  input("autostart").checked = v.autostart;
  input("demo").checked = v.demo;
  input("serverUrl").value = v.serverUrl;
  input("serverKey").value = v.serverKey;
  input("poll").value = String(v.pollSec);
  input("idle").value = String(v.idleMin);

  renderSpecies(setupData.species);
  renderColors(setupData.colors);
  applyStrings();
  input("nickname").focus();
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("error").textContent = "";
  const values: SetupValues = {
    language: ($("language") as HTMLSelectElement).value,
    nickname: input("nickname").value,
    species: selectedSpecies,
    color: selectedColor,
    room: input("room").value,
    demo: input("demo").checked,
    friends: friendCodes,
    shareActivity: input("share").checked,
    showLabel: input("showLabel").checked,
    autostart: input("autostart").checked,
    serverUrl: input("serverUrl").value,
    serverKey: input("serverKey").value,
    pollSec: Number(input("poll").value),
    idleMin: Number(input("idle").value),
  };
  const res = await setupApi.setupSave(values);
  if (!res.ok) $("error").textContent = res.error ?? "error";
});

$("cancel").addEventListener("click", () => setupApi.setupCancel());
$("friend-add").addEventListener("click", () => addFriend());
input("friend-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addFriend();
  }
});
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(input("mycode").value);
    $("copy").textContent = setupTr("setup.copied");
    setTimeout(() => ($("copy").textContent = setupTr("setup.copy")), 1500);
  } catch {
    input("mycode").select();
  }
});

setupApi.onLocale((d) => {
  dict = d.dict;
  ($("language") as HTMLSelectElement).value = d.lang;
  applyStrings();
});

void initSetup();
