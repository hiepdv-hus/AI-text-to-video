import React from "react";
import { interpolate } from "remotion";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { BEAT, useDrift, useEnter, useSweep } from "../motion";

/**
 * TechBars — biểu đồ thanh NGANG cho graphic.kind = "bar-chart".
 *
 * Vì sao nằm ngang chứ không phải cột đứng: khung 9:16 chỉ rộng 1080px, mà nhãn tiếng
 * Việt thì dài. Cột đứng buộc nhãn phải xoay hoặc thu nhỏ — không đọc nổi trên điện
 * thoại. Thanh ngang cho nhãn cả một dòng và số liệu đứng ngay cạnh, mắt đọc một mạch.
 *
 * Nhãn nhập theo dạng "Tên:giá trị" — đơn vị tuỳ ý dính sau số:
 *   "Tốc độ:92%"  ·  "Lỗi runtime:3 lỗi"  ·  "Doanh thu:180"
 *
 * Thanh dài nhất được chuẩn hoá về ~92% bề ngang (không phải theo thang 100), nên biểu
 * đồ luôn "đầy khung" dù số liệu là 3/5/8 hay 60/80/95 — đây là so sánh tương đối.
 */

interface Row {
  name: string;
  value: number;
  unit: string;
}

function parseRows(labels?: string[]): Row[] {
  const src = labels?.length ? labels : ["Trước:35", "Sau:92"];
  return src.map((raw) => {
    const m = raw.match(/^(.*?):\s*([\d.,]+)\s*(.*)$/);
    if (!m) return { name: raw, value: 0, unit: "" };
    return {
      name: m[1]!.trim(),
      value: parseFloat(m[2]!.replace(",", ".")) || 0,
      unit: (m[3] ?? "").trim(),
    };
  });
}

/** Đếm số lên theo tiến trình, làm tròn giống cách viết của người dùng (2 → "2", 2.5 → "2.5"). */
function formatValue(target: number, progress: number): string {
  const v = target * progress;
  return Number.isInteger(target) ? String(Math.round(v)) : v.toFixed(1);
}

export const TechBars: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const rows = parseRows(labels);
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 40, fontFamily: TEXT_STACK }}>
      {rows.map((row, i) => (
        <Bar key={i} row={row} index={i} max={max} isPeak={i === rows.length - 1} p={p} />
      ))}
    </div>
  );
};

/**
 * Một hàng của biểu đồ. Ba chuyển động chồng lên nhau:
 *   - thanh MỌC ra (spring) và số ĐẾM LÊN cùng nhịp;
 *   - vệt sáng QUÉT dọc thanh, lặp lại — giữ cho biểu đồ không đứng chết sau khi mọc xong;
 *   - hàng nhấn thở rất khẽ theo trục dọc.
 *
 * Điểm nhấn là HÀNG CUỐI, không phải giá trị lớn nhất: dữ liệu kiểu này luôn viết theo
 * mạch "trước → sau", nên con số đáng nhớ nằm ở cuối. Lấy giá trị lớn nhất làm điểm nhấn
 * sẽ tô sáng nhầm khi "nhỏ hơn là tốt hơn".
 */
const Bar: React.FC<{ row: Row; index: number; max: number; isPeak: boolean; p: Palette }> = ({
  row,
  index,
  max,
  isPeak,
  p,
}) => {
  const e = useEnter(6 + index * BEAT.stagger, { damping: 20, stiffness: 110, mass: 0.9 });
  const sweep = useSweep(2.8, index * 0.22);
  const float = useDrift(index, 0.15) * (isPeak ? 2.6 : 1.4);
  const pct = (row.value / max) * 92;

  return (
    <div style={{ width: "100%", transform: `translateY(${float}px)` }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 16,
          opacity: interpolate(e, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(e, [0, 1], [14, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: p.size.card,
            fontWeight: 650,
            color: isPeak ? p.text : p.textMuted,
            textAlign: "left",
            lineHeight: 1.15,
          }}
        >
          {row.name}
        </div>
        <div
          style={{
            fontFamily: p.labelFont,
            fontSize: p.size.value,
            fontWeight: 800,
            lineHeight: 1,
            whiteSpace: "nowrap",
            color: isPeak ? p.accent : p.text,
            textShadow: isPeak && isTech(p) ? `0 0 30px ${p.accentSoft}` : "none",
            // Số "chốt" lại bằng một cú nảy nhẹ đúng lúc đếm xong.
            transform: `scale(${interpolate(e, [0.75, 1], [1.12, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
            transformOrigin: "right center",
          }}
        >
          {formatValue(row.value, e)}
          {row.unit && (
            <span style={{ fontSize: p.size.subhead, fontWeight: 700, marginLeft: 6, color: p.textMuted }}>
              {row.unit}
            </span>
          )}
        </div>
      </div>

      {/* Rãnh + thanh tô. Bo tròn hết cỡ để cạnh thanh mềm, không "gãy" như khối chữ nhật. */}
      <div style={{ width: "100%", height: 22, borderRadius: 999, background: p.track, overflow: "hidden" }}>
        <div
          style={{
            position: "relative",
            width: `${pct * e}%`,
            height: "100%",
            borderRadius: 999,
            overflow: "hidden",
            background: p.accentGradient,
            // Thanh phụ dùng CÙNG gradient nhưng mờ đi — vẫn đọc rõ độ dài (đó là
            // toàn bộ ý nghĩa của biểu đồ) mà không tranh điểm nhấn với hàng cuối.
            opacity: isPeak ? 1 : 0.42,
            boxShadow: isPeak && isTech(p) ? p.glow : "none",
          }}
        >
          {/* Vệt sáng chạy dọc thanh — thứ giữ cho biểu đồ vẫn "sống" sau khi mọc xong. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.45) 50%, transparent 80%)",
              transform: `translateX(${sweep * 220 - 110}%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
