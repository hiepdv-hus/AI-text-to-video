import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * assets.ts — tải/chuẩn hoá asset về public/ để staticFile() dùng được.
 *  - src http(s)/data: → tải về public/assets/<hash>.<ext>, trả path tương đối public/.
 *  - src đã nằm trong public/ (đường dẫn tương đối) → giữ nguyên.
 *  - kind "color" → không phải asset.
 */

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const ASSET_SUBDIR = "assets";

function extFromUrl(url: string, fallback: string): string {
  const clean = url.split("?")[0] ?? url;
  const ext = path.extname(clean);
  return ext && ext.length <= 6 ? ext : fallback;
}

/** Trả về đường dẫn TƯƠNG ĐỐI với public/ (dùng cho staticFile). */
export async function downloadAsset(src: string, fallbackExt = ".jpg"): Promise<string> {
  if (src.startsWith("data:")) return src; // inline data URI dùng trực tiếp

  if (!/^https?:\/\//.test(src)) {
    // Đã là đường dẫn trong public/. Chuẩn hoá dấu gạch.
    return src.replace(/^\/+/, "").split(path.sep).join("/");
  }

  const ext = extFromUrl(src, fallbackExt);
  const name = createHash("sha256").update(src).digest("hex").slice(0, 16) + ext;
  const rel = `${ASSET_SUBDIR}/${name}`;
  const abs = path.join(PUBLIC_DIR, ASSET_SUBDIR, name);

  try {
    await fs.access(abs);
    return rel; // cache: đã tải trước đó
  } catch {
    /* chưa có → tải */
  }

  const res = await fetch(src);
  if (!res.ok) throw new Error(`Tải asset lỗi ${res.status}: ${src}`);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await res.arrayBuffer()));
  return rel;
}

export { PUBLIC_DIR };
