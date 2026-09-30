import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import { ffprobeExe, ffmpegExe } from "./ffmpeg.ts";

/**
 * article.ts — LINK BÀI BÁO → nội dung + ảnh để dựng video.
 *
 * Tối ưu cho Kênh 14 và các báo cùng hệ thống (GenK, CafeF, Soha, aFamily…): các trang
 * này đánh dấu rõ `data-role="title" | "sapo" | "content"` và bọc ảnh trong
 * `<figure type="Photo">` kèm kích thước + chú thích. Bám vào các đánh dấu đó ổn định hơn
 * bám theo tên class (tên class đổi theo giao diện, `data-role` là dữ liệu cho máy đọc).
 *
 * Trang báo khác: rơi về thẻ meta Open Graph + JSON-LD NewsArticle + các đoạn <p> trong
 * <article>. Không hoàn hảo, nhưng không có nội dung đủ dài thì BÁO LỖI RÕ chứ không đưa
 * một nửa bài cho AI tự bịa phần còn lại.
 *
 * Không dùng thư viện parse HTML: chỉ cần vài vùng đã biết, và thêm dependency là thêm
 * thứ người dùng cuối phải cài.
 */

export interface ArticleImage {
  url: string;
  width?: number;
  height?: number;
  caption: string;
}

/** Video nhúng trong bài — file thật, không phải ảnh đại diện. */
export interface ArticleVideo {
  /** URL file video (.mp4/.mov) lấy từ `data-vid`. */
  url: string;
  /** Ảnh đại diện — dùng thay thế nếu tải video hỏng. */
  thumb?: string;
  caption: string;
}

export interface Article {
  url: string;
  /** Tên miền, vd "kenh14.vn". */
  site: string;
  /** Tên báo cho người đọc, vd "Kênh 14". */
  siteName: string;
  title: string;
  sapo: string;
  paragraphs: string[];
  images: ArticleImage[];
  videos: ArticleVideo[];
  /** "Theo …" — báo gốc mà trang này dẫn lại, nếu có. */
  source?: string;
  publishedAt?: string;
}

/** Ảnh đã tải về máy, sẵn sàng dùng trong spec. */
export interface LocalImage {
  /** Đường dẫn tương đối với public/, vd "articles/ab12cd34ef56/anh-3.jpg". */
  src: string;
  /** Mã ngắn cho AI tham chiếu, vd "anh-3". */
  id: string;
  width: number;
  height: number;
  caption: string;
}

/** Video đã tải về máy, sẵn sàng dùng trong spec. */
export interface LocalVideo {
  /** Đường dẫn tương đối với public/, vd "articles/ab12cd34ef56/video-1.mp4". */
  src: string;
  /** Mã ngắn cho AI tham chiếu, vd "video-1". */
  id: string;
  width: number;
  height: number;
  /** Độ dài thật (giây) — composition dùng để LẶP khi cảnh dài hơn clip. */
  durationSec: number;
  caption: string;
}

