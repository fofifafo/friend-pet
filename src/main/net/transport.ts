// 친구들과 상태/채팅을 주고받는 전송 계층의 공통 타입.
// 구현체: SupabaseTransport(실제), DemoTransport(가짜 친구로 로컬 테스트).
import type { EventEmitter } from "events";
import type { Category } from "../classifier";

export type PetColor = "orange" | "gray" | "black" | "white" | "pink" | "brown";

/** 서버로 나가는 내 상태. 창 제목이나 URL 같은 원본은 절대 포함하지 않는다. */
export interface MemberState {
  userId: string;
  nickname: string;
  color: PetColor;
  /** 공유를 끈 상태(투명 모드)면 "unknown" 으로 보내고 sharing=false */
  category: Category;
  sharing: boolean;
  /** 현재 카테고리가 시작된 시각 (ISO) */
  since: string;
  /** 마지막으로 상태를 보낸 시각 (ISO) */
  lastActive: string;
}

export interface ChatMessage {
  id: string;
  from: string; // userId
  fromName: string;
  to: string; // userId 또는 "all"
  text: string;
  at: string; // ISO
}

export type ConnectionStatus = "connecting" | "online" | "offline" | "demo";

/**
 * 이벤트:
 *  - "friends" (members: MemberState[])   현재 접속 중인 친구 목록 (나 제외)
 *  - "chat"    (msg: ChatMessage)         받은 채팅
 *  - "status"  (s: ConnectionStatus)      연결 상태
 */
export interface Transport extends EventEmitter {
  connect(): Promise<void>;
  publish(state: MemberState): Promise<void>;
  sendChat(msg: ChatMessage): Promise<void>;
  disconnect(): Promise<void>;
  readonly status: ConnectionStatus;
}
