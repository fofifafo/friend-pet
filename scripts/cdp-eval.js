// 테스트 도구: 실행 중인 앱(--remote-debugging-port=9222)의 페이지에서 JS 를 실행한다.
// 사용법: node scripts/cdp-eval.js <페이지 url 일부> "<표현식>"
// 예:     node scripts/cdp-eval.js setup.html "document.title"
const WebSocket = require("ws");
const http = require("http");

const [, , urlPart, exprArg] = process.argv;
if (!urlPart || !exprArg) {
  console.error("usage: node scripts/cdp-eval.js <url part> <expression | @file>");
  process.exit(2);
}
// "@경로" 로 주면 파일 내용을 표현식으로 쓴다 (셸 따옴표 문제 회피).
const expression = exprArg.startsWith("@") ? require("fs").readFileSync(exprArg.slice(1), "utf-8") : exprArg;

http.get("http://127.0.0.1:9222/json", (res) => {
  let body = "";
  res.on("data", (c) => (body += c));
  res.on("end", () => {
    const pages = JSON.parse(body);
    const page = pages.find((p) => p.type === "page" && p.url.includes(urlPart));
    if (!page) {
      console.error("page not found:", urlPart, "available:", pages.map((p) => p.url));
      process.exit(1);
    }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.on("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 1) {
        if (msg.result?.exceptionDetails) console.log("EXCEPTION:", JSON.stringify(msg.result.exceptionDetails.exception?.description ?? msg.result.exceptionDetails));
        else console.log(JSON.stringify(msg.result?.result?.value));
        ws.close();
        process.exit(0);
      }
    });
    ws.on("error", (e) => {
      console.error("ws error:", e.message);
      process.exit(1);
    });
    setTimeout(() => process.exit(3), 15000);
  });
}).on("error", (e) => {
  console.error("http error:", e.message);
  process.exit(1);
});
