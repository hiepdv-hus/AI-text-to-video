import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { extractJson, authorSpec } from "./author.ts";
import { lintSpec, MAX_CODE_LINE } from "./lint.ts";
import { parseLlmConfig, rankGeminiModels, testLlm, LLM_PROVIDERS, type LlmConfig } from "./llm.ts";
import { videoSpecSchema } from "../src/schema.ts";

/**
 * Hai thứ này đứng giữa "LLM trả về một đống chữ" và "pipeline render", nên chúng là chỗ
 * hỏng thì hỏng âm thầm: bóc JSON sai thì báo lỗi khó hiểu, lint sót thì video render
 * xong mới thấy chữ bị cắt.
 */

/* --------------------------- Bóc JSON ---------------------------------- */

test("extractJson: JSON trần", () => {
  assert.equal(extractJson('{"a":1}'), '{"a":1}');
});

test("extractJson: bọc trong ``` và có lời dẫn", () => {
  const raw = 'Đây là spec bạn cần:\n```json\n{"a":1,"b":{"c":2}}\n```\nChúc bạn quay vui vẻ!';
  assert.equal(extractJson(raw), '{"a":1,"b":{"c":2}}');
});

test("extractJson: ngoặc nhọn NẰM TRONG chuỗi không làm lệch phép đếm", () => {
  // Đây là ca thật: narration tiếng Việt hay có ngoặc, và code mẫu thì đầy `{}`.
  const raw = '{"code":"const a = {b: 1};","note":"dấu } lạc giữa câu"}';
  assert.equal(extractJson(raw), raw);
});

test("extractJson: dấu nháy đã thoát không kết thúc chuỗi sớm", () => {
  const raw = '{"t":"anh ấy nói \\"xong\\" rồi }","x":1}';
  assert.equal(extractJson(raw), raw);
});

test("extractJson: JSON cụt thì báo lỗi rõ, không trả về rác", () => {
  assert.throws(() => extractJson('{"a":1,"b":'), /cắt giữa chừng/);
});

test("extractJson: không có JSON nào", () => {
  assert.throws(() => extractJson("Xin lỗi, tôi không làm được."), /Không tìm thấy JSON/);
});

/* ------------------------------ Lint ------------------------------------ */

/** Cảnh trung tính để nhồi cho đủ số cảnh tối thiểu — không dính vào thứ đang test. */
const filler = (id: string) => ({
  id,
  layout: "bullet" as const,
  narration: `Nội dung phụ ${id}.`,
  heading: `Phụ ${id}`,
  bullets: ["Một ý"],
});

/**
 * Dựng spec từ danh sách cảnh, TỰ NHỒI cho đủ 4 cảnh (chèn trước cảnh cuối) vì lint đòi
 * tối thiểu 4. Nhờ thế mỗi test chỉ cần khai đúng những cảnh nó quan tâm.
 */
function mk(scenes: Record<string, unknown>[]) {
  const padded = [...scenes];
  let n = 0;
  while (padded.length < 4) padded.splice(padded.length - 1, 0, filler(`pad${++n}`));
  return videoSpecSchema.parse({
    meta: { title: "Thử", template: "CodeExplainer", background: "tech" },
    voice: { provider: "piper", voiceId: "adam1", speed: 1.2 },
    captions: {},
    scenes: padded,
  });
}

/** Spec tối thiểu HỢP LỆ — mỗi test bên dưới bẻ đúng một chỗ trên nền này. */
const baseSpec = () =>
  mk([
    { id: "s1", layout: "hook", narration: "Câu mở đầu giật tít.", heading: "Mở đầu" },
    { id: "s2", layout: "cta", narration: "Theo dõi để xem tiếp.", heading: "Chốt" },
  ]);

test("lint: spec tối thiểu hợp lệ thì không có lỗi nào", () => {
  assert.deepEqual(lintSpec(baseSpec()), []);
});

