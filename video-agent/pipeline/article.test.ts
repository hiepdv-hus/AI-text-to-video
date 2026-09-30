import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  parseArticle,
  splitArticleBrief,
  decodeEntities,
  fitFor,
  pickIconUrl,
  siteNameOf,
  type ArticleSource,
} from "./article.ts";
import { authorSpec } from "./author.ts";
import { parseLlmConfig } from "./llm.ts";

/**
 * HTML GIẢ LẬP theo đúng cấu trúc Kênh 14 (data-role + figure type="Photo"), nội dung tự
 * viết — không lưu bài báo thật vào repo. Có cài sẵn các "bẫy" đã gặp trên trang thật:
 * ảnh tin liên quan nằm NGOÀI thân bài, chữ mã hoá HTML entity, dòng ghi công ảnh.
 */
const para = (n: number) =>
  `<p>&#272;o&#7841;n v&#259;n s&#7889; ${n} k&#7875; v&#7873; chuy&#7879;n l&agrave;m v&#432;&#7901;n, c&oacute; &quot;tr&iacute;ch d&#7851;n&quot; v&agrave; nhi&#7873;u ch&#7919; &#273;&#7875; &#273;&#7911; d&agrave;i cho b&agrave;i b&aacute;o th&#7917; nghi&#7879;m.</p>`;

const FIXTURE = `<!doctype html><html><head>
<title>Tiêu đề thẻ title | Kênh 14</title>
<meta property="og:title" content="Tiêu đề og" />
<meta property="og:image" content="https://cdn.example/og.jpg" />
<meta property="article:published_time" content="2026-09-16T16:00:00" />
</head><body>
<h1 class="kbwc-title" data-role="title">Nh&agrave; v&#432;&#7901;n c&#7911;a Beckham</h1>
<h2 class="knc-sapo" data-role="sapo">Cu&#7897;c s&#7889;ng <b>l&agrave;m n&ocirc;ng</b>.</h2>
<div class="detail-content afcbc-body" data-role="content">
  ${para(1)}
  <figure class="VCSortableInPreviewMode" type="Photo"><div><img src="https://cdn.example/thumb/a.jpg" data-original="https://cdn.example/a.jpg" w="1080" h="1920" /></div>
    <figcaption class="PhotoCMS_Caption"><p>V&#432;&#7901;n rau sau nh&agrave;</p></figcaption></figure>
  ${para(2)}
  <figure type="Photo"><img src="https://cdn.example/icon.jpg" w="120" h="80" /></figure>
  <div class="VCSortableInPreviewMode" type="VideoStream" data-thumb="https://cdn.example/video-thumb.jpg"></div>
  <div class="VideoCMS_Caption">Clip thu ho&#7841;ch</div>
  ${para(3)}
  <figure type="Photo"><img src="https://cdn.example/b.jpg" width="1600" height="900" alt="Ảnh ngang" /></figure>
  ${para(4)}
  <p>Ảnh: Instagram</p>
  ${para(5)}${para(6)}
</div>
<div class="link-source-wrapper"><span class="link-source-text-name">Đời sống &amp; Pháp luật</span></div>
<div class="knc-relate"><img src="https://cdn.example/zoom/220_140/related.jpg" /><p>Tin liên quan không được lấy</p></div>
</body></html>`;

test("parseArticle: tiêu đề, sapo, nguồn, ngày đăng theo data-role / meta", () => {
  const a = parseArticle(FIXTURE, "https://kenh14.vn/nha-vuon.chn");
  assert.equal(a.title, "Nhà vườn của Beckham");
  assert.equal(a.sapo, "Cuộc sống làm nông.");
  assert.equal(a.source, "Đời sống & Pháp luật");
  assert.equal(a.site, "kenh14.vn");
  assert.equal(a.siteName, "Kênh 14");
  assert.equal(a.publishedAt, "2026-09-16T16:00:00");
});

test("parseArticle: chỉ lấy đoạn trong THÂN BÀI, bỏ ghi công ảnh và tin liên quan", () => {
  const a = parseArticle(FIXTURE, "https://kenh14.vn/nha-vuon.chn");
  assert.equal(a.paragraphs.length, 6, a.paragraphs.join("\n"));
  assert.match(a.paragraphs[0]!, /^Đoạn văn số 1 kể về chuyện làm vườn, có "trích dẫn"/);
  assert.ok(!a.paragraphs.some((p) => /Ảnh: Instagram|Tin liên quan|Vườn rau sau nhà/.test(p)));
});

