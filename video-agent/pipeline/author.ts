import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { videoSpecSchema, type VideoSpec } from "../src/schema.ts";
import { lintSpec, ICON_LIST, MAX_CODE_LINE, MAX_OUTPUT_LINE } from "./lint.ts";
import { chat, type LlmConfig } from "./llm.ts";
import { fitFor, type ArticleSource } from "./article.ts";

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
    '- `feature-cards`, `architecture`: `"@icon Nội dung"` — CHỈ hai widget này hiểu `@icon`.',
    '- `steps`, `highlight-timeline`: CHỮ TRƠN `"Nội dung"`, KHÔNG có `@icon` (widget tự đánh số;',
    "  ghi `@icon` là nó hiện nguyên chữ `@grad` lên màn hình).",
    '- `checklist`: bắt buộc mở đầu `"+ "` (nên làm) hoặc `"- "` (nên tránh), sau đó là chữ trơn.',
    '- `stat-big`: `"73%:Mô tả con số"`.',
    '- `bar-chart`: `"Nhãn:35"` (giá trị là số).',
    '- `range-bar`: `"Nhãn:khoảng giá trị"` (vd `"Junior:12-20 triệu"`).',
    '- `chat-ai`: `"u:câu người hỏi"` / `"a:câu máy trả lời"`.',
    "- `device-editor`: không dùng `labels`, chỉ `timecode`.",
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
  throw new Error(`JSON bị cắt giữa chừng (thiếu dấu đóng). Thử lại, hoặc chọn model mạnh hơn trong ⚙️ Cài đặt AI.`);
}

export type VisualStyle = VideoSpec["meta"]["visualStyle"];

/**
 * Chỉ dẫn theo KIỂU HÌNH ẢNH người dùng chọn trên giao diện.
 *
 * Để trong lời nhắn người dùng chứ không nhét vào system prompt: system prompt (SKILL.md)
 * giữ nguyên giữa mọi lượt gọi, phần thay đổi theo lựa chọn thì để ở phần thay đổi.
 */
function styleBrief(style: VisualStyle, fromArticle = false): string {
  if (style === "photo") {
    const lines = [
      '## Kiểu hình ảnh: CHỈ ẢNH — đặt `meta.visualStyle: "photo"`',
      "",
      "Trên màn hình CHỈ CÓ ẢNH GỐC + PHỤ ĐỀ LỜI KỂ. Không tiêu đề chữ to, không gạch đầu dòng,",
      "không thẻ, không đồ hoạ. Video là một CÂU CHUYỆN được KỂ qua giọng đọc, mỗi cảnh một ảnh.",
      "Luật:",
      fromArticle
        ? '- MỌI cảnh đều có `media: { "kind": "image", "src": "<mã ảnh của bài>" }`.'
        : '- MỌI cảnh đều có `media: { "kind": "pexels", "src": "<từ khoá tiếng Anh>" }`.',
      "- KHÔNG dùng `pexels-video` hay `video`.",
      "- Layout: cảnh đầu `hook`, cảnh cuối `cta`, các cảnh giữa `image`. KHÔNG dùng layout khác.",
      "- KHÔNG có `bullets`, `chips`, `icon`, `graphic`, `code`. Không cần `heading` (không hiển thị).",
      "- TOÀN BỘ nội dung nằm trong `narration`: văn KỂ CHUYỆN liền mạch, cảnh sau nối tiếp cảnh",
      "  trước như một người đang kể — không liệt kê kiểu \"thứ nhất, thứ hai\". Mỗi cảnh 1–3 câu.",
      "- Không cần `emphasis`: nó chỉ tô màu TIÊU ĐỀ, mà chế độ này không có tiêu đề.",
    ];
    if (!fromArticle) {
      lines.push(
        '- Từ khoá ảnh 2–5 từ tiếng Anh, CỤ THỂ, đúng ý cảnh đó (vd "comedian on stage spotlight").',
        "  Mỗi cảnh một từ khoá KHÁC nhau — trùng là hai cảnh ra cùng một ảnh.",
        "- Kho ảnh miễn phí KHÔNG có ảnh người nổi tiếng cụ thể: đừng ghi tên người vào từ khoá,",
        "  hãy tả BỐI CẢNH (sân khấu, micro, khán giả, phim trường, văn phòng…).",
      );
    }
    return lines.join("\n");
  }
  return [
    '## Kiểu hình ảnh: ĐẦY ĐỦ — đặt `meta.visualStyle: "mixed"`',
    "",
    fromArticle
      ? "Cảnh mở và cảnh kết dùng ảnh của bài làm nền, các cảnh giữa dùng ảnh của bài đóng khung,"
      : "Làm như hướng dẫn ở trên: video thật (`pexels-video`) làm nền cảnh mở và cảnh kết, các",
    fromArticle
      ? "xen đồ hoạ khi bài có số liệu hoặc so sánh rõ ràng."
      : "cảnh giữa dùng đồ hoạ, code hoặc ảnh đóng khung tuỳ nội dung.",
  ].join("\n");
}

