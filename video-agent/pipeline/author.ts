import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { videoSpecSchema, type VideoSpec } from "../src/schema.ts";
import { lintSpec, ICON_LIST, MAX_CODE_LINE, MAX_OUTPUT_LINE } from "./lint.ts";
import { chat, resolveLlm, type LlmInfo } from "./llm.ts";

/**
 * author.ts — MỘT CÂU TIẾNG VIỆT → `specs/<slug>.json` hợp lệ.
 *
 * Đây là "nửa sáng tạo" mà trước giờ do người/agent làm tay. Ba điểm thiết kế:
 *
 * 1. LUẬT VIẾT SPEC KHÔNG CHÉP LẠI Ở ĐÂY. Nó nằm trong `.claude/skills/make-video/SKILL.md`
 *    — file đã có sẵn và vẫn đang được agent dùng. Chép sang đây là tạo nguồn luật thứ hai,
 *    rồi hai bên lệch nhau lúc nào không biết. Ở đây chỉ ĐỌC file đó lên làm system prompt.
 *
 * 2. KHÔNG TIN LLM TRẢ ĐÚNG NGAY. Mỗi lần trả về đều đi qua Zod (đúng kiểu) rồi qua
 *    `lintSpec()` (đúng cách dùng: dòng code không quá dài, tên icon có thật, emphasis có
 *    nằm trong câu…). Sai chỗ nào thì nhắc lại ĐÚNG chỗ đó và bảo nó sửa — hiệu quả hơn
 *    nhiều so với bảo "làm lại đi".
 *
 * 3. KHÔNG SỬA THAY NGƯỜI DÙNG. Nếu sau `MAX_ATTEMPTS` lượt vẫn sai thì báo lỗi kèm danh
 *    sách vấn đề, chứ không lặng lẽ vá spec rồi render ra một video sai ý.
 */

const MAX_ATTEMPTS = 3;

const SKILL_PATH = path.resolve(process.cwd(), ".claude", "skills", "make-video", "SKILL.md");

/** Bỏ khối frontmatter YAML ở đầu SKILL.md — nó là siêu dữ liệu cho Claude Code, không phải luật. */
function stripFrontmatter(md: string): string {
  return md.startsWith("---") ? md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "") : md;
}

/**
 * SKILL.md viết cho một agent CÓ TAY: nó bảo "chạy pnpm video render", "báo đường dẫn MP4",
 * "hỏi lại nếu chủ đề mơ hồ". LLM ở đây không chạy được lệnh và không hỏi lại được — nó chỉ
 * trả về JSON. Phần ghi đè này đặt SAU toàn văn SKILL.md nên nó thắng mọi câu trái ngược
 * ở trên.
 */
function overrides(): string {
  return [
    "",
    "---",
    "",
    "# GHI ĐÈ — ĐỌC KỸ, PHẦN NÀY THẮNG MỌI CÂU Ở TRÊN",
    "",
    "Bạn KHÔNG chạy được lệnh, KHÔNG đọc được file, KHÔNG hỏi lại được người dùng.",
    "Mọi câu ở trên bảo bạn chạy `pnpm video ...`, kiểm tra log, hay hỏi lại — BỎ QUA.",
    "",
    "Đầu ra của bạn là **DUY NHẤT một object JSON** đúng `videoSpecSchema`. Không lời dẫn,",
    "không giải thích, không bọc trong ``` — chỉ JSON, bắt đầu bằng `{` và kết thúc bằng `}`.",
    "",
    "Chủ đề mơ hồ thì TỰ CHỌN cách hiểu phổ biến nhất rồi làm, đừng dừng lại hỏi.",
    "",
    "## Ràng buộc cứng (sai là hỏng hình, không phải chuyện thẩm mỹ)",
    "",
    `- Dòng trong \`code\` tối đa **${MAX_CODE_LINE} ký tự**. Dài hơn là bị CẮT CỤT ở mép phải,`,
    "  không tự xuống dòng. Ngắt dòng thủ công cho vừa.",
    `- Dòng trong \`output\` tối đa **${MAX_OUTPUT_LINE} ký tự**.`,
    "- Cảnh đầu tiên `layout: \"hook\"`, cảnh cuối cùng `layout: \"cta\"`.",
    "- Mỗi cụm trong `emphasis` PHẢI xuất hiện nguyên văn trong `heading` hoặc `narration`",
    "  của chính cảnh đó, nếu không nó không tô được gì.",
    "- `narration` mỗi cảnh dưới 60 từ.",
    "- `heading` không được trùng nhau giữa các cảnh.",
    "",
    "## Tên icon hợp lệ (dùng trong `chips` và `graphic.labels`, cú pháp `@tên Nội dung`)",
    "",
    ICON_LIST,
    "",
    "Chỉ được dùng tên trong danh sách này. Tự nghĩ ra tên khác là nhãn mất icon.",
    "",
    "## Cú pháp `labels` theo từng `graphic.kind`",
    "",
    '- `feature-cards`, `steps`, `architecture`: `"@icon Nội dung"` (steps tự đánh số).',
    '- `checklist`: bắt buộc mở đầu `"+ "` (nên làm) hoặc `"- "` (nên tránh).',
    '- `stat-big`: `"73%:Mô tả con số"`.',
    '- `bar-chart`: `"Nhãn:35"` (giá trị là số).',
    '- `chat-ai`: `"u:câu người hỏi"` / `"a:câu máy trả lời"`.',
    '- `range-bar`, `highlight-timeline`, `device-editor`: `"@icon Nội dung"`.',
    "",
    "## Nhắc lại điều quan trọng nhất",
    "",
    "KHÔNG BỊA SỐ LIỆU. Người dùng chỉ đưa một câu chủ đề — mọi phần trăm, mức lương, thứ",
    "hạng, ngày tháng mà bạn tự nghĩ ra đều là bịa. Không chắc thì đổi sang widget không cần",
    "số (`feature-cards`, `checklist`, `steps`) thay vì `stat-big` hay `bar-chart`.",
  ].join("\n");
}

