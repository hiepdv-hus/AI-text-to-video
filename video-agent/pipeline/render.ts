import path from "node:path";
import os from "node:os";
import { existsSync, readdirSync, statSync } from "node:fs";
import { cp } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { BuiltProps } from "../src/schema.ts";
import { OUT_DIR } from "./build.ts";

/**
 * render.ts — props.json → MP4 bằng @remotion/renderer.
 *   - codec h264, CRF ~23
 *   - concurrency = số core - 1
 *   - onProgress in tiến độ
 *   - xuất out/<slug>/final.mp4
 */

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
  cachedBundle = await bundle({
    entryPoint: entry,
    // webpackOverride giữ mặc định.
  });
  cachedSrcMtime = mtime;
  return cachedBundle;
}

/**
 * Đồng bộ public/ hiện tại vào bundle trước mỗi lần render.
 * Lý do: Remotion COPY public/ vào bundle lúc bundle() (Windows không symlink được),
 * nên audio/asset tạo Ở LẦN RENDER SAU không có trong bundle cache → lỗi 404.
 * Copy lại (file nhỏ) rẻ hơn nhiều so với bundle lại toàn bộ.
 */
async function syncPublicIntoBundle(serveUrl: string): Promise<void> {
  const src = path.resolve(process.cwd(), "public");
  const dest = path.join(serveUrl, "public");
  if (existsSync(src)) {
    await cp(src, dest, { recursive: true });
  }
}

export interface RenderResult {
  outputPath: string;
}

export async function renderVideo(slug: string, props: BuiltProps): Promise<RenderResult> {
  const serveUrl = await getBundle();
  await syncPublicIntoBundle(serveUrl);
  const composition = await selectComposition({
    serveUrl,
    id: props.meta.template,
    inputProps: props,
  });

  const outputPath = path.join(OUT_DIR, slug, "final.mp4");
  const concurrency = Math.max(1, os.cpus().length - 1);

  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 23,
    concurrency,
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

  return { outputPath };
}