export interface ArticleSource {
  article: Article;
  images: LocalImage[];
  videos: LocalVideo[];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
/**
 * Trần số ảnh lấy về. Video từ bài báo giờ dài 2–3 phút (18–30 cảnh) nên cần nhiều ảnh:
 * trần 12 cũ khiến một bài 26 ảnh chỉ dùng được gần một nửa, và những cảnh còn lại phải
 * xài lại ảnh cũ. Một bài báo hiếm khi có quá 40 ảnh trong thân bài.
 */
const MAX_IMAGES = 40;
/** Video nhúng trong một bài thường 1–3 cái; lấy dư chỉ tốn băng thông. */
const MAX_VIDEOS = 6;
/** Ảnh nhỏ hơn thế là icon/ảnh chèn phụ — phóng lên khung 1080x1920 sẽ vỡ. */
const MIN_IMAGE_SIDE = 300;

/**
 * Tên báo cho người đọc. Không lấy og:site_name: báo Việt hay ghi nguyên tên miền vào đó
 * ("https://kenh14.vn"), đọc lên thành "Theo h-t-t-p-s kênh mười bốn chấm vê en".
 */
const SITE_NAMES: Record<string, string> = {
  "kenh14.vn": "Kênh 14",
  "genk.vn": "GenK",
  "cafef.vn": "CafeF",
  "cafebiz.vn": "CafeBiz",
  "soha.vn": "Soha",
  "afamily.vn": "aFamily",
  "gamek.vn": "GameK",
  "autopro.com.vn": "Autopro",
  "vnexpress.net": "VnExpress",
  "tuoitre.vn": "Tuổi Trẻ",
  "thanhnien.vn": "Thanh Niên",
  "dantri.com.vn": "Dân trí",
  "znews.vn": "Znews",
  "vietnamnet.vn": "VietNamNet",
  "laodong.vn": "Lao Động",
  "nld.com.vn": "Người Lao Động",
  "24h.com.vn": "24h",
  "baomoi.com": "Báo Mới",
  "vtv.vn": "VTV",
  "tienphong.vn": "Tiền Phong",
  "ngoisao.vnexpress.net": "Ngôi Sao",
};

export function siteNameOf(host: string): string {
  const h = host.toLowerCase().replace(/^(www|m|amp)\./, "");
  if (SITE_NAMES[h]) return SITE_NAMES[h];
  const parent = Object.keys(SITE_NAMES).find((k) => h.endsWith("." + k));
  return parent ? SITE_NAMES[parent]! : h;
}

/**
 * Tách link bài báo khỏi ô yêu cầu: "https://kenh14.vn/… làm ngắn thôi" →
 * { url, extra: "làm ngắn thôi" }. Không có link → null (luồng một câu như cũ).
 */
export function splitArticleBrief(text: string): { url: string; extra: string } | null {
  const m = /https?:\/\/[^\s"'<>]+/i.exec(text);
  if (!m) return null;
  // Dấu câu dính sau link ("…chn)." ) không thuộc link — trả về phần lời dặn.
  const url = m[0].replace(/[).,;!?]+$/, "");
  return { url, extra: (text.slice(0, m.index) + text.slice(m.index + url.length)).trim() };
}

/* ------------------------------ Bóc HTML ------------------------------ */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", laquo: "«", raquo: "»", middot: "·", deg: "°",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", egrave: "è", eacute: "é", ecirc: "ê",
  igrave: "ì", iacute: "í", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ",
  ugrave: "ù", uacute: "ú", yacute: "ý",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Egrave: "È", Eacute: "É", Ecirc: "Ê",
  Igrave: "Ì", Iacute: "Í", Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ",
  Ugrave: "Ù", Uacute: "Ú", Yacute: "Ý",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[code] ?? m;
  });
}

/** HTML → chữ trơn một dòng. */
function textOf(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag) ?? new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, "i").exec(tag);
  return m ? decodeEntities(m[1]!) : undefined;
};

function meta(html: string, key: string): string | undefined {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if (attr(tag, "property") === key || attr(tag, "name") === key) return attr(tag, "content")?.trim();
  }
  return undefined;
}

/** Nội dung phần tử đầu tiên có data-role="role" (cấu trúc của Kênh 14 và các báo cùng hệ thống). */
function byDataRole(html: string, role: string): string | undefined {
  const m = new RegExp(`<(h1|h2|p|div)\\b[^>]*data-role="${role}"[^>]*>([\\s\\S]*?)</\\1>`, "i").exec(html);
  return m ? textOf(m[2]!) : undefined;
}

/**
 * Cắt đúng vùng THÂN BÀI. Quan trọng nhất là điểm kết thúc: ngay dưới thân bài là tin liên
 * quan, bình luận, quảng cáo — đều có <p> và <img>. Lấy lố là AI kể luôn cả tin khác và
 * video chèn ảnh của bài khác.
 */
function bodyRegion(html: string): string | undefined {
  const start = html.search(/data-role="content"/i);
  if (start >= 0) {
    const rest = html.slice(start);
    const ends = ["link-source-wrapper", 'data-role="tags"', "tin-chan-bai", "knc-relate", "<footer"]
      .map((k) => rest.indexOf(k))
      .filter((i) => i > 0);
    return rest.slice(0, ends.length ? Math.min(...ends) : 80000);
  }
  const art = /<article\b[\s\S]*?<\/article>/i.exec(html);
  return art?.[0];
}

