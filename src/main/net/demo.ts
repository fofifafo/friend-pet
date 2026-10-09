// 서버 없이 테스트하기 위한 가짜 친구 전송 계층.
// Supabase 설정이 비어 있으면 자동으로 이 모드로 실행된다.
import { EventEmitter } from "events";
import type { Category } from "../classifier";
import type { ChatMessage, ConnectionStatus, MemberState, Transport } from "./transport";

const CYCLE: Category[] = ["coding", "browsing", "game", "video", "document", "chat", "away"];

const REPLIES = [
  "ㅋㅋㅋ 뭐해",
  "나 지금 바빠 ㅠ",
  "오 좋은데?",
  "이따 같이 할래?",
  "잠깐만 이것만 끝내고",
  "👍",
  "밥 먹었어?",
];

export class DemoTransport extends EventEmitter implements Transport {
  private timers: NodeJS.Timeout[] = [];
  private friends: MemberState[] = [];
  private _status: ConnectionStatus = "demo";

  constructor(private me: MemberState, private log: (line: string) => void) {
    super();
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    const now = new Date().toISOString();
    this.friends = [
      { userId: "demo-1", nickname: "데모 민수", color: "gray", category: "coding", sharing: true, since: now, lastActive: now },
      { userId: "demo-2", nickname: "데모 지은", color: "pink", category: "video", sharing: true, since: now, lastActive: now },
    ];
    this.log("demo transport: 가짜 친구 2명 접속");
    this.emit("status", "demo");
    // 렌더러가 준비된 뒤 받도록 약간 늦게 알린다.
    this.timers.push(setTimeout(() => this.emit("friends", this.friends.slice()), 1500));

    // 12~25초마다 한 명의 상태가 바뀐다.
    const rotate = () => {
      const f = this.friends[Math.floor(Math.random() * this.friends.length)];
      const next = CYCLE[(CYCLE.indexOf(f.category) + 1 + Math.floor(Math.random() * 3)) % CYCLE.length];
      f.category = next;
      f.since = new Date().toISOString();
      f.lastActive = f.since;
      this.emit("friends", this.friends.slice());
      this.timers.push(setTimeout(rotate, 12_000 + Math.random() * 13_000));
    };
    this.timers.push(setTimeout(rotate, 12_000));

    // 가끔 먼저 말을 건다.
    const greet = () => {
      const f = this.friends[Math.floor(Math.random() * this.friends.length)];
      this.emit("chat", this.makeMessage(f, "all", REPLIES[Math.floor(Math.random() * REPLIES.length)]));
      this.timers.push(setTimeout(greet, 40_000 + Math.random() * 40_000));
    };
    this.timers.push(setTimeout(greet, 20_000));
  }

  private makeMessage(from: MemberState, to: string, text: string): ChatMessage {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: from.userId,
      fromName: from.nickname,
      to,
      text,
      at: new Date().toISOString(),
    };
  }

  async publish(state: MemberState): Promise<void> {
    this.me = state;
  }

  async sendChat(msg: ChatMessage): Promise<void> {
    // 받는 사람(또는 아무나)이 2초 뒤 답장한다.
    const target = this.friends.find((f) => f.userId === msg.to) ?? this.friends[0];
    this.timers.push(
      setTimeout(() => {
        this.emit("chat", this.makeMessage(target, this.me.userId, REPLIES[Math.floor(Math.random() * REPLIES.length)]));
      }, 2000),
    );
  }

  async disconnect(): Promise<void> {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