test("parseArticle: ảnh đúng thứ tự trong bài, bỏ ảnh nhỏ và ảnh ngoài thân bài", () => {
  const a = parseArticle(FIXTURE, "https://kenh14.vn/nha-vuon.chn");
  assert.deepEqual(
    a.images.map((im) => [im.url, im.caption]),
    [
      ["https://cdn.example/a.jpg", "Vườn rau sau nhà"], // data-original thắng src thumbnail
      ["https://cdn.example/video-thumb.jpg", "Clip thu hoạch"], // ảnh đại diện video nhúng
      ["https://cdn.example/b.jpg", "Ảnh ngang"], // không có chú thích → alt
    ],
  );
  assert.deepEqual([a.images[0]!.width, a.images[0]!.height], [1080, 1920]);
});

test("parseArticle: thân bài không có ảnh → dùng ảnh đại diện og:image", () => {
  const html = FIXTURE.replace(/<figure[\s\S]*?<\/figure>/g, "").replace(/<div[^>]*VideoStream[\s\S]*?<\/div>\s*<div class="VideoCMS_Caption">[\s\S]*?<\/div>/, "");
  const a = parseArticle(html, "https://kenh14.vn/x.chn");
  assert.deepEqual(a.images.map((im) => im.url), ["https://cdn.example/og.jpg"]);
});

test("splitArticleBrief: tách link và lời dặn thêm", () => {
  assert.deepEqual(splitArticleBrief("https://kenh14.vn/a-b-123.chn chỉ 6 cảnh thôi"), {
    url: "https://kenh14.vn/a-b-123.chn",
    extra: "chỉ 6 cảnh thôi",
  });
  assert.deepEqual(splitArticleBrief("Làm video từ bài này (https://kenh14.vn/x.chn)."), {
    url: "https://kenh14.vn/x.chn",
    extra: "Làm video từ bài này ().",
  });
  assert.equal(splitArticleBrief("Dựng cho tôi video về Trấn Thành"), null);
});

test("siteNameOf: tên báo tiếng Việt, tên miền con, báo lạ thì giữ tên miền", () => {
  assert.equal(siteNameOf("kenh14.vn"), "Kênh 14");
  assert.equal(siteNameOf("www.vnexpress.net"), "VnExpress");
  assert.equal(siteNameOf("m.genk.vn"), "GenK");
  assert.equal(siteNameOf("sport.dantri.com.vn"), "Dân trí");
  assert.equal(siteNameOf("example.org"), "example.org");
});

test("pickIconUrl: chọn icon to nhất, rel viết kiểu nào cũng nhận, không có thì /favicon.ico", () => {
  const html = `
    <link rel="shortcut icon" href="https://cdn.example/fav.ico" type="image/png">
    <link rel="apple-touch-icon" sizes="57x57" href="/i57.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/i180.png">
    <link rel="icon" type="image/png" href="/i1024.png" sizes="1024x1024">
    <link rel="stylesheet" href="/big-but-not-icon.css">`;
  assert.equal(pickIconUrl(html, "https://kenh14.vn/bai.chn"), "https://kenh14.vn/i180.png");
  assert.equal(pickIconUrl(`<link rel="shortcut icon" href="https://cdn.example/fav.ico">`, "https://a.vn/x"), "https://cdn.example/fav.ico");
  assert.equal(pickIconUrl("<p>không có icon</p>", "https://a.vn/x/y"), "https://a.vn/favicon.ico");
});

test("decodeEntities / fitFor", () => {
  assert.equal(decodeEntities("Tr&#7845;n Th&agrave;nh &amp; &#x1EA1;"), "Trấn Thành & ạ");
  assert.equal(fitFor(1080, 1920), "cover");
  assert.equal(fitFor(1600, 900), "contain");
  assert.equal(fitFor(1000, 1000), "contain");
});

/* ---------------- authorSpec với bài báo: mã ảnh → đường dẫn thật ---------------- */

const SOURCE: ArticleSource = {
  article: {
    url: "https://kenh14.vn/nha-vuon.chn",
    site: "kenh14.vn",
    siteName: "Kênh 14",
    title: "Nhà vườn của Beckham",
    sapo: "Cuộc sống làm nông.",
    paragraphs: ["Beckham trồng rau.", "Victoria nấu ăn."],
    images: [],
    videos: [],
    source: "Đời sống & Pháp luật",
  },
  images: [
    { id: "anh-1", src: "articles/abcdef123456/anh-1.jpg", width: 1080, height: 1920, caption: "Vườn rau" },
    { id: "anh-2", src: "articles/abcdef123456/anh-2.jpg", width: 1600, height: 900, caption: "Bữa cơm" },
  ],
  videos: [],
};