function imagesIn(body: string): ArticleImage[] {
  // Kèm vị trí trong bài để xếp ảnh và ảnh-đại-diện-video đúng thứ tự xuất hiện: AI chọn
  // ảnh theo chú thích, nhưng thứ tự đúng giúp nó bám mạch bài dễ hơn.
  const out: Array<ArticleImage & { at: number }> = [];

  // Ảnh: <figure type="Photo"> <img data-original w h> <figcaption>…</figcaption>
  for (const m of body.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)) {
    const block = m[0];
    const img = /<img\b[^>]*>/i.exec(block)?.[0];
    if (!img) continue;
    const url = attr(img, "data-original") || attr(img, "data-src") || attr(img, "src");
    if (!url) continue;
    const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
    out.push({
      at: m.index!,
      url,
      width: num(attr(img, "w") ?? attr(img, "width")),
      height: num(attr(img, "h") ?? attr(img, "height")),
      caption: textOf(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(block)?.[1] ?? "") || attr(img, "alt") || "",
    });
  }

  // Video nhúng KHÔNG có file (`data-vid`) thì không dựng được thành clip — lấy ảnh đại
  // diện của nó làm ảnh tĩnh, như trước. Video CÓ file do videosIn() lo; lấy cả thumb của
  // nó nữa là cùng một khoảnh khắc xuất hiện hai lần trong video.
  for (const m of body.matchAll(/<div\b[^>]*type="VideoStream"[^>]*>/gi)) {
    if (attr(m[0], "data-vid")) continue;
    const thumb = attr(m[0], "data-thumb");
    if (!thumb) continue;
    const after = body.slice(m.index!, m.index! + 3000);
    const cap = /class="VideoCMS_Caption"[^>]*>([\s\S]*?)<\/div>/i.exec(after)?.[1];
    out.push({ at: m.index!, url: thumb, caption: cap ? textOf(cap) : "" });
  }

  // Mọi <img> còn lại trong thân bài (trang không dùng <figure>, hoặc dùng lẫn lộn).
  // Quét LUÔN chứ không chỉ khi chưa có ảnh nào: có báo đặt vài ảnh trong <figure> và
  // phần còn lại là <img> trần — chỉ chạy nhánh này khi danh sách RỖNG là bỏ sót hết
  // số đó mà không có dấu hiệu gì.
  //
  // Phải đọc CẢ kích thước ở đây, không chỉ url: ảnh trong <figure> cũng khớp vòng lặp
  // này, và nếu bản trùng thiếu w/h thì nó lọt qua bộ lọc ảnh nhỏ bên dưới — tức là mọi
  // icon 120x80 lại chui vào bài.
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const url = attr(tag, "data-original") || attr(tag, "data-src") || attr(tag, "src");
    if (!url) continue;
    const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
    out.push({
      at: m.index!,
      url,
      width: num(attr(tag, "w") ?? attr(tag, "width")),
      height: num(attr(tag, "h") ?? attr(tag, "height")),
      caption: attr(tag, "alt") ?? "",
    });
  }

  const seen = new Set<string>();
  return out
    .sort((a, b) => a.at - b.at)
    .filter((im) => {
      if (!/^https?:\/\//i.test(im.url) || /\.gif(\?|$)/i.test(im.url) || seen.has(im.url)) return false;
      if (im.width && im.height && Math.min(im.width, im.height) < MIN_IMAGE_SIDE) return false;
      seen.add(im.url);
      return true;
    })
    .map(({ at: _at, ...im }) => im);
}

/**
 * Video nhúng trong thân bài.
 *
 * `data-vid` là ĐƯỜNG DẪN FILE THẬT (vd "kenh14cdn.com/…/video-recap-….mp4"), thiếu
 * scheme. Trước đây chỗ này chỉ lấy `data-thumb` rồi coi video như một tấm ảnh tĩnh —
 * tức là vứt đi đúng phần động nhất của bài. Giờ lấy cả hai: file để dựng, thumb để
 * thay thế nếu tải file hỏng.
 */
