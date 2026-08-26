import { createHighlighter, type Highlighter } from "shiki";
import type { CodeToken } from "../src/schema.ts";

/**
 * highlight.ts — tô màu cú pháp bằng shiki Ở PIPELINE (nửa xác định).
 * Sinh sẵn token có màu → lưu vào props.json; component chỉ việc vẽ span.
 * Không tô màu ở lúc render (tránh async trong React của Remotion).
 */

export const CODE_THEME = "one-dark-pro";
const DEFAULT_COLOR = "#ABB2BF";

let hlPromise: Promise<Highlighter> | null = null;

async function getHighlighter(lang: string): Promise<Highlighter> {
  if (!hlPromise) {
    hlPromise = createHighlighter({ themes: [CODE_THEME], langs: [lang] });
  }
  const hl = await hlPromise;
  if (!hl.getLoadedLanguages().includes(lang)) {
    await hl.loadLanguage(lang as Parameters<Highlighter["loadLanguage"]>[0]);
  }
  return hl;
}

/** code → mảng dòng, mỗi dòng là mảng token {text,color}. */
export async function highlightCode(code: string, lang = "javascript"): Promise<CodeToken[][]> {
  const hl = await getHighlighter(lang);
  const lines = hl.codeToTokensBase(code.replace(/\n+$/, ""), {
    lang: lang as Parameters<Highlighter["codeToTokensBase"]>[1]["lang"],
    theme: CODE_THEME,
  });
  return lines.map((line) => line.map((t) => ({ text: t.content, color: t.color ?? DEFAULT_COLOR })));
}
