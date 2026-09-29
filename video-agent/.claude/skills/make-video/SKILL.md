---
name: make-video
description: Tạo video ngắn dọc 1080x1920 (TikTok/Reels/Shorts) từ brief tiếng Việt — kể cả khi brief chỉ là MỘT CÂU chủ đề ("làm video về cách up code lên GitHub"). Agent tự viết kịch bản, sinh VideoSpec JSON, chạy pipeline render ra MP4.
---

# make-video — Dựng video ngắn từ brief tiếng Việt

Bạn là nửa SÁNG TẠO của hệ thống. Việc của bạn: đọc brief tiếng Việt → viết **một file
`specs/<slug>.json`** đúng schema → chạy `pnpm video render` → báo đường dẫn MP4.

**TUYỆT ĐỐI KHÔNG sửa code React/TypeScript để tạo video.** Bạn chỉ sinh JSON. Pipeline
(nửa xác định) lo phần còn lại: TTS, timing, caption, render. Nếu video chưa ưng, bạn sửa
JSON rồi render lại — không đụng vào `src/`.

## ĐỪNG HỎI LẠI — CỨ LÀM

Brief thường chỉ là một câu: *"tạo video hướng dẫn up code lên GitHub"*. Thế là ĐỦ. Tự
quyết mọi thứ còn lại theo MẶC ĐỊNH DỰ ÁN bên dưới rồi render luôn. Người dùng xem video
xong sẽ nói chỗ nào cần sửa — vòng lặp đó nhanh hơn nhiều so với hỏi trước một loạt câu.

Chỉ dừng lại hỏi khi chủ đề mơ hồ tới mức hai cách hiểu ra hai video khác hẳn nhau (vd
"làm video về Java" — Java hay JavaScript, cho người mới hay người đi làm). Còn giọng đọc,
nền, nhạc, số cảnh, widget: **không bao giờ hỏi**, đã có mặc định.

## MẶC ĐỊNH DỰ ÁN — dùng khi brief không nói khác

```jsonc
"meta":     { "template": "CodeExplainer", "background": "tech",
              "width": 1080, "height": 1920, "fps": 30, "locale": "vi-VN" },
"captions": { "style": "auto", "position": "lower-third",
              "maxWordsPerLine": 4, "highlightColor": "#3BE8A0" },
"music":    { "src": "sfx/ambient-tech.wav", "volume": 0.3, "duck": 0.25 },
"sfx":      { "enabled": true, "volume": 0.35 }
```

**GIỌNG ĐỌC:**

```jsonc
"voice": { "provider": "piper", "voiceId": "tranthanh3870", "speed": 1.6, "pitch": 3,
           "pronunciations": { "GitHub": "Git Háp", "commit": "cơ mít" } }
```

Piper chạy local, miễn phí, offline, dùng thương mại được — đó là lý do nó là mặc định.
**`pitch` CÓ tác dụng với piper**: engine piper không tự đổi cao độ, nhưng pipeline dịch cao
độ ở hậu kỳ bằng ffmpeg (cần ffmpeg trên máy — máy này đã có). Đổi lại phải chấp nhận hai
giới hạn, và **luôn phải bù bằng `pronunciations`**:

- Piper **không trả timing từng từ** → phụ đề karaoke bị chia đều máy móc, trôi lệch dần
  so với giọng trong câu dài. Viết câu ngắn thì lệch ít hơn.
- Piper phiên âm qua bộ âm vị tiếng Việt → **mọi từ tiếng Anh đều phải khai `pronunciations`**
  (`"push": "pút"`, `"Docker": "Đốc cơ"`). Bỏ sót từ nào là từ đó đọc sai.

Vì lý do thứ hai: **hạn chế nhét từ tiếng Anh vào `narration`**. Ưu tiên viết bằng tiếng
Việt, để tên tiếng Anh nằm ở `heading`, `chips` hay cửa sổ `code` — chỗ chỉ HIỆN chứ
không ĐỌC.

Cần phụ đề khớp giọng CHÍNH XÁC (word-timing thật) → dùng `edge` (miễn phí, cần mạng,
`vi-VN-NamMinhNeural`) hoặc `elevenlabs` (trả phí). Cả hai cũng đổi được `pitch`. Nhưng
`edge` KHÔNG có giấy phép thương mại rõ ràng — video kiếm tiền thì ở lại với piper/elevenlabs.

Kèm theo: **7 cảnh, ~40 giây**, `pexels-video` làm nền cho cảnh `hook` và `cta`, cảnh cuối
dẫn sang tập sau nếu chủ đề nằm trong một series.

## KHÔNG BỊA SỐ LIỆU — quy tắc cứng

Brief một câu KHÔNG kèm số liệu. Khi đó **cấm** sinh ra phần trăm, khoảng lương, thời gian
tiết kiệm được, hay bất kỳ con số nào nghe có vẻ thống kê. Con số bịa nghe rất thuyết phục
và sẽ được đăng lên kênh thật — hỏng uy tín nhanh hơn mọi lỗi kỹ thuật.

