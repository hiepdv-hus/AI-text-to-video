import type { VideoSpec } from "../src/schema.ts";
import { ICON_NAMES } from "../src/components/claude/Icon.tsx";

/**
 * lint.ts — những luật mà Zod KHÔNG diễn đạt được.
 *
 * Zod chỉ kiểm được kiểu và khoảng giá trị. Nó không biết "dòng code 53 ký tự sẽ bị cắt
 * mất ở mép phải" hay "tên icon @rocket có thật, @rocketship thì không". Đây đúng là
 * những lỗi mà một LLM viết spec hay mắc, và đều là lỗi CHỈ LỘ RA KHI ĐÃ RENDER XONG —
 * tức là sau khi đã tốn vài phút CPU. Bắt ở đây rẻ hơn nhiều.
 *
 * Danh sách trả về được nhét thẳng vào lượt nhắc lại cho LLM tự sửa (xem author.ts).
 */

/**
 * Số ký tự tối đa một dòng code hiển thị được.
 *
 * Tính ra từ layout chứ không ước lượng: khung 1080 − 2×80 lề trang − 2×26 lề panel
 * − 44 cột số dòng − 14 khoảng cách = 810px khả dụng, chia cho bề rộng ký tự mono
 * (36px × 0.6 ≈ 21.6px) → 37 ký tự. Dài hơn là bị CẮT CỤT, không xuống dòng.
 */
export const MAX_CODE_LINE = 37;
/** Panel console rộng hơn (không có cột số dòng) và có xuống dòng, nhưng dài quá thì gãy xấu. */
export const MAX_OUTPUT_LINE = 40;

const ICONS = new Set<string>(ICON_NAMES);

/** Bóc tên icon từ nhãn kiểu "@globe Thời tiết" / "* @flame 9,2K" / "+ @db …". */
function iconOf(label: string): string | null {
  const m = /^(?:[*+\-$]\s+)?@([a-z0-9-]+)\s/i.exec(label);
  return m ? m[1]!.toLowerCase() : null;
}

