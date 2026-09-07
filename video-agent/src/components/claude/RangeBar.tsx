import React from "react";
import { interpolate } from "remotion";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { BEAT, useDrift, useEnter, usePulse } from "../motion";

/**
 * RangeBar — DẢI GIÁ TRỊ min–max cho graphic.kind = "range-bar".
 *
 * Vì sao không dùng bar-chart: lương, thời gian học, chi phí… đều là một KHOẢNG, không
 * phải một điểm. Vẽ bằng bar-chart buộc phải chọn đại một con số (trung bình? cao nhất?)
 * — vừa sai vừa mất thông tin quan trọng nhất là biên độ. Ở đây thanh bắt đầu từ min và
 * kết thúc ở max, nên nhìn phát biết ngay "khoảng này rộng hay hẹp, cao hay thấp".
 *
 * Nhãn dạng "tên:min-max đơn vị":
 *   "Fresher:8-12 triệu"
 *   "Junior:12-20 triệu"
 *   "Middle:20-35 triệu"
 *
 * Mọi hàng dùng CHUNG một thang (0 → max toàn bảng) — đó là toàn bộ lý do widget này
 * tồn tại. Chuẩn hoá từng hàng riêng sẽ khiến ba khoảng khác hẳn nhau trông giống nhau.
 */

interface Row {
  name: string;
  min: number;
  max: number;
  unit: string;
}

function parseRows(labels?: string[]): Row[] {
  const src = labels?.length ? labels : ["Fresher:8-12 triệu", "Junior:12-20 triệu", "Middle:20-35 triệu"];
  return src.map((raw) => {
    const [head, ...rest] = raw.split(":");
    const body = rest.join(":").trim();
    const m = body.match(/^([\d.,]+)\s*[-–—]\s*([\d.,]+)\s*(.*)$/);
    if (!m) {
      // Không có gạch nối → coi là một điểm, min = max. Vẫn vẽ được, chỉ là thanh rất ngắn.
      const one = body.match(/^([\d.,]+)\s*(.*)$/);
      const v = one ? parseFloat(one[1]!.replace(",", ".")) || 0 : 0;
      return { name: (head ?? raw).trim(), min: v, max: v, unit: one ? (one[2] ?? "").trim() : "" };
    }
    const lo = parseFloat(m[1]!.replace(",", ".")) || 0;
    const hi = parseFloat(m[2]!.replace(",", ".")) || 0;
    return {
      name: (head ?? "").trim(),
      min: Math.min(lo, hi),
      max: Math.max(lo, hi),
      unit: (m[3] ?? "").trim(),
    };
  });
}

/** Số nguyên in nguyên, số lẻ giữ 1 chữ số — khớp cách người dùng gõ. */
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export const RangeBar: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const rows = parseRows(labels);
  // Thang chung, chừa 6% phía trên để nhãn của hàng cao nhất không chạm mép phải.
  const scale = Math.max(...rows.map((r) => r.max), 1) * 1.06;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 44, fontFamily: TEXT_STACK }}>
      {rows.map((row, i) => (
        <Range key={i} row={row} index={i} scale={scale} isPeak={i === rows.length - 1} p={p} />
      ))}
    </div>
  );
};

/**
 * Một dải. Thanh mọc từ MIN sang phải (không phải từ 0): mắt đọc ra là "khoảng này bắt
 * đầu ở đây", đúng nghĩa của dữ liệu. Hai đầu có chốt tròn để biên độ rõ ràng.
 *
 * Điểm nhấn là HÀNG CUỐI — giống TechBars, vì dữ liệu kiểu thang bậc luôn viết từ thấp
 * lên cao và con số đáng nhớ nằm ở cuối.
 */
const Range: React.FC<{ row: Row; index: number; scale: number; isPeak: boolean; p: Palette }> = ({
  row,
  index,
  scale,
  isPeak,
  p,
}) => {
  const e = useEnter(6 + index * BEAT.stagger, { damping: 20, stiffness: 115, mass: 0.9 });
  const float = useDrift(index, 0.15) * (isPeak ? 2.6 : 1.4);
  const pulse = usePulse(0.34, index);

  const left = (row.min / scale) * 100;
  const width = ((row.max - row.min) / scale) * 100;

  return (
    <div style={{ width: "100%", transform: `translateY(${float}px)` }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 14,
          opacity: interpolate(e, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(e, [0, 1], [12, 0])}px)`,
        }}
      >
        <div style={{ fontSize: p.size.card, fontWeight: 650, color: isPeak ? p.text : p.textMuted, lineHeight: 1.15 }}>
          {row.name}
        </div>
        <div
          style={{
            fontFamily: p.labelFont,
            fontSize: p.size.subhead,
            fontWeight: 800,
            whiteSpace: "nowrap",
            color: isPeak ? p.accent : p.text,
            textShadow: isPeak && isTech(p) ? `0 0 26px ${p.accentSoft}` : "none",
          }}
        >
          {fmt(row.min)}–{fmt(row.max)}
          {row.unit && <span style={{ fontSize: p.size.small, color: p.textMuted, marginLeft: 6 }}>{row.unit}</span>}
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", height: 20, borderRadius: 999, background: p.track }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${left}%`,
            // Dải mở rộng dần sang phải khi vào: gốc trái đứng yên ở đúng vị trí min.
            width: `${width * e}%`,
            borderRadius: 999,
            background: p.accentGradient,
            opacity: isPeak ? 1 : 0.45,
            boxShadow: isPeak && isTech(p) ? `0 0 ${(14 + pulse * 16).toFixed(0)}px ${p.accentSoft}` : "none",
          }}
        >
          {/* Chốt hai đầu — cho biên độ có điểm bắt đầu và kết thúc dứt khoát. */}
          <Cap side="left" p={p} dim={!isPeak} />
          <Cap side="right" p={p} dim={!isPeak} />
        </div>
      </div>
    </div>
  );
};

const Cap: React.FC<{ side: "left" | "right"; p: Palette; dim: boolean }> = ({ side, p, dim }) => (
  <div
    style={{
      position: "absolute",
      top: "50%",
      [side]: 0,
      transform: `translate(${side === "left" ? "-50%" : "50%"}, -50%)`,
      width: 26,
      height: 26,
      borderRadius: 999,
      background: p.bg,
      border: `4px solid ${p.accent}`,
      opacity: dim ? 0.55 : 1,
    }}
  />
);
