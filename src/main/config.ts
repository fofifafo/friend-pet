import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import * as os from "os";
import type { Category } from "./classifier";
import type { PetColor } from "./net/transport";
import { BUILTIN_SUPABASE, DEFAULT_ROOM } from "./defaults";
import type { Lang } from "./i18n";

export interface PetConfig {
  /** 표시 언어. 비어 있으면 시스템 언어를 따른다. */
  language: Lang | "";
  /** 첫 실행 설정 창을 마쳤는지 */
  setupDone: boolean;
  /** 내 표시 이름 */
  nickname: string;
  /** 자동 생성되는 고유 ID. 바꾸지 않는 것이 좋다. */
  userId: string;
  /** 내 캐릭터 색: orange | gray | black | white | pink | brown */
  color: PetColor;
  /** 초대 코드. 같은 코드를 쓰는 친구끼리만 서로 보인다. */
  room: string;
  /** true 면 서버에 연결하지 않고 가짜 친구를 띄운다 */
  demo: boolean;
  /** 친구 코드 목록. 비어 있으면 같은 방의 모두가 보인다. */
  friends: string[];
  /** Windows 시작 시 자동 실행 */
  autostart: boolean;
  /** Supabase 프로젝트 설정. 비어 있으면 앱에 내장된 값을 쓴다. */
  supabase: { url: string; anonKey: string };
  /** 활성 창을 확인하는 주기 (ms) */
  pollIntervalMs: number;
  /** 이 시간(초) 동안 입력이 없으면 "자리 비움" */
  idleAfterSec: number;
  /** false 면 투명 모드: 내 활동을 친구에게 보내지 않는다 */
  shareActivity: boolean;
  /** 캐릭터 위에 상태 라벨 표시 */
  showLabel: boolean;
  /** 사용자 추가 분류 규칙 */
  customRules: {
    processes: Record<string, Category>;
    titleKeywords: Record<string, Category>;
  };
}

const DEFAULTS: PetConfig = {
  language: "",
  setupDone: false,
  nickname: (() => {
    try {
      return os.userInfo().username || "";
    } catch {
      return "";
    }
  })(),
  userId: "",
  color: "orange",
  room: DEFAULT_ROOM,
  demo: false,
  friends: [],
  autostart: false,
  supabase: { url: "", anonKey: "" },
  pollIntervalMs: 3000,
  idleAfterSec: 300,
  shareActivity: true,
  showLabel: true,
  customRules: { processes: {}, titleKeywords: {} },
};

export function configPath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

export function loadConfig(): PetConfig {
  const p = configPath();
  let cfg: PetConfig = { ...DEFAULTS, supabase: { ...DEFAULTS.supabase }, customRules: { processes: {}, titleKeywords: {} } };
  let needSave = false;
  try {
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
      cfg = {
        ...cfg,
        ...parsed,
        supabase: { ...DEFAULTS.supabase, ...(parsed.supabase ?? {}) },
        customRules: {
          processes: { ...(parsed.customRules?.processes ?? {}) },
          titleKeywords: { ...(parsed.customRules?.titleKeywords ?? {}) },
        },
      };
    } else {
      needSave = true;
    }
  } catch (e) {
    console.error("config.json 읽기 실패, 기본값 사용:", e);
    needSave = true;
  }
  if (!cfg.userId) {
    cfg.userId = randomUUID();
    needSave = true;
  }
  // 손상된 값 보정
  if (!Array.isArray(cfg.friends)) cfg.friends = [];
  cfg.friends = cfg.friends.map((f) => String(f).trim()).filter(Boolean).slice(0, 100);
  cfg.pollIntervalMs = clampNum(cfg.pollIntervalMs, 1000, 60_000, DEFAULTS.pollIntervalMs);
  cfg.idleAfterSec = clampNum(cfg.idleAfterSec, 30, 24 * 3600, DEFAULTS.idleAfterSec);
  if (needSave) saveConfig(cfg);
  return cfg;
}

export function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 친구 목록에 등록할 때 쓰는 짧은 코드 */
export function friendCode(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 8).toLowerCase();
}

export function saveConfig(cfg: PetConfig): void {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf-8");
}

/** 실제로 쓸 Supabase 설정: config 에 값이 있으면 그것, 없으면 내장값 */
export function effectiveSupabase(cfg: PetConfig): { url: string; anonKey: string } {
  if (cfg.supabase.url && cfg.supabase.anonKey) return cfg.supabase;
  return BUILTIN_SUPABASE;
}

export function isSupabaseConfigured(cfg: PetConfig): boolean {
  if (cfg.demo) return false;
  const s = effectiveSupabase(cfg);
  return Boolean(s.url && s.anonKey && cfg.room);
}
