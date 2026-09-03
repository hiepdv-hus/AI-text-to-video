import type { WordTiming } from "../schema";

/**
 * captions.ts — logic chia dòng phụ đề (thuần, không React → test được).
 *
 * Đã cân nhắc @remotion/captions (createTikTokStyleCaptions): nó chỉ gộp token
 * theo cửa sổ thời gian, KHÔNG cap số từ/dòng. Đặc tả yêu cầu chia theo CẢ 2 tiêu chí
 * (tối đa N từ VÀ khoảng lặng > gapMs) nên ta tự chunk — nhỏ, đúng ý, kiểm soát được.
 */

export interface CaptionLine {
  words: WordTiming[];
  startMs: number;
  endMs: number;
}

/**
 * Chia words thành các dòng:
 *  - Ngắt khi đủ maxWords, HOẶC
 *  - Ngắt khi khoảng lặng giữa 2 từ > gapMs (tránh cắt giữa câu → dòng khó chịu).
 */
export function chunkIntoLines(
  words: WordTiming[],
  maxWords: number,
  gapMs = 300,
): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let cur: WordTiming[] = [];

  const flush = () => {
    if (cur.length === 0) return;
    lines.push({
      words: cur,
      startMs: cur[0]!.startMs,
      endMs: cur[cur.length - 1]!.endMs,
    });
    cur = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const prev = cur[cur.length - 1];
    const bigGap = prev ? w.startMs - prev.endMs > gapMs : false;
    if (cur.length >= maxWords || bigGap) flush();
    cur.push(w);
  }
  flush();
  return fixOrphans(lines, maxWords, gapMs);
}

/**
 * fixOrphans — dồn lại các dòng chỉ có ĐÚNG MỘT TỪ.
 *
 * Một từ đứng chơ vơ giữa màn hình trông như lỗi hiển thị, nhất là ở kiểu caption có
 * nền khối. Cách sửa: kéo từ cuối của dòng TRƯỚC xuống, để dòng lẻ có 2 từ.
 *
 * Chỉ làm khi dòng trước bị ngắt vì ĐỦ SỐ TỪ chứ không phải vì khoảng lặng — hai điều
 * kiện đều phải đúng: dòng trước dài đúng maxWords, VÀ giữa hai dòng không có khoảng
 * lặng. Khoảng lặng là ranh giới câu; kéo từ qua nó sẽ ghép đuôi câu này với đầu câu kia.
 * Timing từng từ là tuyệt đối nên chuyển từ giữa các dòng không lệch karaoke.
 */
function fixOrphans(lines: CaptionLine[], maxWords: number, gapMs: number): CaptionLine[] {
  if (maxWords < 3) return lines; // dòng 2 từ thì không có gì để dồn
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const prev = lines[i - 1]!;
    if (line.words.length !== 1 || prev.words.length !== maxWords) continue;
    if (line.words[0]!.startMs - prev.endMs > gapMs) continue; // ngắt do nghỉ hơi → để yên
    const moved = prev.words.pop()!;
    line.words.unshift(moved);
    prev.endMs = prev.words[prev.words.length - 1]!.endMs;
    line.startMs = moved.startMs;
  }
  return lines;
}

/** Chỉ số dòng đang hiển thị tại thời điểm tMs (dòng chứa t, hoặc dòng gần nhất đã/đang tới). */
export function activeLineIndex(lines: CaptionLine[], tMs: number): number {
  if (lines.length === 0) return -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const next = lines[i + 1];
    // Hiển thị dòng i từ lúc nó bắt đầu tới ngay trước khi dòng kế bắt đầu.
    const showUntil = next ? next.startMs : Infinity;
    if (tMs >= line.startMs && tMs < showUntil) return i;
  }
  return tMs < lines[0]!.startMs ? 0 : lines.length - 1;
}

/** Từ đang được đọc trong 1 dòng (index trong line.words), -1 nếu chưa/không có. */
export function activeWordIndex(line: CaptionLine, tMs: number): number {
  for (let i = 0; i < line.words.length; i++) {
    const w = line.words[i]!;
    if (tMs >= w.startMs && tMs < w.endMs) return i;
  }
  // Nếu ở giữa 2 từ, coi từ gần nhất đã đọc là active để chữ không nhấp nháy.
  let idx = -1;
  for (let i = 0; i < line.words.length; i++) {
    if (tMs >= line.words[i]!.startMs) idx = i;
  }
  return idx;
}
