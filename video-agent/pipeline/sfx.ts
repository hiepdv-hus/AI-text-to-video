import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { writeWavFromFloat } from "./audio.ts";

/**
 * sfx.ts — TỔNG HỢP hiệu ứng âm thanh bằng Node, không tải file từ đâu cả.
 *
 * Vì sao tự tổng hợp thay vì tải gói SFX về:
 *   1. BẢN QUYỀN — gói SFX miễn phí gần như luôn kèm điều kiện (ghi nguồn, cấm dùng
 *      thương mại, cấm phân phối lại). Video này có thể đem kiếm tiền, nên một file
 *      không rõ giấy phép là rủi ro thật. Sóng sinh bằng công thức thì không ai sở hữu.
 *   2. XÁC ĐỊNH — cùng một công thức luôn ra cùng một file, hợp với nguyên tắc
 *      "render lại bao nhiêu lần cũng như nhau" của cả hệ.
 *   3. CHỈNH ĐƯỢC — muốn whoosh trầm hơn thì sửa tham số, không phải đi tìm file khác.
 *
 * File sinh ra nằm ở public/sfx/ (đã gitignore) và được tạo lại tự động ở bước build
 * nếu thiếu, nên không cần commit binary vào repo.
 */

const SR = 44100;

/* ----------------------------- Tiện ích DSP ------------------------------- */

/**
 * Nhiễu trắng XÁC ĐỊNH — dùng LCG tự viết chứ không phải Math.random(), để hai lần
 * chạy build ra hai file giống hệt nhau (bit-for-bit).
 */
function makeNoise(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0x100000000) * 2 - 1;
  };
}

/**
 * Bộ lọc state-variable (Chamberlin) — cho ra bandpass thật, thứ biến nhiễu trắng
 * thành tiếng "swish". Lọc thông thấp đơn thuần chỉ làm nhiễu nghe như tiếng xì.
 */
function svfBandpass(input: Float32Array, cutoffAt: (t: number) => number, q: number): Float32Array {
  const out = new Float32Array(input.length);
  let low = 0;
  let band = 0;
  for (let i = 0; i < input.length; i++) {
    const fc = Math.max(40, Math.min(SR / 3, cutoffAt(i / input.length)));
    const f = 2 * Math.sin((Math.PI * fc) / SR);
    const high = input[i]! - low - q * band;
    band += f * high;
    low += f * band;
    out[i] = band;
  }
  return out;
}

/** Chuẩn hoá về đỉnh `peak`, rồi vuốt mềm 3 ms hai đầu để không có tiếng "tách". */
function finish(buf: Float32Array, peak: number): Float32Array {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const g = max > 1e-6 ? peak / max : 0;
  const edge = Math.round(SR * 0.003);
  for (let i = 0; i < buf.length; i++) {
    let a = 1;
    if (i < edge) a = i / edge;
    else if (i > buf.length - edge) a = (buf.length - i) / edge;
    buf[i] = buf[i]! * g * a;
  }
  return buf;
}

const secs = (d: number) => new Float32Array(Math.round(SR * d));

/* ------------------------------ Các âm thanh ------------------------------ */

/**
 * whoosh — nhiễu qua bandpass quét lên rồi xuống. Đây là tiếng chuyển cảnh phổ thông
 * nhất: tai người đọc đường quét tần số thành "có gì đó vừa lướt qua", nên nó khớp với
 * chuyển động trượt/xoá mà không cần giống bất kỳ vật thể nào.
 */
function whoosh(dur = 0.42): Float32Array {
  const n = secs(dur);
  const rnd = makeNoise(12345);
  for (let i = 0; i < n.length; i++) n[i] = rnd();
  // Quét 500 → 5000 → 900 Hz: lên nhanh, xuống chậm, giống vật thể bay ngang qua tai.
  const bp = svfBandpass(n, (t) => (t < 0.45 ? 500 + (t / 0.45) * 4500 : 5000 - ((t - 0.45) / 0.55) * 4100), 0.7);
  for (let i = 0; i < bp.length; i++) {
    const t = i / bp.length;
    // Vào nhanh (8%), tắt dần theo hàm mũ — đuôi dài giữ cho cú cắt không bị cụt.
    const env = t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) * 4.2);
    bp[i] = bp[i]! * env;
  }
  return finish(bp, 0.82);
}

/**
 * riser — sine quét lên kèm nhiễu, biên độ tăng dần. Dùng cho chuyển cảnh phóng/loé:
 * tai đọc cao độ đi lên thành "sắp có gì đó xảy ra", nên nó dẫn vào cảnh mới thay vì
 * chỉ đánh dấu ranh giới như whoosh.
 */
function riser(dur = 0.6): Float32Array {
  const out = secs(dur);
  const rnd = makeNoise(777);
  let phase = 0;
  const noise = secs(dur);
  for (let i = 0; i < noise.length; i++) noise[i] = rnd();
  const air = svfBandpass(noise, (t) => 1200 + t * 5200, 1.1);

  for (let i = 0; i < out.length; i++) {
    const t = i / out.length;
    // Cao độ đi lên theo hàm mũ, không tuyến tính — tai nghe quãng chứ không nghe Hz,
    // quét tuyến tính sẽ có cảm giác chậm dần ở cuối.
    const f = 220 * Math.pow(5.5, t);
    phase += (2 * Math.PI * f) / SR;
    const env = Math.pow(t, 1.6);
    out[i] = (Math.sin(phase) * 0.55 + air[i]! * 0.45) * env;
  }
  // Cắt đuôi 6% cuối để riser dừng ĐÚNG lúc cảnh mới vào, không kéo lê sang cảnh sau.
  const tail = Math.round(out.length * 0.06);
  for (let i = 0; i < tail; i++) out[out.length - 1 - i] = out[out.length - 1 - i]! * (i / tail);
  return finish(out, 0.72);
}

