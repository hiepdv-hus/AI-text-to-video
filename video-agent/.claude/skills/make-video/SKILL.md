---
name: make-video
description: Tạo video ngắn dọc 1080x1920 (TikTok/Reels/Shorts) từ brief tiếng Việt. Dùng khi người dùng muốn dựng video review sản phẩm, listicle top N, hoặc story hook. Agent viết VideoSpec JSON rồi chạy pipeline render ra MP4.
---

# make-video — Dựng video ngắn từ brief tiếng Việt

Bạn là nửa SÁNG TẠO của hệ thống. Việc của bạn: đọc brief tiếng Việt → viết **một file
`specs/<slug>.json`** đúng schema → chạy `pnpm video render` → báo đường dẫn MP4.

**TUYỆT ĐỐI KHÔNG sửa code React/TypeScript để tạo video.** Bạn chỉ sinh JSON. Pipeline
(nửa xác định) lo phần còn lại: TTS, timing, caption, render. Nếu video chưa ưng, bạn sửa
JSON rồi render lại — không đụng vào `src/`.

## Quy trình

1. Đọc brief. Hỏi lại nếu thiếu: sản phẩm/chủ đề, giọng (nam/nữ), có link affiliate không.
2. Chọn template:
   - **ProductReview** — review 1 sản phẩm affiliate (hook → product → bullet → compare → cta)
   - **ListicleTop5** — đếm ngược top N (hook → các hạng → cta)
   - **StoryHook** — kể chuyện giữ chân (hook giật → diễn biến → chốt)
   - **CodeExplainer** — dạy lập trình: hook → các cảnh `code` (mỗi cảnh 1 khái niệm +
     kết quả console) → cta. NGÔI SAO là code + output, KHÔNG phải mặt người.
3. Viết kịch bản:
   - **Hook 3 giây đầu phải GIẬT** — số sốc, câu hỏi, phủ định ("Đừng mua… trước khi…").
   - Mỗi scene **một ý duy nhất**. Tổng **30–45 giây** (khoảng 8–14 scene ngắn).
   - **Văn nói tự nhiên**, không phải văn viết. Đọc lên nghe như người thật nói.
   - Câu ngắn. Có thể chèn emoji ở `heading` cho CTA.
4. Sinh `specs/<slug>.json` đúng schema (xem dưới). `slug` = tên file, không dấu, gạch nối.
5. Chạy: `pnpm video render specs/<slug>.json`
6. Báo đường dẫn `out/<slug>/final.mp4`. Nếu lỗi validate, đọc thông báo Zod và sửa JSON.

## Mẹo viết narration (pipeline sẽ TTS phần này)

- **Số/tiền/%**: cứ viết số bình thường (`299.000đ`, `50%`, `4.9/5`). Pipeline tự đọc thành
  chữ ("hai trăm chín mươi chín nghìn đồng"). Đừng tự viết ra chữ.
- **Tên tiếng Anh/thương hiệu** dễ bị đọc sai → khai báo `voice.pronunciations`
  (vd `{ "iPhone": "ai phôn", "SoundPro": "sao prô" }`).
- `emphasis`: liệt kê vài từ khoá muốn nhấn (gợi ý cho caption).
- `heading` là chữ TO trên màn hình (ngắn gọn, đập vào mắt); `narration` là lời đọc (đầy đủ,
  tự nhiên). Hai cái KHÁC nhau: heading là tiêu đề, narration là câu nói.

## Schema (rút gọn — xem `src/schema.ts` để đầy đủ)

