import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen, shell } from "electron";
import * as path from "path";
import * as fs from "fs";
import { randomUUID } from "crypto";
import {
  loadConfig,
  saveConfig,
  isSupabaseConfigured,
  effectiveSupabase,
  clampNum,
  friendCode,
  PetConfig,
} from "./config";
import { ActivityWatcher, ActivityUpdate } from "./activity";
import type { Category } from "./classifier";
import type { ChatMessage, ConnectionStatus, MemberState, PetColor, PetSpecies, Transport } from "./net/transport";
import { SupabaseTransport } from "./net/supabase";
import { DemoTransport } from "./net/demo";
import { Lang, LANGS, LANG_NAMES, detectLang, getDict, isLang, t } from "./i18n";

let win: BrowserWindow | null = null;
let setupWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let config: PetConfig;
let watcher: ActivityWatcher | null = null;
let transport: Transport | null = null;
let allMembers: MemberState[] = []; // 방에 있는 모든 사람
let friends: MemberState[] = []; // 내 친구 목록 규칙으로 걸러진 사람
let history: ChatMessage[] = [];
const HISTORY_MAX = 100;
const SPECIES: PetSpecies[] = ["cat", "dog", "rabbit", "bear", "penguin", "fox"];
const COLORS: PetColor[] = ["", "orange", "red", "tan", "brown", "white", "cream", "gray", "black", "pink", "navy", "mint"];

const isDev = process.argv.includes("--dev");
const forceSetup = process.argv.includes("--setup");
// 테스트용: --category=coding 처럼 주면 감지 결과 대신 이 카테고리를 쓴다.
const forcedCategory = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1] as Category | undefined;
// 테스트용: --profile=이름 을 주면 별도 설정/로그 폴더(friend-pet-이름)를 쓴다.
// 같은 PC 에서 두 번째 인스턴스를 다른 사용자로 띄울 때 사용한다.
const profile = process.argv.find((a) => a.startsWith("--profile="))?.split("=")[1];
if (profile) {
  app.setPath("userData", path.join(app.getPath("appData"), `friend-pet-${profile}`));
}

let myCategory: Category = "unknown";
let mySince = new Date().toISOString();

