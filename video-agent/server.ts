import "./pipeline/env.ts"; // nạp .env trước tiên
import http from "node:http";
import { promises as fs, createReadStream, statSync, existsSync } from "node:fs";
import path from "node:path";
import { buildSpec, slugify, OUT_DIR } from "./pipeline/build.ts";
import { renderVideo } from "./pipeline/render.ts";
import { buildCaption, buildHashtags, revealFile } from "./pipeline/publish.ts";
import { authorSpec } from "./pipeline/author.ts";
import { loadArticle, peekArticle, splitArticleBrief } from "./pipeline/article.ts";
import { LLM_PROVIDERS, parseLlmConfig, testLlm, effectiveModel } from "./pipeline/llm.ts";
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
let generating = false; // chỉ 1 lượt gọi LLM tại một thời điểm (mỗi lượt là tiền thật)

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

/* ----------------------------------------------------------------------------
 * LOG TRỰC TIẾP cho giao diện (Server-Sent Events, GET /api/logs)
 *
 * Render mất vài phút mà /api/render chỉ trả lời MỘT lần lúc xong — trong lúc chờ người
 * dùng không biết máy đang làm gì. Đúng những dòng in ra terminal ([build] scene 3/6…,
 * [stock] tải video…, [render] 42%) là thứ trả lời câu hỏi đó, nên chuyển thẳng chúng
 * lên trình duyệt thay vì bịa ra một thanh tiến trình riêng.
 *
 * Bắt ở tầng process.stdout/stderr chứ không sửa từng chỗ console.log: log đến từ nhiều
 * nơi (pipeline, Remotion, ffmpeg wrapper), sót một chỗ là giao diện đứng im đúng lúc lâu
 * nhất. Terminal vẫn in như cũ — ở đây chỉ SAO một bản.
 * -------------------------------------------------------------------------- */
const logClients = new Set<http.ServerResponse>();
let logPending = "";

/** Bỏ mã màu ANSI (Remotion tô màu log) — lên trình duyệt thành rác "[31m". */
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

function broadcastLog(line: string) {
  const text = stripAnsi(line).trimEnd();
  if (!text.trim() || !logClients.size) return;
  const payload = `data: ${JSON.stringify(text.slice(0, 400))}\n\n`;
  for (const c of logClients) c.write(payload);
}

function teeLog(chunk: unknown) {
  logPending += typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8");
  // Tách theo \n VÀ \r: tiến độ render in kiểu "\r[render] 42%" — ghi đè cùng một dòng
  // trên terminal, lên trình duyệt thì mỗi lần là một dòng mới (giao diện tự cập nhật tại chỗ).
  const parts = logPending.split(/\r\n|\n|\r/);
  logPending = parts.pop() ?? "";
  parts.forEach(broadcastLog);
}

