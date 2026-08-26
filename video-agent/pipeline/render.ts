import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";
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

let cachedBundle: string | null = null;

async function getBundle(): Promise<string> {
  if (cachedBundle) return cachedBundle;
  const entry = path.resolve(process.cwd(), "src", "index.ts");
  process.stdout.write("[render] bundling…\n");
  cachedBundle = await bundle({
    entryPoint: entry,
    // webpackOverride giữ mặc định.
  });
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
