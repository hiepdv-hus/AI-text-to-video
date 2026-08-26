# setup-wav2lip.ps1 — cài đặt "ảnh biết nói" (Wav2Lip) chạy LOCAL, MIỄN PHÍ.
# Chạy MỘT LẦN trong PowerShell, từ thư mục gốc project (video-agent):
#     powershell -ExecutionPolicy Bypass -File scripts\setup-wav2lip.ps1
#
# Máy KHÔNG cần GPU (chạy CPU, chậm hơn). Cần ~2GB dung lượng và có mạng.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "== Cài Wav2Lip vào: $root\tools ==" -ForegroundColor Cyan

# 1) Python 3.10 (riêng, không đụng Python hệ thống) + ffmpeg
Write-Host "-- Cài Python 3.10 + ffmpeg qua winget..." -ForegroundColor Yellow
winget install --id Python.Python.3.10 --scope user --silent --accept-package-agreements --accept-source-agreements
winget install --id Gyan.FFmpeg --scope user --silent --accept-package-agreements --accept-source-agreements

$py310 = "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe"
if (-not (Test-Path $py310)) { throw "Không thấy Python 3.10 ở $py310" }

# 2) venv 3.10
Write-Host "-- Tạo venv tools\wav2lip-venv..." -ForegroundColor Yellow
& $py310 -m venv tools\wav2lip-venv
$venvPy = "tools\wav2lip-venv\Scripts\python.exe"

# 3) Thư viện (bản tương thích Python 3.10 CPU; requirements gốc của Wav2Lip đã quá cũ)
Write-Host "-- Cài PyTorch CPU + thư viện..." -ForegroundColor Yellow
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install torch==2.2.2 torchvision==0.17.2 --index-url https://download.pytorch.org/whl/cpu
& $venvPy -m pip install "numpy==1.23.5" "numba==0.56.4" "librosa==0.9.2" "opencv-python==4.9.0.80" "scipy==1.10.1" tqdm

# 4) Clone Wav2Lip
if (-not (Test-Path tools\Wav2Lip)) {
  Write-Host "-- Clone Wav2Lip..." -ForegroundColor Yellow
  git clone --depth 1 https://github.com/Rudrabha/Wav2Lip.git tools\Wav2Lip
}

# 5) Vá np.int (bỏ ở numpy mới)
(Get-Content tools\Wav2Lip\face_detection\utils.py) `
  -replace 'dtype=np\.int\)', 'dtype=np.int32)' |
  Set-Content tools\Wav2Lip\face_detection\utils.py

# 6) Tải checkpoints (mirror ổn định)
New-Item -ItemType Directory -Force tools\Wav2Lip\checkpoints | Out-Null
New-Item -ItemType Directory -Force tools\Wav2Lip\face_detection\detection\sfd | Out-Null
$gan = "tools\Wav2Lip\checkpoints\wav2lip_gan.pth"
$s3fd = "tools\Wav2Lip\face_detection\detection\sfd\s3fd.pth"
if (-not (Test-Path $gan)) {
  Write-Host "-- Tải wav2lip_gan.pth (~435MB)..." -ForegroundColor Yellow
  curl.exe -L -f -o $gan "https://github.com/justinjohn0306/Wav2Lip/releases/download/models/wav2lip_gan.pth"
}
if (-not (Test-Path $s3fd)) {
  Write-Host "-- Tải s3fd.pth (~90MB)..." -ForegroundColor Yellow
  curl.exe -L -f -o $s3fd "https://github.com/justinjohn0306/Wav2Lip/releases/download/models/s3fd.pth"
}

# 7) Ghi đường dẫn ffmpeg vào .env để pipeline dùng (Wav2Lip gọi ffmpeg)
$ffbin = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
          Select-Object -First 1).DirectoryName
if ($ffbin) {
  Write-Host "-- ffmpeg: $ffbin" -ForegroundColor Green
  if (-not (Test-Path .env)) { New-Item -ItemType File .env | Out-Null }
  Add-Content .env "`nFFMPEG_BIN=$($ffbin -replace '\\','/')"
}

Write-Host "== XONG. Thử: pnpm video render specs\demo-talkinghead.json ==" -ForegroundColor Cyan
Write-Host "   (đặt ảnh chân dung vào public\faces\ và trỏ media.kind='talkinghead')" -ForegroundColor Cyan
