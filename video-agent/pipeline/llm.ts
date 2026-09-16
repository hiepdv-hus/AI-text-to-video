/**
 * llm.ts — gọi AI để viết kịch bản.
 *
 * KEY DO NGƯỜI DÙNG DÁN TRÊN GIAO DIỆN, không nằm trong file nào. Trình duyệt giữ key
 * trong localStorage và gửi kèm mỗi lần bấm "Viết kịch bản"; server chỉ cầm key trong
 * đúng một lượt gọi rồi bỏ. Người dùng sản phẩm này chạy `pnpm web` là xong, không ai
 * phải mở file cấu hình.
 *
 * Gọi thẳng REST bằng `fetch`, KHÔNG dùng SDK: mỗi người dùng một loại key, kéo về ba bộ
 * SDK chỉ để dùng đúng một lời gọi "chat" là thừa.
 */

export type LlmProvider = "gemini" | "openai" | "anthropic" | "compat";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  /** Bỏ trống = dùng model mặc định của nhà cung cấp. */
  model?: string;
  /** Chỉ dùng với "compat" (OpenRouter, Groq, LM Studio…). */
  baseUrl?: string;
}

/**
 * Bảng nhà cung cấp — NGUỒN DUY NHẤT. Giao diện lấy bảng này qua /api/llm/providers để
 * dựng ô chọn, nên thêm nhà cung cấp mới chỉ phải sửa ở đây.
 */
export const LLM_PROVIDERS: Record<
  LlmProvider,
  { label: string; defaultModel: string; keyUrl: string; note: string }
> = {
  gemini: {
    label: "Google Gemini",
    // Google gỡ model cũ khá nhanh (2.5-flash đã báo "no longer available to new users").
    // Nếu tên này cũng bị gỡ, callGemini() tự tìm model thay thế — xem pickGeminiModel().
    defaultModel: "gemini-3.6-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    note: "Có gói miễn phí — dễ bắt đầu nhất.",
  },
  openai: {
    label: "OpenAI (ChatGPT)",
    defaultModel: "gpt-4o-mini",
    keyUrl: "https://platform.openai.com/api-keys",
    note: "Trả phí theo lượt dùng.",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    defaultModel: "claude-opus-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
    note: "Trả phí theo lượt dùng.",
  },
  compat: {
    label: "Khác (tương thích OpenAI)",
    defaultModel: "",
    keyUrl: "https://openrouter.ai/keys",
    note: "OpenRouter, Groq, LM Studio… — cần điền địa chỉ API và tên model.",
  },
};

/**
 * Kiểm tra cấu hình gửi từ trình duyệt. Dữ liệu từ ngoài vào nên không tin kiểu —
 * báo lỗi bằng câu người dùng đọc hiểu được, không phải "undefined is not a string".
 */
export function parseLlmConfig(raw: unknown): LlmConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const provider = String(r.provider ?? "") as LlmProvider;
  if (!LLM_PROVIDERS[provider]) {
    throw new Error("Chưa chọn AI. Mở phần ⚙️ Cài đặt AI, chọn một dịch vụ và dán key.");
  }
  const apiKey = String(r.apiKey ?? "").trim();
  if (!apiKey) throw new Error(`Chưa dán key ${LLM_PROVIDERS[provider].label}.`);

  const model = String(r.model ?? "").trim() || LLM_PROVIDERS[provider].defaultModel;
  const baseUrl = String(r.baseUrl ?? "").trim();
  if (provider === "compat") {
    if (!baseUrl) throw new Error("Dịch vụ \"Khác\" cần điền địa chỉ API (vd https://openrouter.ai/api/v1).");
    if (!model) throw new Error("Dịch vụ \"Khác\" cần điền tên model.");
  }
  return { provider, apiKey, model, baseUrl: baseUrl || undefined };
}

interface ChatArgs {
  system: string;
  user: string;
  /** Trần token đầu ra. Spec 8 cảnh kèm widget rơi vào khoảng 4-6k token. */
  maxTokens?: number;
}

/**
 * Gọi AI, trả về CHUỖI THÔ model sinh ra (chưa parse). Chế độ ép JSON của từng nhà cung
 * cấp được bật, nhưng không tin tuyệt đối — việc bóc JSON để `extractJson()` lo.
 */
export async function chat(cfg: LlmConfig, { system, user, maxTokens = 16000 }: ChatArgs): Promise<string> {
  const model = cfg.model || LLM_PROVIDERS[cfg.provider].defaultModel;
  switch (cfg.provider) {
    case "gemini":
      return callGemini(cfg.apiKey, model, system, user, maxTokens);
    case "anthropic":
      return callAnthropic(cfg.apiKey, model, system, user, maxTokens);
    case "openai":
      return callOpenAiCompatible("OpenAI", "https://api.openai.com/v1", cfg.apiKey, model, system, user, maxTokens);
    case "compat":
      return callOpenAiCompatible("AI", cfg.baseUrl ?? "", cfg.apiKey, model, system, user, maxTokens);
  }
}

