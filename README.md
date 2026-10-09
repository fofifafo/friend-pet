# 친구 펫 (friend-pet)

친구와 함께하는 Windows 데스크톱 펫입니다.
바탕화면 위를 돌아다니는 픽셀 동물이 내 활동을 포즈로 보여주고, 친구들의 동물도 함께 나타나 서로 장난치며, 말풍선으로 채팅합니다.

## 기능

- **캐릭터 6종** 고양이, 강아지, 토끼, 곰, 펭귄, 여우. 색상 11가지. 32x32 픽셀 스프라이트를 코드로 생성합니다.
- **활동 감지** 활성 창을 PC 안에서만 읽어 코딩/게임/영상/문서/대화/웹/자리비움으로 분류하고, 캐릭터가 앉거나 눕고 머리 위 생각풍선에 아이콘을 띄웁니다. 창 제목이나 URL 은 전송하지 않습니다.
- **친구 상태 공유** Supabase Realtime Presence 로 같은 초대 코드를 쓰는 친구의 캐릭터가 내 화면에 나타납니다. 친구 코드를 등록하면 등록한 친구만 보이게 할 수 있습니다.
- **상호작용 모션** 가까이 있는 캐릭터끼리 코 비비기, 하이파이브, 춤, 같이 앉기, 술래잡기, 손 흔들기를 자동으로 합니다. 친구 패널의 버튼으로 직접 걸 수도 있습니다.
- **말풍선 채팅** 보낸 말은 내 캐릭터 위에, 받은 말은 친구 캐릭터 위에 뜹니다. 듣는 쪽은 놀랐다가 하트를 띄웁니다.
- **설정 창** 첫 실행 때 열립니다. 언어(한국어/English/日本語), 이름, 캐릭터, 초대 코드, 친구 목록, 옵션, 고급 설정.
- **단일 모션 목록** idle, walk, run, sit, lie, sleep, groom, stretch, happy, jump, wave, highfive, nuzzle, dance, talk, surprised, love, sweat, sittogether.

## 설치 (친구용)

1. [Releases](https://github.com/fofifafo/friend-pet/releases) 에서 `friend-pet-Setup-<버전>.exe` 를 받아 실행합니다. 무설치는 `friend-pet-portable-<버전>.exe`.
2. Windows 가 "PC 보호" 경고를 띄우면 **추가 정보 → 실행**.
3. 설정 창에서 이름과 캐릭터를 고르고, 초대 코드를 친구와 같은 값으로 맞춘 뒤 저장합니다.
4. 트레이의 동물 아이콘 우클릭 → 연결: 온라인 · 친구 N명 이 보이면 완료입니다.

서버는 앱에 내장돼 있어 따로 설정할 것이 없습니다. 직접 만든 Supabase 프로젝트를 쓰려면 설정 창의 고급 설정에 URL 과 anon 키를 넣습니다. [docs/supabase-setup.md](docs/supabase-setup.md) 참고.

## 개발

Node.js 20 이상이 필요합니다.

```bash
npm install
npm start
```

처음 `npm install` 때 Electron 설치 스크립트가 npm 정책에 막히면:

```bash
npm approve-scripts electron
npm rebuild electron
```

- `npm run dev`: 개발자 도구를 함께 띄웁니다.
- `npm start -- --category=coding`: 활동 감지 대신 지정한 카테고리로 고정합니다.
- `npm start -- --profile=test`: 별도 설정 폴더(`%APPDATA%\friend-pet-test`)로 실행합니다. 같은 PC 에서 두 번째 사용자를 띄워 연결을 시험할 때 씁니다.
- `npm start -- --setup`: 설정 창을 바로 엽니다.
- `npm run dist`: 설치 파일과 포터블 exe 를 `release/` 에 만듭니다.
- `python scripts/gen-sprites.py --preview <폴더>`: 스프라이트를 다시 생성하고 미리보기 PNG 를 만듭니다. 캐릭터 모양은 이 스크립트에서 고칩니다.
- `node scripts/cdp-eval.js index.html "<식>"`: `--remote-debugging-port=9222` 로 띄운 앱의 화면에서 JS 를 실행합니다 (테스트용).

## 사용법

- 캐릭터가 없는 영역은 클릭이 아래 창으로 통과합니다.
- 캐릭터를 **클릭**하면 패널이 열립니다. 친구 패널에는 👋 🤝 💃 🏃 버튼이 있어 내 캐릭터가 다가가 장난을 겁니다. `Esc` 또는 × 로 닫습니다.
- 캐릭터를 **드래그**해 옮길 수 있습니다.
- 내 패널의 **상태 공유 끄기(투명 모드)** 를 누르면 친구에게 "비공개"로 보입니다.
- 트레이 아이콘: 내 상태, 연결, 내 친구 코드, 공유 토글, 보이기/숨기기, 설정, 언어, 설정 파일, 종료. 더블클릭하면 설정이 열립니다.

## 활동 분류

| 카테고리 | 예 | 캐릭터 |
|---|---|---|
| coding | VS Code, 터미널, GitHub 탭 | 앉아서 💻 |
| game | Steam, 리그 오브 레전드 | 앉아서 🎮 |
| video | YouTube, 넷플릭스, 치지직 | 누워서 📺 |
| document | Word, 한글, Notion | 앉아서 📄 |
| chat | Discord, 카카오톡 | 서서 💬 |
| browsing | 그 외 브라우저 탭 | 돌아다님 |
| away | 5분간 입력 없음 | 잠 |

규칙 추가는 `%APPDATA%\friend-pet\config.json` 의 `customRules` 에 넣습니다.

```json
"customRules": {
  "processes": { "myeditor": "coding" },
  "titleKeywords": { "우리회사위키": "document" }
}
```

## 폴더 구조

```
src/main/main.ts         Electron 메인: 창, 트레이, 설정 창, IPC, 전송 계층
src/main/activity.ts     PowerShell 헬퍼로 활성 창 정보 수집
src/main/classifier.ts   프로세스·제목 → 카테고리 규칙
src/main/config.ts       config.json 읽기/쓰기, 검증
src/main/i18n.ts         한국어/영어/일본어 문자열
src/main/defaults.ts     내장 서버 설정
src/main/net/            transport(공통), supabase(실제, 재접속), demo(가짜 친구)
src/renderer/renderer.ts 캔버스 렌더링, 상태 머신, 상호작용, 패널, 말풍선
src/renderer/sprites.ts  자동 생성된 스프라이트 데이터 (scripts/gen-sprites.py)
src/renderer/setup.*     설정 창
scripts/                 빌드 보조, 스프라이트 생성기, 테스트 도구
```

## 디버깅

로그는 `%APPDATA%\friend-pet\pet.log` 에 기록됩니다 (카테고리 변경, 연결 상태, 친구 수, 수신 채팅, 렌더러 콘솔).

## 배포

```bash
npm run dist
```

`release/` 에 `friend-pet-Setup-<버전>.exe` 와 `friend-pet-portable-<버전>.exe` 가 생깁니다. 코드 서명이 없으므로 SmartScreen 경고가 뜹니다.
