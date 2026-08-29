import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * imagegen.ts — tự sinh ẢNH MINH HỌA từ mô tả (prompt).
 *
 * Mặc định dùng Pollinations.ai: MIỄN PHÍ, KHÔNG cần key (model Flux). Đặt
 * IMAGE_PROVIDER=openai + OPENAI_API_KEY để dùng DALL·E chất lượng cao hơn.
 *
 * Có CACHE theo hash(prompt + kích thước + provider) → render lại không sinh lại.
 * Prompt nên bằng TIẾNG ANH, cụ thể, tránh từ đa nghĩa (vd "map" dễ ra bản đồ).
 */

const CACHE_DIR = path.join(process.cwd(), ".cache", "images");

/** Khoá tuần tự: chỉ 1 lần SINH ảnh chạy tại một thời điểm (Pollinations free chỉ cho
 * 1 request/IP). Các scene song song vẫn chờ nhau ở bước gọi mạng. */
let genLock: Promise<void> = Promise.resolve();
async function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const prev = genLock;
  let release!: () => void;
  genLock = new Promise<void>((r) => (release = r));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}
const DEFAULT_STYLE =
  ", flat vector illustration, clean modern design, vibrant colors, minimal, high detail, tech theme";

export interface ImageGenOptions {
  width: number;
  height: number;
}

/** Sinh ảnh từ prompt, trả về đường dẫn file (trong cache). */
export async function generateImage(prompt: string, opts: ImageGenOptions): Promise<string> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const provider = process.env.IMAGE_PROVIDER ?? "pollinations";
  const styled = /illustration|photo|style|render|art/i.test(prompt) ? prompt : prompt + DEFAULT_STYLE;

  const key = createHash("sha256")
    .update(`${provider}:${styled}:${opts.width}x${opts.height}`)
    .digest("hex")
    .slice(0, 20);
  const cachePath = path.join(CACHE_DIR, `${key}.jpg`);
  if (existsSync(cachePath)) {
    console.log(`[imagegen]   cache hit`);
    return cachePath;
  }

  console.log(`[imagegen]   sinh ảnh (${provider})…`);
  const buf = await serialize(() =>
    provider === "openai" ? genOpenAI(styled, opts) : genPollinations(styled, opts, key),
  );
  if (buf.length < 1000) throw new Error("Ảnh sinh ra rỗng/không hợp lệ.");
  await fs.writeFile(cachePath, buf);
  return cachePath;
}

async function genPollinations(prompt: string, opts: ImageGenOptions, key: string): Promise<Buffer> {
  const seed = parseInt(key.slice(0, 6), 16) % 1_000_000; // seed cố định → ảnh ổn định
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${opts.width}&height=${opts.height}&nologo=true&model=flux&seed=${seed}`;

  // Free tier chỉ cho 1 request/đồng thời/IP → thử lại khi 429, có jitter (theo key)
  // để nhiều ảnh không cùng nhịp mà tự giãn ra.
  const jitter = parseInt(key.slice(0, 4), 16) % 900;
  const maxAttempts = 7;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length >= 1000) return buf;
    } else if (res.status === 429 && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1400 * attempt + jitter));
      continue;
    } else if (attempt >= maxAttempts) {
      throw new Error(`Pollinations lỗi ${res.status} sau ${maxAttempts} lần.`);
    } else {
      await new Promise((r) => setTimeout(r, 900 * attempt));
    }
  }
  throw new Error("Pollinations: không lấy được ảnh.");
}

async function genOpenAI(prompt: string, opts: ImageGenOptions): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("IMAGE_PROVIDER=openai nhưng thiếu OPENAI_API_KEY.");
  const size = opts.width > opts.height ? "1792x1024" : opts.width < opts.height ? "1024x1792" : "1024x1024";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "dall-e-3", prompt, size, n: 1, response_format: "b64_json" }),
  });
  if (!res.ok) throw new Error(`OpenAI ảnh lỗi ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data: { b64_json: string }[] };
  return Buffer.from(data.data[0]!.b64_json, "base64");
}
