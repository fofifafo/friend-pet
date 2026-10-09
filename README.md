# 친구 펫 (friend-pet)

친구와 함께하는 Windows 데스크톱 펫입니다.
바탕화면 위를 돌아다니는 픽셀 고양이가 내 활동을 포즈로 보여주고, 친구들의 고양이도 함께 나타나며, 말풍선으로 채팅합니다.

## 현재 상태

- [x] 1단계: 혼자 돌아다니는 캐릭터 (걷기, 멈춤, 앉기, 드래그, 클릭 통과, 트레이)
- [x] 2단계: 내 활동 감지 → 코딩/게임/영상/문서/대화/자리비움 포즈
- [x] 3단계: Supabase Realtime 으로 친구 상태 공유 (설정 없으면 데모 친구 2명)
- [x] 4단계: 캐릭터 클릭 상세 패널
- [x] 5단계: 말풍선 채팅

## 실행 방법

Node.js 20 이상이 필요합니다.

```bash
npm install
npm start
```

처음 `npm install` 때 Electron 설치 스크립트가 npm 정책에 막히면 아래를 실행한 뒤 다시 설치합니다.

```bash
npm approve-scripts electron
npm rebuild electron
```

- `npm run dev`: 개발자 도구를 함께 띄웁니다.
- `npm start -- --category=coding`: 활동 감지 대신 지정한 카테고리로 고정합니다 (포즈 확인용).
- `npm run dist`: 설치 파일(NSIS)과 포터블 exe 를 `release/` 에 만듭니다.

## 친구와 연결하기

처음에는 Supabase 설정이 비어 있어 **데모 모드**로 실행되며 가짜 친구 2명이 나타납니다.
실제 친구와 연결하려면 [docs/supabase-setup.md](docs/supabase-setup.md) 를 따라 `config.json` 에 URL, anon key, 초대 코드를 넣습니다.

## 사용법

- 캐릭터가 없는 영역은 클릭이 아래 창으로 통과합니다.
- 캐릭터를 **클릭**하면 패널이 열립니다. 이름, 상태, 마지막 활동, 최근 대화가 보이고 메시지를 보낼 수 있습니다. `Esc` 또는 × 로 닫습니다.
- 캐릭터를 **드래그**해 옮길 수 있습니다. 공중에 놓으면 떨어집니다.
- 내 캐릭터 패널의 **상태 공유 끄기(투명 모드)** 를 누르면 친구에게 "비공개"로 보입니다.
- 트레이 아이콘 우클릭: 내 상태, 연결 상태, 공유 토글, 보이기/숨기기, 설정 파일 열기, 종료.

## 활동 분류

활성 창의 프로세스 이름과 창 제목을 PC 안에서만 읽어 카테고리로 바꿉니다. 원본은 저장도 전송도 하지 않습니다.

| 카테고리 | 예 | 포즈 |
|---|---|---|
| coding | VS Code, 터미널, GitHub 탭 | 노트북 타이핑 |
| game | Steam, 리그 오브 레전드 | 게임패드 |
| video | YouTube, 넷플릭스, 치지직 | 누워서 TV |
| document | Word, 한글, Notion | 책 읽기 |
| chat | Discord, 카카오톡 | 폰 보기 |
| browsing | 그 외 브라우저 탭 | 평소처럼 돌아다님 |
| away | 5분간 입력 없음 | 잠 |

규칙을 추가하려면 `config.json` 의 `customRules` 에 넣습니다.

```json
"customRules": {
  "processes": { "myeditor": "coding" },
  "titleKeywords": { "우리회사위키": "document" }
}
```

## 설정 파일

`%APPDATA%\friend-pet\config.json`

| 키 | 기본값 | 설명 |
|---|---|---|
| nickname | Windows 사용자 이름 | 친구에게 보일 이름 |
| color | orange | orange, gray, black, white, pink, brown |
| room | "" | 초대 코드. 비어 있으면 데모 모드 |
| supabase.url / anonKey | "" | Supabase 프로젝트 값 |
| pollIntervalMs | 3000 | 활성 창 확인 주기 |
| idleAfterSec | 300 | 자리 비움 판정 시간 |
| shareActivity | true | false 면 투명 모드 |
| showLabel | true | 캐릭터 위 상태 라벨 |

## 폴더 구조

```
src/main/main.ts         Electron 메인: 창, 트레이, IPC, 전송 계층 연결
src/main/activity.ts     PowerShell 헬퍼를 띄워 활성 창 정보를 받음
src/main/activity.ps1    GetForegroundWindow / GetLastInputInfo 호출
src/main/classifier.ts   프로세스·제목 → 카테고리 규칙
src/main/config.ts       config.json 읽기/쓰기
src/main/net/            transport(공통), supabase(실제), demo(가짜 친구)
src/renderer/renderer.ts 캔버스 렌더링, 스프라이트, 상태 머신, 패널, 말풍선
src/renderer/index.html  패널 마크업
scripts/copy-static.js   html/css/ps1 을 dist 로 복사
```

## 디버깅

로그는 `%APPDATA%\friend-pet\pet.log` 에 기록됩니다 (카테고리 변경, 연결 상태, 렌더러 콘솔).

## 캐릭터 교체

캐릭터는 외부 에셋 없이 코드로 그린 16x16 픽셀 고양이입니다.
`src/renderer/renderer.ts` 의 `IDLE_1`, `SIT`, `LIE` 와 소품 오버레이를 CC0 스프라이트 시트 로딩으로 교체할 수 있도록 프레임 단위로 분리해 두었습니다.

## 배포

```bash
npm run dist
```

`release/` 에 설치 파일이 생깁니다. 코드 서명이 없으므로 친구가 설치할 때 Windows SmartScreen 경고가 뜹니다. "추가 정보 → 실행" 으로 진행하면 됩니다.
