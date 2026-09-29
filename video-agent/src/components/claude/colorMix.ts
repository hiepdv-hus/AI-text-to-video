/**
 * colorMix — trộn hai màu để làm hiệu ứng "sáng dần lên màu nhấn" (viền chip khi năng
 * lượng chạy tới, cạnh khối khi vệt sáng quét qua). Dùng chung cho các widget minh hoạ.
 *
 * Chỉ trộn được khi CẢ HAI là hex #rrggbb. Màu rgba (vd cardBorder) không parse được →
 * rơi về màu đích khi t vượt nửa. Đủ dùng: các chỗ gọi luôn trộn từ viền mờ SANG accent
 * (hex), nên nhánh fallback hiếm khi chạy.
 */
export function mixColor(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  if (!pa || !pb) return t > 0.5 ? b : a;
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(pa.r, pb.r)}, ${m(pa.g, pb.g)}, ${m(pa.b, pb.b)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
}
