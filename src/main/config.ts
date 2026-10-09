import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import * as os from "os";
import type { Category } from "./classifier";
import type { PetColor } from "./net/transport";

export interface PetConfig {
  /** 내 표시 이름 */
  nickname: string;
  /** 자동 생성되는 고유 ID. 바꾸지 않는 것이 좋다. */
  userId: string;
  /** 내 캐릭터 색: orange | gray | black | white | pink | brown */
  color: PetColor;
  /** 초대 코드. 같은 코드를 쓰는 친구끼리만 서로 보인다. */
  room: string;
  /** Supabase 프로젝트 설정. 비어 있으면 데모 모드(가짜 친구)로 실행된다. */
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
  nickname: (() => { try { return os.userInfo().username || "나"; } catch { return "나"; } })(),
  userId: "",
  color: "orange",
  room: "",
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
  if (needSave) saveConfig(cfg);
  return cfg;
}

export function saveConfig(cfg: PetConfig): void {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf-8");
}

export function isSupabaseConfigured(cfg: PetConfig): boolean {
  return Boolean(cfg.supabase.url && cfg.supabase.anonKey && cfg.room);
}
