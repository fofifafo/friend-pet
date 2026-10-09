import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen, shell } from "electron";
import * as path from "path";
import * as fs from "fs";
import { randomUUID } from "crypto";
import { loadConfig, saveConfig, isSupabaseConfigured, PetConfig } from "./config";
import { ActivityWatcher, ActivityUpdate } from "./activity";
import { CATEGORY_LABEL, Category } from "./classifier";
import type { ChatMessage, ConnectionStatus, MemberState, Transport } from "./net/transport";
import { SupabaseTransport } from "./net/supabase";
import { DemoTransport } from "./net/demo";

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let config: PetConfig;
let watcher: ActivityWatcher | null = null;
let transport: Transport | null = null;
let friends: MemberState[] = [];
let history: ChatMessage[] = [];
const HISTORY_MAX = 100;

const isDev = process.argv.includes("--dev");
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

function logPath(): string {
  return path.join(app.getPath("userData"), "pet.log");
}
function log(line: string): void {
  try {
    fs.appendFileSync(logPath(), `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* 로그 실패는 무시 */
  }
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
function myState(): MemberState {
  return {
    userId: config.userId,
    nickname: config.nickname,
    color: config.color,
    category: config.shareActivity ? myCategory : "unknown",
    sharing: config.shareActivity,
    since: mySince,
    lastActive: new Date().toISOString(),
  };
}

function send(channel: string, payload: unknown): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function pushMe(): void {
  send("me-update", { me: myState(), showLabel: config.showLabel });
  void transport?.publish(myState());
}

// ---------- 창 ----------
function createWindow(): void {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea; // 작업표시줄을 제외한 영역

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

  win.on("closed", () => {
    win = null;
  });
}

// ---------- 트레이 ----------
function buildTrayMenu(): Menu {
  const status = CATEGORY_LABEL[myCategory];
  const conn =
    transport?.status === "online" ? "온라인" :
    transport?.status === "demo" ? "데모 모드" :
    transport?.status === "connecting" ? "연결 중" : "오프라인";
  return Menu.buildFromTemplate([
    { label: `내 상태: ${status}`, enabled: false },
    { label: `연결: ${conn} · 친구 ${friends.length}명`, enabled: false },
    { type: "separator" },
    {
      label: config.shareActivity ? "상태 공유 끄기 (투명 모드)" : "상태 공유 켜기",
      click: () => toggleShare(),
    },
    {
      label: "캐릭터 보이기/숨기기",
      click: () => {
        if (!win) return;
        if (win.isVisible()) win.hide();
        else win.show();
      },
    },
    {
      label: "설정 파일 열기",
      click: () => void shell.openPath(path.join(app.getPath("userData"), "config.json")),
    },
    { type: "separator" },
    { label: "종료", click: () => app.quit() },
  ]);
}

function refreshTray(): void {
  tray?.setContextMenu(buildTrayMenu());
  tray?.setToolTip(`친구 펫 - ${CATEGORY_LABEL[myCategory]}`);
}

function createTray(): void {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip("친구 펫");
  refreshTray();
}

function toggleShare(): void {
  config.shareActivity = !config.shareActivity;
  saveConfig(config);
  log(`shareActivity=${config.shareActivity}`);
  refreshTray();
  pushMe();
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
      label: CATEGORY_LABEL[category],
      idleSec: raw.idleSec,
      showLabel: config.showLabel,
    });
  });
  watcher.start();
}

// ---------- 네트워크 ----------
async function startTransport(): Promise<void> {
  if (isSupabaseConfigured(config)) {
    log(`supabase transport: room=${config.room}`);
    transport = new SupabaseTransport(config.supabase.url, config.supabase.anonKey, config.room, myState(), log);
  } else {
    log("supabase 설정이 비어 있어 데모 모드로 실행");
    transport = new DemoTransport(myState(), log);
  }

  transport.on("friends", (members: MemberState[]) => {
    if (members.length !== friends.length) {
      log(`friends: ${members.length} (${members.map((m) => m.nickname).join(", ") || "-"})`);
    }
    friends = members;
    refreshTray();
    send("friends-update", members);
  });
  transport.on("chat", (msg: ChatMessage) => {
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
  labels: CATEGORY_LABEL,
}));

ipcMain.handle("send-chat", async (_e, to: string, text: string) => {
  const trimmed = String(text ?? "").trim().slice(0, 200);
  if (!trimmed) return { ok: false, error: "빈 메시지" };
  const msg: ChatMessage = {
    id: randomUUID(),
    from: config.userId,
    fromName: config.nickname,
    to: to || "all",
    text: trimmed,
    at: new Date().toISOString(),
  };
  try {
    await transport?.sendChat(msg);
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

// ---------- 앱 수명 ----------
app.whenReady().then(async () => {
  config = loadConfig();
  log(`config loaded: nick=${config.nickname} room=${config.room || "(none)"} poll=${config.pollIntervalMs}ms idle=${config.idleAfterSec}s share=${config.shareActivity}`);
  createWindow();
  createTray();
  startWatcher();
  await startTransport();
});

app.on("before-quit", () => {
  watcher?.stop();
  void transport?.disconnect();
});

app.on("window-all-closed", () => {
  app.quit();
});
