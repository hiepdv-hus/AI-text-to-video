import test from "node:test";
import assert from "node:assert/strict";
import { chunkIntoLines } from "../src/components/captions.ts";
import type { WordTiming } from "../src/schema.ts";

/** Tạo chuỗi từ đọc liền mạch (mỗi từ 200ms, không có khoảng lặng). */
function fluent(n: number, gapAt: number[] = []): WordTiming[] {
  const words: WordTiming[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    if (gapAt.includes(i)) t += 800; // khoảng lặng rõ rệt trước từ này
    words.push({ text: `w${i}`, startMs: t, endMs: t + 200 });
    t += 200;
  }
  return words;
}

test("chunkIntoLines: ngắt dòng khi đủ số từ", () => {
  const lines = chunkIntoLines(fluent(8), 4);
  assert.deepEqual(lines.map((l) => l.words.length), [4, 4]);
});

test("chunkIntoLines: ngắt dòng ở khoảng lặng dài", () => {
  const lines = chunkIntoLines(fluent(6, [2]), 4);
  assert.deepEqual(lines.map((l) => l.words.length), [2, 4]);
});

test("chunkIntoLines: dòng cuối 1 từ được kéo thành 2 từ", () => {
  // 9 từ liền mạch, max 4 → 4/4/1; sau khi dồn phải là 4/3/2 (không còn từ lẻ).
  const lines = chunkIntoLines(fluent(9), 4);
  assert.deepEqual(lines.map((l) => l.words.length), [4, 3, 2]);
});

test("chunkIntoLines: dồn từ lẻ vẫn giữ đúng thứ tự và timing", () => {
  const lines = chunkIntoLines(fluent(9), 4);
  const flat = lines.flatMap((l) => l.words.map((w) => w.text));
  assert.deepEqual(flat, ["w0", "w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8"]);
  for (const l of lines) {
    assert.equal(l.startMs, l.words[0]!.startMs);
    assert.equal(l.endMs, l.words[l.words.length - 1]!.endMs);
  }
});

test("chunkIntoLines: KHÔNG dồn qua khoảng lặng (ranh giới câu)", () => {
  // 4 từ liền, rồi lặng, rồi 1 từ → dòng 1 từ là do câu kết thúc, phải giữ nguyên.
  const lines = chunkIntoLines(fluent(5, [4]), 4);
  assert.deepEqual(lines.map((l) => l.words.length), [4, 1]);
});