```
VideoSpec {
  meta: { title, template: "ProductReview"|"ListicleTop5"|"StoryHook"|"CodeExplainer",
          width=1080, height=1920, fps=30, locale="vi-VN",
          background?: "tech"|"claude-dark"|"claude-cream"|"spider"|"aurora"|"solid",
          //   "tech"  = MẶC ĐỊNH cho video lập trình/công nghệ: mưa nhị phân, xanh matrix, nhãn mono
          //   "claude-dark"/"claude-cream" = tối giản ấm (cam đất)
          brand?: { name, logo="🕷", hint? } }             // thanh thương hiệu trên + pill gợi ý dưới
  voice: { provider: "edge"|"piper"|"mock"|"elevenlabs"|"azure"|"google",
           voiceId, speed=1, pitch?, pronunciations?: {from: to} }
  captions: { style: "tech"|"claude"|"chip-glow"|"tiktok-bold"|"clean-minimal"|"outline-pop",
              // LƯU Ý: với background "tech"/"claude-*", caption TỰ đi theo theme —
              // field này chỉ còn tác dụng ở các nền cũ (spider/aurora/solid).
              position: "lower-third"|"center"|"top",
              maxWordsPerLine=4, highlightColor="#B983FF" }
  scenes: [{
    id, narration,                       // narration = lời đọc, bắt buộc
    layout: "hook"|"bullet"|"product"|"compare"|"cta"|"code"|"graphic"|"image",
    heading?, icon?,                     // icon = 1 emoji (vd "🚀","🤖") → huy hiệu cạnh tiêu đề
    bullets?: string[],                  // bullet có thể mở đầu bằng emoji, vd "🐳 Docker"
    media?: { kind:"pexels-video"|"pexels"|"generate"|"image"|"video"|"color", src, fit?, focus? },
    //   "pexels-video"/"video" → chạy FULL-BLEED làm nền cả cảnh (nội dung đè lên trên)
    //   "pexels"/"generate"/"image" → khung ảnh gọn dưới tiêu đề, KHÔNG tràn màn
    emphasis?: string[],                 // cụm từ khoá → tô tím phát sáng trong heading (hook/graphic)
    transitionIn?: "fade"|"slide-left"|"slide-up"|"wipe"|"none"|"zoom"|"blur"|"glow", // zoom/blur/glow = điện ảnh
    tailPadSec?=0.35,
    // chỉ dùng khi layout="code":
    code?, codeTitle?, codeLang?="javascript", codeHighlight?: number[], output?,
    // chỉ dùng khi layout="graphic" (đồ hoạ neon khớp nội dung):
    graphic?: { kind: "bar-chart"|"highlight-timeline"|"steps"|"feature-cards"|"chat-ai"|"device-editor",
                subtitle?, labels?: string[], timestamps?: string[], timecode? }
  }]
  music?: { src, volume=0.12 }
}
```

WIDGET ĐỒ HOẠ (layout `graphic`) — chọn theo BẢN CHẤT dữ liệu, đừng chọn theo cảm tính:

| `graphic.kind` | Dùng khi | Cách nhập `labels` |
|---|---|---|
| `bar-chart` | So sánh SỐ LIỆU | `"Tên:giá trị đơn vị"` — vd `"Trước tối ưu:48 s"`, `"Tốc độ:92%"` |
| `highlight-timeline` | Các mốc THỜI GIAN | nội dung mốc; kèm `timestamps` cùng số lượng, vd `["00:00","00:04"]` |
| `steps` | Quy trình CÓ THỨ TỰ | mỗi bước một chuỗi; nút tự đánh số 01/02/03 |
| `feature-cards` | Liệt kê ngang hàng | mỗi mục một chuỗi, mở đầu bằng emoji nếu muốn |
| `chat-ai` | Hội thoại | `"u:câu người dùng"` / `"a:câu trợ lý"` |

Ghi chú về `bar-chart`: thanh dài nhất được chuẩn hoá về gần hết bề ngang (so sánh
TƯƠNG ĐỐI, không phải thang 100), và **hàng CUỐI là điểm nhấn** — nên xếp dữ liệu theo
mạch "trước → sau" để con số đáng nhớ nằm cuối. Số tự đếm lên khi thanh mọc.

Giới hạn số mục để chữ còn to: `bar-chart` 2–4 hàng · `highlight-timeline` 3–4 mốc ·
`steps` 3 bước · `feature-cards` 3–4 thẻ (từ 5 thẻ trở lên tự xếp 2 cột và chữ nhỏ đi
một nấc — chỉ dùng khi thật sự cần).

NGUYÊN TẮC THẺ/LIỆT KÊ (feature-cards) — tránh lỗi thiết kế:
- **Song song**: mọi label trong 1 lưới phải cùng dạng (toàn câu hỏi "…?" HOẶC toàn cụm danh từ). Đừng trộn.
- **Đừng trộn số liệu với punchline**: số đo ("17 file","3 API") để trong thẻ; câu chốt cảm xúc để lên `heading` (dùng `emphasis`), KHÔNG nhét thành 1 ô ngang hàng.
- **Số lượng ô**: ≤ 4 ô → 1 cột, chữ to (nên dùng); ≥ 5 ô → tự xếp 2 cột và hạ một nấc cỡ chữ.
- **Icon tiết chế**: chỉ thêm emoji khi nó MANG NGHĨA. Label không có emoji → thẻ tự dùng thanh nhấn tím (đẹp, giữ kỷ luật màu). Tránh emoji màu trang trí (bọ vàng, bia đỏ) đâm vào hệ tím–xanh.