// ---------- 로그 ----------
function logPath(): string {
  return path.join(app.getPath("userData"), "pet.log");
}
function log(line: string): void {
  try {
    // 로그가 너무 커지면 비운다 (2MB).
    try {
      if (fs.statSync(logPath()).size > 2 * 1024 * 1024) fs.writeFileSync(logPath(), "");
    } catch {
      /* 파일 없음 */
    }
    fs.appendFileSync(logPath(), `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* 로그 실패는 무시 */
  }
}

process.on("unhandledRejection", (e) => log(`unhandledRejection: ${(e as Error)?.stack ?? e}`));
process.on("uncaughtException", (e) => log(`uncaughtException: ${e.stack ?? e}`));

// ---------- 단일 인스턴스 ----------
// 같은 프로필로 두 번 실행하면 기존 인스턴스의 설정 창을 연다.
const gotLock = app.requestSingleInstanceLock({ profile: profile ?? "" });
if (!gotLock) {
  app.quit();
}
app.on("second-instance", () => {
  openSetupWindow();
});

// ---------- 언어 ----------
function currentLang(): Lang {
  return isLang(config.language) ? config.language : detectLang();
}
function T(key: string, params?: Record<string, string | number>): string {
  return t(currentLang(), key, params);
}
function catLabel(c: Category): string {
  return T(`cat.${c}`);
}
function connLabel(): string {
  return T(`conn.${transport?.status ?? "connecting"}`);
}
function localePayload() {
  const lang = currentLang();
  return { lang, dict: getDict(lang) };
}

/** 16x16 트레이 아이콘을 코드로 생성한다 (외부 파일 불필요). */
function makeTrayIcon(): Electron.NativeImage {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);
  const pattern = [
    "................",
    "................",
    "...xx......xx...",
    "..xxxx....xxxx..",
    "..xxxxxxxxxxxx..",
    "..xxxxxxxxxxxx..",
    "..xx.xxxxxx.xx..",
    "..xxxxxxxxxxxx..",
    "..xxxxxxxxxxxx..",
    "..xxxx.xx.xxxx..",
    "..xxxxxxxxxxxx..",
    "...xxxxxxxxxx...",
    "....xxxxxxxx....",
    "................",
    "................",
    "................",
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (pattern[y][x] === "x") {
        const i = (y * size + x) * 4;
        // BGRA
        buf[i] = 0x4f; buf[i + 1] = 0x9a; buf[i + 2] = 0xf2; buf[i + 3] = 0xff;
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

// ---------- 내 상태 ----------
function myCode(): string {
  return friendCode(config.userId);
}

function myState(): MemberState {
  return {
    userId: config.userId,
    code: myCode(),
    friends: config.friends,
    nickname: config.nickname,
    species: config.species,
    color: config.color,
    category: config.shareActivity ? myCategory : "unknown",
    sharing: config.shareActivity,
    since: mySince,
    lastActive: new Date().toISOString(),
  };
}

/** 친구 목록 규칙: 목록이 비어 있으면 방 전체, 아니면 목록에 있는 사람만 */
function applyFriendFilter(): void {
  const list = config.friends;
  friends = list.length === 0 ? allMembers : allMembers.filter((m) => list.includes(m.code));
}

function send(channel: string, payload: unknown): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function pushMe(): void {
  send("me-update", { me: myState(), showLabel: config.showLabel });
  void transport?.publish(myState());
}

function pushFriends(): void {
  applyFriendFilter();
  refreshTray();
  send("friends-update", friends);
}

function broadcastLocale(): void {
  const payload = localePayload();
  send("locale-update", payload);
  if (setupWin && !setupWin.isDestroyed()) {
    setupWin.setTitle(T("setup.title"));
    setupWin.webContents.send("locale-update", payload);
  }
}

// ---------- 메인 창 ----------
function fitWindowToWorkArea(): void {
  if (!win || win.isDestroyed()) return;
  const area = screen.getPrimaryDisplay().workArea; // 작업표시줄을 제외한 영역
  win.setBounds({ x: area.x, y: area.y, width: area.width, height: area.height });
}

function createWindow(): void {
  const area = screen.getPrimaryDisplay().workArea;

  win = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  // 기본은 클릭 통과. 캐릭터 위에 마우스가 올라가면 렌더러가 해제 요청을 보낸다.
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  win.webContents.on("console-message", (_e, level, message, line, source) => {
    log(`renderer console(${level}) ${source}:${line} ${message}`);
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => log(`did-fail-load ${code} ${desc}`));
  win.webContents.on("did-finish-load", () => log("did-finish-load"));
  win.webContents.on("render-process-gone", (_e, details) => {
    log(`renderer gone: ${details.reason}, reloading`);
    win?.webContents.reload();
  });

  win.on("closed", () => {
    win = null;
  });

  // 모니터 해상도나 작업표시줄이 바뀌면 창을 다시 맞춘다.
  screen.on("display-metrics-changed", () => fitWindowToWorkArea());
  screen.on("display-added", () => fitWindowToWorkArea());
  screen.on("display-removed", () => fitWindowToWorkArea());
}

// ---------- 설정 창 ----------
function openSetupWindow(): void {
  if (setupWin && !setupWin.isDestroyed()) {
    setupWin.show();
    setupWin.focus();
    return;
  }
  log("open setup window");
  setupWin = new BrowserWindow({
    width: 460,
    height: 760,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: T("setup.title"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 메인 창이 screen-saver 레벨이라 설정 창도 같은 레벨로 올려야 가려지지 않는다.
  setupWin.setAlwaysOnTop(true, "screen-saver");
  setupWin.loadFile(path.join(__dirname, "..", "renderer", "setup.html"));
  setupWin.on("closed", () => {
    setupWin = null;
  });
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

function setupPayload() {
  return {
    locale: localePayload(),
    dicts: Object.fromEntries(LANGS.map((l) => [l, getDict(l)])),
    langs: LANGS.map((l) => ({ code: l, name: LANG_NAMES[l] })),
    species: SPECIES,
    colors: COLORS,
    myCode: myCode(),
    values: {
      language: currentLang(),
      nickname: config.nickname,
      species: config.species,
      color: config.color,
      room: config.room,
      demo: config.demo,
      friends: config.friends,
      shareActivity: config.shareActivity,
      showLabel: config.showLabel,
      autostart: config.autostart,
      serverUrl: config.supabase.url,
      serverKey: config.supabase.anonKey,
      pollSec: Math.round(config.pollIntervalMs / 1000),
      idleMin: Math.round(config.idleAfterSec / 60),
    } as SetupValues,
  };
}

function applyAutostart(): void {
  // 개발 중(electron.exe 직접 실행)에는 등록하지 않는다.
  if (!app.isPackaged) return;
  try {
    app.setLoginItemSettings({ openAtLogin: config.autostart, args: profile ? [`--profile=${profile}`] : [] });
  } catch (e) {
    log(`autostart 설정 실패: ${(e as Error).message}`);
  }
}

async function applySetup(v: SetupValues): Promise<{ ok: boolean; error?: string }> {
  const nickname = String(v.nickname ?? "").trim().slice(0, 20);
  if (!nickname) return { ok: false, error: T("setup.nicknameRequired") };
  const pollSec = Number(v.pollSec);
  const idleMin = Number(v.idleMin);
  if (!Number.isFinite(pollSec) || !Number.isFinite(idleMin)) return { ok: false, error: T("setup.invalidNumber") };

  const room = String(v.room ?? "").trim().slice(0, 40) || config.room;
  const color = (COLORS as string[]).includes(v.color) ? (v.color as PetColor) : config.color;
  const species = (SPECIES as string[]).includes(v.species) ? (v.species as PetSpecies) : config.species;
  const language = isLang(v.language) ? v.language : currentLang();
  const demo = Boolean(v.demo);
  const friendsList = (Array.isArray(v.friends) ? v.friends : [])
    .map((f) => String(f).trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((f) => f && f !== myCode())
    .slice(0, 100);
  const serverUrl = String(v.serverUrl ?? "").trim();
  const serverKey = String(v.serverKey ?? "").trim();
  const pollIntervalMs = clampNum(pollSec * 1000, 1000, 60_000, config.pollIntervalMs);
  const idleAfterSec = clampNum(idleMin * 60, 30, 24 * 3600, config.idleAfterSec);

  const langChanged = language !== currentLang();
  const needReconnect =
    room !== config.room ||
    demo !== config.demo ||
    serverUrl !== config.supabase.url ||
    serverKey !== config.supabase.anonKey;
  const needWatcherRestart = pollIntervalMs !== config.pollIntervalMs || idleAfterSec !== config.idleAfterSec;

  config.language = language;
  config.nickname = nickname;
  config.species = species;
  config.color = color;
  config.room = room;
  config.demo = demo;
  config.friends = friendsList;
  config.shareActivity = Boolean(v.shareActivity);
  config.showLabel = Boolean(v.showLabel);
  config.autostart = Boolean(v.autostart);
  config.supabase = { url: serverUrl, anonKey: serverKey };
  config.pollIntervalMs = pollIntervalMs;
  config.idleAfterSec = idleAfterSec;
  config.setupDone = true;
  saveConfig(config);
  log(`setup saved: nick=${nickname} species=${species} color=${color} room=${room} demo=${demo} lang=${language} friends=${friendsList.length}`);

  applyAutostart();
  if (langChanged) broadcastLocale();
  if (needWatcherRestart) {
    watcher?.stop();
    startWatcher();
  }
  if (needReconnect) {
    await restartTransport();
  } else {
    pushMe();
    pushFriends();
  }
  refreshTray();
  return { ok: true };
}

// ---------- 트레이 ----------
function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: T("tray.myStatus", { s: catLabel(myCategory) }), enabled: false },
    { label: T("tray.connection", { s: connLabel(), n: friends.length }), enabled: false },
    { label: T("tray.friendCode", { c: myCode() }), enabled: false },
    { type: "separator" },
    {
      label: config.shareActivity ? T("tray.shareOff") : T("tray.shareOn"),
      click: () => toggleShare(),
    },
    {
      label: T("tray.toggleVisible"),
      click: () => {
        if (!win) return;
        if (win.isVisible()) win.hide();
        else win.show();
      },
    },
    { type: "separator" },
    { label: T("tray.settings"), click: () => openSetupWindow() },
    {
      label: T("tray.language"),
      submenu: LANGS.map((l) => ({
        label: LANG_NAMES[l],
        type: "radio" as const,
        checked: currentLang() === l,
        click: () => setLanguage(l),
      })),
    },
    {
      label: T("tray.openConfig"),
      click: () => void shell.openPath(path.join(app.getPath("userData"), "config.json")),
    },
    { type: "separator" },
    { label: T("tray.quit"), click: () => app.quit() },
  ]);
}

function refreshTray(): void {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(buildTrayMenu());
  tray.setToolTip(T("tray.tooltip", { s: catLabel(myCategory) }));
}

function createTray(): void {
  tray = new Tray(makeTrayIcon());
  tray.on("double-click", () => openSetupWindow());
  refreshTray();
}

function toggleShare(): void {
  config.shareActivity = !config.shareActivity;
  saveConfig(config);
  log(`shareActivity=${config.shareActivity}`);
  refreshTray();
  pushMe();
}

function setLanguage(l: Lang): void {
  if (config.language === l) return;
  config.language = l;
  saveConfig(config);
  log(`language=${l}`);
  refreshTray();
  broadcastLocale();
}

// ---------- 활동 감지 ----------
function startWatcher(): void {
  watcher = new ActivityWatcher(config.pollIntervalMs, config.idleAfterSec, config.customRules, log);
  watcher.on("update", (raw: ActivityUpdate, rawChanged: boolean) => {
    const category = forcedCategory ?? raw.category;
    const changed = forcedCategory ? category !== myCategory : rawChanged;
    if (changed) {
      myCategory = category;
      mySince = new Date().toISOString();
      refreshTray();
      pushMe();
    }
    send("activity-update", {
      category,
      label: catLabel(category),
      idleSec: raw.idleSec,
      showLabel: config.showLabel,
    });
  });
  watcher.start();
}

// ---------- 네트워크 ----------
async function startTransport(): Promise<void> {
  if (isSupabaseConfigured(config)) {
    const s = effectiveSupabase(config);
    log(`supabase transport: room=${config.room}${config.supabase.url ? "" : " (내장 설정)"}`);
    transport = new SupabaseTransport(s.url, s.anonKey, config.room, myState(), log);
  } else {
    log(config.demo ? "데모 모드로 실행" : "서버 설정이 없어 데모 모드로 실행");
    transport = new DemoTransport(
      myState(),
      { name1: T("demo.name1"), name2: T("demo.name2"), replies: T("demo.replies").split("|") },
      log,
    );
  }

  transport.on("friends", (members: MemberState[]) => {
    if (members.length !== allMembers.length) {
      log(`room members: ${members.length} (${members.map((m) => m.nickname).join(", ") || "-"})`);
    }
    allMembers = members;
    pushFriends();
  });
  transport.on("chat", (msg: ChatMessage) => {
    // 친구 목록에 없는 사람의 메시지는 무시한다.
    if (config.friends.length > 0) {
      const sender = allMembers.find((m) => m.userId === msg.from);
      if (!sender || !config.friends.includes(sender.code)) return;
    }
    log(`chat from ${msg.fromName} (${msg.text.length}자)`);
    history.push(msg);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    send("chat-message", msg);
  });
  transport.on("status", (s: ConnectionStatus) => {
    log(`connection: ${s}`);
    refreshTray();
    send("status-update", s);
  });

  try {
    await transport.connect();
  } catch (e) {
    log(`transport connect 실패: ${(e as Error).message}`);
    send("status-update", "offline");
  }
}

async function stopTransport(): Promise<void> {
  const old = transport;
  transport = null;
  if (!old) return;
  old.removeAllListeners();
  try {
    await Promise.race([old.disconnect(), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* ignore */
  }
}

async function restartTransport(): Promise<void> {
  await stopTransport();
  allMembers = [];
  pushFriends();
  send("status-update", "connecting");
  await startTransport();
  pushMe();
}

// ---------- IPC ----------
ipcMain.on("set-ignore-mouse", (_e, ignore: boolean) => {
  if (!win) return;
  win.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on("set-focusable", (_e, focusable: boolean) => {
  if (!win) return;
  win.setFocusable(focusable);
  if (focusable) {
    win.focus();
  } else {
    win.blur();
  }
});

ipcMain.handle("get-init", () => ({
  me: myState(),
  showLabel: config.showLabel,
  status: transport?.status ?? "connecting",
  friends,
  history,
  locale: localePayload(),
}));

ipcMain.handle("send-chat", async (_e, to: string, text: string) => {
  const trimmed = String(text ?? "").trim().slice(0, 200);
  if (!trimmed) return { ok: false, error: "empty" };
  const msg: ChatMessage = {
    id: randomUUID(),
    from: config.userId,
    fromName: config.nickname,
    to: to || "all",
    text: trimmed,
    at: new Date().toISOString(),
  };
  try {
    if (!transport) throw new Error(T("conn.offline"));
    await transport.sendChat(msg);
    history.push(msg);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    send("chat-message", msg);
    return { ok: true, msg };
  } catch (e) {
    log(`채팅 전송 실패: ${(e as Error).message}`);
    return { ok: false, error: (e as Error).message };
  }
});

ipcMain.on("toggle-share", () => toggleShare());

ipcMain.handle("setup-get", () => setupPayload());
ipcMain.handle("setup-save", async (_e, values: SetupValues) => {
  const res = await applySetup(values);
  if (res.ok) setupWin?.close();
  return res;
});
ipcMain.on("setup-cancel", () => setupWin?.close());

// ---------- 앱 수명 ----------
app.whenReady().then(async () => {
  if (!gotLock) return;
  config = loadConfig();
  log(`config loaded: nick=${config.nickname} room=${config.room || "(none)"} lang=${currentLang()} demo=${config.demo} friends=${config.friends.length} poll=${config.pollIntervalMs}ms idle=${config.idleAfterSec}s share=${config.shareActivity}`);
  createWindow();
  createTray();
  startWatcher();
  applyAutostart();
  await startTransport();
  if (!config.setupDone || forceSetup) openSetupWindow();
}).catch((e) => log(`startup failed: ${(e as Error).stack ?? e}`));

// 종료 시 presence 를 정리해 친구 화면에서 바로 사라지게 한다.
let quitting = false;
app.on("before-quit", (e) => {
  if (quitting) return;
  quitting = true;
  e.preventDefault();
  watcher?.stop();
  void stopTransport().finally(() => app.quit());
});

app.on("window-all-closed", () => {
  // 설정 창이 닫혀도 메인 창이 살아 있으면 계속 실행한다.
  if (!win || win.isDestroyed()) app.quit();
});
