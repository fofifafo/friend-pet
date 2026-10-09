# Supabase 연결 설정

친구 펫은 Supabase Realtime 의 **Presence**(접속자 상태 공유)와 **Broadcast**(채팅)만 사용합니다.
DB 테이블이나 인증 설정이 필요 없고, 무료 티어로 충분합니다.

## 1. Supabase 프로젝트 만들기 (한 명만)

1. https://supabase.com 에 가입하고 **New project** 를 누릅니다.
2. 이름은 아무거나, 지역은 **Northeast Asia (Seoul)** 또는 **Tokyo** 를 고릅니다.
3. 생성이 끝나면 왼쪽 메뉴 **Project Settings → API** 로 갑니다.
4. 아래 두 값을 복사합니다.
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public** 키 (긴 문자열)

anon 키는 공개용 키라 친구들에게 알려줘도 됩니다. `service_role` 키는 절대 공유하지 마세요.

## 2. 초대 코드 정하기

같은 초대 코드를 쓰는 사람끼리만 서로 보입니다. 예: `우리집고양이들`.
알기 어려운 문자열을 고르면 모르는 사람이 끼어들 수 없습니다.

## 3. 각자 config.json 에 입력

앱을 한 번 실행하면 트레이 아이콘 우클릭 → **설정 파일 열기** 로 `config.json` 이 열립니다.
(위치: `%APPDATA%\friend-pet\config.json`)

```json
{
  "nickname": "민수",
  "color": "gray",
  "room": "우리집고양이들",
  "supabase": {
    "url": "https://abcdefgh.supabase.co",
    "anonKey": "eyJhbGciOi...."
  }
}
```

- `nickname`: 친구 화면에 보일 이름
- `color`: `orange` `gray` `black` `white` `pink` `brown` 중 하나
- `room`: 초대 코드 (친구들과 동일하게)
- `userId`: 자동 생성됩니다. 건드리지 마세요.

저장한 뒤 앱을 다시 실행하면 트레이 메뉴에 **연결: 온라인** 이 표시됩니다.

## 4. 확인

- 트레이 메뉴의 **연결: 온라인 · 친구 N명** 숫자가 맞는지 봅니다.
- 친구 캐릭터를 클릭해 메시지를 보내면 친구 화면의 내 캐릭터 위에 말풍선이 뜹니다.

## 무료 티어 주의점

- 일주일 동안 아무도 접속하지 않으면 프로젝트가 **일시 정지**됩니다. Supabase 대시보드에서 **Restore** 를 누르면 됩니다.
- Realtime 동시 접속은 무료 티어에서 200개까지라 친구 그룹에는 충분합니다.

## 프라이버시

서버로 가는 것은 `닉네임, 색, 카테고리(코딩/게임/영상/문서/웹/대화/자리비움/기타), 시각` 뿐입니다.
창 제목, URL, 프로세스 이름은 내 PC 안에서 분류에만 쓰이고 전송되지 않습니다.
트레이 메뉴 또는 내 캐릭터 패널에서 **상태 공유 끄기(투명 모드)** 를 켜면 카테고리도 보내지 않습니다.