Không có số liệu thì:
- **Đừng** dùng `stat-big`, `bar-chart`, `range-bar`.
- **Hãy** dùng `checklist`, `steps`, `feature-cards`, `architecture`, `chat-ai`, `code` —
  chúng chở được lập luận và hướng dẫn mà không cần số.

Số ĐẾM ĐƯỢC trong chính nội dung thì dùng thoải mái ("3 lệnh", "bước 2/5", "40 ký tự") —
đó là sự thật kiểm chứng được, không phải thống kê.

Nếu người dùng có đưa số liệu trong brief: dùng ĐÚNG những số đó, không thêm.

## Quy trình

1. Đọc brief. Áp MẶC ĐỊNH DỰ ÁN cho mọi thứ brief không nói. Không hỏi lại.
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
          visualStyle?: "mixed"|"photo",
          //   "mixed" = MẶC ĐỊNH: pexels-video làm nền hook/cta, ảnh (pexels/generate) ĐÓNG KHUNG
          //   "photo" = CHỈ ẢNH GỐC + PHỤ ĐỀ LỜI KỂ: mọi cảnh có media ảnh ("pexels" + từ khoá
          //             tiếng Anh) hiển thị nguyên bản (không mờ, không phủ tối, không chuyển động);
          //             không video, không nền tech, không tiêu đề, không bullet, không đồ hoạ.
          //             Layout: hook (đầu) / image (giữa) / cta (cuối). Nội dung kể hết trong narration.
          brand?: { name, logo="🕷", hint? } }             // thanh thương hiệu trên + pill gợi ý dưới
  voice: { provider: "edge"|"piper"|"mock"|"elevenlabs"|"azure"|"google",
           voiceId, speed=1, pitch?, pronunciations?: {from: to} }
  captions: { style: "auto"|"clean-minimal"|"tiktok-bold"|"outline-pop"|"chip-glow"|"tech"|"claude",
              //   "auto" = MẶC ĐỊNH, đi theo theme (tech → khối đặc, claude → chữ tô màu).
              //   `style` quyết định HÌNH DẠNG, theme quyết định MÀU → chọn kiểu nào cũng
              //   không lệch tông. "clean-minimal" = CHỈ tô màu chữ, không nền (nhẹ nhất).
              //   highlightColor chỉ áp cho các kiểu TỰ CHỌN, không áp cho auto/tech/claude.
              position: "lower-third"|"center"|"top",
              maxWordsPerLine=4, highlightColor="#3BE8A0" }
  scenes: [{
    id, narration,                       // narration = lời đọc, bắt buộc
    layout: "hook"|"bullet"|"product"|"compare"|"cta"|"code"|"graphic"|"image"|"illus"|"shot"|"gfx",
    //   "gfx" = ĐỒ HOẠ 3D VẼ NỘI DUNG là chính (media gfx3d) + nhãn nhỏ, ít chữ.
    heading?, icon?,                     // icon = 1 emoji (vd "🚀","🤖") → huy hiệu cạnh tiêu đề
    chips?: string[],                    // hàng nhãn nhỏ dưới tiêu đề — xem mục CHIP bên dưới
    bullets?: string[],                  // bullet có thể mở đầu bằng emoji, vd "🐳 Docker"
    media?: { kind:"pexels-video"|"pexels"|"generate"|"image"|"video"|"color"|"gfx3d", src, fit?, focus? },
    //   "pexels-video"/"video" → chạy FULL-BLEED làm nền cả cảnh (nội dung đè lên trên)
    //   "pexels"/"generate"/"image" → khung ảnh gọn dưới tiêu đề, KHÔNG tràn màn
    emphasis?: string[],                 // cụm từ khoá → tô tím phát sáng trong heading (hook/graphic)
    transitionIn?: "fade"|"slide-left"|"slide-up"|"wipe"|"none"|"zoom"|"blur"|"glow", // zoom/blur/glow = điện ảnh
    tailPadSec?=0.35,
    // chỉ dùng khi layout="code":
    code?, codeTitle?, codeLang?="javascript", codeHighlight?: number[], output?,
    // chỉ dùng khi layout="graphic" (đồ hoạ neon khớp nội dung):
    graphic?: { kind: "bar-chart"|"highlight-timeline"|"steps"|"feature-cards"|"chat-ai"
                     |"device-editor"|"stat-big"|"checklist"|"architecture"|"range-bar",
                subtitle?, labels?: string[], timestamps?: string[], timecode? }
  }]
  music?: { src, volume=0.12, duck=0.25 }
  sfx?:   { enabled=true, volume=0.35 }
}
```

ÂM THANH — **luôn bật cả hai**, video im lặng ngoài giọng đọc nghe ra ngay là nghiệp dư:

```jsonc
"music": { "src": "sfx/ambient-tech.wav", "volume": 0.35, "duck": 0.25 },
"sfx":   { "enabled": true, "volume": 0.35 }
```

- `sfx/ambient-tech.wav` là nền tổng hợp sẵn, KHÔNG bản quyền, lặp liền mạch. Dùng mặc
  định cho video công nghệ. Muốn nhạc khác thì bỏ file vào `public/audio/` rồi trỏ vào.
- `duck` = mức nhạc còn lại khi có giọng đọc. `0.25` là chuẩn; hạ xuống `0.15` nếu nhạc
  chọn có nhiều tần số trung (đàn, giọng hát) vì nó tranh dải với lời.
- Tiếng chuyển cảnh tự chọn theo `transitionIn`, không cần khai báo gì thêm. Cảnh đầu
  tiên cố ý không có tiếng — chưa chuyển từ đâu cả.

WIDGET ĐỒ HOẠ (layout `graphic`) — chọn theo BẢN CHẤT dữ liệu, đừng chọn theo cảm tính:

| `graphic.kind` | Dùng khi | Cách nhập `labels` |
|---|---|---|
| `stat-big` | MỘT số liệu đáng nhớ | `"giá trị:diễn giải"` — vd `"73%:Tin tuyển dụng yêu cầu AI"`, `"3.5x:Nhanh hơn"` |
| `bar-chart` | So sánh SỐ LIỆU giữa các mục | `"Tên:giá trị đơn vị"` — vd `"Trước tối ưu:48 s"`, `"Tốc độ:92%"` |
| `bar-chart-3d` | Như `bar-chart` nhưng CỘT 3D THẬT (WebGL, có chiều sâu + đổ bóng) | Y HỆT `bar-chart` (`"Tên:giá trị đơn vị"`). Dùng khi muốn cảnh số liệu "nặng đô" hơn; cột cuối tự phát sáng |
| `illus-orbit` | MINH HOẠ ĐỘNG: một thứ ở TRUNG TÂM nối/điều khiển nhiều thứ khác (quay liên tục, năng lượng chạy) | `labels[0]` = hub giữa, `labels[1..]` = vệ tinh (3–6). Vd `["@brain Mô hình AI","@code Viết code","@bug Tìm lỗi","@chat Trả lời"]`. Dùng khi nội dung là "một cái lõi, nhiều nhánh" — thứ chữ/bullet nói không gọn |
| `illus-flow` | MINH HOẠ ĐỘNG: một thứ DI CHUYỂN qua các chặng A→B→C (gói chạy dọc ray, chặng bừng sáng khi gói tới) | mỗi chặng một nhãn (2–4), vd `["@file Code","@boxes Staging","@git Commit","@cloud GitHub"]`. Hợp quy trình/hành trình. Khác `steps` (đánh số, tĩnh) và `architecture` (sơ đồ tĩnh) ở chỗ có VẬT di chuyển |
| `illus-compare` | MINH HOẠ ĐỘNG: vế cũ/vấn đề BIẾN THÀNH vế mới/giải pháp (cũ mờ+✕, mới sáng+✓, mũi tên ở giữa) | ĐÚNG 2 nhãn: `labels[0]`=cũ, `labels[1]`=mới. Vd `["@x-circle Cách cũ: chậm","@zap Cách mới: nhanh"]`. Hợp trước/sau, vấn đề/giải pháp |
| `illus-build` | MINH HOẠ ĐỘNG: các lớp/mảnh GHÉP LẠI thành một khối (bay vào xen kẽ + vệt sáng quét lên) | mỗi lớp một nhãn (2–4), viết trên→dưới. Vd `["@monitor Giao diện","@server Máy chủ","@db Cơ sở dữ liệu"]`. Hợp "X gồm những gì / cấu thành từ gì" |
| `illus-hero` | MINH HOẠ ĐỘNG: một CHỦ THỂ lớn ở giữa + bối cảnh trôi quanh (gần cảm giác "cảnh phim") | `labels[0]`=chủ thể, `labels[1..]`=bối cảnh (3–5). Vd `["@mobile Điện thoại","@idea Đèn","@lock Khoá","@eye Camera"]`. Hợp "một thứ và thế giới quanh nó" |
| `range-bar` | Giá trị là một KHOẢNG | `"Tên:min-max đơn vị"` — vd `"Junior:12-20 triệu"` |
| `checklist` | Nên / KHÔNG nên | `"+ Việc nên làm"` · `"- Việc nên tránh"` |
| `steps` | Quy trình CÓ THỨ TỰ | mỗi bước một chuỗi; nút tự đánh số 01/02/03 |
| `architecture` | Các thành phần NỐI với nhau | `"@server API"`; dùng `" + "` cho 2 thành phần CÙNG tầng |
| `highlight-timeline` | Các mốc THỜI GIAN | nội dung mốc; kèm `timestamps` cùng số lượng, vd `["00:00","00:04"]`. **Không dùng dấu PHẨY trong `timestamps`** (`"0,2 s"` sẽ bị Studio cắt làm đôi) — viết `"0.2 s"` |
| `feature-cards` | Liệt kê ngang hàng | mỗi mục một chuỗi, mở đầu bằng icon nếu muốn |
| `chat-ai` | Hội thoại | `"u:câu người dùng"` / `"a:câu trợ lý"` |
| `device-editor` | Máy ĐANG XỬ LÝ (dựng phim, build, chạy local) | không dùng `labels`; đặt `timecode` |

CHỌN GIỮA MẤY CÁI HAY NHẦM:
- Một con số → `stat-big`. Nhiều con số so với nhau → `bar-chart`. Con số là khoảng
  min–max → `range-bar` (đừng ép về bar-chart, làm thế là vứt mất biên độ).
- Có thứ tự thời gian/bước → `steps`. Có phán xét đúng-sai → `checklist`. Ngang hàng,
  không thứ tự → `feature-cards`. Nối với nhau bằng luồng dữ liệu → `architecture`.

MINH HOẠ ĐỘNG (`illus-*`) — ƯU TIÊN dùng khi cảnh nói về một KHÁI NIỆM/QUAN HỆ chứ không
phải số liệu hay danh sách. Đây là cách làm video "như hoạt hình để minh hoạ" thay vì chỉ
hiện chữ: chúng CHUYỂN ĐỘNG LIÊN TỤC (quay/chảy/lắp ghép/trôi) nên mắt xem ra ngay là
video, không phải slide. Bản đồ chọn nhanh:
- "một lõi, nhiều nhánh / kết nối" → `illus-orbit`
- "đi qua từng chặng, một thứ di chuyển" → `illus-flow`
- "trước vs sau, vấn đề → giải pháp" → `illus-compare`
- "X gồm/được tạo từ những phần nào" → `illus-build`
- "một chủ thể cụ thể và mọi thứ quanh nó" → `illus-hero`
Một video tốt nên XEN KẼ cảnh minh hoạ động (`illus-*`) với cảnh số liệu (`stat-big`,
`bar-chart`…) và cảnh chữ — đừng để cả video chỉ toàn một loại. Icon trong `labels` dùng
cú pháp `"@tên Chữ"` (xem bảng icon), nó tự tô theo màu nhấn của theme.

CHIP (`scene.chips`) — HÀNG NHÃN NHỎ dưới tiêu đề, dùng được ở MỌI layout:

```jsonc
"chips": ["@star 75.868 sao", "MIT", "@code Python",
          "* @flame 9,2K fork", "$ docker compose up -d"]
