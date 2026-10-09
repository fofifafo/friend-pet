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
  private reconnectTimer: NodeJS.Timeout | null = null;
  private friendsTimer: NodeJS.Timeout | null = null;
  private reconnectDelay = 5_000;
  private closed = false;
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
    this.closed = false;
    this.client = createClient(this.url, this.anonKey, {
      realtime: { params: { eventsPerSecond: 5 }, transport: WebSocket as unknown as typeof globalThis.WebSocket },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    this.joinChannel();

    // 60초마다 lastActive 를 갱신해 오래된 presence 를 구분할 수 있게 한다.
    this.heartbeat = setInterval(() => {
      this.me = { ...this.me, lastActive: new Date().toISOString() };
      void this.track();
    }, 60_000);
  }

  /** 채널에 들어간다. 끊기면 지수 백오프로 다시 들어간다. */
  private joinChannel(): void {
    if (!this.client || this.closed) return;
    // 방 이름이 곧 초대 코드다. 같은 코드를 쓰는 사람끼리만 서로 보인다.
    this.channel = this.client.channel(`friend-pet:${this.room}`, {
      config: {
        presence: { key: this.me.userId },
        broadcast: { self: false, ack: false },
      },
    });

    // presence 갱신은 leave+join 으로 들어올 수 있어 잠깐 모아서 한 번만 알린다.
    this.channel.on("presence", { event: "sync" }, () => this.emitFriendsSoon());
    this.channel.on("presence", { event: "join" }, () => this.emitFriendsSoon());
    this.channel.on("presence", { event: "leave" }, () => this.emitFriendsSoon());
    this.channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      const msg = payload as ChatMessage;
      if (!msg || typeof msg.text !== "string" || typeof msg.from !== "string") return;
      if (msg.to !== "all" && msg.to !== this.me.userId) return;
      if (msg.from === this.me.userId) return;
      // 상대가 보낸 값은 믿지 말고 길이를 자른다.
      this.emit("chat", {
        ...msg,
        text: msg.text.slice(0, 500),
        fromName: String(msg.fromName ?? "").slice(0, 20),
      });
    });

    this.channel.subscribe(async (status, err) => {
      this.log(`supabase channel: ${status}${err ? " " + err.message : ""}`);
      if (status === "SUBSCRIBED") {
        this.subscribed = true;
        this.reconnectDelay = 5_000;
        await this.track();
        this.setStatus("online");
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.subscribed = false;
        this.setStatus("offline");
        this.emit("friends", []);
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60_000);
    this.log(`supabase: ${Math.round(delay / 1000)}s 뒤 재접속`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.closed) return;
      if (this.channel && this.client) {
        try {
          await this.client.removeChannel(this.channel);
        } catch {
          /* ignore */
        }
      }
      this.channel = null;
      this.setStatus("connecting");
      this.joinChannel();
    }, delay);
  }

  private emitFriendsSoon(): void {
    if (this.friendsTimer) return;
    this.friendsTimer = setTimeout(() => {
      this.friendsTimer = null;
      this.emitFriends();
    }, 400);
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
        code: String(latest.code ?? latest.userId.slice(0, 8)),
        friends: Array.isArray(latest.friends) ? latest.friends.map(String).slice(0, 100) : [],
        nickname: String(latest.nickname ?? "").slice(0, 20),
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
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.friendsTimer) clearTimeout(this.friendsTimer);
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
