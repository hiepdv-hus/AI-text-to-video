import { test } from "node:test";
import assert from "node:assert/strict";
import {
  numberToVietnamese,
  expandNumbers,
  normalizeVietnamese,
  toNFC,
} from "./normalize.ts";

test("numberToVietnamese: cơ bản", () => {
  assert.equal(numberToVietnamese(0), "không");
  assert.equal(numberToVietnamese(5), "năm");
  assert.equal(numberToVietnamese(10), "mười");
  assert.equal(numberToVietnamese(15), "mười lăm");
  assert.equal(numberToVietnamese(21), "hai mươi mốt");
  assert.equal(numberToVietnamese(25), "hai mươi lăm");
  assert.equal(numberToVietnamese(100), "một trăm");
  assert.equal(numberToVietnamese(105), "một trăm lẻ năm");
  assert.equal(numberToVietnamese(1000), "một nghìn");
  assert.equal(numberToVietnamese(299000), "hai trăm chín mươi chín nghìn");
  assert.equal(numberToVietnamese(1000000), "một triệu");
  assert.equal(numberToVietnamese(1500000), "một triệu năm trăm nghìn");
});

test("expandNumbers: tiền tệ / phần trăm / tỉ lệ", () => {
  assert.equal(expandNumbers("299.000đ"), "hai trăm chín mươi chín nghìn đồng");
  assert.equal(expandNumbers("50%"), "năm mươi phần trăm");
  assert.equal(expandNumbers("giảm 30% còn 199k"), "giảm ba mươi phần trăm còn một trăm chín mươi chín nghìn");
  assert.equal(expandNumbers("4.9/5 sao"), "bốn phẩy chín trên năm sao");
});

test("normalizeVietnamese: end-to-end với NFC + pronunciation", () => {
  const out = normalizeVietnamese("Mua iPhone giá 25.990.000đ", {
    pronunciations: { iPhone: "ai phôn" },
  });
  assert.match(out, /ai phôn/);
  assert.match(out, /hai mươi lăm triệu chín trăm chín mươi nghìn đồng/);
});

test("toNFC: gộp dấu tổ hợp", () => {
  const composed = "ế"; // NFC
  const decomposed = "ế"; // NFD
  assert.notEqual(composed, decomposed);
  assert.equal(toNFC(decomposed), toNFC(composed));
});
