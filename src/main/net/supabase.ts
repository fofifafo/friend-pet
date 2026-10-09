// Supabase Realtime 기반 전송 계층.
//  - Presence: 방(room)에 접속한 각 사용자의 상태를 공유한다.
//  - Broadcast: 채팅 메시지를 전달한다.
// DB 테이블이 필요 없으므로 프로젝트 URL 과 anon key 만 있으면 된다.
import { EventEmitter } from "events";
import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
// Electron 메인 프로세스(Node 20)에는 전역 WebSocket 이 없으므로 ws 를 넘긴다.
import WebSocket from "ws";
import type { ChatMessage, ConnectionStatus, MemberState, Transport } from "./transport";

export class SupabaseTransport extends EventEmitter implements Transport {
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private subscribed = false;
  private heartbeat: NodeJS.Timeout | null = null;
  private _status: ConnectionStatus = "connecting";

  constructor(
    private url: string,
    private anonKey: string,
    private room: string,
    private me: MemberState,
    private log: (line: string) => void,
  ) {
    super();
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(s: ConnectionStatus): void {
    if (this._status === s) return;
    this._status = s;
    this.emit("status", s);
  }

  async connect(): Promise<void> {
    this.client = createClient(this.url, this.anonKey, {
      realtime: { params: { eventsPerSecond: 5 }, transport: WebSocket as unknown as typeof globalThis.WebSocket },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 방 이름이 곧 초대 코드다. 같은 코드를 쓰는 사람끼리만 서로 보인다.
    this.channel = this.client.channel(`friend-pet:${this.room}`, {
      config: {
        presence: { key: this.me.userId },
        broadcast: { self: false, ack: false },
      },
    });

    this.channel.on("presence", { event: "sync" }, () => this.emitFriends());
    this.channel.on("presence", { event: "join" }, () => this.emitFriends());
    this.channel.on("presence", { event: "leave" }, () => this.emitFriends());
    this.channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      const msg = payload as ChatMessage;
      if (!msg || typeof msg.text !== "string") return;
      if (msg.to !== "all" && msg.to !== this.me.userId) return;
      this.emit("chat", msg);
    });

    this.channel.subscribe(async (status, err) => {
      this.log(`supabase channel: ${status}${err ? " " + err.message : ""}`);
      if (status === "SUBSCRIBED") {
        this.subscribed = true;
        await this.track();
        this.setStatus("online");
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.subscribed = false;
        this.setStatus("offline");
      }
    });

    // 60초마다 lastActive 를 갱신해 오래된 presence 를 구분할 수 있게 한다.
    this.heartbeat = setInterval(() => {
      this.me = { ...this.me, lastActive: new Date().toISOString() };
      void this.track();
    }, 60_000);
  }

  private emitFriends(): void {
    if (!this.channel) return;
    const state = this.channel.presenceState<MemberState>();
    const members: MemberState[] = [];
    for (const [key, entries] of Object.entries(state)) {
      if (key === this.me.userId) continue;
      const latest = entries[entries.length - 1];
      if (!latest || !latest.userId) continue;
      members.push({
        userId: latest.userId,
        nickname: latest.nickname,
        color: latest.color,
        category: latest.category,
        sharing: latest.sharing,
        since: latest.since,
        lastActive: latest.lastActive,
      });
    }
    this.emit("friends", members);
  }

  private async track(): Promise<void> {
    if (!this.channel || !this.subscribed) return;
    try {
      await this.channel.track(this.me);
    } catch (e) {
      this.log(`presence track 실패: ${(e as Error).message}`);
    }
  }

  async publish(state: MemberState): Promise<void> {
    this.me = state;
    await this.track();
  }

  async sendChat(msg: ChatMessage): Promise<void> {
    if (!this.channel || !this.subscribed) throw new Error("아직 연결되지 않았습니다");
    const res = await this.channel.send({ type: "broadcast", event: "chat", payload: msg });
    if (res !== "ok") throw new Error(`전송 실패: ${res}`);
  }

  async disconnect(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.channel) {
      try {
        await this.channel.untrack();
      } catch {
        /* ignore */
      }
      await this.client?.removeChannel(this.channel);
    }
    this.channel = null;
    this.subscribed = false;
    this.setStatus("offline");
  }
}