function videosIn(body: string): ArticleVideo[] {
  const out: ArticleVideo[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(/<div\b[^>]*type="VideoStream"[^>]*>/gi)) {
    const tag = m[0];
    const vid = attr(tag, "data-vid");
    const thumb = attr(tag, "data-thumb");
    if (!vid) continue;
    const url = /^https?:\/\//i.test(vid) ? vid : `https://${vid.replace(/^\/+/, "")}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const after = body.slice(m.index!, m.index! + 3000);
    const cap = /class="VideoCMS_Caption"[^>]*>([\s\S]*?)<\/div>/i.exec(after)?.[1];
    out.push({ url, thumb, caption: cap ? textOf(cap) : "" });
  }
  return out.slice(0, MAX_VIDEOS);
}

function paragraphsIn(body: string): string[] {
  // Bỏ khối ảnh/video trước, nếu không chú thích ảnh lẫn vào thành đoạn văn.
  const clean = body
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, "")
    .replace(/<p\b[^>]*NLPlaceholderShow[^>]*>[\s\S]*?<\/p>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  return [...clean.matchAll(/<(p|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => textOf(m[2]!))
    // Bỏ dòng ghi công ảnh/video ("Ảnh: FBNV") — không phải nội dung, AI hay đọc nhầm thành lời kể.
    .filter((t) => t.length > 1 && !(t.length < 80 && /^(ảnh|video|clip|nguồn)\s*:/i.test(t)));
}

/** Bài báo NewsArticle trong JSON-LD — dùng khi trang không có vùng thân bài nhận ra được. */
function jsonLdArticle(html: string): { headline?: string; description?: string; body?: string; image?: string } | null {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]!);
      for (const node of Array.isArray(data) ? data : [data]) {
        if (/NewsArticle|Article/.test(String(node?.["@type"]))) {
          const img = node.image;
          return {
            headline: node.headline,
            description: node.description,
            body: node.articleBody,
            image: typeof img === "string" ? img : Array.isArray(img) ? img[0]?.url ?? img[0] : img?.url,
          };
        }
      }
    } catch {
      /* JSON-LD hỏng — bỏ qua khối này */
    }
  }
  return null;
}

/** Bóc bài báo từ HTML (tách riêng khỏi việc tải để test được không cần mạng). */
export function parseArticle(html: string, url: string): Article {
  const ld = jsonLdArticle(html);
  const body = bodyRegion(html) ?? "";
  let paragraphs = paragraphsIn(body);
  if (paragraphs.join(" ").length < 200 && ld?.body) {
    paragraphs = decodeEntities(ld.body).split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }

  let images = imagesIn(body);
  const og = meta(html, "og:image") ?? ld?.image;
  // Bài không có ảnh trong thân → dùng ảnh đại diện của bài, còn hơn video trống trơn.
  if (!images.length && og) images = [{ url: og, caption: "" }];

  const site = new URL(url).hostname.replace(/^www\./, "");
  return {
    url,
    site,
    siteName: siteNameOf(site),
    title: byDataRole(html, "title") || meta(html, "og:title") || ld?.headline || textOf(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ""),
    sapo: byDataRole(html, "sapo") || meta(html, "og:description") || ld?.description || "",
    paragraphs,
    images: images.slice(0, MAX_IMAGES),
    videos: videosIn(body),
    source: textOf(/class="link-source-text-name"[^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1] ?? "") || undefined,
    publishedAt: meta(html, "article:published_time"),
  };
}

/* ------------------------------ Tải về ------------------------------ */

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9" }, signal: AbortSignal.timeout(20000) });
  } catch (err) {
    throw new Error(`Không mở được link bài báo: ${(err as Error).message}`);
  }
  if (!res.ok) throw new Error(`Trang báo trả lỗi ${res.status} — kiểm tra lại link.`);
  return { html: await res.text(), finalUrl: res.url || url };
}

const wordCount = (a: Article) => a.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;

