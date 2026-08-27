# Prompt dựng hệ thống tạo video tự động bằng AI Agent

> Cách dùng: **đừng paste hết một lần**. Chia làm 5 giai đoạn, mỗi giai đoạn paste một prompt, kiểm tra kết quả chạy được rồi mới sang bước tiếp. Agent build one-shot cả hệ thống gần như chắc chắn sẽ ra code không chạy.

---

## PROMPT 0 — Khởi tạo & kiến trúc

```
Tôi muốn xây một hệ thống tạo video ngắn tự động (dọc 1080x1920, cho TikTok/Reels/Shorts)
mà tôi điều khiển hoàn toàn bằng câu lệnh tiếng Việt qua agent. Render chạy local.

KIẾN TRÚC BẮT BUỘC — tuân thủ đúng, đây là điểm cốt lõi của thiết kế:

Toàn bộ hệ thống chia làm 2 nửa tách biệt hoàn toàn:

  [Nửa sáng tạo]  Agent (bạn) đọc brief → sinh ra 1 file JSON duy nhất: VideoSpec
  [Nửa xác định]  Pipeline code đọc VideoSpec → ra file MP4. Không có LLM ở nửa này.

Ranh giới giữa 2 nửa là VideoSpec. Agent KHÔNG bao giờ sửa code React khi tạo video,
chỉ sinh JSON. Điều này để mỗi lần tạo video là deterministic, debug được, và
tôi có thể sửa tay JSON rồi render lại mà không cần gọi AI.

STACK:
- Remotion (video = React component, render bằng Chrome headless + FFmpeg)
- TypeScript, strict mode
- Zod để định nghĩa schema VideoSpec — dùng luôn schema này làm props schema của Remotion
- pnpm

CẤU TRÚC THƯ MỤC:

video-agent/
├── src/
│   ├── Root.tsx                    # đăng ký compositions
│   ├── schema.ts                   # Zod: VideoSpec, Scene, WordTiming...
│   ├── theme/tokens.ts             # màu, font, spacing — mọi component đọc từ đây
│   ├── compositions/               # mỗi template 1 file
│   │   └── ProductReview.tsx
│   └── components/
│       ├── KaraokeCaption.tsx
│       ├── SceneWrapper.tsx
│       └── transitions/
├── pipeline/
│   ├── tts.ts                      # adapter đa provider
│   ├── align.ts                    # lấy timestamp từng từ
│   ├── assets.ts                   # tải/chuẩn hoá ảnh, b-roll
│   ├── build.ts                    # VideoSpec + audio → props.json hoàn chỉnh
│   └── render.ts                   # gọi Remotion renderer
├── cli.ts                          # entrypoint: pnpm video build/render/preview
├── specs/                          # VideoSpec JSON đã sinh, lưu lại được
├── public/                         # asset cho staticFile()
└── out/

VIỆC CẦN LÀM Ở BƯỚC NÀY (chỉ bước này thôi, đừng làm thêm):
1. Scaffold project bằng create-video, cấu hình TypeScript strict
2. Viết src/schema.ts — Zod schema đầy đủ cho VideoSpec (xem đặc tả bên dưới)
3. Viết src/theme/tokens.ts với 1 bộ token mặc định
4. Tạo 1 composition "Hello" tối giản render được ra MP4, để verify toolchain
5. Chạy thử render và báo cho tôi biết nó chạy được

ĐẶC TẢ VideoSpec:

{
  meta: { title, template, width, height, fps, locale }
  scenes: [{
    id: string
    narration: string          // câu thoại — pipeline sẽ TTS phần này
    layout: enum               // "hook" | "bullet" | "product" | "compare" | "cta"
    heading?: string
    bullets?: string[]
    media?: { kind: "image"|"video"|"color", src: string, fit?: ... }
    emphasis?: string[]        // các từ trong narration cần tô nổi bật
    transitionIn?: enum
  }]
  voice: { provider, voiceId, speed, pitch? }
  captions: { style, position, maxWordsPerLine, highlightColor }
  music?: { src, volume }
}

LƯU Ý QUAN TRỌNG:
- durationInFrames của mỗi scene KHÔNG có trong VideoSpec. Nó được tính từ độ dài
  file audio thật sau khi TTS xong. Dùng calculateMetadata + getAudioDurationInSeconds.
  Đây là lý do pipeline phải chạy TTS trước khi render.
- Trước khi code, hãy đọc doc Remotion hiện tại để xác nhận API. Kiến thức của bạn
  có thể cũ hơn phiên bản mới nhất.

Xong bước 1-5 thì dừng lại, đừng làm tiếp.
```

