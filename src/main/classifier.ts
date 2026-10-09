// 활성 창 정보를 카테고리로 바꾼다.
// 입력(프로세스 이름, 창 제목)은 이 함수 안에서만 쓰이고 저장하거나 전송하지 않는다.

export type Category =
  | "coding"
  | "game"
  | "video"
  | "document"
  | "browsing"
  | "chat"
  | "away"
  | "unknown";

export const CATEGORY_LABEL: Record<Category, string> = {
  coding: "코딩 중",
  game: "게임 중",
  video: "영상 시청 중",
  document: "문서 작업 중",
  browsing: "웹 서핑 중",
  chat: "대화 중",
  away: "자리 비움",
  unknown: "뭔가 하는 중",
};

export interface RawActivity {
  process: string;
  title: string;
  idle: number; // 초
}

export interface Rules {
  processes: Record<string, Category>;
  titleKeywords: Record<string, Category>;
}

const BROWSERS = new Set([
  "chrome", "msedge", "firefox", "brave", "whale", "opera", "opera_gx", "arc", "vivaldi", "chromium",
]);

const DEFAULT_PROCESSES: Record<string, Category> = {
  // 코딩
  code: "coding", cursor: "coding", windsurf: "coding", devenv: "coding",
  idea64: "coding", pycharm64: "coding", webstorm64: "coding", rider64: "coding", clion64: "coding",
  goland64: "coding", datagrip64: "coding", studio64: "coding",
  sublime_text: "coding", "notepad++": "coding", windowsterminal: "coding", cmd: "coding",
  powershell: "coding", pwsh: "coding", unity: "coding", godot: "coding",
  unrealeditor: "coding", claude: "coding", vim: "coding", nvim: "coding", neovide: "coding",
  // 게임
  steam: "game", epicgameslauncher: "game", "battle.net": "game", riotclientservices: "game",
  leagueclient: "game", "league of legends": "game", valorant: "game", "valorant-win64-shipping": "game",
  overwatch: "game", minecraft: "game", javaw: "game", genshinimpact: "game", starrail: "game",
  lostark: "game", maplestory: "game", r5apex: "game", cs2: "game", dota2: "game",
  "fortniteclient-win64-shipping": "game", eldenring: "game", "stardew valley": "game",
  // 영상
  vlc: "video", "mpc-hc64": "video", "mpc-hc": "video", potplayermini64: "video", potplayer: "video",
  potplayermini: "video", netflix: "video", "video.ui": "video", mpv: "video", kmplayer: "video",
  // 문서
  winword: "document", excel: "document", powerpnt: "document", acrobat: "document", acrord32: "document",
  notion: "document", obsidian: "document", onenote: "document", hwp: "document", hword: "document",
  notepad: "document", sumatrapdf: "document", typora: "document", wps: "document",
  // 대화
  discord: "chat", kakaotalk: "chat", slack: "chat", teams: "chat", "ms-teams": "chat",
  telegram: "chat", line: "chat", zoom: "chat", whatsapp: "chat", signal: "chat",
};

const DEFAULT_TITLE_KEYWORDS: Record<string, Category> = {
  // 영상
  youtube: "video", netflix: "video", twitch: "video", chzzk: "video", 치지직: "video",
  watcha: "video", 왓챠: "video", tving: "video", 티빙: "video", wavve: "video", 웨이브: "video",
  laftel: "video", 라프텔: "video", "disney+": "video", "prime video": "video", 쿠팡플레이: "video",
  bilibili: "video", vimeo: "video", soop: "video", 아프리카tv: "video",
  // 코딩
  github: "coding", gitlab: "coding", "stack overflow": "coding", stackoverflow: "coding",
  localhost: "coding", "visual studio code": "coding", jupyter: "coding", colab: "coding",
  "pull request": "coding", "merge request": "coding", codesandbox: "coding", replit: "coding",
  chatgpt: "coding", claude: "coding",
  // 문서
  "google docs": "document", "google sheets": "document", "google slides": "document",
  "docs.google": "document", notion: "document", overleaf: "document", figma: "document",
  canva: "document", 한글: "document",
  // 대화
  discord: "chat", gmail: "chat", outlook: "chat", "naver mail": "chat", 메일: "chat",
  kakao: "chat", slack: "chat", messenger: "chat",
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function matchTitle(title: string, keywords: Record<string, Category>): Category | null {
  const t = normalize(title);
  if (!t) return null;
  for (const [kw, cat] of Object.entries(keywords)) {
    if (t.includes(normalize(kw))) return cat;
  }
  return null;
}

export function classify(raw: RawActivity, idleAfterSec: number, custom?: Partial<Rules>): Category {
  if (raw.idle >= idleAfterSec) return "away";

  const processes = { ...DEFAULT_PROCESSES, ...(custom?.processes ?? {}) };
  const titleKeywords = { ...DEFAULT_TITLE_KEYWORDS, ...(custom?.titleKeywords ?? {}) };

  const proc = normalize(raw.process);
  if (!proc) return "unknown";

  if (BROWSERS.has(proc)) {
    return matchTitle(raw.title, titleKeywords) ?? "browsing";
  }

  const byProcess = processes[proc];
  if (byProcess) return byProcess;

  // 모르는 프로세스는 제목 키워드로 한 번 더 시도한다.
  return matchTitle(raw.title, titleKeywords) ?? "unknown";
}