/** Như SOURCE nhưng bài có kèm một video nhúng đã tải về. */
const SOURCE_WITH_VIDEO: ArticleSource = {
  ...SOURCE,
  videos: [
    {
      id: "video-1",
      src: "articles/abcdef123456/video-1.mp4",
      width: 1920,
      height: 1080,
      durationSec: 12.5,
      caption: "Beckham dẫn khách đi thăm vườn",
    },
  ],
};

const photoSpec = (srcs: string[]) =>
  JSON.stringify({
    meta: { title: "Beckham làm vườn", template: "StoryHook", background: "claude-dark" },
    voice: { provider: "edge", voiceId: "vi-VN-NamMinhNeural" },
    captions: {},
    scenes: srcs.map((src, i) => ({
      id: `s${i + 1}`,
      layout: i === 0 ? "hook" : i === srcs.length - 1 ? "cta" : "image",
      narration: `Lời kể ${i + 1}.`,
      media: { kind: "image", src },
    })),
  });

async function withFake(replies: string[], fn: (llm: ReturnType<typeof parseLlmConfig>) => Promise<unknown>) {
  const calls: string[] = [];
  let i = 0;
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    calls.push(Buffer.concat(chunks).toString("utf8"));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: replies[Math.min(i++, replies.length - 1)] } }] }));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const llm = parseLlmConfig({ provider: "compat", apiKey: "t", model: "fake", baseUrl: `http://127.0.0.1:${port}/v1` });
  try {
    return { result: await fn(llm), calls };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

test("authorSpec bài báo: mã ảnh → đường dẫn thật, dọc cover / ngang contain", async () => {
  const { result, calls } = await withFake([photoSpec(["anh-1", "anh-2", "anh-1", "anh-2"])], (llm) =>
    authorSpec("", llm, () => {}, { visualStyle: "photo", article: SOURCE }),
  );
  const { spec } = result as Awaited<ReturnType<typeof authorSpec>>;
  assert.deepEqual(
    spec.scenes.map((s) => [s.media?.kind, s.media?.src, s.media?.fit]),
    [
      ["image", "articles/abcdef123456/anh-1.jpg", "cover"],
      ["image", "articles/abcdef123456/anh-2.jpg", "contain"],
      ["image", "articles/abcdef123456/anh-1.jpg", "cover"],
      ["image", "articles/abcdef123456/anh-2.jpg", "contain"],
    ],
  );
  // Nội dung bài + danh sách ảnh phải thực sự tới tay AI; không còn dặn tìm ảnh Pexels.
  const prompt = JSON.parse(calls[0]!).messages.at(-1).content as string;
  assert.match(prompt, /Beckham trồng rau\./);
  assert.match(prompt, /anh-2 \(ngang\): Bữa cơm/);
  assert.doesNotMatch(prompt, /"kind": "pexels"/);
});

test("authorSpec bài báo: AI bịa ảnh không có trong bài → bị nhắc sửa", async () => {
  const { result, calls } = await withFake(
    [photoSpec(["anh-1", "anh-9", "sunset beach", "anh-2"]), photoSpec(["anh-1", "anh-2", "anh-1", "anh-2"])],
    (llm) => authorSpec("", llm, () => {}, { visualStyle: "photo", article: SOURCE }),
  );
  assert.equal((result as { attempts: number }).attempts, 2);
  const retry = JSON.parse(calls[1]!).messages.at(-1).content as string;
  assert.match(retry, /scene "s2": ảnh "anh-9" không có trong bài/);
  assert.match(retry, /scene "s3": ảnh "sunset beach" không có trong bài/);
});

/* ------------- Kiểu "article": giao diện báo + độ dài kể hết bài ------------- */

/** Như SOURCE nhưng có ngày đăng dạng ISO — thứ renderer phải nhận ở dạng dd/mm/yyyy. */
const SOURCE_DATED: ArticleSource = {
  ...SOURCE,
  article: { ...SOURCE.article, publishedAt: "2026-09-20T08:30:00+07:00" },
};

test('kiểu "article": meta.article do chương trình điền, chú thích ảnh đi theo ảnh', async () => {
  const { result } = await withFake([photoSpec(["anh-1", "anh-2", "anh-1", "anh-2"])], (llm) =>
    authorSpec("", llm, () => {}, { visualStyle: "article", article: SOURCE_DATED }),
  );
  const { spec } = result as Awaited<ReturnType<typeof authorSpec>>;

  assert.equal(spec.meta.visualStyle, "article");
  assert.deepEqual(spec.meta.article, {
    siteName: "Kênh 14",
    title: "Nhà vườn của Beckham",
    sapo: "Cuộc sống làm nông.",
    source: "Đời sống & Pháp luật",
    publishedAt: "20/09/2026", // ISO → ngày đọc được, đổi ở pipeline chứ không ở renderer
    url: "https://kenh14.vn/nha-vuon.chn",
  });
  // Chú thích lấy từ ẢNH được chọn, không phải do AI gõ lại.
  assert.deepEqual(
    spec.scenes.map((s) => s.media?.caption),
    ["Vườn rau", "Bữa cơm", "Vườn rau", "Bữa cơm"],
  );
});

test('kiểu "photo" KHÔNG kèm giao diện báo — chỉ "article" mới vẽ măng sét', async () => {
  const { result } = await withFake([photoSpec(["anh-1", "anh-2", "anh-1", "anh-2"])], (llm) =>
    authorSpec("", llm, () => {}, { visualStyle: "photo", article: SOURCE_DATED }),
  );
  const { spec } = result as Awaited<ReturnType<typeof authorSpec>>;
  assert.equal(spec.meta.visualStyle, "photo");
  assert.equal(spec.meta.article, undefined);
});

test("video từ bài báo được dặn kể HẾT bài, ghi đè luật 30–45 giây của video ngắn", async () => {
  const { calls } = await withFake([photoSpec(["anh-1", "anh-2", "anh-1", "anh-2"])], (llm) =>
    authorSpec("", llm, () => {}, { visualStyle: "article", article: SOURCE }),
  );
  const prompt = JSON.parse(calls[0]!).messages.at(-1).content as string;
  assert.match(prompt, /18–30 cảnh/);
  assert.match(prompt, /2–3 phút/);
  assert.match(prompt, /KHÔNG áp dụng ở đây/);
  assert.match(prompt, /KỂ LẠI CẢ BÀI, không phải video tóm tắt/);
});

test("bài có video: mã video-N → file thật, kèm độ dài để lặp", async () => {
  const spec = JSON.parse(photoSpec(["anh-1", "video-1", "anh-2", "anh-1"]));
  const { result } = await withFake([JSON.stringify(spec)], (llm) =>
    authorSpec("", llm, () => {}, { visualStyle: "article", article: SOURCE_WITH_VIDEO }),
  );
  const s = (result as Awaited<ReturnType<typeof authorSpec>>).spec.scenes[1]!;
  assert.equal(s.media?.kind, "video"); // AI ghi "image", chương trình sửa theo MÃ
  assert.equal(s.media?.src, "articles/abcdef123456/video-1.mp4");
  assert.equal(s.media?.durationSec, 12.5);
  // Clip 1920x1080 là NGANG → contain: để nguyên khung hình, hai dải trống được lớp
  // nền mờ lấp (NewsBackdrop). Cover sẽ cắt mất hai phần ba clip.
  assert.equal(s.media?.fit, "contain");
  assert.equal(s.media?.caption, "Beckham dẫn khách đi thăm vườn");
});

test("danh sách video được đưa vào lời nhắn cho AI", async () => {
  const { calls } = await withFake([photoSpec(["anh-1", "anh-2", "anh-1", "anh-2"])], (llm) =>
    authorSpec("", llm, () => {}, { visualStyle: "article", article: SOURCE_WITH_VIDEO }),
  );
  const prompt = JSON.parse(calls[0]!).messages.at(-1).content as string;
  assert.match(prompt, /### Video của bài — 1 clip/);
  assert.match(prompt, /video-1 \(13 giây\): Beckham dẫn khách/);
});

test("bài không có video: không sinh mục video thừa trong lời nhắn", async () => {
  const { calls } = await withFake([photoSpec(["anh-1", "anh-2", "anh-1", "anh-2"])], (llm) =>
    authorSpec("", llm, () => {}, { visualStyle: "article", article: SOURCE }),
  );
  assert.doesNotMatch(JSON.parse(calls[0]!).messages.at(-1).content as string, /Video của bài/);
});