/**
 * impact — cú thụp trầm: sine hạ cao độ rất nhanh (60 → 38 Hz) cộng một transient
 * nhiễu ngắn ở đầu. Transient là thứ làm nó nghe "đánh" chứ không phải "ù".
 */
function impact(dur = 0.5): Float32Array {
  const out = secs(dur);
  const rnd = makeNoise(4242);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / out.length;
    const f = 38 + 26 * Math.exp(-t * 14);
    phase += (2 * Math.PI * f) / SR;
    const body = Math.sin(phase) * Math.exp(-t * 5.5);
    const click = t < 0.02 ? rnd() * (1 - t / 0.02) * 0.5 : 0;
    out[i] = body + click;
  }
  return finish(out, 0.8);
}

/**
 * pop — blip ngắn cho phần tử nhỏ xuất hiện. Cao độ đi LÊN một chút trong lúc tắt:
 * đi xuống nghe thành "hỏng/huỷ", đi lên nghe thành "hiện ra".
 */
function pop(dur = 0.13): Float32Array {
  const out = secs(dur);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / out.length;
    const f = 620 + 380 * t;
    phase += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(phase) * Math.exp(-t * 16);
  }
  return finish(out, 0.6);
}

/**
 * ambient-tech — NỀN xoay vòng 20 giây cho video công nghệ: quãng năm trầm + hoà âm
 * rất nhẹ + tầng nhiễu bị lọc, tất cả trôi theo một LFO chậm.
 *
 * Cố ý KHÔNG có giai điệu và không có nhịp: đây là thứ lấp khoảng im lặng, không phải
 * nhạc. Có giai điệu thì nó tranh chỗ với giọng đọc, mà giọng đọc mới là nội dung.
 * Số chu kỳ LFO là số nguyên nên điểm nối khi lặp không bị giật.
 */
function ambientTech(dur = 20): Float32Array {
  const out = secs(dur);
  const rnd = makeNoise(20260905);
  const noise = secs(dur);
  for (let i = 0; i < noise.length; i++) noise[i] = rnd();
  const airy = svfBandpass(noise, (t) => 900 + Math.sin(t * Math.PI * 4) * 500, 1.6);

  // A1 và E2 — quãng năm, không có quãng ba nên không "vui" cũng không "buồn",
  // hợp với nội dung kỹ thuật ở mọi tông cảm xúc.
  const roots = [55, 82.5, 110, 165];
  const phases = roots.map(() => 0);

  for (let i = 0; i < out.length; i++) {
    const t = i / out.length;
    // 3 chu kỳ trọn vẹn trong 20 s → nối vòng liền mạch.
    const lfo = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 3);
    let v = 0;
    for (let k = 0; k < roots.length; k++) {
      phases[k] = phases[k]! + (2 * Math.PI * roots[k]!) / SR;
      // Bè cao mờ dần theo LFO → hoà âm "thở" thay vì đứng yên.
      const w = k < 2 ? 1 : 0.35 + lfo * 0.4;
      v += Math.sin(phases[k]!) * w * (1 / roots.length);
    }
    out[i] = v * 0.85 + airy[i]! * 0.1 * lfo;
  }
  // Vuốt hai đầu 0.4 s để vòng lặp không nghe thấy mối nối.
  const edge = Math.round(SR * 0.4);
  for (let i = 0; i < edge; i++) {
    const a = i / edge;
    out[i] = out[i]! * a;
    out[out.length - 1 - i] = out[out.length - 1 - i]! * a;
  }
  return finish(out, 0.5);
}

/* ------------------------------- Xuất file -------------------------------- */

const BANK: Record<string, () => Float32Array> = {
  whoosh,
  riser,
  impact,
  pop,
  "ambient-tech": ambientTech,
};

/** Tên file (không kèm thư mục) của một hiệu ứng — dùng chung giữa pipeline và React. */
export const SFX_DIR = "sfx";
export const sfxFile = (name: string) => `${SFX_DIR}/${name}.wav`;

/**
 * Sinh các file SFX còn thiếu vào public/sfx/. Gọi ở đầu mỗi lần build: rẻ (chỉ kiểm
 * tra file tồn tại) và tự lành — xoá thư mục đi thì lần build sau tự dựng lại.
 */
export async function ensureSfx(publicDir: string): Promise<void> {
  const dir = path.join(publicDir, SFX_DIR);
  await fs.mkdir(dir, { recursive: true });
  const missing = Object.keys(BANK).filter((n) => !existsSync(path.join(dir, `${n}.wav`)));
  if (missing.length === 0) return;
  for (const name of missing) {
    await writeWavFromFloat(path.join(dir, `${name}.wav`), BANK[name]!(), SR);
  }
  console.log(`[sfx]   đã tổng hợp ${missing.length} file: ${missing.join(", ")}`);
}