export async function buildSystemPrompt(): Promise<string> {
  if (!existsSync(SKILL_PATH)) {
    throw new Error(`Không thấy luật viết spec: ${SKILL_PATH}`);
  }
  return stripFrontmatter(await readFile(SKILL_PATH, "utf8")) + overrides();
}

/**
 * Bóc object JSON ra khỏi câu trả lời.
 *
 * Dù đã bật chế độ ép JSON của cả ba nhà cung cấp, model vẫn có lúc bọc ```json hoặc thêm
 * một câu dẫn. Quét theo CẶP NGOẶC CÂN NHAU (có đếm chuỗi và ký tự thoát) thay vì regex
 * tham lam — narration tiếng Việt đầy dấu ngoặc và dấu nháy, regex sẽ cắt nhầm.
 */
export function extractJson(raw: string): string {
  const text = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const start = text.indexOf("{");
  if (start < 0) throw new Error(`Không tìm thấy JSON trong câu trả lời:\n${raw.slice(0, 400)}`);

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`JSON bị cắt giữa chừng (thiếu dấu đóng). Thử tăng LLM_MODEL hoặc rút ngắn brief.`);
}

export interface AuthorResult {
  spec: VideoSpec;
  llm: LlmInfo;
  attempts: number;
}

/** Một lượt kiểm: Zod trước (kiểu), lint sau (cách dùng). Trả về danh sách vấn đề. */
function check(jsonText: string): { spec?: VideoSpec; problems: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return { problems: [`JSON không parse được: ${(err as Error).message}`] };
  }
  const res = videoSpecSchema.safeParse(parsed);
  if (!res.success) {
    return {
      problems: res.error.issues.map((i) => `${i.path.join(".") || "(gốc)"}: ${i.message}`),
    };
  }
  return { spec: res.data, problems: lintSpec(res.data) };
}

/**
 * authorSpec — brief tiếng Việt → VideoSpec đã hợp lệ.
 *
 * `onProgress` để CLI và server in được tiến độ; không có thì chạy im.
 */
export async function authorSpec(
  brief: string,
  onProgress: (msg: string) => void = () => {},
): Promise<AuthorResult> {
  const llm = resolveLlm();
  if (!llm) throw new Error("Chưa cấu hình LLM.");

  const system = await buildSystemPrompt();
  let user = `Brief của người dùng:\n\n"""\n${brief.trim()}\n"""\n\nTrả về DUY NHẤT object JSON của VideoSpec.`;

  const seen: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onProgress(`[viết] lượt ${attempt}/${MAX_ATTEMPTS} — ${llm.provider}/${llm.model}…`);
    const raw = await chat({ system, user });

    let problems: string[];
    let spec: VideoSpec | undefined;
    try {
      ({ spec, problems } = check(extractJson(raw)));
    } catch (err) {
      problems = [(err as Error).message];
    }

    if (spec && problems.length === 0) {
      onProgress(`[viết] ✓ spec hợp lệ (${spec.scenes.length} cảnh)`);
      return { spec, llm, attempts: attempt };
    }

    seen.push(`Lượt ${attempt}:\n${problems.map((p) => `  • ${p}`).join("\n")}`);
    onProgress(`[viết] còn ${problems.length} lỗi, nhắc lại để sửa…`);

    // Gửi lại CHÍNH bản JSON vừa sinh kèm đúng danh sách lỗi: sửa tại chỗ rẻ hơn và giữ
    // được ý tưởng của lượt trước, khác hẳn việc bắt viết lại từ đầu.
    user = [
      `Brief của người dùng:\n\n"""\n${brief.trim()}\n"""`,
      ``,
      `Bạn vừa trả về JSON này:`,
      "```json",
      raw.slice(0, 12000),
      "```",
      ``,
      `Nó còn những lỗi sau:`,
      ...problems.map((p) => `  • ${p}`),
      ``,
      `Sửa ĐÚNG những lỗi trên, giữ nguyên phần còn lại. Trả về DUY NHẤT object JSON đã sửa.`,
    ].join("\n");
  }

  throw new Error(
    `Sau ${MAX_ATTEMPTS} lượt vẫn chưa ra spec hợp lệ.\n\n${seen.join("\n\n")}\n\n` +
      `Gợi ý: đặt LLM_MODEL sang model mạnh hơn, hoặc viết brief cụ thể hơn.`,
  );
}
