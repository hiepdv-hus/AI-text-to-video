import "./pipeline/env.ts"; // nạp .env trước tiên
import http from "node:http";
import { promises as fs, createReadStream, statSync, existsSync } from "node:fs";
import path from "node:path";
import { buildSpec, slugify, OUT_DIR } from "./pipeline/build.ts";
import { renderVideo } from "./pipeline/render.ts";
import { videoSpecSchema } from "./src/schema.ts";

/**
 * server.ts — "Studio" web chạy LOCAL. Mở http://localhost:4321, điền form,
 * bấm render → pipeline dựng video → xem ngay trong trình duyệt.
 * Chạy: pnpm video serve   (hoặc: pnpm exec tsx server.ts)
 */

const ROOT = process.cwd();
const PORT = Number(process.env.PORT ?? 4321);
const SPECS_DIR = path.join(ROOT, "specs");

let rendering = false; // chỉ 1 lần render tại một thời điểm

function send(res: http.ServerResponse, code: number, body: string | Buffer, type = "text/plain; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type });
  res.end(body);
}

function sendJson(res: http.ServerResponse, code: number, obj: unknown) {
  send(res, code, JSON.stringify(obj), "application/json; charset=utf-8");
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Serve file có hỗ trợ Range (để tua video trong trình duyệt). */
function serveVideo(req: http.IncomingMessage, res: http.ServerResponse, filePath: string) {
  if (!existsSync(filePath)) return send(res, 404, "not found");
  const stat = statSync(filePath);
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? parseInt(m[1]!, 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": "video/mp4",
    });
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Length": stat.size, "Content-Type": "video/mp4", "Accept-Ranges": "bytes" });
    createReadStream(filePath).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const pathname = decodeURIComponent(url.pathname);

    // Trang studio
    if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      const html = await fs.readFile(path.join(ROOT, "studio.html"), "utf8");
      return send(res, 200, html, "text/html; charset=utf-8");
    }

    // Liệt kê spec đã lưu
    if (req.method === "GET" && pathname === "/api/specs") {
      const files = (await fs.readdir(SPECS_DIR)).filter((f) => f.endsWith(".json"));
      return sendJson(res, 200, { specs: files });
    }

    // Nạp 1 spec
    if (req.method === "GET" && pathname.startsWith("/api/spec/")) {
      const name = path.basename(pathname.slice("/api/spec/".length));
      const file = path.join(SPECS_DIR, name);
      if (!existsSync(file)) return sendJson(res, 404, { error: "không thấy spec" });
      return send(res, 200, await fs.readFile(file, "utf8"), "application/json; charset=utf-8");
    }

    // Thư viện: liệt kê mọi project (spec + video) để quản lý/xóa.
    if (req.method === "GET" && pathname === "/api/library") {
      const specFiles = (await fs.readdir(SPECS_DIR).catch(() => [])).filter((f) => f.endsWith(".json"));
      let outDirs: string[] = [];
      try {
        outDirs = (await fs.readdir(OUT_DIR, { withFileTypes: true }))
          .filter((d) => d.isDirectory())
          .map((d) => d.name);
      } catch {
        /* out/ chưa có */
      }
      const slugs = [...new Set([...specFiles.map((f) => f.replace(/\.json$/, "")), ...outDirs])];
      const items = [];
      for (const slug of slugs) {
        const specName = `${slug}.json`;
        const hasSpec = specFiles.includes(specName);
        let title = slug;
        if (hasSpec) {
          try {
            title = JSON.parse(await fs.readFile(path.join(SPECS_DIR, specName), "utf8")).meta?.title ?? slug;
          } catch {
            /* spec hỏng */
          }
        }
        const videoPath = path.join(OUT_DIR, slug, "final.mp4");
        const hasVideo = existsSync(videoPath);
        const videoSize = hasVideo ? statSync(videoPath).size : 0;
        items.push({ slug, title, hasSpec, hasVideo, videoSize });
      }
      items.sort((a, b) => a.title.localeCompare(b.title, "vi"));
      return sendJson(res, 200, { items });
    }

    // Xóa 1 project: xóa out/<slug>, public/audio/<slug>, specs/<slug>.json.
    if (req.method === "DELETE" && pathname.startsWith("/api/item/")) {
      const slug = path.basename(pathname.slice("/api/item/".length));
      if (!slug) return sendJson(res, 400, { error: "thiếu slug" });
      await fs.rm(path.join(OUT_DIR, slug), { recursive: true, force: true });
      await fs.rm(path.join(ROOT, "public", "audio", slug), { recursive: true, force: true });
      await fs.rm(path.join(SPECS_DIR, `${slug}.json`), { force: true });
      console.log(`[serve] đã xóa "${slug}"`);
      return sendJson(res, 200, { ok: true });
    }

    // Render
    if (req.method === "POST" && pathname === "/api/render") {
      if (rendering) return sendJson(res, 429, { error: "Đang render video khác, đợi chút rồi thử lại." });
      const body = await readBody(req);
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: "JSON không hợp lệ." });
      }
      const parsed = videoSpecSchema.safeParse(json);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(gốc)"}: ${i.message}`);
        return sendJson(res, 400, { error: "Spec chưa hợp lệ", issues });
      }

      rendering = true;
      const t0 = Date.now();
      try {
        const slug = slugify(parsed.data.meta.title);
        await fs.mkdir(SPECS_DIR, { recursive: true });
        const specPath = path.join(SPECS_DIR, `${slug}.json`);
        await fs.writeFile(specPath, JSON.stringify(parsed.data, null, 2), "utf8");

        console.log(`[serve] render "${slug}"…`);
        const { slug: builtSlug, props } = await buildSpec(specPath);
        await renderVideo(builtSlug, props);
        const secs = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`[serve] xong "${builtSlug}" trong ${secs}s`);
        return sendJson(res, 200, {
          ok: true,
          slug: builtSlug,
          videoUrl: `/video/${builtSlug}?t=${Date.now()}`,
          durationSec: props.totalDurationInFrames / props.meta.fps,
          specName: `${slug}.json`,
        });
      } catch (err) {
        console.error(err);
        return sendJson(res, 500, { error: (err as Error).message });
      } finally {
        rendering = false;
      }
    }

    // Serve video đã render
    if (req.method === "GET" && pathname.startsWith("/video/")) {
      const slug = path.basename(pathname.slice("/video/".length));
      return serveVideo(req, res, path.join(OUT_DIR, slug, "final.mp4"));
    }

    send(res, 404, "not found");
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: (err as Error).message });
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Cổng ${PORT} đang bị server CŨ chiếm → server mới không chạy được.`);
    console.error(`   Diệt server cũ (PowerShell):`);
    console.error(
      `   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`,
    );
    console.error(`   Rồi chạy lại. Hoặc đổi cổng:  $env:PORT=4322; pnpm web\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`\n🎬 Video Studio: http://localhost:${PORT}\n   (mở link trên trong trình duyệt)\n`);
});
