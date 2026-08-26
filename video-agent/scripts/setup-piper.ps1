# setup-piper.ps1 — cài Piper TTS chạy LOCAL, MIỄN PHÍ, KHÔNG cần API key/mạng.
# Chạy MỘT LẦN từ thư mục gốc project (video-agent):
#     powershell -ExecutionPolicy Bypass -File scripts\setup-piper.ps1
# Cần ~90MB dung lượng. Máy KHÔNG cần GPU (Piper chạy CPU rất nhanh).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force tools | Out-Null

# 1) Tải + giải nén Piper binary (Windows)
if (-not (Test-Path tools\piper\piper.exe)) {
  Write-Host "-- Tải Piper binary..." -ForegroundColor Yellow
  $zip = "tools\piper.zip"
  curl.exe -L -f -o $zip "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"
  Expand-Archive -Path $zip -DestinationPath tools\ -Force
  Remove-Item $zip
}

# 2) Tải các giọng tiếng Việt
New-Item -ItemType Directory -Force tools\piper\voices | Out-Null
$repo = "https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN"
# name = tên file; sub = đường dẫn con trong repo
$voices = @(
  @{ name = "vi_VN-vais1000-medium";     sub = "vais1000/medium" },       # rõ nhất (22kHz)
  @{ name = "vi_VN-25hours_single-low";  sub = "25hours_single/low" },     # giọng khác
  @{ name = "vi_VN-vivos-x_low";         sub = "vivos/x_low" }             # 65 speaker (#0..64)
)
foreach ($v in $voices) {
  $onnx = "tools\piper\voices\$($v.name).onnx"
  if (-not (Test-Path $onnx)) {
    Write-Host "-- Tải giọng $($v.name)..." -ForegroundColor Yellow
    curl.exe -L -f -o $onnx "$repo/$($v.sub)/$($v.name).onnx"
    curl.exe -L -f -o "$onnx.json" "$repo/$($v.sub)/$($v.name).onnx.json"
  }
}

Write-Host "== XONG. Dùng trong spec: ==" -ForegroundColor Cyan
Write-Host '   "voice": { "provider": "piper", "voiceId": "vi_VN-vais1000-medium", "speed": 1.15 }'
Write-Host "   Thử: pnpm video render specs\<file>.json"
