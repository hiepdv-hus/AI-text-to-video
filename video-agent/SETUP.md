# Cài đặt trên máy mới (SETUP)

> File này nằm TRONG git → khi clone về máy khác, đọc file này (hoặc bảo Claude Code
> "setup theo SETUP.md") là chạy được. Những gì KHÔNG lên git đều liệt kê ở đây.

## 0. Yêu cầu
- **Node ≥ 18** và **pnpm** (`npm i -g pnpm` nếu chưa có)
- **ffmpeg** (cho giọng `edge` — lấy độ dài file mp3). Windows: `winget install Gyan.FFmpeg`
- **git**
- (Tùy chọn) **API key Pexels** nếu dùng ảnh thật — free ở https://www.pexels.com/api/

## 1. Cài cơ bản (bắt buộc)
```bash
pnpm install
# tạo file .env (xem mục 2) — chỉ cần nếu dùng Pexels hoặc ffmpeg không trên PATH
pnpm video render specs/con-can-hoc-code-khi-co-ai.json
```
Lần render đầu Remotion tự tải **Chrome headless (~150MB)**. Xong sẽ có `out/<slug>/final.mp4`.

Chạy được ngay ở bước này: giọng **edge/mock**, layout **code/bullet/hook/cta/image**,
nền **tech/aurora/solid**, icon emoji. (Ảnh `pexels`/`generate` cần key/mạng — xem dưới.)

## 2. File `.env` (KHÔNG lên git — tự tạo lại)
Copy `.env.example` → `.env`, điền thứ cần:
```
# Ảnh thật Pexels (media.kind "pexels"): free key ở pexels.com/api
PEXELS_API_KEY=...
# CHỈ cần nếu ffmpeg KHÔNG có trên PATH (code tự dò winget nên thường bỏ trống được)
FFMPEG_BIN=
```
> Ảnh AI `generate` (Pollinations) miễn phí, KHÔNG cần key.

## 3. Giọng đọc thêm — Piper (tùy chọn, MIỄN PHÍ offline)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-piper.ps1
```
Tải Piper + 3 giọng vi (~150MB) vào `tools/piper/` (không lên git).

## 4. Ảnh biết nói — Wav2Lip (tùy chọn, MIỄN PHÍ, CPU chậm)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-wav2lip.ps1
```
Cài Python 3.10 + Wav2Lip + model (~2GB) vào `tools/` (không lên git).

## 5. Studio web (giao diện điền form)
```bash
pnpm web        # tsx watch → tự nạp lại khi sửa code; mở http://localhost:4321
```

---

## Những gì KHÔNG lên git (tự phục hồi)
| Thứ | Phục hồi bằng |
|---|---|
| `node_modules/` | `pnpm install` |
| `.env` (API key) | tạo lại theo mục 2 |
| `tools/` (Piper, Wav2Lip, ~2GB) | `scripts/setup-*.ps1` |
| `out/`, `.cache/`, `public/audio\|assets\|images\|talkinghead/` | tự sinh khi render |

## Quirks / lỗi hay gặp (đọc để đỡ mất thời gian)
- **Windows – pnpm "not recognized"**: pnpm ở `%APPDATA%\npm` chưa trên PATH. Chạy 1 lần:
  `[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:APPDATA\npm", "User")` rồi mở lại terminal.
- **ffmpeg**: code TỰ DÒ (env `FFMPEG_BIN` → PATH → thư mục winget). Chỉ set `FFMPEG_BIN` khi tự dò trượt.
- **Đường dẫn dự án có dấu tiếng Việt** (vd "Máy tính"): OpenCV/Piper không đọc được path tuyệt đối
  non-ASCII → code đã truyền đường dẫn TƯƠNG ĐỐI cho piper/Wav2Lip. Đừng đổi cách đó.
- **Studio**: dùng `pnpm web` (watch). Nếu cổng 4321 kẹt (server cũ), server báo lỗi + cách diệt;
  hoặc: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 4321).OwningProcess -Force`.
- **Máy KHÔNG có GPU**: Wav2Lip chạy CPU nên chậm (~30–120s/scene). Piper/Edge thì nhanh.
- **Bảng phát âm** (`voice.pronunciations`) PHÂN BIỆT hoa/thường: "AI" (viết tắt) khác "ai" (từ Việt).
- **Windows-only hiện tại**: `scripts/*.ps1` là PowerShell, Piper là binary Windows. Mac/Linux cần chỉnh.

## Lệnh hay dùng
```bash
pnpm video render <spec>   # build + render → out/<slug>/final.mp4
pnpm video build  <spec>   # chỉ build props.json (nhanh, để kiểm tra)
pnpm video voices          # liệt kê giọng
pnpm web                   # Studio web (form → render)
pnpm typecheck             # tsc --noEmit
pnpm test                  # test chuẩn hoá tiếng Việt
```
