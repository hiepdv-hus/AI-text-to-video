import React from "react";
import { interpolate } from "remotion";
import { ArrowDown } from "lucide-react";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { useEnter, usePulse } from "../motion";
import { Glyph, parseLabel } from "./Icon";

/**
 * IllusCompare — MINH HOẠ ĐỘNG cho graphic.kind = "illus-compare".
 *
 * Hai thế giới tương phản, TRÊN biến thành DƯỚI: panel trên (cũ/vấn đề) trôi vào từ trái,
 * xám và mờ, gắn ✕; panel dưới (mới/giải pháp) trôi vào từ phải, sáng rực màu nhấn, thở
 * và gắn ✓; giữa hai panel một mũi tên đi xuống nảy nhẹ = "cái này trở thành cái kia".
 *
 * Khác `compare` (layout chữ) và `checklist`: đây là HÌNH minh hoạ có tương phản thị giác
 * mạnh + chuyển động, không phải hai dòng chữ.
 *
 * Nhãn (labels): đúng 2 phần tử —
 *   labels[0] = vế CŨ/vấn đề  (vd "@bug Code rối, khó sửa")
 *   labels[1] = vế MỚI/giải pháp (vd "@zap Gọn, chạy nhanh")
 */

export const IllusCompare: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const src = labels?.length ? labels : ["@x-circle Cách cũ: chậm và rối", "@zap Cách mới: nhanh, gọn"];
  const bad = parseLabel(src[0] ?? "@x-circle Cách cũ");
  const good = parseLabel(src[1] ?? "@zap Cách mới");

  const eBad = useEnter(6, { damping: 18, stiffness: 150, mass: 0.85 });
  const eGood = useEnter(16, { damping: 18, stiffness: 150, mass: 0.85 });
  const eArrow = useEnter(24, { damping: 12, stiffness: 220, mass: 0.6 });
  const pulse = usePulse(0.5);
  const tech = isTech(p);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: TEXT_STACK }}>
      {/* Vế CŨ — trôi vào từ trái, xám, mờ, ✕ */}
      <Panel
        node={bad}
        e={eBad}
        fromX={-70}
        good={false}
        badge="✕"
        p={p}
      />

      {/* Mũi tên biến đổi */}
      <div
        style={{
          opacity: interpolate(eArrow, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(eArrow, [0, 1], [-10, 0])}px) scale(${interpolate(eArrow, [0, 1], [0.4, 1])})`,
          width: 62,
          height: 62,
          borderRadius: 999,
          background: p.accentSoft,
          border: `2px solid ${p.accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: tech ? `0 0 ${16 + pulse * 22}px ${p.accentSoft}` : p.cardShadow,
          margin: "2px 0",
        }}
      >
        <ArrowDown size={34} color={p.accent} strokeWidth={2.6} absoluteStrokeWidth />
      </div>

      {/* Vế MỚI — trôi vào từ phải, sáng, thở, ✓ */}
      <Panel node={good} e={eGood} fromX={70} good badge="✓" glow={pulse} p={p} />
    </div>
  );
};

const Panel: React.FC<{
  node: ReturnType<typeof parseLabel>;
  e: number;
  fromX: number;
  good: boolean;
  badge: string;
  glow?: number;
  p: Palette;
}> = ({ node, e, fromX, good, badge, glow = 0, p }) => {
  const tech = isTech(p);
  const border = good ? p.accent : p.cardBorder;
  const iconColor = good ? p.accent : p.textMuted;
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "26px 28px",
        borderRadius: p.radius.lg,
        background: good ? p.accentSoft : p.card,
        border: `${good ? 2 : 1.5}px solid ${border}`,
        boxShadow: good ? (tech ? `${p.cardShadow}, 0 0 ${20 + glow * 30}px ${p.accentSoft}` : p.cardShadow) : p.cardShadow,
        backdropFilter: p.cardBackdrop !== "none" ? p.cardBackdrop : undefined,
        opacity: interpolate(e, [0, 0.5], [0, good ? 1 : 0.72], { extrapolateRight: "clamp" }),
        transform: `translateX(${interpolate(e, [0, 1], [fromX, 0])}px)`,
        // Vế cũ hơi ngả xám: hạ bão hoà icon + chữ mờ. Vế mới giữ nguyên độ tươi.
        filter: good ? "none" : "saturate(0.5)",
      }}
    >
      <div
        style={{
          width: 84,
          height: 84,
          minWidth: 84,
          borderRadius: p.radius.md,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: good ? p.card : "transparent",
          border: `1.5px solid ${good ? p.accent : p.hairline}`,
        }}
      >
        <Glyph parsed={node} size={50} color={iconColor} p={p} />
      </div>
      <div style={{ flex: 1, fontSize: p.size.card, fontWeight: 650, color: good ? p.text : p.textMuted, textAlign: "left", lineHeight: 1.18 }}>
        {node.text}
      </div>
      <div
        style={{
          width: 52,
          height: 52,
          minWidth: 52,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          fontWeight: 800,
          color: good ? p.onAccent : p.textMuted,
          background: good ? p.accent : "transparent",
          border: good ? "none" : `2px solid ${p.textMuted}`,
        }}
      >
        {badge}
      </div>
    </div>
  );
};