for (const stream of [process.stdout, process.stderr]) {
  const original = stream.write.bind(stream) as (...args: unknown[]) => boolean;
  stream.write = ((chunk: unknown, ...rest: unknown[]) => {
    try {
      teeLog(chunk);
    } catch {
      /* log hỏng không được làm hỏng việc in ra terminal */
    }
    return original(chunk, ...rest);
  }) as typeof stream.write;
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

    // Luồng log trực tiếp — trình duyệt giữ kết nối mở, server đẩy từng dòng xuống.
    if (req.method === "GET" && pathname === "/api/logs") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      logClients.add(res);
      // Nhịp giữ kết nối: một số proxy/antivirus cắt kết nối im lặng quá lâu.
      const ping = setInterval(() => res.write(": ping\n\n"), 25000);
      req.on("close", () => {
        clearInterval(ping);
        logClients.delete(res);
      });
      return;
    }

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

    // Xóa 1 project: out/<slug>, spec, và MỌI asset mang tên slug trong public/.
    //
    // Bản trước chỉ xoá public/audio/<slug> mà bỏ sót public/video/<slug> và
    // public/images/<slug> — đúng hai thư mục NẶNG nhất (clip nền Pexels vài MB mỗi cái).
    // Hệ quả: xoá project trên giao diện mà đĩa gần như không giảm, và public/ cứ phình
    // mãi theo số video từng dựng.
    if (req.method === "DELETE" && pathname.startsWith("/api/item/")) {
      const slug = path.basename(pathname.slice("/api/item/".length));
      if (!slug) return sendJson(res, 400, { error: "thiếu slug" });
      await fs.rm(path.join(OUT_DIR, slug), { recursive: true, force: true });
      for (const kind of ["audio", "video", "images"]) {
        await fs.rm(path.join(ROOT, "public", kind, slug), { recursive: true, force: true });
      }
      await fs.rm(path.join(SPECS_DIR, `${slug}.json`), { force: true });
      console.log(`[serve] đã xóa "${slug}" (out/, spec, audio+video+images trong public/)`);
      return sendJson(res, 200, { ok: true });
    }

    // Danh sách AI cho ô chọn trên giao diện — lấy từ llm.ts để không khai hai nơi.
    if (req.method === "GET" && pathname === "/api/llm/providers") {
      return sendJson(res, 200, { providers: LLM_PROVIDERS });
    }

    // Danh sách giọng Google vi-VN cho dropdown — NẠP ĐỘNG từ API thật để tên giọng
    // (nhất là Chirp3-HD, đặt theo tên sao và hay đổi) luôn khớp, khỏi hardcode sai gây
    // lỗi 400 lúc render. Key chỉ dùng phía server, KHÔNG trả về client.
    if (req.method === "GET" && pathname === "/api/tts/voices") {
      const key = process.env.GOOGLE_TTS_API_KEY;
      if (!key) return sendJson(res, 200, { ok: true, hasKey: false, voices: [] });
      try {
        const r = await fetch(`https://texttospeech.googleapis.com/v1/voices?languageCode=vi-VN&key=${key}`);
        if (!r.ok) return sendJson(res, 200, { ok: false, hasKey: true, error: `Google ${r.status}`, voices: [] });
        const data = (await r.json()) as { voices?: Array<{ name: string; languageCodes?: string[]; ssmlGender?: string }> };
        // Xếp theo chất lượng: Chirp3-HD > Neural2 > WaveNet > Standard.
        const rank = (n: string) =>
          n.includes("Chirp3-HD") ? 0 : n.includes("Neural2") ? 1 : n.includes("Wavenet") ? 2 : 3;
        const voices = (data.voices ?? [])
          .filter((v) => (v.languageCodes ?? []).includes("vi-VN"))
          .map((v) => ({ name: v.name, gender: v.ssmlGender ?? "", rank: rank(v.name) }))
          .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
        return sendJson(res, 200, { ok: true, hasKey: true, voices });
      } catch (err) {
        return sendJson(res, 200, { ok: false, hasKey: true, error: (err as Error).message, voices: [] });
      }
    }

    // Thử key ngay lúc người dùng dán, trước khi họ tốn 30 giây chờ viết kịch bản.
    // KEY KHÔNG BAO GIỜ ĐƯỢC GHI LOG hay lưu xuống đĩa — nó chỉ sống trong lượt gọi này.
    if (req.method === "POST" && pathname === "/api/llm/test") {
      try {
        const { llm } = JSON.parse(await readBody(req)) as { llm?: unknown };
        // Trả model DÙNG THẬT: nếu model đã chọn bị gỡ và hệ thống tự đổi, giao diện lưu lại.
        const model = await testLlm(parseLlmConfig(llm));
        return sendJson(res, 200, { ok: true, model });
      } catch (err) {
        return sendJson(res, 400, { error: (err as Error).message });
      }
    }

    // Xem nhanh link bài báo vừa dán: logo + tên báo + tiêu đề + số ảnh. Không gọi AI.
    if (req.method === "GET" && pathname === "/api/article/peek") {
      const link = url.searchParams.get("url")?.trim() ?? "";
      if (!/^https?:\/\//i.test(link)) return sendJson(res, 400, { error: "Link phải bắt đầu bằng http:// hoặc https://" });
      try {
        return sendJson(res, 200, { ok: true, ...(await peekArticle(link)) });
      } catch (err) {
        return sendJson(res, 200, { ok: false, error: (err as Error).message });
      }
    }

    // MỘT CÂU → spec. Không render ở đây: trả JSON về cho giao diện đổ vào form để
    // người dùng ĐỌC LẠI và sửa trước khi tốn vài phút CPU render.
    if (req.method === "POST" && pathname === "/api/generate") {
      if (generating) return sendJson(res, 429, { error: "Đang viết kịch bản khác, đợi chút." });
      const body = JSON.parse(await readBody(req)) as { brief?: string; llm?: unknown; visualStyle?: string };
      // Chỉ nhận hai giá trị đã biết; gửi lạ thì về mặc định chứ không để AI nhận rác.
      const visualStyle = body.visualStyle === "photo" ? "photo" : "mixed";
      const brief = body.brief?.trim();
      if (!brief) return sendJson(res, 400, { error: "Thiếu nội dung yêu cầu." });
      let llm;
      try {
        llm = parseLlmConfig(body.llm);
      } catch (err) {
        return sendJson(res, 400, { error: (err as Error).message });
      }

      generating = true;
      try {
        // Có link trong ô yêu cầu → đọc bài báo + tải ảnh của bài, phần chữ còn lại là yêu cầu thêm.
        const link = splitArticleBrief(brief);
        const article = link ? await loadArticle(link.url, (m) => console.log(m)) : undefined;
        console.log(`[serve] viết kịch bản (${visualStyle}) bằng ${llm.provider}/${llm.model}: "${(article?.article.title ?? brief).slice(0, 80)}"`);
        const { spec, attempts } = await authorSpec(link ? link.extra : brief, llm, (m) => console.log(m), { visualStyle, article });
        return sendJson(res, 200, {
          ok: true,
          spec,
          attempts,
          model: effectiveModel(llm),
          article: article && {
            title: article.article.title,
            site: article.article.site,
            siteName: article.article.siteName,
            url: article.article.url,
            images: article.images.length,
          },
        });
      } catch (err) {
        console.error(err);
        return sendJson(res, 500, { error: (err as Error).message });
      } finally {
        generating = false;
      }
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

    // Chuẩn bị đăng TikTok: trả caption + hashtag + đường dẫn MP4 trên đĩa.
    if (req.method === "GET" && pathname.startsWith("/api/publish/")) {
      const slug = path.basename(pathname.slice("/api/publish/".length));
      if (!slug) return sendJson(res, 400, { error: "thiếu slug" });
      const videoPath = path.join(OUT_DIR, slug, "final.mp4");
      const specPath = path.join(SPECS_DIR, `${slug}.json`);

      let caption = "";
      let hashtags: string[] = [];
      let title = slug;
      if (existsSync(specPath)) {
        const parsed = videoSpecSchema.safeParse(JSON.parse(await fs.readFile(specPath, "utf8")));
        if (parsed.success) {
          caption = buildCaption(parsed.data);
          hashtags = buildHashtags(parsed.data);
          title = parsed.data.meta.title;
        }
      }
      // Không có spec (vd video cũ) → vẫn cho đăng, chỉ là caption trống.
      return sendJson(res, 200, {
        ok: true,
        slug,
        title,
        caption,
        hashtags,
        hasVideo: existsSync(videoPath),
        videoPath,
      });
    }

    // Mở thư mục chứa final.mp4 và bôi đen sẵn file (chỉ chạy được vì server là local).
    if (req.method === "POST" && pathname.startsWith("/api/reveal/")) {
      const slug = path.basename(pathname.slice("/api/reveal/".length));
      const videoPath = path.join(OUT_DIR, slug, "final.mp4");
      try {
        revealFile(videoPath);
        return sendJson(res, 200, { ok: true, videoPath });
      } catch (err) {
        return sendJson(res, 404, { error: (err as Error).message });
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
