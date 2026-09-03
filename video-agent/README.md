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
  theme/claude.ts          SỔ THEME: palette tech / claude-dark / claude-cream
  theme/tokens.ts          màu / font / spacing của các nền cũ (spider/aurora/solid)
  compositions/
    Hello.tsx              composition verify toolchain
    VideoComposition.tsx   renderer chung: sequence các scene + nhạc nền
    defaultProps.ts        props mẫu cho Studio preview
  components/
    fonts.ts               embed Be Vietnam Pro (đủ dấu tiếng Việt)
    KaraokeCaption.tsx     phụ đề karaoke — preset đi theo theme
    captions.ts            logic chia dòng (max từ + khoảng lặng) — thuần, test được
    motion.ts              NHỊP chuyển động dùng chung: vào / sống / ra
    FilmGrain.tsx          hạt phim phủ toàn khung (chống banding + chất phim)
    TechBackground.tsx     mưa nhị phân ở hai mép, chừa dải giữa cho nội dung
    SceneBackdrop.tsx      VIDEO NỀN toàn màn: duotone + scrim + Ken Burns + loop
    claude/Heading.tsx     thứ bậc chữ dùng chung: eyebrow → tiêu đề → phụ đề
    claude/ClaudeLayouts   hook / bullet / product / compare / cta / image / graphic
    CodeLayout.tsx         cửa sổ code kiểu IDE, chrome đổi theo theme
    SceneWrapper.tsx       ghép nền + layout + caption + audio + transitionIn
pipeline/
  normalize.ts             chuẩn hoá tiếng Việt: số→chữ, NFC, bảng phát âm (+ test)
  tts.ts                   adapter đa provider (edge/piper/mock/elevenlabs/azure/google)
  align.ts                 Whisper align khi provider không trả timing (+ fallback đều)
  audio.ts                 đọc/ghi WAV thuần, lấy duration
  cache.ts                 cache TTS theo hash(text+voice+speed)
  assets.ts                tải asset về public/
  stock.ts                 tải ẢNH + VIDEO thật từ Pexels (có cache)
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

## Diện mạo: theme + hình nền

`meta.background` chọn theme, và theme quyết định **toàn bộ** diện mạo — tiêu đề, thẻ, cửa sổ
code, đồ hoạ, phụ đề đều đọc màu/chất liệu từ cùng một Palette (`src/theme/claude.ts`). Không
đặt màu rời rạc trong spec; đó là thứ giữ cho video đồng nhất.

| `meta.background` | Diện mạo |
|---|---|
| `tech` | Mưa nhị phân, nhấn xanh matrix, nhãn monospace, thẻ kính mờ. Mặc định cho nội dung lập trình. |
| `claude-dark` / `claude-cream` | Tối giản ấm, nhấn cam đất. |
| `spider` / `aurora` / `solid` | Nền cũ, dùng palette claude-dark cho phần chữ. |

**Tiêu đề 2 tầng**: viết `heading` dạng `"Bước 3 — Viết API đầu tiên"` (gạch dài `—`, vế trái
≤ 22 ký tự) thì tự tách thành nhãn nhỏ *BƯỚC 3* + tiêu đề lớn.

**Hình nền lấy từ Pexels** (cần `PEXELS_API_KEY` miễn phí):

| `media.kind` | Kết quả |
|---|---|
| `pexels-video` | Tải clip dọc thật → chạy **full-bleed làm nền cả cảnh**. Cảnh dài hơn clip thì tự lặp. |
| `pexels` | Tải ảnh thật → hiện trong **khung ảnh gọn** dưới tiêu đề. |
| `generate` | Sinh ảnh AI (Pollinations, không cần key) → khung ảnh gọn. |

Cảnh CÓ video thì video là nền **duy nhất** — không phủ mưa nhị phân lên nữa. Mỗi cảnh vì
thế có một danh tính rõ ràng: hoặc cảnh quay thật, hoặc nền đồ hoạ.

Clip nền được xử lý tự động cho khớp theme: giảm bão hoà + nhuộm về tông theme + xoá phông
+ lớp phủ đậm hai đầu khung + phóng chậm và trôi ngang. Nhờ vậy clip Pexels bất kỳ cũng
"cùng một bộ phim" và chữ vẫn đọc rõ. Mức xoá phông thay đổi theo layout: cảnh nhiều khối
nội dung (`bullet`, `graphic`, `code`) làm mờ mạnh để clip lùi hẳn thành chất liệu; cảnh chỉ
có tiêu đề (`hook`, `cta`) mờ nhẹ để còn thấy cảnh quay.