test("lint: bắt dòng code quá dài — lỗi chỉ lộ ra sau khi render", () => {
  const long = "const API = process.env.NEXT_PUBLIC_API_URL ?? LOCAL;";
  assert.ok(long.length > MAX_CODE_LINE);
  const spec = mk([
      { id: "s1", layout: "hook", narration: "Mở đầu.", heading: "A" },
      { id: "s2", layout: "code", narration: "Đoạn mã.", heading: "B", code: long },
      { id: "s3", layout: "cta", narration: "Chốt.", heading: "C" },
    ]);
  const p = lintSpec(spec);
  assert.ok(p.some((x) => x.includes("sẽ bị cắt")), p.join("\n"));
});

test("lint: bắt tên icon bịa", () => {
  const spec = mk([
      { id: "s1", layout: "hook", narration: "Mở đầu.", heading: "A", chips: ["@rocketship Bay lên"] },
      { id: "s2", layout: "cta", narration: "Chốt.", heading: "C" },
    ]);
  assert.ok(lintSpec(spec).some((x) => x.includes('icon "@rocketship"')));
});

test("lint: icon CÓ THẬT thì không báo", () => {
  const spec = mk([
      { id: "s1", layout: "hook", narration: "Mở đầu.", heading: "A", chips: ["@rocket Bay lên", "* @db Dữ liệu"] },
      { id: "s2", layout: "cta", narration: "Chốt.", heading: "C" },
    ]);
  assert.deepEqual(lintSpec(spec), []);
});

test("lint: bắt emphasis không nằm trong câu nào", () => {
  const spec = mk([
      { id: "s1", layout: "hook", narration: "Mở đầu.", heading: "A", emphasis: ["không có ở đâu cả"] },
      { id: "s2", layout: "cta", narration: "Chốt.", heading: "C" },
    ]);
  assert.ok(lintSpec(spec).some((x) => x.includes("không xuất hiện")));
});

test("lint: emphasis khớp dù lệch hoa/thường và dấu câu", () => {
  const spec = mk([
      { id: "s1", layout: "hook", narration: "Đừng mua, trước khi xem hết!", heading: "A", emphasis: ["Đừng mua"] },
      { id: "s2", layout: "cta", narration: "Chốt.", heading: "C" },
    ]);
  assert.deepEqual(lintSpec(spec), []);
});

test("lint: checklist thiếu tiền tố +/-", () => {
  const spec = mk([
      { id: "s1", layout: "hook", narration: "Mở đầu.", heading: "A" },
      {
        id: "s2",
        layout: "graphic",
        narration: "Danh sách.",
        heading: "B",
        graphic: { kind: "checklist", labels: ["Nên làm cái này"] },
      },
      { id: "s3", layout: "cta", narration: "Chốt.", heading: "C" },
    ]);
  assert.ok(lintSpec(spec).some((x) => x.includes('"+ "')));
});

test("lint: bắt heading trùng nhau", () => {
  const spec = mk([
      { id: "s1", layout: "hook", narration: "Mở đầu.", heading: "Giống nhau" },
      { id: "s2", layout: "cta", narration: "Chốt.", heading: "Giống nhau" },
    ]);
  assert.ok(lintSpec(spec).some((x) => x.includes("trùng")));
});

test("lint: bắt cảnh đầu/cuối sai layout", () => {
  const spec = mk([
      { id: "s1", layout: "bullet", narration: "Mở đầu.", heading: "A", bullets: ["x"] },
      { id: "s2", layout: "bullet", narration: "Chốt.", heading: "C", bullets: ["y"] },
    ]);
  const p = lintSpec(spec);
  assert.ok(p.some((x) => x.includes("ĐẦU TIÊN")));
  assert.ok(p.some((x) => x.includes("CUỐI CÙNG")));
});

test("lint: bắt narration quá dài", () => {
  const spec = mk([
      { id: "s1", layout: "hook", narration: "từ ".repeat(70), heading: "A" },
      { id: "s2", layout: "cta", narration: "Chốt.", heading: "C" },
    ]);
  assert.ok(lintSpec(spec).some((x) => x.includes("quá dài")));
});

