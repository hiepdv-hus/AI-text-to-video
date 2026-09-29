import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Shot, Story, Camera } from "../src/schema.ts";

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

/**
 * Style KHOÁ THEO THEME — để MỌI ảnh AI trong cùng một video ăn cùng một tông (nền tối
 * xanh matrix cho "tech", nâu ấm cho claude…). Đây là mấu chốt để ảnh AI không "mỗi cái
 * một kiểu": cùng một palette + cùng "flat vector illustration" thì bốn ảnh của bốn cảnh
 * trông như cùng một bộ.
 *
 * "no text, no words, no letters": mô hình sinh ảnh viết chữ ra rất xấu (chữ méo, sai
 * chính tả) và đá nhau với tiêu đề — cấm hẳn chữ trong ảnh, để chữ cho phần caption/heading.
 */
export function applyIllustrationStyle(prompt: string, background: string): string {
  // Prompt đã tự khai style riêng thì tôn trọng, chỉ thêm luật "không chữ".
  const hasOwnStyle = /illustration|photo|style|render|art|3d|painting/i.test(prompt);
  const palette =
    background === "tech"
      ? "dark navy background, teal and cyan neon accents, glowing thin lines"
      : background === "claude-cream"
        ? "warm cream background, earthy terracotta orange accents, soft"
        : "warm dark charcoal background, earthy terracotta orange accents";
  const base = hasOwnStyle
    ? prompt
    : `${prompt}, flat vector illustration, ${palette}, minimal, clean, high detail, centered composition`;
  return `${base}, no text, no words, no letters, no watermark`;
}

export interface ImageGenOptions {
  width: number;
  height: number;
}

/**
 * compileCinematicPrompt — ghép công thức KHUNG PHIM (layout "shot") thành MỘT prompt ảnh
 * điện ảnh. Khác `applyIllustrationStyle` (flat vector): đây là ảnh QUAY THẬT — ánh sáng,
 * ống kính, độ sâu trường ảnh. Nhân vật + phong cách của `story` được nhét vào MỌI shot để
 * các khung "cùng một bộ phim".
 *
 * Cố ý mở đầu bằng "cinematic photo" (có chữ "photo") để generateImage không chèn nhầm
 * DEFAULT_STYLE (flat vector) đè lên. "no text" vì chữ AI vẽ ra luôn méo.
 */
const SHOT_SIZE_PHRASE: Record<Camera["shot"], string> = {
  wide: "wide establishing shot",
  medium: "medium shot",
  close: "close-up",
  "extreme-close": "extreme close-up",
};

export function compileCinematicPrompt(shot: Shot | undefined, story?: Story): string {
  const s: Partial<Shot> = shot ?? {};
  const parts = [
    "cinematic photo, film still",
    s.camera?.shot ? SHOT_SIZE_PHRASE[s.camera.shot] : undefined,
    s.subject,
    s.action,
    s.world,
    s.light ? `${s.light} lighting` : undefined,
    s.composition,
    s.emotion ? `${s.emotion} atmosphere` : undefined,
    story?.protagonist,
    story?.look,
    "shallow depth of field, 35mm, photorealistic, highly detailed, no text, no watermark",
  ].filter(Boolean);
  return parts.join(", ");
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
  const jitter = parseInt(key.slice(0, 4), 16) % 900;

  // Model chính đổi được qua env; nếu nó bị chặn (402/429) dai dẳng thì tự lùi về "turbo"
  // (tier miễn phí, hiếm khi bị 402). token (nếu có) gỡ luôn giới hạn free.
  const primary = process.env.POLLINATIONS_MODEL ?? "flux";
  const models = primary === "turbo" ? ["turbo"] : [primary, "turbo"];
  const token = process.env.POLLINATIONS_TOKEN;

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi]!;
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=${opts.width}&height=${opts.height}&nologo=true&model=${model}&seed=${seed}` +
      (token ? `&token=${encodeURIComponent(token)}` : "");

    // 402 (free tier hết lượt tạm thời) và 429 (quá nhanh) đều là lỗi TẠM → chờ rồi thử
    // lại; 5xx cũng vậy. Các mã khác coi như hỏng hẳn model này → sang model kế.
    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        await new Promise((r) => setTimeout(r, 1000 * attempt + jitter));
        continue;
      }
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length >= 1000) return buf;
      }
      const retryable = res.status === 402 || res.status === 429 || res.status >= 500;
      if (retryable && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt + jitter));
        continue;
      }
      // Hết lượt thử với model này (hoặc mã lỗi không cứu được) → thoát vòng, sang model sau.
      if (mi === models.length - 1 && attempt >= maxAttempts) {
        throw new Error(
          `Pollinations lỗi ${res.status} sau khi thử ${models.join(", ")}. ` +
            `Free tier có thể đang quá tải — thử lại sau, hoặc đặt POLLINATIONS_TOKEN / IMAGE_PROVIDER=openai.`,
        );
      }
      break;
    }
    console.log(`[imagegen]   model "${model}" chưa được, thử "${models[mi + 1] ?? "(hết)"}"…`);
  }
  throw new Error("Pollinations: không lấy được ảnh (đã thử mọi model).");
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
