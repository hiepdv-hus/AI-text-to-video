/**
 * normalize.ts — chuẩn hoá text tiếng Việt TRƯỚC khi gửi TTS.
 *
 * Vì sao cần:
 *  - TTS đọc "299.000đ" hay "50%" rất tuỳ hứng → phải viết ra chữ trước.
 *  - So khớp word-timing với narration gốc sẽ fail nếu Unicode không cùng NFC
 *    (dấu thanh tổ hợp vs dựng sẵn).
 *  - Tên tiếng Anh / thương hiệu hay bị đọc sai → cho phép bảng phát âm thay thế.
 */

/** Chuẩn hoá Unicode về NFC. Dùng ở CẢ 2 phía khi so khớp từ. */
export function toNFC(s: string): string {
  return s.normalize("NFC");
}

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

/** Đọc 3 chữ số (0..999). full=true → luôn đọc đủ hàng trăm (dùng cho nhóm sau). */
function readTriple(n: number, full: boolean): string {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  const out: string[] = [];

  if (tram > 0 || full) {
    out.push(DIGITS[tram]!, "trăm");
  }

  if (chuc === 0) {
    if (donvi > 0) {
      if (tram > 0 || full) out.push("lẻ");
      out.push(DIGITS[donvi]!);
    }
  } else if (chuc === 1) {
    out.push("mười");
    if (donvi === 5) out.push("lăm");
    else if (donvi > 0) out.push(DIGITS[donvi]!);
  } else {
    out.push(DIGITS[chuc]!, "mươi");
    if (donvi === 1) out.push("mốt");
    else if (donvi === 5) out.push("lăm");
    else if (donvi > 0) out.push(DIGITS[donvi]!);
  }
  return out.join(" ");
}

const SCALES = ["", "nghìn", "triệu", "tỷ"];

/** Số nguyên → chữ tiếng Việt. Hỗ trợ tới hàng nghìn tỷ. */
export function numberToVietnamese(input: number | string): string {
  let n = typeof input === "string" ? input.trim() : String(input);
  const negative = n.startsWith("-");
  if (negative) n = n.slice(1);
  n = n.replace(/\D/g, "");
  if (n === "") return "";
  n = n.replace(/^0+(?=\d)/, "");
  if (n === "0") return "không";

  // Cắt thành các nhóm 3 chữ số từ phải qua.
  const groups: number[] = [];
  for (let i = n.length; i > 0; i -= 3) {
    groups.unshift(parseInt(n.slice(Math.max(0, i - 3), i), 10));
  }

  const parts: string[] = [];
  const highest = groups.length - 1;
  for (let g = 0; g < groups.length; g++) {
    const val = groups[g]!;
    const scaleIdx = highest - g;
    if (val === 0) continue;
    // Nhóm đầu tiên không ép đọc đủ hàng trăm; các nhóm sau thì có.
    const full = g !== 0;
    parts.push(readTriple(val, full));
    const scale = SCALES[scaleIdx % SCALES.length];
    // Với "tỷ tỷ" (rất hiếm) lặp lại "tỷ".
    const extraTy = Math.floor(scaleIdx / SCALES.length);
    if (scale) parts.push(scale);
    for (let k = 0; k < extraTy; k++) parts.push("tỷ");
  }

  return (negative ? "âm " : "") + parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Đọc phần thập phân từng chữ số: "3.5" phần "5" → "năm". */
function readDecimal(frac: string): string {
  return frac
    .split("")
    .map((d) => DIGITS[parseInt(d, 10)] ?? "")
    .filter(Boolean)
    .join(" ");
}

/**
 * Bung mọi con số/tiền tệ/phần trăm trong câu ra chữ.
 *  "299.000đ"  → "hai trăm chín mươi chín nghìn đồng"
 *  "50%"       → "năm mươi phần trăm"
 *  "4.9/5 sao" → "bốn phẩy chín trên năm sao"
 */
export function expandNumbers(text: string): string {
  let out = text;

  // Tiền tệ: <số>đ | <số> VND | <số>k (nghìn)
  out = out.replace(
    /(\d[\d.,]*)\s*(k)\b/gi,
    (_m, num: string) => `${numberToVietnamese(stripThousands(num))} nghìn`,
  );
  // Longest alternative trước ("đồng" trước "đ"). Không dùng \b vì "đ" (U+0111)
  // không phải \w trong JS regex → dùng lookahead unicode.
  out = out.replace(
    /(\d[\d.,]*)\s*(?:đồng|vnđ|vnd|đ)(?![\p{L}])/giu,
    (_m, num: string) => `${numberToVietnamese(stripThousands(num))} đồng`,
  );

  // Phần trăm
  out = out.replace(
    /(\d[\d.,]*)\s*%/g,
    (_m, num: string) => `${readNumberToken(num)} phần trăm`,
  );

  // Phân số / tỉ lệ "x/y"
  out = out.replace(
    /(\d[\d.,]*)\s*\/\s*(\d[\d.,]*)/g,
    (_m, a: string, b: string) => `${readNumberToken(a)} trên ${readNumberToken(b)}`,
  );

  // Số còn lại (kể cả thập phân)
  out = out.replace(/\d[\d.,]*/g, (m) => readNumberToken(m));

  return out.replace(/\s+/g, " ").trim();
}

/** Bỏ dấu chấm phân tách hàng nghìn kiểu VN: "299.000" → "299000". */
function stripThousands(num: string): string {
  // Nếu có dạng nhóm 3 số ngăn bởi '.' hoặc ',', coi là ngăn cách nghìn.
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) return num.replace(/[.,]/g, "");
  return num;
}

/** Đọc 1 token số, phân biệt thập phân (dấu ',' hoặc '.' đứng trước <3 số cuối). */
function readNumberToken(raw: string): string {
  const cleaned = stripThousands(raw);
  // Thập phân: còn lại dấu '.'/',' không phải nhóm nghìn
  const decMatch = cleaned.match(/^(\d+)[.,](\d+)$/);
  if (decMatch) {
    return `${numberToVietnamese(decMatch[1]!)} phẩy ${readDecimal(decMatch[2]!)}`;
  }
  return numberToVietnamese(cleaned);
}

/** Áp bảng phát âm thay thế (whole-word, không phân biệt hoa thường). */
export function applyPronunciations(
  text: string,
  table?: Record<string, string>,
): string {
  if (!table) return text;
  let out = text;
  for (const [from, to] of Object.entries(table)) {
    // PHÂN BIỆT HOA/THƯỜNG: "AI" (viết tắt) khác "ai"/"Ai" (từ tiếng Việt = who).
    // Người dùng viết key đúng dạng chữ như xuất hiện trong narration.
    const re = new RegExp(`\\b${escapeRegExp(from)}\\b`, "g");
    out = out.replace(re, to);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Hàm chính: chuẩn hoá 1 narration để gửi TTS.
 * Thứ tự: pronunciations (giữ tên gốc trước khi bung số) → NFC → bung số.
 */
export function normalizeVietnamese(
  text: string,
  opts: { pronunciations?: Record<string, string> } = {},
): string {
  const withPron = applyPronunciations(text, opts.pronunciations);
  const nfc = toNFC(withPron);
  return expandNumbers(nfc);
}