/* ------------------- Vòng lặp sửa lỗi, chạy thật ------------------------ */

/**
 * Dựng một "LLM giả" nói giao thức OpenAI, trả lần lượt các câu đã soạn sẵn.
 *
 * Đây là test đáng giá nhất file: nó chạy ĐÚNG đường đi thật (llm.ts → author.ts →
 * Zod → lint → nhắc lại) mà không cần key và không tốn tiền. Thứ nó bảo vệ là vòng lặp
 * sửa lỗi — chỗ mà nếu hỏng thì người dùng chỉ thấy "không tạo được video".
 */
async function withFakeLlm<T>(
  replies: string[],
  fn: (llm: LlmConfig) => Promise<T>,
): Promise<{ result: T; calls: string[] }> {
  const calls: string[] = [];
  let i = 0;
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    calls.push(Buffer.concat(chunks).toString("utf8"));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: replies[Math.min(i++, replies.length - 1)] } }] }));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;

  // Cấu hình truyền THẲNG vào, đúng như giao diện gửi lên — không đụng biến môi trường.
  const llm = parseLlmConfig({
    provider: "compat",
    apiKey: "test",
    model: "fake",
    baseUrl: `http://127.0.0.1:${port}/v1`,
  });
  try {
    return { result: await fn(llm), calls };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

const GOOD_SPEC = JSON.stringify({
  meta: { title: "Trấn Thành", template: "StoryHook", background: "tech" },
  voice: { provider: "piper", voiceId: "adam1", speed: 1.2 },
  captions: {},
  scenes: [
    { id: "s1", layout: "hook", narration: "Câu mở đầu giật tít đây.", heading: "Mở đầu" },
    { id: "s2", layout: "bullet", narration: "Ý thứ nhất.", heading: "Một", bullets: ["A"] },
    { id: "s3", layout: "bullet", narration: "Ý thứ hai.", heading: "Hai", bullets: ["B"] },
    { id: "s4", layout: "cta", narration: "Theo dõi để xem tiếp.", heading: "Chốt" },
  ],
});

test("authorSpec: nhận JSON hợp lệ ngay lượt đầu", async () => {
  const { result, calls } = await withFakeLlm([GOOD_SPEC], (llm) => authorSpec("video về Trấn Thành", llm));
  assert.equal(result.attempts, 1);
  assert.equal(result.spec.scenes.length, 4);
  assert.equal(calls.length, 1);
});

test("authorSpec: bọc ``` + lời dẫn vẫn bóc ra được", async () => {
  const { result } = await withFakeLlm(
    ["Đây nhé:\n```json\n" + GOOD_SPEC + "\n```"],
    (llm) => authorSpec("video về Trấn Thành", llm),
  );
  assert.equal(result.attempts, 1);
});

test("authorSpec: lượt đầu sai lint → nhắc lại kèm ĐÚNG lỗi → lượt hai qua", async () => {
  // Sai đúng một chỗ: dòng code dài quá khung. Zod cho qua, chỉ lint mới bắt được.
  const tooLong = JSON.parse(GOOD_SPEC) as { scenes: Record<string, unknown>[] };
  tooLong.scenes[1] = {
    id: "s2",
    layout: "code",
    narration: "Đoạn mã.",
    heading: "Một",
    code: "const API = process.env.NEXT_PUBLIC_API_URL ?? LOCAL;",
  };

  const { result, calls } = await withFakeLlm(
    [JSON.stringify(tooLong), GOOD_SPEC],
    (llm) => authorSpec("video về Trấn Thành", llm),
  );
  assert.equal(result.attempts, 2);
  assert.equal(calls.length, 2);
  // Lượt nhắc lại phải chở theo mô tả lỗi cụ thể, không phải "làm lại đi".
  assert.match(calls[1]!, /sẽ bị cắt/);
});

test("authorSpec: sai Zod cũng được nhắc lại đúng đường dẫn trường", async () => {
  const badZod = '{"meta":{"title":"X"},"scenes":[],"voice":{},"captions":{}}';
  const { result, calls } = await withFakeLlm([badZod, GOOD_SPEC], (llm) => authorSpec("brief", llm));
  assert.equal(result.attempts, 2);
  assert.match(calls[1]!, /meta\.template|scenes/);
});

test("authorSpec: hết lượt vẫn sai thì BÁO LỖI, không trả spec hỏng", async () => {
  await assert.rejects(
    () => withFakeLlm(['{"không":"phải spec"}'], (llm) => authorSpec("brief", llm)),
    /vẫn chưa ra spec hợp lệ/,
  );
});

/* ------------------- Cấu hình AI gửi từ giao diện ----------------------- */

test("parseLlmConfig: chưa chọn AI → câu báo người thường đọc hiểu", () => {
  assert.throws(() => parseLlmConfig({}), /Chưa chọn AI/);
});

test("parseLlmConfig: có AI mà chưa dán key", () => {
  assert.throws(() => parseLlmConfig({ provider: "gemini", apiKey: "  " }), /Chưa dán key/);
});

test("parseLlmConfig: bỏ trống model thì lấy mặc định, key được cắt khoảng trắng thừa", () => {
  const c = parseLlmConfig({ provider: "gemini", apiKey: "  abc  \n" });
  assert.equal(c.apiKey, "abc");
  assert.equal(c.model, LLM_PROVIDERS.gemini.defaultModel);
});

test("parseLlmConfig: 'Khác' bắt buộc có địa chỉ API và tên model", () => {
  assert.throws(() => parseLlmConfig({ provider: "compat", apiKey: "k", model: "m" }), /địa chỉ API/);
  assert.throws(() => parseLlmConfig({ provider: "compat", apiKey: "k", baseUrl: "http://x" }), /tên model/);
});

/* ---------------- Tự thử lại khi nhà cung cấp quá tải ---------------- */

/** Máy chủ trả lần lượt các [status, body] soạn sẵn; phần tử cuối lặp lại mãi. */
async function withScriptedLlm<T>(script: [number, string][], fn: (llm: LlmConfig) => Promise<T>) {
  let calls = 0;
  const server = http.createServer(async (req, res) => {
    for await (const _ of req) void _;
    const [status, body] = script[Math.min(calls++, script.length - 1)]!;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(body);
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const llm = parseLlmConfig({ provider: "compat", apiKey: "t", model: "fake", baseUrl: `http://127.0.0.1:${port}/v1` });
  const prev = process.env.LLM_RETRY_BASE_MS;
  process.env.LLM_RETRY_BASE_MS = "5"; // test không đợi 2,5 giây thật
  try {
    const result = await fn(llm).catch((err: Error) => err);
    return { result, calls };
  } finally {
    if (prev === undefined) delete process.env.LLM_RETRY_BASE_MS;
    else process.env.LLM_RETRY_BASE_MS = prev;
    await new Promise<void>((r) => server.close(() => r()));
  }
}

const HIGH_DEMAND = JSON.stringify({ error: { code: 503, message: "This model is currently experiencing high demand." } });
const okReply = (content: string) => JSON.stringify({ choices: [{ message: { content } }] });

test("chat: 503 'high demand' hai lần rồi hết → tự thử lại, người dùng không thấy lỗi", async () => {
  const { result, calls } = await withScriptedLlm(
    [[503, HIGH_DEMAND], [503, HIGH_DEMAND], [200, okReply('{"ok":true}')]],
    (llm) => testLlm(llm),
  );
  assert.equal(result, "fake");
  assert.equal(calls, 3);
});

test("chat: quá tải mãi → dừng sau 4 lượt, báo rõ là lỗi phía máy chủ AI", async () => {
  const { result, calls } = await withScriptedLlm([[503, HIGH_DEMAND]], (llm) => testLlm(llm));
  assert.equal(calls, 4);
  assert.match(String(result), /lỗi 503 → máy chủ AI đang quá tải \(không phải lỗi key/);
});

test("chat: lỗi KHÔNG tạm thời (key sai) → báo ngay, không thử lại", async () => {
  const { result, calls } = await withScriptedLlm([[401, '{"error":"bad key"}']], (llm) => testLlm(llm));
  assert.equal(calls, 1);
  assert.match(String(result), /key sai/);
});

test("chat: 429 vì hết hạn mức ngày → không thử lại (đợi cũng vô ích)", async () => {
  const { calls } = await withScriptedLlm(
    [[429, '{"error":{"message":"You exceeded your current quota, please check your plan and billing"}}']],
    (llm) => testLlm(llm),
  );
  assert.equal(calls, 1);
});

test("chat: 429 giới hạn tốc độ tạm thời → có thử lại", async () => {
  const { result, calls } = await withScriptedLlm(
    [[429, '{"error":{"message":"Rate limit reached, try again in 1s"}}'], [200, okReply('{"ok":true}')]],
    (llm) => testLlm(llm),
  );
  assert.equal(result, "fake");
  assert.equal(calls, 2);
});

/* ---------------- Tự chọn model Gemini khi model cũ bị gỡ ---------------- */

/**
 * Danh sách giống thứ Google trả về thật: lẫn đủ loại biến thể chuyên dụng. Chọn sai ở
 * đây là khách bị chuyển sang model sinh ẢNH hay đọc GIỌNG — gọi viết kịch bản sẽ hỏng
 * theo một kiểu khó hiểu hơn nhiều so với lỗi 404 ban đầu.
 */
const GOOGLE_LIST = [
  "gemini-2.0-flash",
  "gemini-3.6-flash",
  "gemini-3.6-flash-lite",
  "gemini-3.6-flash-image",
  "gemini-3.6-flash-preview-tts",
  "gemini-3.7-flash-preview",
  "gemini-3.6-pro",
  "gemini-embedding-001",
  "gemma-3-27b-it",
];

test("rankGeminiModels: chọn flash ỔN ĐỊNH mới nhất, bỏ lite/ảnh/giọng/pro/embedding", () => {
  assert.equal(rankGeminiModels(GOOGLE_LIST)[0], "gemini-3.6-flash");
});

test("rankGeminiModels: bản ổn định thắng bản preview dù preview số cao hơn", () => {
  // preview hay bị gỡ không báo trước — đúng cái rủi ro mà cơ chế tự đổi đang tránh.
  assert.deepEqual(rankGeminiModels(["gemini-3.7-flash-preview", "gemini-3.6-flash"]), [
    "gemini-3.6-flash",
    "gemini-3.7-flash-preview",
  ]);
});

test("rankGeminiModels: chỉ còn preview thì vẫn dùng preview, còn hơn không có gì", () => {
  assert.equal(rankGeminiModels(["gemini-3.7-flash-preview", "gemini-3.6-flash-lite"])[0], "gemini-3.7-flash-preview");
});

test("rankGeminiModels: không có model phù hợp thì trả rỗng (để báo lỗi gốc, không đoán bừa)", () => {
  assert.deepEqual(rankGeminiModels(["gemini-3.6-pro", "gemini-embedding-001"]), []);
});

/* ---------------------- Kiểu hình ảnh "chỉ ảnh" ------------------------- */

/** Cảnh hợp lệ của chế độ "Chỉ ảnh": ảnh + lời kể, không tiêu đề, không gì khác. */
const photoScene = (id: string, layout: string, extra: Record<string, unknown> = {}) => ({
  id,
  layout,
  narration: `Lời kể của cảnh ${id}.`,
  media: { kind: "pexels", src: `stage spotlight ${id}` },
  ...extra,
});

/** Bốn cảnh chuẩn: mở (hook) → hai cảnh kể (image) → kết (cta). */
const photoStory = () => [photoScene("s1", "hook"), photoScene("s2", "image"), photoScene("s3", "image"), photoScene("s4", "cta")];

function mkPhoto(scenes: Record<string, unknown>[]) {
  return videoSpecSchema.parse({
    meta: { title: "Thử", template: "StoryHook", background: "claude-dark", visualStyle: "photo" },
    voice: { provider: "edge", voiceId: "vi-VN-NamMinhNeural" },
    captions: {},
    scenes,
  });
}

test("schema: không ghi visualStyle thì mặc định mixed — spec cũ giữ nguyên hình", () => {
  assert.equal(baseSpec().meta.visualStyle, "mixed");
});

test("lint photo: ảnh + lời kể, không tiêu đề — hợp lệ", () => {
  assert.deepEqual(lintSpec(mkPhoto(photoStory())), []);
});

test("lint photo: bắt cảnh thiếu ảnh và cảnh lẫn video", () => {
  const spec = mkPhoto([
    photoScene("s1", "hook", { media: { kind: "pexels-video", src: "city night" } }),
    { id: "s2", layout: "image", narration: "Không ảnh." },
    photoScene("s3", "image"),
    photoScene("s4", "cta"),
  ]);
  const p = lintSpec(spec);
  assert.ok(p.some((x) => x.includes('scene "s1"') && x.includes("không được dùng video")), p.join("\n"));
  assert.ok(p.some((x) => x.includes('scene "s2"') && x.includes("cần mỗi cảnh một ảnh")), p.join("\n"));
});

test("authorSpec photo: AI quên ghi visualStyle → vẫn đặt đúng lựa chọn người dùng", async () => {
  const noStyle = JSON.stringify({
    meta: { title: "Trấn Thành", template: "StoryHook", background: "claude-dark" },
    voice: { provider: "edge", voiceId: "vi-VN-NamMinhNeural" },
    captions: {},
    scenes: photoStory(),
  });
  const { result, calls } = await withFakeLlm([noStyle], (llm) =>
    authorSpec("video về Trấn Thành", llm, () => {}, { visualStyle: "photo" }),
  );
  assert.equal(result.spec.meta.visualStyle, "photo");
  assert.equal(result.attempts, 1);
  // Chỉ dẫn "chỉ ảnh" phải thực sự tới tay AI.
  assert.match(calls[0]!, /CHỈ ẢNH/);
});

test("authorSpec photo: AI trả spec kiểu cũ (video ở hook) → bị nhắc sửa", async () => {
  // GOOD_SPEC là spec "đầy đủ": không có ảnh nền → sai với lựa chọn "chỉ ảnh".
  await assert.rejects(
    () => withFakeLlm([GOOD_SPEC], (llm) => authorSpec("brief", llm, () => {}, { visualStyle: "photo" })),
    /chỉ ảnh/,
  );
});

test("lint: steps không hiểu @icon — bắt lỗi hiện nguyên chữ '@grad' lên màn hình", () => {
  const spec = mk([
    { id: "s1", layout: "hook", narration: "Mở đầu.", heading: "A" },
    {
      id: "s2",
      layout: "graphic",
      narration: "Các bước.",
      heading: "B",
      graphic: { kind: "steps", labels: ["@grad 18 tuổi: Vào đại học", "19 tuổi: Cày thuật toán"] },
    },
    { id: "s3", layout: "cta", narration: "Chốt.", heading: "C" },
  ]);
  const p = lintSpec(spec);
  assert.ok(p.some((x) => x.includes("steps không hiểu") && x.includes("@grad")), p.join("\n"));
  assert.equal(p.filter((x) => x.includes("không hiểu")).length, 1, "nhãn chữ trơn không bị báo nhầm");
});

test("lint: feature-cards thì @icon hợp lệ, không báo", () => {
  const spec = mk([
    { id: "s1", layout: "hook", narration: "Mở đầu.", heading: "A" },
    { id: "s2", layout: "graphic", narration: "Thẻ.", heading: "B", graphic: { kind: "feature-cards", labels: ["@grad Học"] } },
    { id: "s3", layout: "cta", narration: "Chốt.", heading: "C" },
  ]);
  assert.deepEqual(lintSpec(spec), []);
});

/* ---------- "Chỉ ảnh" = ảnh gốc + lời kể. Không bullet, không đồ hoạ, không chữ đè ---------- */

test("lint photo: cấm bullet, đồ hoạ, code, chips, icon", () => {
  const spec = mkPhoto([
    photoScene("s1", "hook", { chips: ["@star Nổi bật"], icon: "🎬" }),
    photoScene("s2", "bullet", { bullets: ["Dòng một"] }),
    photoScene("s3", "graphic", { graphic: { kind: "steps", labels: ["Bước một"] } }),
    photoScene("s4", "code", { code: "x = 1" }),
    photoScene("s5", "cta"),
  ]);
  const p = lintSpec(spec).join("\n");
  assert.match(p, /scene "s1".*chips/);
  assert.match(p, /scene "s1".*icon/);
  assert.match(p, /scene "s2".*layout "bullet"/);
  assert.match(p, /scene "s2".*bullets/);
  assert.match(p, /scene "s3".*layout "graphic"/);
  assert.match(p, /scene "s4".*layout "code"/);
});

test("lint photo: tiêu đề không hiển thị ở chế độ ảnh nên không bắt buộc", () => {
  // photoStory() không có heading nào — vẫn phải hợp lệ.
  assert.ok(photoStory().every((s) => !("heading" in s)));
  assert.deepEqual(lintSpec(mkPhoto(photoStory())), []);
});

/* ---------------- Trần số cảnh: video ngắn vs video từ bài báo ---------------- */

/** n cảnh hợp lệ kiểu ảnh: mở → (n-2) cảnh kể → kết. */
const photoStoryOf = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    photoScene(`s${i + 1}`, i === 0 ? "hook" : i === n - 1 ? "cta" : "image"),
  );

function mkArticle(scenes: Record<string, unknown>[]) {
  return videoSpecSchema.parse({
    meta: {
      title: "Thử",
      template: "StoryHook",
      background: "claude-dark",
      visualStyle: "article",
      article: { siteName: "Kênh 14", title: "Nhà vườn của Beckham" },
    },
    voice: { provider: "edge", voiceId: "vi-VN-NamMinhNeural" },
    captions: {},
    scenes,
  });
}

test("lint: video ngắn thường vẫn chặn ở 14 cảnh", () => {
  assert.deepEqual(lintSpec(mkPhoto(photoStoryOf(14))), []);
  assert.ok(lintSpec(mkPhoto(photoStoryOf(15))).some((x) => x.includes("tối đa 14")));
});

test("lint: video từ bài báo được kể dài — 26 cảnh vẫn hợp lệ", () => {
  // Đây là điểm mấu chốt của kiểu "article": trần 14 cảnh ép nó tóm tắt cả bài báo
  // xuống còn vài câu, đúng thứ làm video ra cụt lủn.
  assert.deepEqual(lintSpec(mkArticle(photoStoryOf(26))), []);
  assert.ok(lintSpec(mkArticle(photoStoryOf(35))).some((x) => x.includes("tối đa 34")));
});

test('lint: kiểu "article" vẫn cấm đồ hoạ/bullet như kiểu ảnh', () => {
  const spec = mkArticle([
    photoScene("s1", "hook"),
    photoScene("s2", "bullet", { bullets: ["một", "hai"] }),
    photoScene("s3", "cta"),
  ]);
  const p = lintSpec(spec).join("\n");
  assert.match(p, /scene "s2".*layout "bullet"/);
  assert.match(p, /scene "s2".*bullets/);
});
