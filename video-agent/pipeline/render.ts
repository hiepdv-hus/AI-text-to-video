import path from "node:path";
import os from "node:os";
import { existsSync, readdirSync, statSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { BuiltProps } from "../src/schema.ts";
import { OUT_DIR } from "./build.ts";

/**
 * render.ts — props.json → MP4 bằng @remotion/renderer.
 *   - codec h264, CRF ~23
 *   - concurrency: xem renderConcurrency() bên dưới
 *   - onProgress in tiến độ
 *   - xuất out/<slug>/final.mp4
 */

/** Thư mục bundle CỐ ĐỊNH. Xem ghi chú ở getBundle(). */
const BUNDLE_DIR = path.resolve(process.cwd(), ".cache", "bundle-serve");

/**
 * Thư mục public RỖNG đưa cho bundler.
 *
 * bundle() mặc định COPY toàn bộ public/ vào bundle. public/ ở đây chứa mọi clip
 * Pexels + audio của MỌI video từng dựng (đo được 220 MB và chỉ có tăng), trong khi
 * một lần render chỉ đụng tới vài chục MB của riêng nó. Nên chỉ vào một thư mục rỗng,
 * rồi syncPublicIntoBundle() chép đúng phần cần (xem hàm đó).
 */
const EMPTY_PUBLIC_DIR = path.resolve(process.cwd(), ".cache", "bundle-public-empty");

/** mtime mới nhất của mọi file trong src/ — để biết code có đổi từ lần bundle trước không. */
function latestSrcMtime(): number {
  const root = path.resolve(process.cwd(), "src");
  let max = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else max = Math.max(max, st.mtimeMs);
    }
  };
  if (existsSync(root)) walk(root);
  return max;
}

let cachedBundle: string | null = null;
let cachedSrcMtime = 0;

async function getBundle(): Promise<string> {
  const mtime = latestSrcMtime();
  // Tái dùng bundle CHỈ KHI không có file src/ nào đổi từ lần bundle trước.
  // (Server chạy dài như `pnpm web` sẽ tự bundle lại khi bạn sửa component → không dính bundle cũ.)
  if (cachedBundle && mtime <= cachedSrcMtime) return cachedBundle;
  const entry = path.resolve(process.cwd(), "src", "index.ts");
  process.stdout.write(cachedBundle ? "[render] code đổi → bundle lại…\n" : "[render] bundling…\n");
  await mkdir(EMPTY_PUBLIC_DIR, { recursive: true });
  cachedBundle = await bundle({
    entryPoint: entry,
    // outDir CỐ ĐỊNH thay vì để bundler tự mkdtemp trong %TEMP%.
    // Mặc định mỗi lần gọi bundle() sinh MỘT thư mục tạm mới và không bao giờ xoá —
    // mỗi lần khởi động lại `pnpm web` hay mỗi lệnh `pnpm video render` là thêm một bản
    // sao (kèm nguyên public/ bên trong). Trên máy này đã đọng 45 thư mục ≈ 5.2 GB.
    // Trỏ vào một chỗ cố định thì chỉ còn đúng MỘT bundle, được ghi đè mỗi lần.
    // Đánh đổi: KHÔNG chạy hai tiến trình render cùng lúc (vd `pnpm web` và
    // `pnpm video render` song song) vì chúng sẽ ghi đè bundle của nhau.
    outDir: BUNDLE_DIR,
    publicDir: EMPTY_PUBLIC_DIR,
    // webpackOverride giữ mặc định.
  });
  cachedSrcMtime = mtime;
  return cachedBundle;
}

/**
 * Đồng bộ asset của LẦN RENDER NÀY vào bundle.
 *
 * Lý do phải sync sau khi bundle: Remotion COPY public/ vào bundle lúc bundle() (Windows
 * không symlink được), nên audio/clip tạo Ở LẦN RENDER SAU không có trong bundle cache →
 * lỗi 404.
 *
 * Lý do chép CÓ CHỌN LỌC chứ không `cp public → bundle/public`: public/ giữ asset của mọi
 * video từng dựng. Bản trước chép cả 220 MB trước MỖI lần render, trong khi video đang
 * dựng chỉ cần audio của chính nó + vài clip nền + thư mục sfx (~2 MB). Danh sách file
 * cần chép lấy thẳng từ props — đúng những đường dẫn mà staticFile() sẽ hỏi tới.
 */
