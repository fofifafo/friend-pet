# 활성 창의 프로세스 이름, 창 제목, 마지막 입력 후 경과 시간을 주기적으로 JSON 한 줄씩 출력한다.
# 이 출력은 같은 PC의 메인 프로세스만 읽으며, 창 제목 원본은 절대 외부로 나가지 않는다.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$interval = 3000
if ($args.Count -ge 1) { $interval = [int]$args[0] }

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class PetWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
}
"@

while ($true) {
  $h = [PetWin32]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 512
  [PetWin32]::GetWindowText($h, $sb, 512) | Out-Null
  $wpid = [uint32]0
  [PetWin32]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
  $name = ""
  if ($wpid -gt 0) {
    try { $name = (Get-Process -Id $wpid -ErrorAction Stop).ProcessName } catch {}
  }
  $lii = New-Object PetWin32+LASTINPUTINFO
  $lii.cbSize = 8
  [PetWin32]::GetLastInputInfo([ref]$lii) | Out-Null
  $now = [int64]([Environment]::TickCount -band 0xFFFFFFFF)
  $idle = ($now - [int64]$lii.dwTime) / 1000
  if ($idle -lt 0) { $idle = 0 }
  $obj = @{ process = $name; title = $sb.ToString(); idle = [math]::Round($idle) }
  Write-Output ($obj | ConvertTo-Json -Compress)
  Start-Sleep -Milliseconds $interval
}