/** Bài báo dài cỡ nào cũng chỉ gửi chừng này ký tự — đủ cho 6–12 cảnh, không đốt token vô ích. */
const MAX_ARTICLE_CHARS = 14000;

/**
 * Chỉ dẫn khi nguồn là BÀI BÁO: nội dung lấy từ bài, ảnh lấy từ bài.
 *
 * AI tham chiếu ảnh bằng MÃ NGẮN ("anh-3") chứ không phải đường dẫn: mã ngắn khó gõ sai,
 * và chương trình tự đổi mã → đường dẫn thật + cách hiển thị (cover/contain) theo kích
 * thước ảnh — hai thứ AI không nhìn thấy nên không nên để nó quyết.
 */
function articleBrief(src: ArticleSource): string {
  const { article, images } = src;
  let body = article.paragraphs.join("\n\n");
  if (body.length > MAX_ARTICLE_CHARS) body = body.slice(0, MAX_ARTICLE_CHARS) + "\n\n[…bài còn tiếp, đã lược bớt]";
  const outlet = article.siteName;
  const credit = article.source ? `${outlet} (theo ${article.source})` : outlet;

  return [
    "## Nguồn: MỘT BÀI BÁO — dựng video tóm tắt đúng bài này",
    "",
    `Link: ${article.url}`,
    `Tiêu đề: ${article.title}`,
    article.sapo ? `Sapo: ${article.sapo}` : "",
    "",
    '"""',
    body,
    '"""',
    "",
    "### Ảnh của bài (CHỈ được dùng những ảnh này)",
    "",
    ...images.map((im) => {
      const shape = im.height / im.width >= 1.25 ? "dọc" : im.width / im.height >= 1.25 ? "ngang" : "vuông";
      return `- ${im.id} (${shape}): ${im.caption || "(không có chú thích)"}`;
    }),
    "",
    "Luật cho video từ bài báo:",
    "- Kể lại NỘI DUNG CHÍNH của bài theo đúng trình tự hợp lý: mở bằng điều gây tò mò nhất, sau đó",
    "  diễn biến, chi tiết đáng chú ý, cuối cùng là kết/ý nghĩa. 6–12 cảnh tuỳ độ dài bài.",
    "- CHỈ dùng thông tin CÓ TRONG BÀI. Không thêm số liệu, tên, ngày tháng, lời trích dẫn nào bài",
    "  không nói. Tên riêng, con số giữ ĐÚNG như bài.",
    "- Viết lại bằng lời văn kể chuyện của bạn, KHÔNG chép nguyên câu dài của bài.",
    '- Ảnh: `media: { "kind": "image", "src": "anh-N" }` — ghi đúng MÃ ảnh ở danh sách trên. Không',
    "  dùng pexels / pexels-video / generate. Chọn ảnh có chú thích khớp nội dung cảnh. Ưu tiên",
    "  mỗi cảnh một ảnh khác nhau; bài ít ảnh hơn số cảnh thì mới dùng lại.",
    `- Cảnh cuối (cta) nhắc nguồn trong narration, vd "Theo ${credit}."`,
    `- meta.title: tiêu đề ngắn gọn cho video, dựa trên tiêu đề bài.`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export interface AuthorResult {
  spec: VideoSpec;
  attempts: number;
}

/**
 * Đổi mã ảnh "anh-3" → đường dẫn thật trong public/ + cách hiển thị theo kích thước ảnh.
 * Chạy TRƯỚC Zod/lint để lint thấy spec y như lúc render. Trả về các lỗi tham chiếu ảnh.
 */
function resolveArticleImages(parsed: unknown, src: ArticleSource): string[] {
  const problems: string[] = [];
  const byId = new Map(src.images.map((im) => [im.id, im]));
  const byPath = new Map(src.images.map((im) => [im.src, im]));
  const ids = src.images.map((im) => im.id).join(", ");
  const scenes = (parsed as { scenes?: unknown })?.scenes;
  if (!Array.isArray(scenes)) return problems;

  for (const scene of scenes as Array<Record<string, unknown>>) {
    const media = scene?.media as Record<string, unknown> | undefined;
    if (!media || typeof media !== "object") continue;
    const sid = String(scene.id ?? "?");
    if (media.kind === "pexels" || media.kind === "generate" || media.kind === "image") {
      const key = String(media.src ?? "").trim().replace(/\.(jpe?g|png|webp)$/i, "");
      const im = byId.get(key) ?? byPath.get(String(media.src ?? "").trim());
      if (!im) {
        problems.push(`scene "${sid}": ảnh "${media.src}" không có trong bài — chỉ dùng media { "kind": "image", "src": "<mã>" } với mã trong: ${ids}.`);
        continue;
      }
      media.kind = "image";
      media.src = im.src;
      media.fit = fitFor(im.width, im.height);
      media.focus = media.fit === "cover" ? "top" : "center";
    }
  }
  return problems;
}

/** Một lượt kiểm: Zod trước (kiểu), lint sau (cách dùng). Trả về danh sách vấn đề. */
function check(jsonText: string, style: VisualStyle, article?: ArticleSource): { spec?: VideoSpec; problems: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return { problems: [`JSON không parse được: ${(err as Error).message}`] };
  }
  // Lựa chọn của NGƯỜI DÙNG thắng: AI quên ghi hoặc ghi sai visualStyle thì đặt lại, không
  // bắt nó tốn một lượt chỉ để sửa đúng một trường. Lint bên dưới vẫn kiểm NỘI DUNG có
  // khớp kiểu đã chọn không (vd chế độ photo mà cảnh thiếu ảnh).
  const meta = (parsed as { meta?: unknown } | null)?.meta;
  if (meta && typeof meta === "object") (meta as Record<string, unknown>).visualStyle = style;
  const refProblems = article ? resolveArticleImages(parsed, article) : [];
  const res = videoSpecSchema.safeParse(parsed);
  if (!res.success) {
    return {
      problems: [...refProblems, ...res.error.issues.map((i) => `${i.path.join(".") || "(gốc)"}: ${i.message}`)],
    };
  }
  return { spec: res.data, problems: [...refProblems, ...lintSpec(res.data)] };
}

/**
 * authorSpec — brief tiếng Việt → VideoSpec đã hợp lệ.
 *
 * `onProgress` để CLI và server in được tiến độ; không có thì chạy im.
 * `opts.visualStyle`: kiểu hình ảnh người dùng chọn (mặc định "mixed" — như trước giờ).
 */
export async function authorSpec(
  brief: string,
  llm: LlmConfig,
  onProgress: (msg: string) => void = () => {},
  opts: { visualStyle?: VisualStyle; article?: ArticleSource } = {},
): Promise<AuthorResult> {
  const style: VisualStyle = opts.visualStyle ?? "mixed";
  const { article } = opts;
  const system = await buildSystemPrompt();
  const request = article
    ? `${styleBrief(style, true)}\n\n${articleBrief(article)}` +
      (brief.trim() ? `\n\nYêu cầu thêm của người dùng:\n"""\n${brief.trim()}\n"""` : "")
    : `Brief của người dùng:\n\n"""\n${brief.trim()}\n"""\n\n${styleBrief(style)}`;
  let user = `${request}\n\nTrả về DUY NHẤT object JSON của VideoSpec.`;

  const seen: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onProgress(`[viết] lượt ${attempt}/${MAX_ATTEMPTS} — ${llm.provider}/${llm.model}…`);
    const raw = await chat(llm, { system, user });

    let problems: string[];
    let spec: VideoSpec | undefined;
    try {
      ({ spec, problems } = check(extractJson(raw), style, article));
    } catch (err) {
      problems = [(err as Error).message];
    }

    if (spec && problems.length === 0) {
      onProgress(`[viết] ✓ spec hợp lệ (${spec.scenes.length} cảnh)`);
      return { spec, attempts: attempt };
    }

    seen.push(`Lượt ${attempt}:\n${problems.map((p) => `  • ${p}`).join("\n")}`);
    onProgress(`[viết] còn ${problems.length} lỗi, nhắc lại để sửa…`);

    // Gửi lại CHÍNH bản JSON vừa sinh kèm đúng danh sách lỗi: sửa tại chỗ rẻ hơn và giữ
    // được ý tưởng của lượt trước, khác hẳn việc bắt viết lại từ đầu.
    user = [
      request,
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
      `Gợi ý: chọn model mạnh hơn trong ⚙️ Cài đặt AI, hoặc viết yêu cầu cụ thể hơn.`,
  );
}
