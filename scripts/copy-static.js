// 컴파일 대상이 아닌 정적 파일을 dist 로 복사한다.
//  - src/renderer/*.html, *.css  → dist/renderer
//  - src/main/*.ps1              → dist/main
const fs = require("fs");
const path = require("path");

function copyByExt(srcDir, dstDir, exts) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir)) {
    if (exts.some((e) => f.endsWith(e))) {
      fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
    }
  }
}

const root = path.join(__dirname, "..");
copyByExt(path.join(root, "src", "renderer"), path.join(root, "dist", "renderer"), [".html", ".css"]);
copyByExt(path.join(root, "src", "main"), path.join(root, "dist", "main"), [".ps1"]);