PHONG CÁCH "TECH" (MẶC ĐỊNH cho video lập trình/công nghệ): đặt `meta.background:"tech"`.
Toàn bộ video (tiêu đề, thẻ, cửa sổ code, phụ đề, đồ hoạ) tự đổi sang một hệ: nền mưa nhị
phân, nhấn xanh matrix, nhãn monospace, thẻ kính mờ. Không cần chỉnh gì thêm — **đừng** tự
đặt màu trong spec, để theme lo, đó là thứ giữ cho video đồng nhất.
- **Nhãn nhỏ tự động**: `heading` viết dạng `"Bước 3 — Viết API đầu tiên"` (gạch dài `—`,
  vế trái ≤ 22 ký tự) sẽ tự tách thành nhãn mono nhỏ "BƯỚC 3" + tiêu đề lớn "Viết API đầu
  tiên". Đây là cách tạo thứ bậc chữ; hãy dùng nó cho các cảnh trong một chuỗi có đánh số.
- **Mưa nhị phân chỉ rơi ở HAI MÉP**, chừa trọn dải giữa cho nội dung. Đừng lo nó làm rối chữ.
- **Cảnh có video thì KHÔNG có mưa nhị phân** — hai thứ tách bạch. Mỗi cảnh vì thế hoặc là
  cảnh quay thật, hoặc là nền đồ hoạ; xen kẽ hai loại sẽ tạo nhịp cho video.
- **Video nền là cách làm hình mặc định**: đặt `media.kind:"pexels-video"` cho khoảng một
  nửa số cảnh (nhất là `hook`, `cta`, và các cảnh chỉ có tiêu đề). Cảnh có widget dày
  (`graphic`, `bullet`, `code`) thì video tự động bị làm mờ mạnh để lùi hẳn ra sau — vẫn
  dùng được, nhưng đừng để cảnh nào cũng có.
- **Chuyển động là tự động, đừng cố mô tả nó trong spec**: tiêu đề tự chạy theo từng chữ,
  thẻ tự lật vào và trôi, biểu đồ tự có vệt sáng quét, timeline tự có chấm chạy, CTA tự thở.
  Việc của spec chỉ là nội dung; nhịp do `src/components/motion.ts` lo.

PHONG CÁCH "SpiderAI News" (mặc định cho video công nghệ/AI): đặt `meta.background:"spider"`,
`meta.brand`, `captions.style:"chip-glow"`. Dùng `layout:"graphic"` để đồ hoạ khớp nội dung —
`highlight-timeline` (AI nhận diện đoạn nổi bật), `device-editor` (xử lý/biên tập cục bộ),
`feature-cards` (liệt kê tính năng). Đặt `heading` + `emphasis` để tô sáng từ khoá. Mẫu đầy đủ:
`specs/spider-ai-news.json`.

Quy ước layout:
- `hook`: chữ lớn giữa màn — `heading` ngắn cực mạnh.
- `product`: nền ảnh sản phẩm (Ken Burns) + `heading` overlay; đặt `media.kind:"image"` với
  `src` là URL ảnh, hoặc `"color"` với mã màu nếu chưa có ảnh.

CODE (dạy lập trình): đặt `layout:"code"` với các field:
- `code`: mã nguồn (dùng `\n` xuống dòng). GIỮ NGẮN: tối đa ~6-9 dòng, mỗi dòng ≤ ~40 ký tự.
- `codeTitle`: tên file trên thanh cửa sổ (vd `"map.js"`).
- `codeHighlight`: mảng số dòng (1-indexed) cần tô sáng, vd `[2]` — dòng khác sẽ mờ.
- `output`: kết quả console (chuỗi, có thể nhiều dòng) — hiện ở panel dưới, là khoảnh khắc "à há".
- `codeLang`: mặc định "javascript".
- `heading`: tiêu đề ngắn của khái niệm (vd `"map — biến đổi mỗi phần tử"`).
`narration` = lời GIẢI THÍCH (không đọc code). Mỗi cảnh code chỉ 1 khái niệm. Xem
`specs/js-tap1-map-filter-reduce.json`. Với từ tiếng Anh (map/filter/const…) nên thêm
`voice.pronunciations` để đọc đỡ trật.

