import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import { OUT_DIR } from "./build.ts";
import { cleanRemotionTmp } from "./render.ts";

/**
 * clean.ts — dọn rác đĩa của pipeline.
 *
 * Ba nguồn phình to, theo thứ tự nặng dần trên máy thật:
 *   1. %TEMP%/remotion-*        bundle + frame tạm Remotion bỏ lại khi tiến trình bị kill.
 *   2. public/{video,images,audio}/<slug>  asset của video đã xoá khỏi out/ và specs/.
 *   3. .cache/stock             clip & ảnh Pexels đã tải (chỉ xoá khi có --stock: xoá là
 *                               lần build sau phải tải lại, tốn quota API).
 *
 * Mặc định chỉ báo cáo (dry-run). Thêm --yes mới thật sự xoá.
 */

export interface CleanTarget {
  label: string;
  path: string;
  bytes: number;
}

export interface CleanReport {
  targets: CleanTarget[];
  tmpRemoved: number;
  tmpBytes: number;
  totalBytes: number;
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

/** Slug nào còn "sống": có thư mục trong out/ hoặc có spec trong specs/. */
async function liveSlugs(root: string): Promise<Set<string>> {
  const live = new Set<string>();
  try {
    for (const d of await readdir(OUT_DIR, { withFileTypes: true })) {
      if (d.isDirectory()) live.add(d.name);
    }
  } catch {
    /* chưa có out/ */
  }
  try {
    for (const f of await readdir(path.join(root, "specs"))) {
      if (f.endsWith(".json")) live.add(f.replace(/\.json$/, ""));
    }
  } catch {
    /* chưa có specs/ */
  }
  return live;
}

/** Mã thư mục ảnh bài báo được nhắc tới trong specs/*.json và out/<slug>/*.json. */
async function referencedArticleKeys(root: string): Promise<Set<string>> {
  const files: string[] = [];
  const jsonIn = async (dir: string) => {
    try {
      for (const f of await readdir(dir)) if (f.endsWith(".json")) files.push(path.join(dir, f));
    } catch {
      /* chưa có thư mục */
    }
  };
  await jsonIn(path.join(root, "specs"));
  try {
    for (const d of await readdir(OUT_DIR, { withFileTypes: true })) {
      if (d.isDirectory()) await jsonIn(path.join(OUT_DIR, d.name));
    }
  } catch {
    /* chưa có out/ */
  }
  const keys = new Set<string>();
  for (const f of files) {
    try {
      for (const m of (await readFile(f, "utf8")).matchAll(/articles\/([0-9a-f]{12})\//g)) keys.add(m[1]!);
    } catch {
      /* file vừa biến mất */
    }
  }
  return keys;
}

export async function cleanWorkspace(opts: { apply: boolean; stock: boolean }): Promise<CleanReport> {
  const root = process.cwd();
  const live = await liveSlugs(root);
  const targets: CleanTarget[] = [];

  // Asset mồ côi: thư mục con trong public/{audio,video,images} không còn slug nào nhận.
  for (const kind of ["audio", "video", "images"]) {
    const base = path.join(root, "public", kind);
    if (!existsSync(base)) continue;
    for (const d of await readdir(base, { withFileTypes: true })) {
      if (!d.isDirectory() || live.has(d.name)) continue;
      const p = path.join(base, d.name);
      targets.push({ label: `public/${kind}/${d.name} (mồ côi)`, path: p, bytes: await dirSize(p) });
    }
  }

  // Ảnh bài báo nằm theo MÃ LINK (public/articles/<mã>), không theo slug — còn spec hay
  // bản build nào nhắc tới mã đó thì giữ.
  const articlesDir = path.join(root, "public", "articles");
  if (existsSync(articlesDir)) {
    const used = await referencedArticleKeys(root);
    for (const d of await readdir(articlesDir, { withFileTypes: true })) {
      if (!d.isDirectory() || used.has(d.name)) continue;
      const p = path.join(articlesDir, d.name);
      targets.push({ label: `public/articles/${d.name} (ảnh bài báo không còn dùng)`, path: p, bytes: await dirSize(p) });
    }
  }

  if (opts.stock) {
    const stock = path.join(root, ".cache", "stock");
    if (existsSync(stock)) {
      targets.push({ label: ".cache/stock (tải lại từ Pexels khi cần)", path: stock, bytes: await dirSize(stock) });
    }
  }

  if (opts.apply) {
    for (const t of targets) await rm(t.path, { recursive: true, force: true });
  }
  // maxAgeHours = 0: người dùng chủ động gọi lệnh clean nên dọn cả thư mục vừa tạo.
  const { removed: tmpRemoved, bytes: tmpBytes } = await cleanRemotionTmp({
    maxAgeHours: 0,
    apply: opts.apply,
  });

  return {
    targets,
    tmpRemoved,
    tmpBytes,
    totalBytes: targets.reduce((s, t) => s + t.bytes, 0) + tmpBytes,
  };
}
