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
  meta: { title, template: "ProductReview"|"ListicleTop5"|"StoryHook",
          width=1080, height=1920, fps=30, locale="vi-VN" }
  voice: { provider: "edge"|"piper"|"mock"|"elevenlabs"|"azure"|"google",
           voiceId, speed=1, pitch?, pronunciations?: {from: to} }
  captions: { style: "tiktok-bold"|"clean-minimal"|"outline-pop",
              position: "lower-third"|"center"|"top",
              maxWordsPerLine=4, highlightColor="#FFD400" }
  scenes: [{
    id, narration,                       // narration = lời đọc, bắt buộc
    layout: "hook"|"bullet"|"product"|"compare"|"cta"|"code",
    heading?, icon?,                     // icon = 1 emoji (vd "🚀","🤖") → huy hiệu cạnh tiêu đề
    bullets?: string[],                  // bullet có thể mở đầu bằng emoji, vd "🐳 Docker"
    media?: { kind:"image"|"video"|"color"|"talkinghead"|"generate", src, fit?, focus? },
    emphasis?: string[],
    transitionIn?: "fade"|"slide-left"|"slide-up"|"wipe"|"none",
    tailPadSec?=0.35,
    // chỉ dùng khi layout="code":
    code?, codeTitle?, codeLang?="javascript", codeHighlight?: number[], output?
  }]
  music?: { src, volume=0.12 }
}
```

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

ẢNH MINH HỌA:
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

ẢNH BIẾT NÓI (talking-head): đặt `media.kind: "talkinghead"`, `src` = ảnh CHÂN DUNG
(nên chính diện, rõ mặt). Pipeline dùng Wav2Lip biến ảnh + giọng đọc scene thành video mặt
mấp máy môi. Dùng với `layout:"product"` và KHÔNG đặt `heading` để mặt chiếm trọn khung.
Cần đã chạy `scripts/setup-wav2lip.ps1` trước (máy không GPU vẫn chạy, chỉ chậm hơn).
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