---

## PROMPT 1 — TTS tiếng Việt + timestamp từng từ

```
Giờ làm pipeline/tts.ts và pipeline/align.ts.

TTS — thiết kế dạng adapter, tôi đổi provider bằng cách sửa config:

interface TTSProvider {
  synthesize(text: string, opts): Promise<{ audioPath: string, words?: WordTiming[] }>
}

Implement các provider sau, ưu tiên theo thứ tự:
1. ElevenLabs — dùng endpoint with-timestamps, nó trả về alignment cấp ký tự,
   gộp lại thành cấp từ thì KHỎI CẦN chạy Whisper. Đây là đường nhanh nhất.
2. Azure Speech — SDK có word boundary event, cũng cho timestamp sẵn. Giọng vi-VN tốt.
3. Google Cloud TTS — giọng vi-VN ổn nhưng KHÔNG có word timestamp → phải fallback align.
4. FPT.AI hoặc Viettel AI — provider Việt Nam, để dự phòng.

ALIGN — chỉ chạy khi provider không tự trả timestamp:
- Dùng @remotion/install-whisper-cpp: nó tự tải và build whisper.cpp về máy,
  hàm transcribe() có option cho word-level timestamps. Chạy hoàn toàn local, miễn phí.
- Model: large-v3 hoặc medium cho tiếng Việt, ép language="vi"
- Whisper cần WAV 16kHz mono → dùng ffmpeg convert trước

XỬ LÝ RIÊNG CHO TIẾNG VIỆT — phần này quan trọng, đừng bỏ qua:
- Tiếng Việt viết rời từng âm tiết, nên "word" mà Whisper trả về ≈ âm tiết.
  Với karaoke thì như vậy lại đẹp, cứ để nguyên, ĐỪNG cố gộp thành từ ghép.
- Chuẩn hoá Unicode về NFC trước khi so khớp, nếu không dấu thanh sẽ lệch
  và việc match từ với narration gốc sẽ fail.
- Số, ngày tháng, đơn vị tiền tệ: viết ra chữ TRƯỚC khi gửi TTS
  ("299.000đ" → "hai trăm chín mươi chín nghìn đồng"). Viết hàm normalizeVietnamese()
  xử lý việc này, có unit test.
- Từ tiếng Anh chen giữa (tên sản phẩm, thương hiệu) hay bị đọc sai —
  cho phép VideoSpec khai báo bảng phát âm thay thế.

Viết test: đưa vào 1 đoạn tiếng Việt có số và tên tiếng Anh, in ra bảng
word timing, tôi tự kiểm tra bằng mắt xem có khớp không.
```

---

## PROMPT 2 — Phụ đề karaoke

```
Làm src/components/KaraokeCaption.tsx.

Input: WordTiming[] gồm { text, startMs, endMs }
Output: phụ đề chia dòng, từ đang được đọc thì nổi bật.

- Kiểm tra @remotion/captions trước, nó có sẵn hàm chia caption kiểu TikTok.
  Nếu dùng được thì dùng, đừng viết lại từ đầu.
- Chia dòng theo cả 2 tiêu chí: tối đa N từ VÀ khoảng lặng > 300ms thì ngắt.
  Chỉ chia theo số từ thôi sẽ ra những dòng cắt giữa câu, nhìn rất khó chịu.
- Từ active: xác định bằng frame/fps so với startMs/endMs
- Hiệu ứng: scale nhẹ bằng spring() + đổi màu, KHÔNG dùng CSS transition
  (Remotion render từng frame rời rạc, transition không hoạt động)

Làm 3 preset style: "tiktok-bold", "clean-minimal", "outline-pop".
Mỗi preset đọc màu từ theme/tokens.ts.

Yêu cầu kỹ thuật:
- Font phải embed bằng @remotion/fonts hoặc loadFont, KHÔNG dùng font hệ thống —
  Chrome headless không có font đó, chữ sẽ ra ô vuông. Font Việt cần đủ bộ dấu,
  gợi ý Be Vietnam Pro hoặc Montserrat.
- Text có dấu tiếng Việt cao hơn chữ Latin thường → tăng line-height,
  nếu không dấu mũ bị cắt ngọn.
- Đặt safe area: chừa 15% dưới cho UI của TikTok che.

Tạo composition demo để tôi preview bằng `pnpm remotion studio` và xem thử.
```

