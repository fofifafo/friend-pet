// 설정 창: 언어, 이름, 캐릭터 색, 초대 코드, 친구 목록, 옵션, 고급 설정.
// 스크립트(비모듈) 파일이므로 전역 타입을 직접 선언한다. 이름이 renderer.ts 와 겹치지 않게 Setup 접두어를 쓴다.

interface SetupLocale {
  lang: string;
  dict: Record<string, string>;
}
interface SetupValues {
  language: string;
  nickname: string;
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

// 미리보기용 미니 고양이 (8x8)
const SETUP_CAT = [
  "........",
  ".d....d.",
  ".dd..dd.",
  ".dooood.",
  ".dkoook.",
  ".doowod.",
  "..dood..",
  "..d..d..",
];
const SETUP_BASE: Record<string, string> = { o: "#f2a65a", d: "#c7773a", w: "#fff4e0", k: "#2b2b2b" };
const SETUP_VARIANTS: Record<string, Record<string, string>> = {
  orange: {},
  gray: { o: "#9aa0a8", d: "#6b7079", w: "#e8eaee" },
  black: { o: "#3d3d47", d: "#22222a", w: "#8c8c99", k: "#f2e36b" },
  white: { o: "#f5f5f0", d: "#c2c0b4", w: "#ffffff" },
  pink: { o: "#f4a3b5", d: "#c9718a", w: "#ffe6ec" },
  brown: { o: "#9c6b45", d: "#6e4830", w: "#e3cdb6" },
};

function drawMiniCat(color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext("2d")!;
  const pal = { ...SETUP_BASE, ...(SETUP_VARIANTS[color] ?? {}) };
  SETUP_CAT.forEach((row, y) => {
    for (let x = 0; x < 8; x++) {
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
let selectedColor = "orange";
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
  document.querySelectorAll<HTMLElement>(".swatch").forEach((el) => {
    el.querySelector("span")!.textContent = setupTr(`color.${el.dataset.color}`);
  });
  renderFriends();
}

function renderColors(colors: string[]): void {
  const box = $("colors");
  box.innerHTML = "";
  for (const color of colors) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch" + (color === selectedColor ? " selected" : "");
    btn.dataset.color = color;
    btn.appendChild(drawMiniCat(color));
    const name = document.createElement("span");
    btn.appendChild(name);
    btn.addEventListener("click", () => {
      selectedColor = color;
      document.querySelectorAll(".swatch").forEach((el) => el.classList.toggle("selected", el === btn));
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
  selectedColor = setupData.values.color;
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
    // 저장 전에도 선택한 언어로 바로 바뀐다.
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