/** Đọc thân lỗi để thông báo có ích, thay vì chỉ "HTTP 400". */
async function fail(provider: string, res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  const hint =
    res.status === 400 && /api key|API_KEY_INVALID/i.test(body)
      ? " → key không hợp lệ, kiểm tra lại đã dán đủ chưa."
      : res.status === 401 || res.status === 403
        ? " → key sai hoặc hết hạn."
        : res.status === 404
          ? " → tên model không tồn tại hoặc key không có quyền dùng model này."
          : res.status === 429
            ? " → vượt hạn mức hoặc hết tiền trong tài khoản, đợi một lát rồi thử lại."
            : OVERLOADED.has(res.status)
              ? ` → máy chủ ${provider} đang quá tải (không phải lỗi key hay lỗi của bạn). Đã tự thử lại ` +
                "vài lần vẫn chưa được — đợi 1–2 phút rồi bấm lại, hoặc chọn model khác trong ⚙️ Cài đặt AI."
              : "";
  throw new Error(`${provider} lỗi ${res.status}${hint}\n${body.slice(0, 500)}`);
}

/**
 * Lỗi PHÍA NHÀ CUNG CẤP, tự hết sau vài giây–vài phút: 500/502/504 trục trặc, 503 "high
 * demand" (Gemini gặp thường xuyên giờ cao điểm), 529 "overloaded" (Claude).
 */
const OVERLOADED = new Set([500, 502, 503, 504, 529]);
/** Lượt gọi tối đa cho MỘT yêu cầu (1 lần đầu + 3 lần thử lại). */
const MAX_TRIES = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Gửi yêu cầu, gặp lỗi TẠM THỜI thì đợi rồi gửi lại (2,5s → 5s → 10s, hoặc theo
 * Retry-After nếu máy chủ bảo). Người dùng không phải dân kỹ thuật: thấy "lỗi 503" họ nghĩ
 * app hỏng, trong khi đợi vài giây là qua.
 *
 * 429 vì HẾT HẠN MỨC NGÀY hay HẾT TIỀN thì không thử lại — đợi 20 giây cũng không khác gì.
 * Lỗi khác (400 key sai, 404 model…) trả về ngay để báo đúng nguyên nhân.
 */
async function sendWithRetry(name: string, request: () => Promise<Response>): Promise<Response> {
  const base = Number(process.env.LLM_RETRY_BASE_MS) || 2500;
  for (let attempt = 1; ; attempt++) {
    let res: Response | undefined;
    let netErr: Error | undefined;
    try {
      res = await request();
    } catch (err) {
      netErr = err as Error;
    }

    let transient = !!netErr || OVERLOADED.has(res!.status) || res!.status === 429;
    if (res?.status === 429) {
      const body = await res.clone().text().catch(() => "");
      if (/per ?day|daily|billing|insufficient_quota|credit|exceeded your current quota/i.test(body)) transient = false;
    }
    if (!transient || attempt >= MAX_TRIES) {
      if (netErr) throw new Error(`Không kết nối được ${name}: ${netErr.message} — kiểm tra mạng rồi thử lại.`);
      return res!;
    }

    const retryAfter = Number(res?.headers.get("retry-after"));
    const wait = Math.min(
      30_000,
      retryAfter > 0 ? retryAfter * 1000 : base * 2 ** (attempt - 1) + Math.random() * base * 0.4,
    );
    const why = netErr ? "mất kết nối" : res!.status === 429 ? "đang giới hạn tốc độ (429)" : `đang quá tải (${res!.status})`;
    console.log(`[ai] ${name} ${why} — tự thử lại sau ${Math.round(wait / 1000)}s (lần ${attempt + 1}/${MAX_TRIES})…`);
    await res?.body?.cancel().catch(() => {});
    await sleep(wait);
  }
}

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Model đã tự chọn thay cho model bị Google gỡ: "tên yêu cầu" → "tên dùng thật".
 * Nhớ trong bộ nhớ server để một lượt viết kịch bản (tới 3 lời gọi) chỉ phải dò một lần.
 */
const geminiReplacement = new Map<string, string>();

/** Model thực sự sẽ được gọi — để báo lại cho giao diện lưu, lần sau gọi thẳng. */
export function effectiveModel(cfg: LlmConfig): string {
  const model = cfg.model || LLM_PROVIDERS[cfg.provider].defaultModel;
  return cfg.provider === "gemini" ? (geminiReplacement.get(model) ?? model) : model;
}