async function syncPublicIntoBundle(serveUrl: string, props: BuiltProps): Promise<void> {
  const publicDir = path.resolve(process.cwd(), "public");
  const destRoot = path.join(serveUrl, "public");

  /** Đường dẫn tương đối với public/ mà composition sẽ gọi staticFile(). */
  const wanted = new Set<string>();
  const add = (src: string | undefined) => {
    // Bỏ qua URL tuyệt đối và data: — trình duyệt tải thẳng, không qua public/.
    if (!src || /^https?:\/\//.test(src) || src.startsWith("data:")) return;
    wanted.add(src.replace(/^\/+/, "").split(path.sep).join("/"));
  };

  for (const scene of props.scenes) {
    add(scene.audioSrc);
    if (scene.media && scene.media.kind !== "color") add(scene.media.src);
  }
  add(props.music?.src);

  for (const rel of wanted) {
    const from = path.join(publicDir, rel);
    if (!existsSync(from)) continue;
    const to = path.join(destRoot, rel);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to);
  }

  // sfx/ đi cả thư mục: SceneWrapper chọn file theo kiểu chuyển cảnh nên không suy ra
  // được từ props, và cả thư mục cũng chỉ ~2 MB.
  const sfxDir = path.join(publicDir, "sfx");
  if (existsSync(sfxDir)) await cp(sfxDir, path.join(destRoot, "sfx"), { recursive: true });
}

/**
 * Số frame render SONG SONG. Mỗi đơn vị là một tab Chrome headless raster 1080x1920
 * bằng CPU (headless không dùng GPU), cộng thêm ffmpeg encode chạy cùng lúc.
 *
 * Bản trước đặt `số core - 1` (11 trên máy 6 nhân/12 luồng) → chiếm trọn CPU suốt lúc
 * render mà KHÔNG nhanh hơn. Đo thực tế trên clip 60 frame:
 *     concurrency=6   cảnh có video 219 ms/frame · cảnh đồ hoạ 191 ms/frame
 *     concurrency=11  cảnh có video 206 ms/frame · cảnh đồ hoạ 214 ms/frame
 * Nghĩa là quá 6 thì chỉ còn tranh nhau core và RAM (mỗi tab giữ frame video đã giải mã).
 *
 * Mặc định lấy đúng công thức của Remotion — một nửa số luồng, tối đa 8 — nên còn lại
 * một nửa máy để dùng việc khác. Đổi bằng biến môi trường RENDER_CONCURRENCY nếu muốn.
 */
function renderConcurrency(): number {
  const cores = os.cpus().length;
  const fromEnv = Number(process.env.RENDER_CONCURRENCY);
  if (Number.isFinite(fromEnv) && fromEnv >= 1) return Math.min(Math.floor(fromEnv), cores);
  return Math.round(Math.min(8, Math.max(1, cores / 2)));
}

/**
 * Dọn thư mục tạm Remotion còn sót của những lần chạy TRƯỚC.
 *
 * Hai loại rác, cả hai đều do Remotion tạo trong %TEMP% và không tự xoá khi tiến trình
 * bị kill (Ctrl-C lúc đang render, server tắt giữa chừng…):
 *   remotion-webpack-bundle-*  bundle cũ, mỗi cái kèm một bản sao public/ (hàng trăm MB)
 *   remotion-v*-assets*        frame video OffthreadVideo giải mã tạm
 * outDir cố định ở getBundle() chặn nguồn sinh rác mới; hàm này dọn phần đã đọng.
 *
 * Chỉ đụng tới thư mục KHÔNG ĐỘNG TỚI trong `maxAgeHours` giờ, để không giẫm lên một
 * tiến trình Remotion khác đang chạy song song. Đặt RENDER_NO_TMP_CLEAN=1 để tắt hẳn.
 *
 * `apply: false` chỉ đo, không xoá — dùng cho chế độ xem trước của `pnpm video clean`.
 */
