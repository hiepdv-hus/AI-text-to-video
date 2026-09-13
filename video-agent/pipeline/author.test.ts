import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { extractJson, authorSpec } from "./author.ts";
import { lintSpec, MAX_CODE_LINE } from "./lint.ts";
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
async function withFakeLlm<T>(replies: string[], fn: () => Promise<T>): Promise<{ result: T; calls: string[] }> {
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

  const saved = { ...process.env };
  process.env.LLM_PROVIDER = "compat";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.LLM_API_KEY = "test";
  process.env.LLM_MODEL = "fake";
  try {
    return { result: await fn(), calls };
  } finally {
    process.env = saved;
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
  const { result, calls } = await withFakeLlm([GOOD_SPEC], () => authorSpec("video về Trấn Thành"));
  assert.equal(result.attempts, 1);
  assert.equal(result.spec.scenes.length, 4);
  assert.equal(calls.length, 1);
});

test("authorSpec: bọc ``` + lời dẫn vẫn bóc ra được", async () => {
  const { result } = await withFakeLlm(
    ["Đây nhé:\n```json\n" + GOOD_SPEC + "\n```"],
    () => authorSpec("video về Trấn Thành"),
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
    () => authorSpec("video về Trấn Thành"),
  );
  assert.equal(result.attempts, 2);
  assert.equal(calls.length, 2);
  // Lượt nhắc lại phải chở theo mô tả lỗi cụ thể, không phải "làm lại đi".
  assert.match(calls[1]!, /sẽ bị cắt/);
});

test("authorSpec: sai Zod cũng được nhắc lại đúng đường dẫn trường", async () => {
  const badZod = '{"meta":{"title":"X"},"scenes":[],"voice":{},"captions":{}}';
  const { result, calls } = await withFakeLlm([badZod, GOOD_SPEC], () => authorSpec("brief"));
  assert.equal(result.attempts, 2);
  assert.match(calls[1]!, /meta\.template|scenes/);
});

test("authorSpec: hết lượt vẫn sai thì BÁO LỖI, không trả spec hỏng", async () => {
  await assert.rejects(
    () => withFakeLlm(['{"không":"phải spec"}'], () => authorSpec("brief")),
    /vẫn chưa ra spec hợp lệ/,
  );
});