---

## PROMPT 3 — Template & compositions

```
Làm template đầu tiên: ProductReview (dành cho video affiliate).

Cấu trúc scene theo layout:
- hook:    chữ lớn giữa màn hình, animate mạnh, 2-3 giây
- product: ảnh sản phẩm + Ken Burns (zoom/pan chậm), heading overlay
- bullet:  danh sách gạch đầu dòng, từng dòng stagger xuất hiện
- compare: chia đôi màn hình
- cta:     kêu gọi hành động + hiệu ứng nhấn

Nguyên tắc code:
- Mỗi layout là 1 component nhận props đã typed, không nhận `any`
- Timing dùng interpolate() và spring() theo frame, tuyệt đối không dùng
  setTimeout/setInterval/requestAnimationFrame — render không real-time
- Ảnh dùng <Img> của Remotion (nó tự delayRender chờ load), KHÔNG dùng <img>
- Video nền dùng <OffthreadVideo>, không dùng <Video> (chậm hơn nhiều khi render)
- Mỗi scene bọc trong <Sequence from={} durationInFrames={}> tính từ audio thật
- Audio ghép bằng <Audio> đặt ở scene tương ứng

Thêm transitions bằng @remotion/transitions (fade, slide, wipe).

Sau đó tạo thêm 2 template nữa dùng chung components: ListicleTop5, StoryHook.
```

---

## PROMPT 4 — CLI, orchestration, và skill cho agent

```
Ghép mọi thứ lại.

pipeline/build.ts — nhận specs/xxx.json, chạy tuần tự:
  1. Validate bằng Zod, fail sớm với thông báo rõ ràng
  2. normalizeVietnamese() từng narration
  3. TTS song song các scene (giới hạn concurrency 3, tránh rate limit)
  4. Align lấy word timing nếu provider không trả sẵn
  5. ffprobe lấy duration thật từng file audio → tính durationInFrames
  6. Tải asset về public/, convert ảnh về đúng tỉ lệ
  7. Ghi ra out/<slug>/props.json + toàn bộ audio
  Có cache: cùng narration + cùng voice thì dùng lại file audio cũ,
  không gọi API lại. Key cache = hash(text + voiceId + speed).

pipeline/render.ts — dùng renderMedia() từ @remotion/renderer:
  - codec h264, CRF ~23
  - concurrency = số core - 1
  - onProgress in ra tiến độ
  - Xuất out/<slug>/final.mp4

cli.ts với các lệnh:
  pnpm video build <spec>      # chạy pipeline, ra props.json
  pnpm video render <spec>     # build + render ra MP4
  pnpm video preview <spec>    # build + mở Remotion Studio
  pnpm video voices            # liệt kê voice tiếng Việt khả dụng

CUỐI CÙNG — tạo .claude/skills/make-video/SKILL.md để tôi ra lệnh bằng tiếng Việt:

Skill này hướng dẫn agent:
  - Đọc brief tiếng Việt của tôi
  - Chọn template phù hợp
  - Viết kịch bản: hook 3 giây đầu phải giật, mỗi scene 1 ý, tổng 30-45 giây,
    văn nói tự nhiên chứ không phải văn viết
  - Sinh file specs/<slug>.json đúng Zod schema
  - Chạy `pnpm video render`
  - Báo đường dẫn MP4

Trong SKILL.md ghi rõ schema và 2 ví dụ spec hoàn chỉnh để agent bắt chước.
```

---

## Phong cách "SpiderAI News" (neon tím) — DÙNG MẶC ĐỊNH cho video công nghệ/AI

Đây là bộ nhận diện hình ảnh chuẩn để video "có phong cách" và **khớp hoàn hảo với nội
dung** (nói tới ý nào thì hiện đúng đồ hoạ đó). Bật bằng cách đặt trong spec:

```jsonc
"meta": {
  "background": "spider",                 // nền gradient tím-teal + quầng neon + lưới mờ
  "brand": {                              // thanh thương hiệu trên cùng + pill gợi ý dưới
    "name": "SpiderAI News",
    "logo": "🕷",
    "hint": "Kéo xuống để khóa tốc độ 2x"
  }
},
"captions": {
  "style": "chip-glow",                   // mỗi từ 1 chip tối; từ đang đọc là chip tím phát sáng
  "highlightColor": "#B983FF"
}
```

**Tiêu đề có keyword phát sáng:** đặt `heading` + `emphasis` (cụm từ khoá) — cụm trong
`emphasis` sẽ được tô tím, gạch chân glow. Dùng cho cả `layout: "hook"` và `"graphic"`.

**Layout `graphic` — đồ hoạ neon khớp nội dung.** Thêm `scene.graphic`:

| `graphic.kind` | Dùng khi narration nói về… | Tham số riêng |
|---|---|---|
| `highlight-timeline` | AI nhận diện đoạn/khoảnh khắc nổi bật trong video | `labels[]` (nhãn cột), `timestamps[]` (thước) |
| `device-editor` | xử lý/biên tập cục bộ trên máy, timeline dựng phim | `timecode` (vd "00:02:17") |
| `feature-cards` | liệt kê tính năng/lợi ích (2–4 thẻ) | `labels[]` dạng `"✂️ Cắt tự động"` |
| `bar-chart` | so sánh/thống kê (cột mọc dần + số đếm) | `labels[]` dạng `"Tên:80"` (tên : giá trị 0–100) |
| `chat-ai` | chatbot/hỏi-đáp với trợ lý AI (bong bóng chat + chấm đang gõ) | `labels[]` dạng `"u:câu người dùng"` / `"a:câu trợ lý"` |

Mỗi graphic đều nhận `subtitle` (dòng mô tả nhỏ dưới tiêu đề, vd `"Nhanh · Riêng tư"`).

**Chuyển cảnh điện ảnh:** ngoài `fade/slide-left/slide-up/wipe/none`, có thêm `zoom` (phóng nhẹ vào), `blur` (mờ → nét), `glow` (bừng sáng) cho cảm giác hiện đại.

**Nguyên tắc "kết hợp hoàn hảo":** mỗi scene chọn `graphic.kind` đúng với điều đang nói.
Đừng dùng nền tĩnh chung chung khi có thể minh hoạ bằng đồ hoạ. Xem `specs/spider-ai-news.json`
làm mẫu hoàn chỉnh. Muốn thêm loại đồ hoạ mới → tạo component trong `src/components/graphics/`
và đăng ký ở `GRAPHICS` trong `GraphicLayout.tsx` + enum `graphicSchema.kind` trong `schema.ts`.

## Những chỗ dễ vỡ — nói trước với agent để đỡ mất thời gian

| Vấn đề | Cách xử lý |
|---|---|
| Chữ Việt ra ô vuông | Font phải embed, không dùng font hệ thống |
| Animation không chạy | Bỏ hết CSS transition, mọi thứ tính theo `useCurrentFrame()` |
| Render treo ở 0% | Ảnh/font load async chưa `delayRender()`; hoặc thiếu Chrome — chạy `npx remotion browser ensure` |
| Audio lệch phụ đề | Duration lấy từ ffprobe file thật, đừng ước lượng theo số ký tự |
| Render rất chậm | Đổi `<Video>` → `<OffthreadVideo>`, giảm số layer blur/shadow |
| Dấu tiếng Việt lệch khi so khớp | Chuẩn hoá NFC ở cả 2 phía |

## Mở rộng sau khi bản đầu chạy được

- Cắm b-roll sinh từ Kling/Veo vào `media.kind = "video"`
- Sinh nhiều biến thể hook từ 1 spec để A/B test — đây là thứ có giá trị nhất cho affiliate
- Render hàng loạt từ 1 file CSV danh sách sản phẩm
- Bọc CLI thành MCP server nếu muốn gọi từ Claude Desktop thay vì terminal

## Lưu ý

Kiến thức của mình về API cụ thể (tên package, endpoint, tham số) có thể đã cũ so với
phiên bản hiện tại. Trong mỗi prompt đều có câu yêu cầu agent đọc doc chính thức trước
khi code — giữ nguyên câu đó.

Nếu làm video affiliate: gắn nhãn nội dung AI theo quy định nền tảng, không dựng lời
chứng thực giả, và công khai link tiếp thị liên kết.