export async function cleanRemotionTmp(
  opts: { maxAgeHours?: number; apply?: boolean } = {},
): Promise<{ removed: number; bytes: number }> {
  const { maxAgeHours = 6, apply = true } = opts;
  const tmp = os.tmpdir();
  const cutoff = Date.now() - maxAgeHours * 3600_000;
  let removed = 0;
  let bytes = 0;

  let entries: string[];
  try {
    entries = await readdir(tmp);
  } catch {
    return { removed, bytes };
  }

  for (const name of entries) {
    if (!/^remotion-(webpack-bundle-|v[\d.]+-assets)/.test(name)) continue;
    const dir = path.join(tmp, name);
    try {
      const st = await stat(dir);
      if (!st.isDirectory() || st.mtimeMs > cutoff) continue;
      bytes += await dirSize(dir);
      if (apply) await rm(dir, { recursive: true, force: true });
      removed++;
    } catch {
      // Đang bị tiến trình khác giữ / đã biến mất — bỏ qua, lần sau dọn tiếp.
    }
  }
  return { removed, bytes };
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    let items;
    try {
      items = await readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const it of items) {
      const p = path.join(cur, it.name);
      if (it.isDirectory()) stack.push(p);
      else {
        try {
          total += (await stat(p)).size;
        } catch {
          /* file vừa biến mất */
        }
      }
    }
  }
  return total;
}

const MB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

/** Chỉ dọn MỘT LẦN mỗi tiến trình — server chạy dài không cần quét %TEMP% mỗi lần render. */
let tmpCleaned = false;

export interface RenderResult {
  outputPath: string;
}

export async function renderVideo(slug: string, props: BuiltProps): Promise<RenderResult> {
  if (!tmpCleaned && process.env.RENDER_NO_TMP_CLEAN !== "1") {
    tmpCleaned = true;
    const { removed, bytes } = await cleanRemotionTmp({});
    if (removed > 0) console.log(`[render] dọn ${removed} thư mục tạm Remotion cũ (${MB(bytes)}).`);
  }

  const serveUrl = await getBundle();
  await syncPublicIntoBundle(serveUrl, props);
  const composition = await selectComposition({
    serveUrl,
    id: props.meta.template,
    inputProps: props,
  });

  const outputPath = path.join(OUT_DIR, slug, "final.mp4");
  const concurrency = renderConcurrency();
  console.log(`[render] ${concurrency}/${os.cpus().length} luồng (đổi bằng RENDER_CONCURRENCY).`);

  const run = async (offthreadVideoThreads: number) => {
    let lastPct = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: 23,
      concurrency,
      offthreadVideoThreads,
      inputProps: props,
      outputLocation: outputPath,
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          process.stdout.write(`\r[render] ${pct}%   `);
        }
      },
    });
    process.stdout.write("\n");
  };

  try {
    await run(2); // 2 = mặc định của Remotion
  } catch (err) {
    // "No frame found at position N" là lỗi CHẬP CHỜN của compositor Remotion, không phải
    // clip hỏng: cùng một file, cùng một spec, lần chạy này hỏng lần sau lại qua. Đã kiểm
    // chứng bằng cách so PTS (đều tăm tắp), đếm frame giải mã (đủ), và so hash bản sao tạm
    // của Remotion với file gốc (trùng khớp).
    //
    // Thử lại MỘT lần với 1 luồng giải mã video: seek tuần tự nên không còn tranh chấp.
    // Chậm hơn, nhưng chỉ trả giá đó ở lần hỏng, và đổi lại không mất cả lượt render.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/No frame found at position/i.test(msg)) throw err;
    console.warn(
      `\n[render] Compositor hụt frame (lỗi chập chờn của Remotion, KHÔNG phải clip hỏng).` +
        `\n[render] Thử lại với 1 luồng giải mã video…`,
    );
    await run(1);
  }

  return { outputPath };
}
