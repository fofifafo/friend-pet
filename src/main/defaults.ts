// 앱에 내장된 기본 서버 설정.
// anon 키는 Supabase 가 공개용으로 설계한 키라 배포 파일에 넣어도 된다.
// config.json 의 supabase.url / anonKey / room 을 채우면 이 값 대신 쓰인다.
export const BUILTIN_SUPABASE = {
  url: "https://kvqchryblhoouuomemzc.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWNocnlibGhvb3V1b21lbXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDY5MjMsImV4cCI6MjEwNzEyMjkyM30.Gy2ZggE6zTcuqDoHGQzt8FXQ8rcqrXPBQuG8NX-oaHo",
};

/** 설정 창에 기본으로 채워지는 초대 코드 */
export const DEFAULT_ROOM = "cat-d3jad4";
