import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import type { VideoSpec } from "../src/schema.ts";

/**
 * publish.ts — hỗ trợ ĐĂNG TIKTOK kiểu bán tự động.
 *
 * Không gọi API TikTok (API chính thức cần app đã qua audit + redirect HTTPS).
 * Thay vào đó chuẩn bị sẵn 3 thứ để việc đăng chỉ còn vài giây:
 *   1. Caption + hashtag sinh từ chính VideoSpec (đúng nội dung video).
 *   2. Mở thư mục chứa final.mp4 (đã select sẵn file) để kéo thả.
 *   3. Studio mở tab tiktok.com/upload.
 */

/* ------------------------------ Hashtag ---------------------------------- */

/** Luôn có — hashtag phổ thông giúp video vào phân phối chung. */
const TAG_BASE = ["fyp", "xuhuong", "LearnOnTikTok"];

/** Hashtag theo template của video. */
const TAG_BY_TEMPLATE: Record<VideoSpec["meta"]["template"], string[]> = {
  CodeExplainer: ["laptrinh", "coding", "hoclaptrinh", "devtok"],
  ProductReview: ["review", "danhgia", "reviewsanpham"],
  ListicleTop5: ["top5", "meohay", "tipshay"],
  StoryHook: ["storytime", "chuyenthat"],
};

/**
 * Từ khoá hay gặp → hashtag chuẩn. Dò trên toàn bộ text của spec (tiêu đề +
 * heading + lời đọc + code) nên không cần người dùng gõ tay.
 *
 * CỐ Ý không tự cắt tiêu đề tiếng Việt thành hashtag: tiếng Việt đơn âm nên
 * cắt ra chỉ được #tinh #nang #vong… — vô nghĩa và không ai search.
 */
const TAG_BY_KEYWORD: Array<[RegExp, string]> = [
  [/\bjavascript\b|\bjs\b/i, "javascript"],
  [/\btypescript\b|\bts\b/i, "typescript"],
  [/\breact\b/i, "reactjs"],
  [/\bnode(\.?js)?\b/i, "nodejs"],
  [/\bpython\b/i, "python"],
  [/\bcss\b/i, "css"],
  [/\bhtml\b/i, "html"],
  [/\bsql\b|cơ sở dữ liệu/i, "sql"],
  [/\bgit\b|github/i, "git"],
  [/\bdocker\b/i, "docker"],
  [/\bexcel\b/i, "excel"],
  [/\bchatgpt\b/i, "chatgpt"],
  [/\bclaude\b/i, "claude"],
  // "AI" viết hoa hoặc cụm tiếng Việt — tránh dính từ "ai" (nghĩa là "who").
  [/\bAI\b/, "ai"],
  [/trí tuệ nhân tạo/i, "ai"],
  [/lập trình|học code/i, "hoclaptrinh"],
  [/roadmap|lộ trình/i, "roadmap"],
  [/full ?-?stack/i, "fullstack"],
  [/front ?-?end/i, "frontend"],
  [/back ?-?end/i, "backend"],
  [/phỏng vấn/i, "phongvan"],
  [/tự học/i, "tuhoc"],
  [/sinh viên/i, "sinhvien"],
  [/người mới|newbie|bắt đầu/i, "nguoimoi"],
  [/kiếm tiền|thu nhập|\blương\b/i, "kiemtien"],
];

/** Toàn bộ chữ trong spec — dùng để dò từ khoá. */
function specText(spec: VideoSpec): string {
  const parts = [spec.meta.title];
  for (const s of spec.scenes) {
    parts.push(s.narration, s.heading ?? "", s.code ?? "", ...(s.bullets ?? []));
  }
  return parts.join("\n");
}

/** Đúng 5 hashtag: 2 tag chủ đề + 3 tag cơ bản. Nhiều hơn chỉ làm caption rối. */
const TAG_LIMIT = 5;

export function buildHashtags(spec: VideoSpec): string[] {
  const text = specText(spec);
  const found = TAG_BY_KEYWORD.filter(([re]) => re.test(text)).map(([, tag]) => tag);
  const topical = [...new Set([...found, ...TAG_BY_TEMPLATE[spec.meta.template]])];
  // TAG_BASE luôn được giữ (quan trọng nhất cho reach) → cắt bớt tag chủ đề trước.
  const kept = topical.filter((t) => !TAG_BASE.includes(t)).slice(0, TAG_LIMIT - TAG_BASE.length);
  return [...kept, ...TAG_BASE];
}

/* ------------------------------ Caption ---------------------------------- */

/** TikTok cho tối đa 2200 ký tự caption (tính cả hashtag). Chừa biên an toàn. */
const CAPTION_LIMIT = 2200;

function firstSentence(s: string, max = 90): string {
  const t = s.trim().split(/(?<=[.!?…])\s/)[0] ?? s.trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Sinh caption từ spec: câu hook mở đầu → vài gạch đầu dòng nội dung → CTA →
 * hashtag. Người dùng vẫn sửa được trong Studio trước khi copy.
 */
export function buildCaption(spec: VideoSpec): string {
  const lines: string[] = [];

  const hookScene = spec.scenes.find((s) => s.layout === "hook") ?? spec.scenes[0];
  if (hookScene) lines.push(firstSentence(hookScene.heading || hookScene.narration, 100));

  const points = spec.scenes
    .filter((s) => s !== hookScene && s.layout !== "cta" && s.heading)
    .slice(0, 4)
    .map((s) => `• ${s.heading!.trim()}`);
  if (points.length) lines.push("", ...points);

  const ctaScene = spec.scenes.find((s) => s.layout === "cta");
  const cta = ctaScene ? firstSentence(ctaScene.heading || ctaScene.narration, 80) : "Theo dõi để xem thêm 👇";
  lines.push("", cta);

  const tags = buildHashtags(spec).map((t) => `#${t}`).join(" ");
  lines.push("", tags);

  const caption = lines.join("\n").trim();
  return caption.length <= CAPTION_LIMIT ? caption : caption.slice(0, CAPTION_LIMIT - 1) + "…";
}

/* --------------------------- Mở thư mục chứa MP4 -------------------------- */

/**
 * Mở file manager và bôi đen sẵn file video, để kéo thả thẳng vào tab TikTok.
 * Chỉ có tác dụng khi Studio chạy trên chính máy của người dùng (đúng thiết kế:
 * server này là local).
 */
export function revealFile(filePath: string): void {
  const abs = path.resolve(filePath);
  if (!existsSync(abs)) throw new Error(`Không thấy file: ${abs}`);

  // explorer.exe luôn trả exit code 1 kể cả khi thành công → bỏ qua mã lỗi.
  const [cmd, args] =
    process.platform === "win32"
      ? ["explorer.exe", [`/select,${abs}`]]
      : process.platform === "darwin"
        ? ["open", ["-R", abs]]
        : ["xdg-open", [path.dirname(abs)]];

  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}