const UNREADABLE =
  "Không đọc được nội dung bài báo từ link này (trang cần đăng nhập, là trang chủ/chuyên mục, " +
  "hoặc cấu trúc trang chưa hỗ trợ). Hãy dán link tới MỘT bài viết cụ thể.";

export async function fetchArticle(url: string): Promise<Article> {
  const { html, finalUrl } = await fetchHtml(url);
  const article = parseArticle(html, finalUrl);
  if (!article.title || wordCount(article) < 60) throw new Error(UNREADABLE);
  return article;
}

/* ------------------------------ Logo báo ------------------------------ */

/**
 * Chọn icon to nhất trang khai báo (apple-touch-icon thường 180px, favicon chỉ 16–32px —
 * hiện trên giao diện ở 40px thì favicon nhoè). Không khai báo gì thì thử /favicon.ico.
 */
export function pickIconUrl(html: string, pageUrl: string): string {
  let best = { url: "", score: -1 };
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (!href || !/(^|\s)(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/.test(rel)) continue;
    const sizes = [...(attr(tag, "sizes") ?? "").matchAll(/(\d+)x(\d+)/gi)].map((s) => Number(s[1]));
    const size = sizes.length ? Math.max(...sizes) : rel.includes("apple") ? 180 : 32;
    // To quá (512+) chỉ tốn băng thông; ưu tiên khoảng 96–256.
    const score = size > 256 ? 256 - (size - 256) / 10 : size;
    if (score > best.score) {
      try {
        best = { url: new URL(href, pageUrl).href, score };
      } catch {
        /* href hỏng */
      }
    }
  }
  return best.url || new URL("/favicon.ico", pageUrl).href;
}

const iconCache = new Map<string, string | null>();