```

| Cú pháp | Kết quả |
|---|---|
| `"@star 75.868 sao"` | chip thường, có icon |
| `"MIT"` | chip thường, không icon |
| `"* @flame 9,2K fork"` | chip NHẤN — viền + chữ màu nhấn |
| `"$ docker compose up -d"` | chip TERMINAL — nền tối, chữ mono |

Đây là thứ tạo MẬT ĐỘ: một khung vừa có tiêu đề lớn vừa có siêu dữ liệu bên dưới, người
lướt qua cảm được ngay là video có thông tin. Dùng cho số liệu ĐẾM ĐƯỢC và sự thật kiểm
chứng được (số sao GitHub, giấy phép, ngôn ngữ, phiên bản, lệnh chạy) — **không** dùng để
nhét thống kê bịa (xem mục KHÔNG BỊA SỐ LIỆU).

Giới hạn 3–5 chip mỗi cảnh; nhiều hơn thì tràn thành 3 dòng và át mất tiêu đề. Chip là
chú thích, không phải nội dung chính — nội dung chính là `heading` và widget.

ICON (`feature-cards`, `architecture`, `chips`): viết `"@tên Chữ"` để dùng icon vector — nó tô
theo màu nhấn của theme. Emoji `"⚡ Chữ"` vẫn chạy nhưng màu cố định, dễ lạc tông. Tên
icon hợp lệ: `code terminal bug file git package layers boxes cpu db server cloud network
lock shield globe mobile monitor settings wrench gauge ai brain chat send zap rocket flame
star award target play eye search filter check check-circle x x-circle warn idea money
trend-up trend-down users user clock calendar book grad work`. Gõ sai tên thì chữ "@abc"
sẽ hiện nguyên trong video — không crash, nhưng nhìn là biết sai.

Ghi chú về `bar-chart` và `range-bar`: thanh dài nhất chuẩn hoá về gần hết bề ngang (so
sánh TƯƠNG ĐỐI, không phải thang 100), và **hàng CUỐI là điểm nhấn** — nên xếp dữ liệu
theo mạch "trước → sau" / "thấp → cao" để con số đáng nhớ nằm cuối. Số tự đếm lên.

Giới hạn số mục để chữ còn to: `stat-big` 1 mục (tối đa 3) · `bar-chart` 2–4 hàng ·
`range-bar` 2–4 hàng · `checklist` 3–4 mục · `architecture` 3–4 tầng · `steps` 3 bước ·
`highlight-timeline` 3–4 mốc · `feature-cards` 3–4 thẻ (từ 5 thẻ trở lên tự xếp 2 cột và
chữ nhỏ đi một nấc — chỉ dùng khi thật sự cần).

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

Nền `spider`/`aurora`/`solid` là các nền CŨ, giữ lại cho spec cũ chạy được. Đừng chọn cho
video mới — chúng không có Palette riêng nên phần chữ vẫn mượn của `claude-dark`, kém đồng
bộ hơn `tech` hẳn một bậc.

Quy ước layout:
- `hook`: chữ lớn giữa màn — `heading` ngắn cực mạnh.
- `product`: nền ảnh sản phẩm (Ken Burns) + `heading` overlay; đặt `media.kind:"image"` với
  `src` là URL ảnh, hoặc `"color"` với mã màu nếu chưa có ảnh.

CODE (dạy lập trình): đặt `layout:"code"` với các field:
- `code`: mã nguồn (dùng `\n` xuống dòng). GIỮ NGẮN: tối đa ~6-9 dòng, mỗi dòng ≤ 37 ký tự.
- `codeTitle`: tên file trên thanh cửa sổ (vd `"map.js"`).
- `codeHighlight`: mảng số dòng (1-indexed) cần tô sáng, vd `[2]` — dòng khác sẽ mờ.
- `output`: kết quả console (chuỗi, có thể nhiều dòng) — hiện ở panel dưới, là khoảnh khắc "à há".
- `codeLang`: mặc định "javascript".
- `heading`: tiêu đề ngắn của khái niệm (vd `"map — biến đổi mỗi phần tử"`).
`narration` = lời GIẢI THÍCH (không đọc code). Mỗi cảnh code chỉ 1 khái niệm. Với từ tiếng
Anh (map/filter/const…) nên thêm `voice.pronunciations` để đọc đỡ trật.

Dòng code KHÔNG tự xuống dòng — dòng dài quá 37 ký tự sẽ bị cắt cụt ở mép phải.

NỀN ĐỒ HOẠ 3D (`media.kind: "gfx3d"`) — ĐỒ HOẠ 3D TOÀN MÀN, HOẠT HÌNH, KHÔNG cần ảnh:
Dùng cho cảnh KHÁI NIỆM (không cần ảnh/video thật) mà vẫn muốn nền động, dày, hiện đại. Đặt
dưới BẤT KỲ layout nhiều chữ nào (`bullet`, `graphic`, `hook`, `cta`) → nền 3D chạy sau, chữ
đè lên. `src` CHỌN SCENE KHỚP NỘI DUNG đang nói (đây là điểm mấu chốt — đừng chọn bừa):

| `src` | Dùng khi nội dung nói về | Scene |
|---|---|---|
| `"network"` | kết nối, hệ thống, mạng lưới, "mọi thứ liên quan nhau" | đồ thị 3D nhiều nút nối nhau |
| `"particles"` | dữ liệu, quy mô lớn, dòng chảy, "hàng triệu…" | biển hạt trôi |
| `"bars3d"` | tăng trưởng, so sánh, số liệu theo thời gian | rừng cột 3D mọc theo sóng |
| `"globe"` | toàn cầu, phủ rộng, quốc tế, nhiều nơi | quả cầu lưới xoay |
| `"orbit"` | một lõi điều phối/kết nối nhiều thứ quay quanh | lõi + vành + vệ tinh 3D |
| `"float"` | chung chung (không scene nào khớp hơn) | khối toon trôi |

CHỦ THỂ VẼ ĐÚNG NỘI DUNG (3D dựng tay, literal — dùng khi nói tới đúng vật/người đó):

| `src` | Vẽ ra | Dùng khi nói về |
|---|---|---|
| `"coder"` | người ngồi gõ laptop (màn sáng, tay gõ) | lập trình, làm việc máy tính, dân IT |
| `"walk"` | người đi bộ (nhìn nghiêng, sải bước) | hành trình, tìm việc, bước tiếp, đi làm |
| `"rocket"` | tên lửa phóng (lửa + khói) | bứt phá, khởi nghiệp, tăng tốc, ra mắt |
| `"phone"` | điện thoại (màn sáng + icon bay) | app, mạng xã hội, thông báo, mobile |
| `"brain"` | bộ não phát sáng + nơ-ron | tư duy, AI, kỹ năng, học hỏi |
| `"idea"` | bóng đèn sáng + tia | ý tưởng, sáng tạo, giải pháp, "à há" |
| `"money"` | chồng xu vàng + đồng bay | lương, tiền, thu nhập, tài chính |
| `"gear"` | hai bánh răng lồng nhau quay | quy trình, cơ chế, cách vận hành |
| `"building"` | dãy toà nhà văn phòng đèn sáng | công ty, doanh nghiệp, thành phố, công sở |

Chủ thể literal hợp nhất với **`layout: "gfx"`** (3D là chính + 1 nhãn nhỏ + phụ đề, ít chữ).
Muốn kèm nhiều chữ thì đặt gfx3d dưới `bullet`/`graphic` như các `src` trừu tượng ở trên.

- KHÔNG cần `src` là từ khoá/ảnh — chỉ là TÊN scene ở trên. Không tải gì, vẽ 3D lúc render.
- Màu tự lấy theo theme (`meta.background`). Khung nên DÀY: kèm `heading` + `bullets` (2–3) +
  `chips` để không trống. Mẫu: `specs/demo-gfx3d-lib.json`.
- KHÁC ảnh AI/khung phim: gfx3d là đồ hoạ 3D thuần, miễn phí, không cần mạng, không lệ thuộc
  Pollinations. Cần ẢNH THẬT thì mới dùng `pexels`/`pexels-video`.

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
  `image` (khung), `illus` (khung lớn ĐỘNG — xem dưới) hoặc `product` (nền toàn màn).
  - **KHÔNG cần tả style/màu trong prompt**: pipeline TỰ KHOÁ style theo `meta.background`
    (tech → nền tối xanh teal; claude → nâu ấm) và tự cấm chữ trong ảnh, nên MỌI ảnh AI trong
    một video ăn cùng một tông. Chỉ tả NỘI DUNG cảnh (ai, làm gì, ở đâu).

- **`illus` — MINH HOẠ ẢNH AI LÀM "SỐNG" (fallback cho MỌI chủ đề ngoài thư viện `illus-*`)**:
  `layout: "illus"` + `media.kind: "generate"` (prompt tiếng Anh tả cảnh). Ảnh AI hiện to,
  được làm động bằng Ken Burns + nghiêng parallax 2.5D + vệt sáng quét + khung glow → đọc ra
  là video chứ không phải ảnh dán. Dùng khi cảnh cần MINH HOẠ một cảnh/tình huống cụ thể mà
  không có widget `illus-*` vẽ tay nào hợp (vd "một người ngồi lo lắng trước màn hình phỏng
  vấn"). Đây là cách "minh hoạ như hoạt hình" cho chủ đề tự do. XEN KẼ với `illus-*` vẽ tay
  và cảnh số liệu để video không đơn điệu. Mẫu: `specs/demo-illus-ai.json`.

- `bullet`: `bullets[]` hiện lần lượt. 2–4 dòng, mỗi dòng ngắn.
- `compare`: chia đôi trên/dưới, dùng `bullets[0]` vs `bullets[1]`.
- `cta`: nút kêu gọi — `heading` có emoji càng tốt.

KHUNG PHIM (`layout: "shot"`) — KỂ CHUYỆN kiểu ĐIỆN ẢNH thay vì "slide đồ hoạ":
Dùng khi muốn video *có chất phim* (chủ thể, cảm xúc, cú máy) chứ không phải infographic.
Ảnh AI điện ảnh chạy FULL-BLEED + máy quay chuyển động thật + grade + vignette + phụ đề tối
giản (KHÔNG tiêu đề to / bullet). Có HAI tầng:

1) **`meta.story`** — SỢI CHỈ cho CẢ video (thứ biến các shot rời thành CÂU CHUYỆN):
```jsonc
"story": {
  "logline": "1 câu: ai, muốn gì, vướng gì",
  "protagonist": "mô tả nhân vật CỐ ĐỊNH bằng tiếng Anh — đưa vào mọi shot cho nhất quán.
                  MẸO: tả 'seen from behind' / bóng đổ / bàn tay để khỏi lệ thuộc khuôn mặt
                  (model free không giữ được mặt giống nhau)",
  "look": "khoá phong cách hình tiếng Anh: tông màu + kiểu phim + ống kính
           (vd 'teal and amber grade, 35mm anamorphic, film grain')"
}
```

2) **`scene.shot`** — công thức từng khung (mô tả bằng **tiếng Anh** để sinh ảnh):
```jsonc
{ "id": "s1", "layout": "shot",
  "narration": "lời kể tiếng Việt (TTS + phụ đề)",
  "shot": {
    "beat": "shot này đẩy chuyện tới đâu (ghi chú, không lên hình)",
    "subject": "ai/cái gì trong khung",
    "action": "đang LÀM gì (động từ)",
    "emotion": "cảm xúc chủ đạo",
    "world": "bối cảnh, giờ, thời tiết",
    "light": "nguồn + hướng + mood (vd 'golden sunrise backlight, lens flare')",
    "composition": "bố cục (vd 'subject small in lower third, leading lines')",
    "camera": { "shot": "wide|medium|close|extreme-close",
                "move": "dolly-in|dolly-out|pan-left|pan-right|crane-up|crane-down|handheld|static" }
  },
  "transitionIn": "fade" }
