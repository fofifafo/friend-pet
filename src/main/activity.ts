// PowerShell 헬퍼를 띄워 활성 창 정보를 받고, 카테고리로 분류해 알린다.
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { EventEmitter } from "events";
import { classify, Category, RawActivity, Rules } from "./classifier";

export interface ActivityUpdate {
  category: Category;
  idleSec: number;
  at: number;
}

export class ActivityWatcher extends EventEmitter {
  private proc: ChildProcess | null = null;
  private current: ActivityUpdate = { category: "unknown", idleSec: 0, at: Date.now() };
  private buffer = "";
  private restartTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private gotFirst = false;
  private restartDelay = 5000;

  constructor(
    private pollIntervalMs: number,
    private idleAfterSec: number,
    private rules: Partial<Rules>,
    private log: (line: string) => void,
  ) {
    super();
  }

  get latest(): ActivityUpdate {
    return this.current;
  }

  start(): void {
    this.stopped = false;
    // 패키징된 앱에서는 app.asar 안의 파일을 PowerShell 이 읽을 수 없으므로
    // asarUnpack 으로 빼낸 app.asar.unpacked 쪽 경로를 쓴다.
    const script = path.join(__dirname, "activity.ps1").replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
    this.proc = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, String(this.pollIntervalMs)],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    this.proc.stdout!.setEncoding("utf-8");
    this.proc.stdout!.on("data", (chunk: string) => this.onData(chunk));
    this.proc.stderr!.setEncoding("utf-8");
    this.proc.stderr!.on("data", (chunk: string) => this.log(`activity helper stderr: ${chunk.trim()}`));
    this.proc.on("error", (err) => this.log(`activity helper spawn error: ${err.message}`));
    this.proc.on("exit", (code) => {
      this.log(`activity helper exited (${code})`);
      this.proc = null;
      if (!this.stopped) {
        // 계속 죽으면 재시작 간격을 늘린다 (최대 60초).
        this.restartTimer = setTimeout(() => this.start(), this.restartDelay);
        this.restartDelay = Math.min(this.restartDelay * 2, 60_000);
      }
    });
    this.log("activity helper started");
  }

  stop(): void {
    this.stopped = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let raw: RawActivity;
      try {
        raw = JSON.parse(line);
      } catch {
        continue;
      }
      if (!this.gotFirst) {
        this.gotFirst = true;
        this.restartDelay = 5000;
        this.log("activity helper: first sample received");
      }
      // 분류 결과만 남긴다. raw(창 제목 포함)는 여기서 버려진다.
      const category = classify(raw, this.idleAfterSec, this.rules);
      const update: ActivityUpdate = { category, idleSec: raw.idle, at: Date.now() };
      const changed = category !== this.current.category;
      this.current = update;
      if (changed) this.log(`activity: ${category}`);
      this.emit("update", update, changed);
    }
  }
}