/** Tải logo báo thành data URI — giao diện hiện thẳng, không cần thêm đường proxy ảnh. */
async function iconDataUri(html: string, pageUrl: string): Promise<string | null> {
  const host = new URL(pageUrl).hostname;
  if (iconCache.has(host)) return iconCache.get(host)!;
  let out: string | null = null;
  try {
    const iconUrl = pickIconUrl(html, pageUrl);
    const res = await fetch(iconUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    const buf = Buffer.from(await res.arrayBuffer());
    let type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    // Máy chủ báo hay trả .ico với content-type sai (image/png, octet-stream) — nhận theo đuôi file.
    if (/\.ico(\?|$)/i.test(iconUrl)) type = "image/x-icon";
    if (res.ok && type.startsWith("image/") && buf.length > 0 && buf.length < 300_000) {
      out = `data:${type};base64,${buf.toString("base64")}`;
    }
  } catch {
    /* không có logo thì giao diện hiện chữ cái đầu */
  }
  iconCache.set(host, out);
  return out;
}

export interface ArticlePeek {
  url: string;
  site: string;
  siteName: string;
  icon: string | null;
  title: string;
  sapo: string;
  cover?: string;
  images: number;
  words: number;
  /** Đọc được nội dung đủ để dựng video không; không thì `error` nói vì sao. */
  readable: boolean;
  error?: string;
}

/**
 * Xem nhanh một link khi người dùng vừa dán: báo nào (logo + tên), bài gì, bao nhiêu ảnh.
 * Để người dùng thấy ngay link có đúng không TRƯỚC khi tốn lượt gọi AI và vài phút render.
 */
export async function peekArticle(url: string): Promise<ArticlePeek> {
  const { html, finalUrl } = await fetchHtml(url);
  const a = parseArticle(html, finalUrl);
  const words = wordCount(a);
  const readable = !!a.title && words >= 60;
  return {
    url: a.url,
    site: a.site,
    siteName: a.siteName,
    icon: await iconDataUri(html, finalUrl),
    title: a.title,
    sapo: a.sapo,
    cover: meta(html, "og:image") ?? a.images[0]?.url,
    images: a.images.length,
    words,
    readable,
    error: readable ? undefined : UNREADABLE,
  };
}

/** Kích thước ảnh bằng ffprobe — cho ảnh mà trang không ghi sẵn w/h. */
function probeSize(file: string): { width: number; height: number } | null {
  const r = spawnSync(ffprobeExe(), ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" });
  const [w, h] = (r.stdout ?? "").trim().split(",").map(Number);
  return w && h ? { width: w, height: h } : null;
}

/**
 * Tải ảnh của bài về public/articles/<mã-link>/anh-N.<đuôi>.
 *
 * Thư mục theo MÃ LINK chứ không theo tên video: tên video do AI đặt và người dùng sửa
 * được, còn ảnh phải ở yên một chỗ cho mọi lần render lại. Tải rồi thì lần sau bỏ qua.
 */
export async function downloadArticleImages(
  article: Article,
  onLog: (msg: string) => void = () => {},
): Promise<LocalImage[]> {
  const key = createHash("sha256").update(article.url).digest("hex").slice(0, 12);
  const rel = `articles/${key}`;
  const dir = path.resolve(process.cwd(), "public", rel);
  await fs.mkdir(dir, { recursive: true });

  const out: LocalImage[] = [];
  for (const [i, im] of article.images.entries()) {
    const id = `anh-${i + 1}`;
    try {
      const existing = (await fs.readdir(dir)).find((f) => f.startsWith(id + "."));
      let file = existing ? path.join(dir, existing) : "";
      if (!file) {
        const res = await fetch(im.url, { headers: { "User-Agent": UA, Referer: article.url }, signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = res.headers.get("content-type") ?? "";
        const ext = /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : /jpe?g/.test(type) ? "jpg" : "";
        if (!ext) throw new Error(`không phải ảnh (${type || "không rõ loại"})`);
        file = path.join(dir, `${id}.${ext}`);
        await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
      }
      const size = im.width && im.height ? { width: im.width, height: im.height } : probeSize(file);
      if (!size) throw new Error("không đọc được kích thước");
      if (Math.min(size.width, size.height) < MIN_IMAGE_SIDE) throw new Error("ảnh quá nhỏ");
      out.push({ src: `${rel}/${path.basename(file)}`, id, ...size, caption: im.caption });
      onLog(`[bài báo] ảnh ${i + 1}/${article.images.length} ✓ ${size.width}x${size.height}`);
    } catch (err) {
      onLog(`[bài báo] bỏ ảnh ${i + 1}: ${(err as Error).message}`);
    }
  }
  if (!out.length) throw new Error("Bài báo không có ảnh nào dùng được.");
  return out;
}

/** Kích thước + độ dài của một file video. null nếu không đọc được (thiếu ffprobe…). */
function probeVideo(file: string): { width: number; height: number; durationSec: number } | null {
  const r = spawnSync(
    ffprobeExe(),
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" },
  );
  const [w, h, d] = (r.stdout ?? "").trim().split(/\s+/).map(Number);
  return w && h ? { width: w, height: h, durationSec: d && d > 0 ? d : 0 } : null;
}

/**
 * Re-encode video của bài về MP4 / CFR 30 / không tiếng.
 *
 * Ba lý do, đều đã gặp thật: (1) báo Việt hay nhúng `.mov` — Chrome trong Remotion decode
 * không chắc chắn; (2) file gốc có edit-list làm OffthreadVideo báo "No frame found at
 * position N" khi seek; (3) tiếng gốc của clip sẽ chồng lên giọng đọc TTS.
 *
 * Không có ffmpeg thì trả false và giữ file gốc — vẫn chạy được với .mp4 lành lặn.
 */
function normalizeArticleVideo(input: string, output: string): boolean {
  const r = spawnSync(
    ffmpegExe(),
    ["-y", "-i", input, "-an", "-vf", "fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p",
     "-profile:v", "high", "-preset", "veryfast", "-crf", "21", "-movflags", "+faststart", output],
    { stdio: "ignore" },
  );
  return r.status === 0 && existsSync(output);
}

/**
 * Tải video của bài về public/articles/<mã-link>/video-N.mp4.
 *
 * Cùng quy ước thư mục với ảnh. Video nào tải/đọc hỏng thì BỎ QUA chứ không làm hỏng cả
 * lượt dựng — bài vẫn còn ảnh để kể; `loadArticle` sẽ lấy ảnh đại diện của video đó bù vào.
 */
export async function downloadArticleVideos(
  article: Article,
  onLog: (msg: string) => void = () => {},
): Promise<{ videos: LocalVideo[]; failedThumbs: string[] }> {
  const key = createHash("sha256").update(article.url).digest("hex").slice(0, 12);
  const rel = `articles/${key}`;
  const dir = path.resolve(process.cwd(), "public", rel);
  await fs.mkdir(dir, { recursive: true });

  const videos: LocalVideo[] = [];
  const failedThumbs: string[] = [];
  for (const [i, v] of article.videos.entries()) {
    const id = `video-${i + 1}`;
    const finalAbs = path.join(dir, `${id}.mp4`);
    try {
      if (!existsSync(finalAbs)) {
        const res = await fetch(v.url, {
          headers: { "User-Agent": UA, Referer: article.url },
          signal: AbortSignal.timeout(120000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rawAbs = path.join(dir, `${id}.raw${path.extname(new URL(v.url).pathname) || ".mp4"}`);
        await fs.writeFile(rawAbs, Buffer.from(await res.arrayBuffer()));
        if (normalizeArticleVideo(rawAbs, finalAbs)) {
          await fs.rm(rawAbs, { force: true });
        } else if (rawAbs.endsWith(".mp4")) {
          await fs.rename(rawAbs, finalAbs); // không có ffmpeg: dùng tạm file gốc
          onLog(`[bài báo] ⚠ không có ffmpeg → dùng video gốc, có thể lỗi khi render`);
        } else {
          await fs.rm(rawAbs, { force: true });
          throw new Error("cần ffmpeg để đổi video sang mp4");
        }
      }
      const info = probeVideo(finalAbs);
      if (!info) throw new Error("không đọc được kích thước/độ dài");
      videos.push({ src: `${rel}/${id}.mp4`, id, ...info, caption: v.caption });
      onLog(`[bài báo] video ${i + 1}/${article.videos.length} ✓ ${info.width}x${info.height}, ${info.durationSec.toFixed(1)}s`);
    } catch (err) {
      onLog(`[bài báo] bỏ video ${i + 1}: ${(err as Error).message}`);
      if (v.thumb) failedThumbs.push(v.thumb);
    }
  }
  return { videos, failedThumbs };
}

/**
 * Ảnh DỌC → lấp kín khung (cover) vì tỉ lệ đã gần 9:16. Ảnh NGANG → hiện nguyên ảnh
 * (contain): phóng ảnh ngang cho kín khung dọc là cắt mất hai phần ba, mặt người trong ảnh
 * báo hay nằm đúng phần bị cắt.
 */
export function fitFor(width: number, height: number): "cover" | "contain" {
  return height / width >= 1.25 ? "cover" : "contain";
}

/** Đọc link + tải ảnh và video — một bước cho server/CLI. */
export async function loadArticle(url: string, onLog: (msg: string) => void = () => {}): Promise<ArticleSource> {
  onLog(`[bài báo] đang đọc ${url}`);
  const article = await fetchArticle(url);
  onLog(
    `[bài báo] "${article.title}" — ${article.paragraphs.length} đoạn, ` +
      `${article.images.length} ảnh, ${article.videos.length} video`,
  );
  const { videos, failedThumbs } = await downloadArticleVideos(article, onLog);
  // Video nào tải hỏng thì lấy ảnh đại diện của nó bù vào — thà có ảnh tĩnh ở đoạn đó
  // còn hơn mất hẳn một khoảnh khắc của bài.
  const withThumbs: Article = failedThumbs.length
    ? { ...article, images: [...article.images, ...failedThumbs.map((url) => ({ url, caption: "" }))] }
    : article;
  const images = await downloadArticleImages(withThumbs, onLog);
  onLog(`[bài báo] dùng được ${images.length} ảnh + ${videos.length} video`);
  return { article, images, videos };
}

/** Thư mục ảnh bài báo có tồn tại (dùng cho dọn rác). */
export const articleDirExists = (rel: string) => existsSync(path.resolve(process.cwd(), "public", rel));
