import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * stock.ts — lấy ẢNH và VIDEO THẬT từ Pexels (miễn phí, cần API key free: pexels.com/api).
 *   media.kind "pexels"       → fetchStockImage(), src = TỪ KHÓA tìm ảnh.
 *   media.kind "pexels-video" → fetchStockVideo(), src = TỪ KHÓA tìm clip.
 * Từ khóa nên viết TIẾNG ANH cho kết quả tốt nhất.
 * Cả hai đều cache theo hash(query + orientation + index) để build lại không tốn quota.
 */

const CACHE_DIR = path.join(process.cwd(), ".cache", "stock");

export interface StockOptions {
  orientation: "landscape" | "portrait" | "square";
  /** Lấy kết quả thứ mấy (0 = hợp nhất). Đổi số để lấy clip/ảnh khác. */
  index?: number;
}

interface PexelsPhoto {
  src: { original: string; large2x: string; large: string; portrait: string; landscape: string };
}

interface PexelsVideoFile {
  id: number;
  quality: "hd" | "sd" | "uhd" | string;
  file_type: string;
  width: number | null;
  height: number | null;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  video_files: PexelsVideoFile[];
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

/* ------------------------------- Video -------------------------------- */

/** Khung đích của video dọc — dùng để chấm điểm chọn file phù hợp nhất. */
const TARGET_W = 1080;
const TARGET_H = 1920;

/**
 * pickVideoFile — chọn file tải về trong danh sách biến thể của 1 video Pexels.
 *
 * Tiêu chí, theo thứ tự quan trọng:
 *   1. Phải là MP4 (h264) — Remotion/ffmpeg decode nhanh và chắc chắn được.
 *   2. Đủ độ phân giải: chiều ngắn ≥ 1080 để không bị vỡ khi crop về khung dọc.
 *   3. Trong số đủ điều kiện, lấy file NHỎ NHẤT — tải nhanh, render nhẹ, chất lượng
 *      vẫn thừa cho khung 1080x1920. (Chọn "to nhất" là sai: 4K làm render chậm gấp bội
 *      mà người xem TikTok không phân biệt được.)
 * Nếu không file nào đủ 1080 thì lấy file lớn nhất có được.
 */
function pickVideoFile(v: PexelsVideo): PexelsVideoFile | undefined {
  const mp4 = v.video_files.filter((f) => f.file_type === "video/mp4" && f.width && f.height);
  if (!mp4.length) return v.video_files[0];

  const area = (f: PexelsVideoFile) => (f.width ?? 0) * (f.height ?? 0);
  const shortSide = (f: PexelsVideoFile) => Math.min(f.width ?? 0, f.height ?? 0);

  const enough = mp4.filter((f) => shortSide(f) >= Math.min(TARGET_W, TARGET_H));
  if (enough.length) return enough.sort((a, b) => area(a) - area(b))[0];
  return mp4.sort((a, b) => area(b) - area(a))[0];
}

export interface StockVideo {
  /** Đường dẫn file .mp4 trong cache. */
  filePath: string;
  /** Độ dài clip (giây) — do Pexels báo. Composition cần nó để LẶP clip đúng chỗ. */
  durationSec: number;
}

/**
 * fetchStockVideo — tìm & tải 1 clip thật từ Pexels.
 *
 * Ưu tiên clip DÀI (≥ 8s) để khi làm nền cả cảnh thì vòng lặp ít lộ. Nếu không có clip
 * nào đủ dài thì lấy clip dài nhất tìm được; composition sẽ lặp nó cho khớp độ dài cảnh.
 *
 * Độ dài lấy thẳng từ Pexels (field `duration`) nên KHÔNG cần ffprobe — build chạy được
 * cả trên máy chưa cài ffmpeg. Cache kèm một file .json nhỏ để lần build sau vẫn biết
 * độ dài mà không phải gọi lại API.
 */
export async function fetchStockVideo(query: string, opts: StockOptions): Promise<StockVideo> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("Thiếu PEXELS_API_KEY (đăng ký miễn phí ở pexels.com/api, xem .env.example).");
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const index = opts.index ?? 0;
  const cacheKey = createHash("sha256").update(`video:${query}:${opts.orientation}:${index}`).digest("hex").slice(0, 20);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp4`);
  const metaPath = path.join(CACHE_DIR, `${cacheKey}.json`);
  if (existsSync(cachePath) && existsSync(metaPath)) {
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as { durationSec: number };
    console.log(`[stock]   cache hit (video)`);
    return { filePath: cachePath, durationSec: meta.durationSec };
  }

  const url =
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}` +
    `&per_page=${index + 8}&orientation=${opts.orientation}&size=medium`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels Video lỗi ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as { videos: PexelsVideo[] };
  if (!data.videos?.length) throw new Error(`Pexels không tìm thấy video cho "${query}". Đổi từ khóa khác.`);

  // Ưu tiên clip đủ dài; giữ nguyên thứ hạng liên quan của Pexels trong nhóm đủ dài.
  const longEnough = data.videos.filter((v) => v.duration >= 8);
  const pool = longEnough.length ? longEnough : [...data.videos].sort((a, b) => b.duration - a.duration);
  const video = pool[Math.min(index, pool.length - 1)]!;

  const file = pickVideoFile(video);
  if (!file) throw new Error(`Video Pexels "${query}" không có file tải được.`);

  console.log(`[stock]   tải video Pexels "${query}" (${file.width}x${file.height}, ${video.duration}s)…`);
  const dl = await fetch(file.link);
  if (!dl.ok) throw new Error(`Tải video Pexels lỗi ${dl.status}`);
  await fs.writeFile(cachePath, Buffer.from(await dl.arrayBuffer()));

  // Pexels có lúc trả duration = 0; khi đó coi như không biết (0) và bỏ lặp.
  const durationSec = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  await fs.writeFile(metaPath, JSON.stringify({ durationSec }), "utf8");
  return { filePath: cachePath, durationSec };
}