VIDEO NỀN (cách làm hình ảnh MẶC ĐỊNH — ưu tiên hơn ảnh tĩnh):
- `media.kind: "pexels-video"`, `src` = TỪ KHÓA tiếng **Anh** (vd "programmer typing code closeup").
  Pipeline tự tìm & tải clip dọc thật từ Pexels, đặt làm nền TOÀN MÀN của cảnh đó.
- Cảnh dài hơn clip thì clip TỰ LẶP — không đứng hình. Không cần khai báo gì thêm.
- Clip được tự động: giảm bão hoà + nhuộm về tông của theme + phủ lớp tối + phủ mưa nhị phân
  → mọi clip Pexels đều "cùng một bộ phim", không lạc màu, chữ vẫn đọc rõ. **Không cần** tự
  chỉnh màu hay chọn clip tối/sáng.
- Chọn từ khóa tả HÀNH ĐỘNG hoặc KHÔNG GIAN, đừng tả chữ/đồ hoạ (clip có chữ tiếng Anh
  trên màn hình sẽ đá nhau với tiêu đề). Tốt: "server room lights", "hands typing keyboard
  night", "city traffic timelapse". Tránh: "javascript tutorial", "infographic".
- Dùng được cho MỌI layout trừ `code` (cảnh code đã có cửa sổ IDE riêng, đừng thêm nền động
  làm rối). Hợp nhất với `hook`, `cta`, `bullet`.

ẢNH MINH HỌA (khi cần hình TĨNH, cụ thể — sơ đồ, sản phẩm):
- Layout `image` = khung ảnh gọn, sắc nét (không crop) + tiêu đề. Hợp sơ đồ/hình minh họa.
- `media.kind: "image"`, src = URL hoặc file trong `public/images/`.
- **ẢNH THẬT (Pexels)**: `media.kind: "pexels"`, `src` = TỪ KHÓA tìm kiếm bằng **tiếng Anh**
  (vd "frustrated programmer laptop"). Tự tìm & tải ảnh thật chất lượng cao. Cần PEXELS_API_KEY
  (free). Hợp khi muốn ảnh thực tế, hợp lý (thường tự nhiên hơn ảnh AI).
- **TỰ SINH ẢNH BẰNG AI**: `media.kind: "generate"`, `src` = MÔ TẢ ẢNH bằng **tiếng Anh**,
  cụ thể, tránh từ đa nghĩa (vd "map" → dễ ra bản đồ; hãy tả rõ cảnh cần vẽ). Pipeline tự sinh
  ảnh (Pollinations, miễn phí, không key) khớp nội dung scene rồi nhúng vào. Khi làm video, NÊN
  tự viết `generate` prompt cho mỗi cảnh cần minh họa để ảnh khớp nội dung. Dùng với layout
  `image` (khung) hoặc `product` (nền toàn màn).

- `bullet`: `bullets[]` hiện lần lượt. 2–4 dòng, mỗi dòng ngắn.
- `compare`: chia đôi trên/dưới, dùng `bullets[0]` vs `bullets[1]`.
- `cta`: nút kêu gọi — `heading` có emoji càng tốt.

Provider giọng đọc:
- `"edge"` — **khuyến nghị**: MIỄN PHÍ, không cần key, giọng vi-VN tự nhiên
  (`vi-VN-HoaiMyNeural` nữ, `vi-VN-NamMinhNeural` nam). Cần mạng khi render.
- `"mock"` — giọng im lặng, không cần mạng; chỉ để test nhanh timing/caption offline.
- `"elevenlabs"`/`"azure"`/`"google"` — cần API key (xem `.env.example`).

Mặc định nên dùng `"edge"` để video có tiếng ngay. Xem `pnpm video voices`.

## Ví dụ 1 — ProductReview (affiliate)