```
- KHÔNG cần tả style/màu trong từng shot — `meta.story.look` + `protagonist` tự nhét vào.
- CUNG CẢM XÚC bằng ÁNH SÁNG: lạnh (áp lực) → xám (bế tắc) → vàng ấm (hy vọng). Đây là
  cách "kể" mạnh nhất, mạnh hơn mọi dòng chữ.
- Chọn `camera.move` theo cảm xúc: `dolly-in` dồn nén, `handheld` bất an, `crane-up` mở ra
  hy vọng, `static`/`dolly-out` tĩnh lặng.
- Ít chữ: để `heading` trống, chỉ có phụ đề. Nên đặt `captions.style:"clean-minimal"`,
  `sfx.enabled:false` (dissolve phim không cần tiếng whoosh).
- Đây là ẢNH TĨNH được diễn hoạt (chưa phải video quay thật) — nhân vật đứng yên, chỉ máy
  quay động. Mẫu đầy đủ: `specs/demo-cinematic.json`.

Provider giọng đọc (pitch = có đổi được cao độ không):
- `"piper"` — **MẶC ĐỊNH**. Local, miễn phí, offline, không key, **dùng thương mại được**.
  **Đổi được pitch** (dịch hậu kỳ bằng ffmpeg). Không có word-timing (phụ đề chia đều →
  viết câu ngắn). Giọng ở `tools/piper/voices/`: `tranthanh3870` (đang dùng), `adam1`,
  `maiphuong`, `ngochuyen`, `ngochuyennew`, `phuongtrang`, `vi_VN-vais1000-medium`,
  `vi_VN-25hours_single-low`, `vi_VN-vivos-x_low`.
- `"edge"` — miễn phí, không key, giọng vi-VN tự nhiên, **đổi được pitch**, có word-timing
  (phụ đề khớp chuẩn). Cần mạng. ⚠️ Không có giấy phép thương mại rõ ràng — **đừng dùng cho
  video kiếm tiền**. `vi-VN-NamMinhNeural`, `vi-VN-HoaiMyNeural`.
- `"elevenlabs"` — chất lượng cao nhất, có timestamp + **đổi được pitch**. Cần key (trả phí).
- `"azure"` — giọng vi-VN tốt, **đổi được pitch**. Cần key+region.
- `"mock"` — giọng im lặng; CHỈ để test nhanh timing/caption offline, đừng giao bản mock.
- `"google"` — giọng vi-VN ổn, KHÔNG đổi được pitch, KHÔNG có timestamp. Cần key.

Xem danh sách: `pnpm video voices`.

## Ví dụ 1 — TỪ CHỦ ĐỀ TRẦN (ca hay gặp nhất)

Brief người dùng gõ, đúng một câu:

> *hãy tạo video hướng dẫn up code lên GitHub*

Không có giọng, không có nền, không có số liệu, không nói mấy cảnh. **Không hỏi lại** — áp
MẶC ĐỊNH DỰ ÁN, tự viết kịch bản, và vì brief không cho số liệu nên **không có widget số**
(`stat-big`/`bar-chart`/`range-bar`); dùng `architecture` + `code` + `checklist` để chở
kiến thức. Ghi ra `specs/up-code-len-github.json`:

```json
{
  "meta": { "title": "Up code lên GitHub trong 4 lệnh", "template": "CodeExplainer",
            "width": 1080, "height": 1920, "fps": 30, "locale": "vi-VN",
            "background": "tech" },
  "voice": { "provider": "piper", "voiceId": "tranthanh3870", "speed": 1.6, "pitch": 3,
             "pronunciations": { "GitHub": "Git Háp", "commit": "cơ mít", "push": "pút",
                                 "remote": "ri mốt", "staging": "sờ tây ging" } },
  "captions": { "style": "auto", "position": "lower-third",
                "maxWordsPerLine": 4, "highlightColor": "#3BE8A0" },
  "music": { "src": "sfx/ambient-tech.wav", "volume": 0.3, "duck": 0.25 },
  "sfx": { "enabled": true, "volume": 0.35 },
  "scenes": [
    { "id": "s1", "layout": "hook", "heading": "Git — Bốn lệnh là xong",
      "emphasis": ["Bốn lệnh"],
      "narration": "Đa số người mới sợ Git vì tưởng phải học hai mươi lệnh. Thật ra up code lên GitHub chỉ cần bốn.",
      "media": { "kind": "pexels-video", "src": "hands typing keyboard night closeup" },
      "transitionIn": "zoom" },

    { "id": "s2", "layout": "graphic", "heading": "Code của bạn đi qua bốn chỗ",
      "narration": "Hiểu được đường đi này thì bốn lệnh kia tự khắc có nghĩa, không cần học thuộc.",
      "emphasis": ["đường đi"],
      "graphic": { "kind": "architecture", "subtitle": "Mỗi lệnh đẩy code sang một chặng",
                   "labels": ["@file Thư mục làm việc", "@boxes Staging", "@git Repo dưới máy", "@cloud GitHub"] },
      "transitionIn": "blur" },

    { "id": "s3", "layout": "code", "heading": "Bước 1 — Đánh dấu và ghi lại",
      "narration": "Lệnh add đưa file vào vùng chờ. Lệnh commit chốt lại thành một mốc có tên.",
      "codeTitle": "terminal", "codeLang": "bash",
      "code": "git init\ngit add .\ngit commit -m \"lần đầu\"",
      "codeHighlight": [2, 3],
      "output": "3 files changed, 128 insertions(+)",
      "transitionIn": "slide-up" },

    { "id": "s4", "layout": "code", "heading": "Bước 2 — Nối và đẩy lên",
      "narration": "Khai báo địa chỉ kho trên GitHub, rồi đẩy toàn bộ mốc đã chốt lên đó.",
      "codeTitle": "terminal", "codeLang": "bash",
      "code": "git remote add origin <URL>\ngit push -u origin main",
      "codeHighlight": [2],
      "output": "branch 'main' set up to track 'origin/main'",
      "transitionIn": "slide-up" },

    { "id": "s5", "layout": "graphic", "heading": "Ba lỗi khiến bạn kẹt cả buổi",
      "narration": "Ba lỗi này người mới nào cũng dính, và cả ba đều tránh được trong ba mươi giây.",
      "emphasis": ["cả ba đều tránh được"],
      "graphic": { "kind": "checklist", "subtitle": "Làm trước khi gõ lệnh đầu tiên",
                   "labels": ["+ Tạo .gitignore trước khi add",
                              "+ Đặt tên commit nói rõ đã làm gì",
                              "- Push thẳng file .env lên",
                              "- Commit cả thư mục node_modules"] },
      "transitionIn": "slide-up" },

    { "id": "s6", "layout": "graphic", "heading": "Từ lần thứ hai trở đi",
      "narration": "Những lần sau chỉ còn ba lệnh, và bạn sẽ gõ chúng tới hết đời làm nghề.",
      "graphic": { "kind": "steps", "subtitle": "Vòng lặp hằng ngày",
                   "labels": ["git add .", "git commit -m \"sửa gì đó\"", "git push"] },
      "transitionIn": "fade" },

    { "id": "s7", "layout": "cta", "heading": "Tập sau — Sửa khi push bị từ chối",
      "emphasis": ["push bị từ chối"],
      "narration": "Tập sau mình sẽ xử lý lỗi mà ai cũng gặp lần đầu: push lên thì bị từ chối.",
      "media": { "kind": "pexels-video", "src": "developer thinking at desk office" },
      "transitionIn": "zoom" }
  ]
}
```

Rồi chạy `pnpm video render specs/up-code-len-github.json` và báo đường dẫn MP4.

Để ý mấy quyết định trong ví dụ này — đó là thứ cần bắt chước:
- **Không con số nào** vì brief không cho. Hook dùng nghịch lý ("tưởng hai mươi lệnh, thật ra bốn") thay vì thống kê bịa.
- `architecture` đặt ở cảnh 2, TRƯỚC hai cảnh code: cho mô hình tư duy trước rồi mới đến cú pháp.
- `heading` dạng `"Bước 1 — …"` để tự tách thành nhãn nhỏ + tiêu đề.
- `pronunciations` cho mọi từ tiếng Anh sẽ đọc lên.
- Cảnh code KHÔNG có `media` — cửa sổ IDE đã là nội dung chính.
- Cảnh cuối dẫn sang tập sau để giữ người xem.

## Ví dụ 2 — ProductReview (affiliate)

```json
{
  "meta": { "title": "Tai nghe SoundPro X2 có đáng mua", "template": "ProductReview",
            "width": 1080, "height": 1920, "fps": 30, "locale": "vi-VN",
            "background": "claude-dark" },
  "voice": { "provider": "piper", "voiceId": "maiphuong", "speed": 1.4,
             "pronunciations": { "SoundPro": "sao prô", "X2": "ích hai" } },
  "captions": { "style": "auto", "position": "lower-third", "maxWordsPerLine": 4 },
  "music": { "src": "sfx/ambient-tech.wav", "volume": 0.3, "duck": 0.25 },
  "sfx": { "enabled": true, "volume": 0.35 },
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

## Ví dụ 3 — ListicleTop5

```json
{
  "meta": { "title": "Top 5 app học tiếng Anh miễn phí", "template": "ListicleTop5",
            "width": 1080, "height": 1920, "fps": 30, "locale": "vi-VN",
            "background": "tech" },
  "voice": { "provider": "piper", "voiceId": "adam1", "speed": 1.5 },
  "captions": { "style": "auto", "position": "lower-third", "maxWordsPerLine": 3 },
  "music": { "src": "sfx/ambient-tech.wav", "volume": 0.3, "duck": 0.25 },
  "sfx": { "enabled": true, "volume": 0.35 },
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

Mẫu dùng đủ 6 widget mới trong repo: `specs/demo-widget-moi.json`.

## Kiểm tra trước khi giao

- **Có con số nào tôi tự nghĩ ra không?** Nếu có mà brief không đưa → bỏ hoặc đổi widget.
  Đây là mục quan trọng nhất trong danh sách này.
- Hook có giật không? Đọc narration scene đầu lên xem có muốn xem tiếp không.
- Tổng thời lượng 30–45s (chạy `pnpm video build` rồi xem log số frame ÷ fps).
- Có `music` + `sfx` chưa? Thiếu là video nghe ra ngay là nghiệp dư.
- Số tiền/%/tên riêng đã đúng (chạy `pnpm video demo-tts "<câu>"` để nghe thử cách đọc).
- Dòng `code` nào dài quá 37 ký tự không? Nó sẽ bị cắt mất ở mép phải.

## Tuân thủ (video affiliate)

- Gắn nhãn nội dung AI theo quy định nền tảng.
- Không dựng lời chứng thực giả.
- Công khai link tiếp thị liên kết.