/** Bỏ dấu để so khớp `emphasis` với narration mà không kẹt vì hoa/thường hay dấu câu. */
const loose = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function lintSpec(spec: VideoSpec): string[] {
  const problems: string[] = [];
  const add = (sceneId: string, msg: string) => problems.push(`scene "${sceneId}": ${msg}`);

  if (spec.scenes.length < 4) problems.push(`Chỉ có ${spec.scenes.length} cảnh — video quá ngắn, cần ít nhất 4.`);
  if (spec.scenes.length > 14) problems.push(`Có ${spec.scenes.length} cảnh — quá dài, tối đa 14.`);

  const ids = new Set<string>();
  const headings = new Set<string>();

  for (const s of spec.scenes) {
    if (ids.has(s.id)) add(s.id, "id bị trùng với cảnh khác.");
    ids.add(s.id);

    if (s.heading) {
      const h = loose(s.heading);
      if (headings.has(h)) add(s.id, `heading trùng với cảnh trước: "${s.heading}".`);
      headings.add(h);
    }

    // Lời thoại dài thì phụ đề karaoke trôi lệch dần so với giọng (piper không trả
    // timing từng từ), và cảnh bị kéo quá lâu so với nhịp video ngắn.
    const words = s.narration.trim().split(/\s+/).length;
    if (words > 60) add(s.id, `narration ${words} từ — quá dài, cắt xuống dưới 60 từ hoặc tách thành hai cảnh.`);

    if (s.layout === "graphic" && !s.graphic) add(s.id, 'layout "graphic" nhưng thiếu trường `graphic`.');
    if (s.layout === "code" && !s.code) add(s.id, 'layout "code" nhưng thiếu trường `code`.');
    if (s.layout === "bullet" && !s.bullets?.length) add(s.id, 'layout "bullet" nhưng thiếu `bullets`.');
    if (s.layout === "compare" && (s.bullets?.length ?? 0) < 2)
      add(s.id, 'layout "compare" cần đúng 2 phần tử trong `bullets` (vế sai trước, vế đúng sau).');

    // Dòng code quá dài — lỗi hay gặp nhất và chỉ lộ ra sau khi render.
    for (const [i, line] of (s.code ?? "").split("\n").entries()) {
      if (line.length > MAX_CODE_LINE)
        add(s.id, `code dòng ${i + 1} dài ${line.length} ký tự (tối đa ${MAX_CODE_LINE}) → sẽ bị cắt: "${line}"`);
    }
    for (const [i, line] of (s.output ?? "").split("\n").entries()) {
      if (line.length > MAX_OUTPUT_LINE)
        add(s.id, `output dòng ${i + 1} dài ${line.length} ký tự (tối đa ${MAX_OUTPUT_LINE}).`);
    }

    // Tên icon phải có thật, nếu không nhãn mất icon và lệch lưới.
    for (const label of [...(s.chips ?? []), ...(s.graphic?.labels ?? [])]) {
      const name = iconOf(label);
      if (name && !ICONS.has(name)) add(s.id, `icon "@${name}" không tồn tại — xem danh sách icon hợp lệ.`);
    }

    // emphasis chỉ có tác dụng khi cụm đó THỰC SỰ nằm trong chữ hiển thị/đọc.
    const hay = `${loose(s.heading ?? "")} ${loose(s.narration)}`;
    for (const em of s.emphasis ?? []) {
      if (em.trim() && !hay.includes(loose(em)))
        add(s.id, `emphasis "${em}" không xuất hiện trong heading lẫn narration → không tô được gì.`);
    }

    // Chỉ feature-cards / architecture (và chips) hiểu cú pháp "@icon". Widget khác gặp
    // "@grad 18 tuổi" là hiện NGUYÊN CHỮ "@grad" lên màn hình — lỗi này đã lọt ra video thật.
    const ICON_WIDGETS = new Set(["feature-cards", "architecture"]);
    if (s.graphic && !ICON_WIDGETS.has(s.graphic.kind)) {
      for (const l of s.graphic.labels ?? []) {
        if (/^(?:[+-]\s+)?@[a-z0-9-]+\s/i.test(l))
          add(s.id, `${s.graphic.kind} không hiểu cú pháp "@icon" — bỏ phần "@…" đi, để chữ trơn: "${l}"`);
      }
    }
    if (s.graphic?.kind === "range-bar") {
      for (const l of s.graphic.labels ?? []) {
        if (!l.includes(":")) add(s.id, `range-bar cần nhãn kiểu "Junior:12-20 triệu": "${l}"`);
      }
    }

    // checklist: phải có tiền tố +/- thì mới biết dấu tick hay dấu chéo.
    if (s.graphic?.kind === "checklist") {
      for (const l of s.graphic.labels ?? []) {
        if (!/^[+-]\s/.test(l)) add(s.id, `checklist cần nhãn bắt đầu bằng "+ " hoặc "- ": "${l}"`);
      }
    }
    // stat-big / bar-chart / chat-ai có cú pháp riêng, sai là widget hiện mặc định.
    if (s.graphic?.kind === "stat-big") {
      for (const l of s.graphic.labels ?? []) {
        if (!/^[^:]+:/.test(l)) add(s.id, `stat-big cần nhãn kiểu "73%:Mô tả": "${l}"`);
      }
    }
    if (s.graphic?.kind === "bar-chart") {
      for (const l of s.graphic.labels ?? []) {
        if (!/^[^:]+:\d+(\.\d+)?$/.test(l)) add(s.id, `bar-chart cần nhãn kiểu "Trước:35": "${l}"`);
      }
    }
    if (s.graphic?.kind === "chat-ai") {
      for (const l of s.graphic.labels ?? []) {
        if (!/^[ua]:/.test(l)) add(s.id, `chat-ai cần nhãn bắt đầu bằng "u:" (người) hoặc "a:" (máy): "${l}"`);
      }
    }
  }

  // Chế độ "chỉ ảnh": ảnh là NỀN của mọi cảnh. Thiếu ảnh ở một cảnh là cảnh đó trơ nền
  // giữa một video toàn ảnh — lộ ngay. Còn lẫn video vào là sai hẳn lựa chọn của người dùng.
  if (spec.meta.visualStyle === "photo") {
    // Chế độ này TRÊN MÀN HÌNH CHỈ CÓ ẢNH GỐC + PHỤ ĐỀ LỜI KỂ. Renderer không vẽ layout nào,
    // nên mọi nội dung nhét vào bullet/thẻ/code đều BIẾN MẤT không báo — bắt ở đây để AI
    // đưa hết nội dung vào lời kể (narration), chỗ duy nhất người xem thấy và nghe.
    const PHOTO_LAYOUTS = new Set(["hook", "image", "cta"]);
    for (const s of spec.scenes) {
      if (!PHOTO_LAYOUTS.has(s.layout))
        add(s.id, `chế độ "chỉ ảnh" không vẽ gì ngoài ảnh — layout "${s.layout}" không dùng được, chỉ hook / image / cta.`);
      if (s.bullets?.length)
        add(s.id, 'chế độ "chỉ ảnh" không có gạch đầu dòng — bỏ `bullets`, kể nội dung đó trong `narration`.');
      if (s.chips?.length) add(s.id, 'chế độ "chỉ ảnh" không dùng `chips` — bỏ đi.');
      if (s.icon) add(s.id, 'chế độ "chỉ ảnh" không dùng `icon` — bỏ đi.');
    }
    for (const s of spec.scenes) {
      const kind = s.media?.kind;
      if (kind === "video" || kind === "pexels-video") {
        add(s.id, `chế độ "chỉ ảnh" không được dùng video (media.kind="${kind}") — đổi sang "pexels".`);
      } else if (!kind || kind === "color") {
        add(s.id, 'chế độ "chỉ ảnh" cần mỗi cảnh một ảnh nền: media { kind: "pexels", src: "<từ khoá tiếng Anh>" }.');
      } else if (!s.media?.src.trim()) {
        add(s.id, "media.src đang trống — cần từ khoá tìm ảnh.");
      }
    }
  }

  // Cảnh đầu nên là hook, cảnh cuối nên là cta — đây là khung của mọi video ngắn.
  if (spec.scenes[0]?.layout !== "hook") problems.push('Cảnh ĐẦU TIÊN phải có layout "hook".');
  if (spec.scenes.at(-1)?.layout !== "cta") problems.push('Cảnh CUỐI CÙNG phải có layout "cta".');

  return problems;
}

/** Danh sách icon hợp lệ, xuống dòng cho gọn — nhét vào system prompt. */
export const ICON_LIST = ICON_NAMES.join(", ");
