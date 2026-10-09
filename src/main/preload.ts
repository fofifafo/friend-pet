import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("petApi", {
  /** true면 마우스 이벤트가 창을 통과한다. 캐릭터/패널 위에서는 false로 둔다. */
  setIgnoreMouse: (ignore: boolean) => ipcRenderer.send("set-ignore-mouse", ignore),
  /** 채팅 입력을 위해 창이 키보드 포커스를 받을 수 있게 한다. */
  setFocusable: (focusable: boolean) => ipcRenderer.send("set-focusable", focusable),
  /** 시작 시 내 상태, 친구 목록, 채팅 기록, 언어 사전을 한 번에 받는다. */
  getInit: () => ipcRenderer.invoke("get-init"),
  /** 채팅 전송. to 는 userId 또는 "all". */
  sendChat: (to: string, text: string) => ipcRenderer.invoke("send-chat", to, text),
  /** 상태 공유(투명 모드) 토글 */
  toggleShare: () => ipcRenderer.send("toggle-share"),

  onActivity: (cb: (data: unknown) => void) => ipcRenderer.on("activity-update", (_e, d) => cb(d)),
  onMe: (cb: (data: unknown) => void) => ipcRenderer.on("me-update", (_e, d) => cb(d)),
  onFriends: (cb: (data: unknown) => void) => ipcRenderer.on("friends-update", (_e, d) => cb(d)),
  onChat: (cb: (data: unknown) => void) => ipcRenderer.on("chat-message", (_e, d) => cb(d)),
  onStatus: (cb: (data: unknown) => void) => ipcRenderer.on("status-update", (_e, d) => cb(d)),
  onLocale: (cb: (data: unknown) => void) => ipcRenderer.on("locale-update", (_e, d) => cb(d)),

  // 설정 창 전용
  setupGet: () => ipcRenderer.invoke("setup-get"),
  setupSave: (values: unknown) => ipcRenderer.invoke("setup-save", values),
  setupCancel: () => ipcRenderer.send("setup-cancel"),
});