```json
{
  "meta": { "title": "Tai nghe SoundPro X2 có đáng mua", "template": "ProductReview",
            "width": 1080, "height": 1920, "fps": 30, "locale": "vi-VN" },
  "voice": { "provider": "edge", "voiceId": "vi-VN-HoaiMyNeural", "speed": 1,
             "pronunciations": { "SoundPro": "sao prô", "X2": "ích hai" } },
  "captions": { "style": "tiktok-bold", "position": "lower-third",
                "maxWordsPerLine": 4, "highlightColor": "#FFD400" },
  "scenes": [
    { "id": "hook", "narration": "Đừng mua tai nghe 2 triệu trước khi xem hết video này!",
      "layout": "hook", "heading": "ĐỪNG MUA VỘI!", "transitionIn": "fade" },
    { "id": "product", "narration": "Đây là SoundPro X2, giá chỉ 1.290.000đ, rẻ hơn hàng hiệu một nửa.",
      "layout": "product", "heading": "SoundPro X2 — 1.290.000đ",
      "media": { "kind": "color", "src": "#1E2A4A" }, "transitionIn": "slide-up" },
    { "id": "bullets", "narration": "Ba lý do nên mua: pin 40 giờ, chống ồn chủ động, và micro cực rõ.",
      "layout": "bullet", "heading": "3 lý do nên mua",
      "bullets": ["Pin 40 giờ dùng cả tuần", "Chống ồn chủ động ANC", "Micro đàm thoại cực rõ"],
      "transitionIn": "slide-left" },
    { "id": "compare", "narration": "So với bản cũ, âm bass mạnh hơn và kết nối ổn định hơn hẳn.",
      "layout": "compare", "heading": "Cũ vs Mới",
      "bullets": ["Bản cũ: bass yếu", "Bản mới: bass mạnh"], "transitionIn": "wipe" },
    { "id": "cta", "narration": "Link mua ở phần bình luận, giảm thêm 10% cho 100 bạn đầu tiên!",
      "layout": "cta", "heading": "Xem link bình luận 👇", "transitionIn": "fade" }
  ]
}
```

## Ví dụ 2 — ListicleTop5

```json
{
  "meta": { "title": "Top 5 app học tiếng Anh miễn phí", "template": "ListicleTop5",
            "width": 1080, "height": 1920, "fps": 30, "locale": "vi-VN" },
  "voice": { "provider": "edge", "voiceId": "vi-VN-NamMinhNeural", "speed": 1 },
  "captions": { "style": "outline-pop", "position": "lower-third",
                "maxWordsPerLine": 3, "highlightColor": "#39D98A" },
  "scenes": [
    { "id": "hook", "narration": "5 app học tiếng Anh miễn phí mà 90% người Việt chưa biết!",
      "layout": "hook", "heading": "5 APP MIỄN PHÍ", "transitionIn": "fade" },
    { "id": "top", "narration": "Số 5 luyện nghe, số 4 học từ vựng, số 3 luyện phát âm chuẩn bản xứ.",
      "layout": "bullet", "heading": "Hạng 5 đến 3",
      "bullets": ["#5 luyện nghe mỗi ngày", "#4 học 20 từ vựng", "#3 luyện phát âm bản xứ"],
      "transitionIn": "slide-up" },
    { "id": "top2", "narration": "Nhưng số 1 mới là app khiến bạn nói tự nhiên chỉ sau 30 ngày.",
      "layout": "bullet", "heading": "Top 2 và quán quân",
      "bullets": ["#2 luyện phản xạ giao tiếp", "#1 nói tự nhiên sau 30 ngày"],
      "transitionIn": "slide-left" },
    { "id": "cta", "narration": "Lưu lại kẻo trôi, và theo dõi để xem phần 2 nhé!",
      "layout": "cta", "heading": "Lưu lại + Theo dõi", "transitionIn": "fade" }
  ]
}
```

## Kiểm tra trước khi giao

- Hook có giật không? Đọc narration scene đầu lên xem có muốn xem tiếp không.
- Tổng thời lượng 30–45s (chạy `pnpm video build` rồi xem log số frame ÷ fps).
- Số tiền/%/tên riêng đã đúng (chạy `pnpm video demo-tts "<câu>"` để nghe thử cách đọc).

## Tuân thủ (video affiliate)

- Gắn nhãn nội dung AI theo quy định nền tảng.
- Không dựng lời chứng thực giả.
- Công khai link tiếp thị liên kết.
