/**
 * llm.ts — gọi LLM để viết kịch bản. NGƯỜI DÙNG TỰ CẮM KEY.
 *
 * Bốn nhà cung cấp, gọi thẳng bằng `fetch` chứ KHÔNG dùng SDK. Lý do: sản phẩm này giao
 * cho người dùng cuối, mỗi người cắm một loại key. Kéo về ba bộ SDK chỉ để dùng đúng một
 * lời gọi "chat" là bắt mọi người tải thêm vài chục MB cho thứ họ không dùng tới. REST của
 * cả bốn đều ổn định và đơn giản.
 *
 * Chọn nhà cung cấp: LLM_PROVIDER trong .env, hoặc TỰ DÒ theo key nào đang có.
 * Đổi model: LLM_MODEL (mặc định bên dưới chỉ là điểm khởi đầu hợp lý).
 *
 *   LLM_PROVIDER=gemini     GEMINI_API_KEY=...      (có tầng miễn phí — dễ bắt đầu nhất)
 *   LLM_PROVIDER=openai     OPENAI_API_KEY=...
 *   LLM_PROVIDER=anthropic  ANTHROPIC_API_KEY=...
 *   LLM_PROVIDER=compat     LLM_BASE_URL=... LLM_API_KEY=...   (OpenRouter, Groq, LM Studio…)
 */

export type LlmProvider = "gemini" | "openai" | "anthropic" | "compat";

const DEFAULT_MODEL: Record<LlmProvider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-opus-5",
  compat: "gpt-4o-mini",
};

export interface LlmInfo {
  provider: LlmProvider;
  model: string;
}

/** Nhà cung cấp đang dùng + model, hoặc null nếu chưa cắm key nào. */
export function resolveLlm(): LlmInfo | null {
  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase() as LlmProvider | undefined;
  const has = (k: string) => Boolean(process.env[k]?.trim());

  const provider: LlmProvider | null = forced
    ? forced
    : has("GEMINI_API_KEY")
      ? "gemini"
      : has("ANTHROPIC_API_KEY")
        ? "anthropic"
        : has("OPENAI_API_KEY")
          ? "openai"
          : has("LLM_BASE_URL") && has("LLM_API_KEY")
            ? "compat"
            : null;

  if (!provider) return null;
  if (!DEFAULT_MODEL[provider]) {
    throw new Error(
      `LLM_PROVIDER="${provider}" không hợp lệ. Chọn: ${Object.keys(DEFAULT_MODEL).join(", ")}.`,
    );
  }
  return { provider, model: process.env.LLM_MODEL?.trim() || DEFAULT_MODEL[provider] };
}

/** Câu hướng dẫn cắm key — dùng chung cho CLI và server để không viết hai kiểu. */
export const LLM_SETUP_HINT = [
  "Chưa cấu hình LLM. Mở file .env rồi thêm MỘT trong các dòng sau:",
  "",
  "  GEMINI_API_KEY=...       (aistudio.google.com/apikey — có tầng miễn phí)",
  "  OPENAI_API_KEY=...       (platform.openai.com)",
  "  ANTHROPIC_API_KEY=...    (console.anthropic.com)",
  "",
  "Muốn dùng dịch vụ tương thích OpenAI (OpenRouter, Groq, LM Studio…):",
  "  LLM_PROVIDER=compat",
  "  LLM_BASE_URL=https://openrouter.ai/api/v1",
  "  LLM_API_KEY=...",
  "  LLM_MODEL=<tên model>",
].join("\n");

interface ChatArgs {
  system: string;
  user: string;
  /** Trần token đầu ra. Spec 8 cảnh kèm widget rơi vào khoảng 4-6k token. */
  maxTokens?: number;
}

/**
 * Gọi LLM, trả về CHUỖI THÔ mà model sinh ra (chưa parse).
 *
 * Ba nhà cung cấp có chế độ ép JSON riêng và đều được bật ở đây, nhưng KHÔNG tin tuyệt
 * đối vào nó: model vẫn có lúc bọc thêm ``` hoặc thêm lời dẫn. Việc bóc JSON để cho
 * `extractJson()` ở author.ts lo, chỗ này chỉ trả về chuỗi.
 */
export async function chat({ system, user, maxTokens = 16000 }: ChatArgs): Promise<string> {
  const llm = resolveLlm();
  if (!llm) throw new Error(LLM_SETUP_HINT);

  switch (llm.provider) {
    case "gemini":
      return callGemini(llm.model, system, user, maxTokens);
    case "anthropic":
      return callAnthropic(llm.model, system, user, maxTokens);
    case "openai":
    case "compat":
      return callOpenAiCompatible(llm, system, user, maxTokens);
  }
}

/** Đọc thân lỗi để thông báo có ích, thay vì chỉ "HTTP 400". */
async function fail(provider: string, res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  const hint =
    res.status === 401 || res.status === 403
      ? " → key sai hoặc hết hạn."
      : res.status === 404
        ? " → tên model không tồn tại với key này. Đặt LLM_MODEL sang model bạn có quyền dùng."
        : res.status === 429
          ? " → vượt hạn mức, đợi một lát rồi thử lại."
          : "";
  throw new Error(`${provider} lỗi ${res.status}${hint}\n${body.slice(0, 600)}`);
}

async function callGemini(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("LLM_PROVIDER=gemini nhưng thiếu GEMINI_API_KEY.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) await fail("Gemini", res);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini trả về rỗng:\n${JSON.stringify(data).slice(0, 600)}`);
  return text;
}

async function callAnthropic(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("LLM_PROVIDER=anthropic nhưng thiếu ANTHROPIC_API_KEY.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) await fail("Anthropic", res);
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  };
  if (data.stop_reason === "refusal") throw new Error("Anthropic từ chối yêu cầu này.");
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  if (!text) throw new Error(`Anthropic trả về rỗng:\n${JSON.stringify(data).slice(0, 600)}`);
  return text;
}

async function callOpenAiCompatible(
  llm: LlmInfo,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const compat = llm.provider === "compat";
  const key = (compat ? process.env.LLM_API_KEY : process.env.OPENAI_API_KEY)?.trim();
  if (!key) throw new Error(`Thiếu ${compat ? "LLM_API_KEY" : "OPENAI_API_KEY"}.`);
  const base = (compat ? process.env.LLM_BASE_URL?.trim() : "https://api.openai.com/v1") ?? "";
  if (!base) throw new Error("LLM_PROVIDER=compat nhưng thiếu LLM_BASE_URL.");

  const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: llm.model,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) await fail(compat ? "LLM" : "OpenAI", res);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`LLM trả về rỗng:\n${JSON.stringify(data).slice(0, 600)}`);
  return text;
}
