import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * stock.ts — lấy ẢNH THẬT từ Pexels (miễn phí, cần API key free: pexels.com/api).
 * media.kind "pexels", src = TỪ KHÓA tìm kiếm (tiếng Anh cho kết quả tốt nhất).
 * Có cache theo hash(query + orientation + index).
 */

const CACHE_DIR = path.join(process.cwd(), ".cache", "stock");

export interface StockOptions {
  orientation: "landscape" | "portrait" | "square";
  /** Lấy ảnh thứ mấy trong kết quả (0 = hợp nhất). Đổi số để lấy ảnh khác. */
  index?: number;
}

interface PexelsPhoto {
  src: { original: string; large2x: string; large: string; portrait: string; landscape: string };
}

export async function fetchStockImage(query: string, opts: StockOptions): Promise<string> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("Thiếu PEXELS_API_KEY (đăng ký miễn phí ở pexels.com/api, xem .env.example).");
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const index = opts.index ?? 0;
  const cacheKey = createHash("sha256").update(`${query}:${opts.orientation}:${index}`).digest("hex").slice(0, 20);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.jpg`);
  if (existsSync(cachePath)) {
    console.log(`[stock]   cache hit`);
    return cachePath;
  }

  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&per_page=${index + 5}&orientation=${opts.orientation}`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels lỗi ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as { photos: PexelsPhoto[] };
  if (!data.photos?.length) throw new Error(`Pexels không tìm thấy ảnh cho "${query}". Đổi từ khóa khác.`);

  const photo = data.photos[Math.min(index, data.photos.length - 1)]!;
  const picUrl =
    opts.orientation === "portrait"
      ? photo.src.portrait
      : opts.orientation === "landscape"
        ? photo.src.landscape
        : photo.src.large2x;

  console.log(`[stock]   tải ảnh Pexels cho "${query}"…`);
  const img = await fetch(picUrl);
  if (!img.ok) throw new Error(`Tải ảnh Pexels lỗi ${img.status}`);
  const buf = Buffer.from(await img.arrayBuffer());
  await fs.writeFile(cachePath, buf);
  return cachePath;
}
