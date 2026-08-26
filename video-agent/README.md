# video-agent

Hệ thống tạo video ngắn dọc **1080×1920** (TikTok/Reels/Shorts) tự động, điều khiển bằng
brief tiếng Việt qua AI agent. Render chạy **local** bằng Remotion (Chrome headless + FFmpeg).

## Kiến trúc: 2 nửa tách biệt

```
[Nửa sáng tạo]  Agent đọc brief → sinh 1 file JSON: VideoSpec  (specs/<slug>.json)
                              │
                       ranh giới = VideoSpec
                              │
[Nửa xác định]  Pipeline đọc VideoSpec → MP4  (KHÔNG có LLM ở đây)
```

Agent **không bao giờ sửa code React** khi tạo video — chỉ sinh JSON. Mỗi lần tạo video là
**deterministic**, debug được, và có thể sửa tay JSON rồi render lại mà không cần gọi AI.

`durationInFrames` của mỗi scene **không** nằm trong VideoSpec — nó được tính từ **độ dài file
audio thật** sau khi TTS (qua `ffprobe`/đọc header WAV). Vì thế pipeline phải chạy TTS trước
khi render.

## Cài đặt

```bash
pnpm install                 # cài deps (esbuild build script đã được allow trong pnpm-workspace.yaml)
# Chrome headless + FFmpeg do Remotion tự tải ở lần render đầu.
cp .env.example .env         # (tuỳ chọn) điền API key nếu muốn giọng thật
```

Yêu cầu: Node ≥ 18, pnpm. Không cần cài FFmpeg riêng (Remotion bundle sẵn); đường `mock`
đọc/ghi WAV thuần bằng Node nên chạy offline không cần binary ngoài.

## Cách dễ nhất: Studio web (không cần gõ lệnh/JSON)

```bash
pnpm video serve          # rồi mở http://localhost:4321 trong trình duyệt
```
Điền tiêu đề, chọn giọng/template, thêm các cảnh (hook/code/bullet/cta…), bấm **Render** →
video hiện ngay trong trang để xem + tải. Spec tự lưu vào `specs/`. Nút "Nạp spec" để mở lại
và sửa video cũ.

## Dùng CLI

```bash
pnpm video build   specs/demo-tainghe.json   # spec → out/<slug>/props.json (TTS + timing)
pnpm video render  specs/demo-tainghe.json   # build + render → out/<slug>/final.mp4
pnpm video preview specs/demo-tainghe.json   # build + mở Remotion Studio với props thật
pnpm video voices                            # liệt kê voice tiếng Việt khả dụng
pnpm video demo-tts "Giảm 30% còn 199k!"     # in bảng word-timing để kiểm tra bằng mắt

pnpm studio            # mở Remotion Studio (preview template với defaultProps)
pnpm typecheck         # tsc --noEmit
pnpm test              # test chuẩn hoá tiếng Việt (số → chữ, NFC…)
```

## Cấu trúc

```
src/
  Root.tsx                 đăng ký compositions (Hello + 3 template dùng chung renderer)
  index.ts                 registerRoot
  schema.ts                Zod: VideoSpec (agent viết) + BuiltProps (pipeline sinh)
  theme/tokens.ts          màu / font / spacing — mọi component đọc từ đây
  compositions/
    Hello.tsx              composition verify toolchain
    VideoComposition.tsx   renderer chung: sequence các scene + nhạc nền
    defaultProps.ts        props mẫu cho Studio preview
  components/
    fonts.ts               embed Be Vietnam Pro (đủ dấu tiếng Việt)
    KaraokeCaption.tsx     phụ đề karaoke, 3 preset
    captions.ts            logic chia dòng (max từ + khoảng lặng) — thuần, test được
    Background.tsx         nền: Img (Ken Burns) / OffthreadVideo / màu
    layouts.tsx            hook / bullet / product / compare / cta
    SceneWrapper.tsx       ghép nền + layout + caption + audio + transitionIn
pipeline/
  normalize.ts             chuẩn hoá tiếng Việt: số→chữ, NFC, bảng phát âm (+ test)
  tts.ts                   adapter đa provider (edge/piper/mock/elevenlabs/azure/google)
  align.ts                 Whisper align khi provider không trả timing (+ fallback đều)
  audio.ts                 đọc/ghi WAV thuần, lấy duration
  cache.ts                 cache TTS theo hash(text+voice+speed)
  assets.ts                tải asset về public/
  build.ts                 VideoSpec → out/<slug>/props.json
  render.ts                props.json → MP4 (renderMedia)
cli.ts                     entrypoint các lệnh trên
specs/                     VideoSpec JSON (sửa tay + render lại được)
public/                    asset cho staticFile() (audio, ảnh tải về…)
out/                       props.json + final.mp4
.claude/skills/make-video/ SKILL.md — hướng dẫn agent ra lệnh bằng tiếng Việt
```

## Provider TTS

| Provider | Word timing | Ghi chú |
|---|---|---|
| `edge` | có (word boundary) | **MIỄN PHÍ, không cần key** — giọng vi-VN Microsoft Edge (HoaiMy/NamMinh). Khuyến nghị. Cần mạng khi render. Output MP3. |
| `piper` | qua align đều | **MIỄN PHÍ, offline, không key** — giọng vi local. Cài: `scripts/setup-piper.ps1`. Giọng: `vi_VN-vais1000-medium` (rõ nhất), `vi_VN-25hours_single-low`, `vi_VN-vivos-x_low#0..64` (65 speaker — đổi số sau `#`). |
| `mock` | có (đều) | Không cần key, không cần mạng. Giọng **im lặng** — để chạy/kiểm thử offline. |
| `elevenlabs` | có (ký tự→từ) | Chất lượng cao nhất. Cần `ELEVENLABS_API_KEY`. |
| `azure` | qua Whisper | Giọng vi-VN tốt. Cần key+region. |
| `google` | qua Whisper | Giọng vi-VN ổn, không có timestamp. Cần key. |

> Đổi giọng: sửa `voice.provider` + `voice.voiceId` trong spec. Xem `pnpm video voices`.

## Những chỗ dễ vỡ (đã xử lý sẵn)

- **Chữ Việt ra ô vuông** → font embed qua `@remotion/google-fonts` (Be Vietnam Pro), không
  dùng font hệ thống.
- **Animation không chạy** → mọi hiệu ứng bằng `useCurrentFrame()`/`interpolate`/`spring`,
  không CSS transition, không setTimeout.
- **Render treo 0%** → `<Img>`/`<OffthreadVideo>` tự `delayRender`; Chrome do Remotion tự tải.
- **Audio lệch phụ đề** → duration lấy từ file audio thật, không ước lượng theo ký tự.
- **Dấu tiếng Việt lệch khi so khớp** → chuẩn hoá NFC ở cả 2 phía.

## Mở rộng

- Cắm b-roll từ Kling/Veo vào `media.kind = "video"`.
- Sinh nhiều biến thể hook từ 1 spec để A/B test.
- Render hàng loạt từ CSV danh sách sản phẩm.
- Bọc CLI thành MCP server để gọi từ Claude Desktop.

## Tuân thủ

Nếu làm affiliate: gắn nhãn nội dung AI theo quy định nền tảng, không dựng lời chứng thực giả,
công khai link tiếp thị liên kết.