## Chuyển động

Nhịp chuyển động của cả hệ nằm ở [`src/components/motion.ts`](src/components/motion.ts) —
sửa `BEAT` ở đó là đổi cảm giác của toàn bộ video. Ba tầng tách bạch:

| Tầng | Hàm | Việc |
|---|---|---|
| VÀO | `useEnter` | phần tử xuất hiện, có nảy, lệch nhau `BEAT.stagger` frame |
| SỐNG | `useDrift` · `usePulse` · `useSweep` | trôi/thở/quét **liên tục** sau khi đã vào |
| RA | `useExit` | nội dung đẩy lên + mờ ở 10 frame cuối cảnh |

Tầng "SỐNG" là phần quan trọng nhất: không có nó thì sau giây thứ hai mọi thứ đứng chết
trong khi giọng đọc vẫn chạy — đó chính là cảm giác "slide có tiếng" chứ không phải video.

Áp dụng cụ thể: tiêu đề chạy theo **từng chữ** (bay lên + lấy nét); thẻ lật vào quanh trục
ngang rồi trôi khẽ; thanh biểu đồ có vệt sáng quét; timeline có chấm sáng chạy dọc đường ray
và nút thở theo nhịp; cửa sổ code có con trỏ nhấp nháy; nút CTA thở. Lớp nội dung còn trôi
**ngược chiều** nền đang phóng vào (parallax) để khung hình có chiều sâu.

Hai lớp phủ toàn video: **hạt phim** (`FilmGrain` — phá banding của nền tối khi nén H.264,
và cho chất phim) và **thanh tiến trình** mép trên (người xem biết còn bao lâu → giữ chân
tốt hơn, đồng thời là thứ duy nhất chuyển động liên tục nối các cảnh thành một mạch).

## Widget đồ hoạ (layout `graphic`)

| `graphic.kind` | Dùng khi | `labels` |
|---|---|---|
| `bar-chart` | So sánh số liệu | `"Trước tối ưu:48 s"` — thanh dài nhất chuẩn hoá gần hết bề ngang, **hàng cuối là điểm nhấn**, số tự đếm lên |
| `highlight-timeline` | Mốc thời gian | nội dung mốc + `timestamps` cùng số lượng |
| `steps` | Quy trình có thứ tự | mỗi bước một chuỗi, tự đánh số 01/02/03 |
| `feature-cards` | Liệt kê ngang hàng | ≤ 4 mục → 1 cột chữ to; ≥ 5 mục → 2 cột |
| `chat-ai` | Hội thoại | `"u:…"` / `"a:…"` |

Mẫu đầy đủ dùng cả 5 widget + video nền: `specs/tech-showcase.json`.

## Những chỗ dễ vỡ (đã xử lý sẵn)

- **Chữ Việt ra ô vuông** → font embed qua `@remotion/google-fonts` (Be Vietnam Pro), không
  dùng font hệ thống.
- **Animation không chạy** → mọi hiệu ứng bằng `useCurrentFrame()`/`interpolate`/`spring`,
  không CSS transition, không setTimeout.
- **Render treo 0%** → `<Img>`/`<OffthreadVideo>` tự `delayRender`; Chrome do Remotion tự tải.
- **Audio lệch phụ đề** → duration lấy từ file audio thật, không ước lượng theo ký tự.
- **Dấu tiếng Việt lệch khi so khớp** → chuẩn hoá NFC ở cả 2 phía.

## Mở rộng

- Cắm b-roll từ Kling/Veo vào `media.kind = "video"` (dùng chung đường render với `pexels-video`).
- Sinh nhiều biến thể hook từ 1 spec để A/B test.
- Render hàng loạt từ CSV danh sách sản phẩm.
- Bọc CLI thành MCP server để gọi từ Claude Desktop.

## Tuân thủ

Nếu làm affiliate: gắn nhãn nội dung AI theo quy định nền tảng, không dựng lời chứng thực giả,
công khai link tiếp thị liên kết.