/**
 * Xếp hạng model Gemini để chọn cái thay thế. Tách riêng để test được.
 *
 * Chỉ lấy dòng "flash" dùng để sinh chữ: nhanh, rẻ, có gói miễn phí — đúng thứ cần cho
 * việc viết kịch bản. Loại các biến thể chuyên dụng (ảnh, giọng, embedding, lite…).
 * Ưu tiên bản ỔN ĐỊNH trước bản preview/exp, rồi mới tới số phiên bản cao hơn: bản
 * preview hay bị gỡ không báo trước, đúng cái rủi ro mà cơ chế này đang tránh.
 */
export function rankGeminiModels(ids: string[]): string[] {
  const special = /(lite|image|tts|audio|live|embedding|vision|learnlm|gemma|aqa|robotics|computer)/i;
  const version = (id: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0);
  const unstable = (id: string) => (/(preview|exp)/i.test(id) ? 1 : 0);
  return ids
    .filter((id) => /^gemini-/.test(id) && /flash/i.test(id) && !special.test(id))
    .sort((a, b) => unstable(a) - unstable(b) || version(b) - version(a) || a.length - b.length);
}

/** Hỏi Google danh sách model key này được dùng, xếp theo độ phù hợp. */
async function listGeminiModels(key: string): Promise<string[]> {
  const res = await fetch(`${GEMINI_API}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } }).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const ids = (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
  return rankGeminiModels(ids);
}

async function callGemini(key: string, model: string, system: string, user: string, maxTokens: number) {
  const generate = (m: string) =>
    sendWithRetry(`Gemini (${m})`, () =>
      fetch(`${GEMINI_API}/models/${encodeURIComponent(m)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens },
        }),
      }),
    );

  const remembered = geminiReplacement.get(model);
  const used = remembered ?? model;
  let res = await generate(used);

  // 404 = model không tồn tại / đã bị gỡ với key này. Người dùng không phải dân kỹ thuật,
  // không thể bắt họ tự đi tìm tên model mới — tự dò và chuyển sang, rồi báo lại.
  if (res.status === 404 && !remembered) {
    const alt = (await listGeminiModels(key))[0];
    if (alt && alt !== model) {
      console.log(`[ai] Gemini "${model}" không còn dùng được → tự chuyển sang "${alt}"`);
      geminiReplacement.set(model, alt);
      res = await generate(alt);
    }
  }

  // Thử lại mấy lần vẫn quá tải → model này đang nghẽn. Google phân tải THEO MODEL, model
  // flash khác thường vẫn chạy. Chỉ đổi cho LƯỢT NÀY, không ghi nhớ: quá tải là chuyện
  // nhất thời, lần sau vẫn dùng model người dùng đã chọn.
  if (OVERLOADED.has(res.status)) {
    const alt = (await listGeminiModels(key)).find((m) => m !== used);
    if (alt) {
      console.log(`[ai] Gemini "${used}" vẫn quá tải → dùng tạm "${alt}" cho lượt này`);
      await res.body?.cancel().catch(() => {});
      res = await generate(alt);
    }
  }
  if (!res.ok) await fail("Gemini", res);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini trả về rỗng:\n${JSON.stringify(data).slice(0, 500)}`);
  return text;
}

async function callAnthropic(key: string, model: string, system: string, user: string, maxTokens: number) {
  const res = await sendWithRetry("Claude", () =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    }),
  );
  if (!res.ok) await fail("Claude", res);
  const data = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  if (data.stop_reason === "refusal") throw new Error("Claude từ chối yêu cầu này.");
  const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (!text) throw new Error(`Claude trả về rỗng:\n${JSON.stringify(data).slice(0, 500)}`);
  return text;
}

async function callOpenAiCompatible(
  name: string,
  base: string,
  key: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
) {
  const res = await sendWithRetry(name, () =>
    fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    }),
  );
  if (!res.ok) await fail(name, res);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`${name} trả về rỗng:\n${JSON.stringify(data).slice(0, 500)}`);
  return text;
}

/**
 * Thử key bằng một lời gọi siêu nhỏ. Người dùng không phải dân kỹ thuật nên cần biết
 * ngay lúc dán key là đúng hay sai — không phải đợi tới lúc viết kịch bản 30 giây mới lỗi.
 */
export async function testLlm(cfg: LlmConfig): Promise<string> {
  const raw = await chat(cfg, {
    system: 'Trả về đúng JSON {"ok":true}.',
    user: "ping",
    // Không để quá nhỏ: Gemini và Claude đời mới "nghĩ" trước khi trả lời, phần nghĩ
    // cũng ăn vào trần này — đặt 50 là có lúc nghĩ xong hết chỗ, trả về rỗng, báo nhầm
    // key hỏng.
    maxTokens: 1024,
  });
  if (!raw.includes("ok")) throw new Error(`Key dùng được nhưng AI trả lời lạ: ${raw.slice(0, 120)}`);
  // Trả về model DÙNG THẬT (có thể đã tự đổi) để giao diện lưu lại.
  return effectiveModel(cfg);
}
