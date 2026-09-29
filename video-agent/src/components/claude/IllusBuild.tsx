import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { useEnter } from "../motion";
import { Glyph, parseLabel } from "./Icon";
import { mixColor } from "./colorMix";

/**
 * IllusBuild — MINH HOẠ ĐỘNG cho graphic.kind = "illus-build".
 *
 * Các lớp/mảnh BAY VÀO từ hai bên xen kẽ và XẾP CHỒNG thành một khối hoàn chỉnh; sau khi
 * lắp xong, một vệt sáng QUÉT LÊN qua từng tầng, lặp lại — đọc ra là "những phần này hợp
 * lại tạo nên một thứ". Kể cái mà `steps`/`feature-cards` không kể: sự CẤU THÀNH.
 *   "Một web app = Frontend + Backend + Database"
 *   "Kỹ năng fullstack = HTML/CSS + JavaScript + React + Node"
 *
 * Nhãn (labels): mỗi lớp một nhãn (2–4), viết theo thứ tự TRÊN → DƯỚI như bạn muốn xếp:
 *   ["@monitor Giao diện", "@server Máy chủ", "@db Cơ sở dữ liệu"]
 */

const RISE_SEC = 3.2; // chu kỳ vệt sáng quét lên hết chồng

export const IllusBuild: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layers = (labels?.length ? labels : ["@monitor Giao diện", "@server Máy chủ", "@db Cơ sở dữ liệu"])
    .slice(0, 4)
    .map(parseLabel);
  const n = layers.length;
  const allIn = useEnter(6 + n * 7, { damping: 20, stiffness: 120 }); // ~xong lúc lớp cuối vào
  // Pha quét sáng 0..1 (từ đáy lên đỉnh), chỉ chạy sau khi lắp xong.
  const rise = allIn > 0.9 ? (frame / fps / RISE_SEC) % 1 : -1;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14, fontFamily: TEXT_STACK }}>
      {layers.map((ly, i) => {
        // i=0 ở trên cùng; vệt sáng đi từ dưới lên → lớp dưới cùng sáng trước.
        const fromBottom = (n - 1 - i) / Math.max(n - 1, 1);
        const lit = rise < 0 ? 0 : Math.max(0, 1 - Math.abs(rise - fromBottom) * 3.2);
        return <BuildLayer key={i} node={ly} delay={6 + i * 7} fromLeft={i % 2 === 0} lit={lit} p={p} />;
      })}
    </div>
  );
};

const BuildLayer: React.FC<{
  node: ReturnType<typeof parseLabel>;
  delay: number;
  fromLeft: boolean;
  lit: number;
  p: Palette;
}> = ({ node, delay, fromLeft, lit, p }) => {
  const e = useEnter(delay, { damping: 16, stiffness: 150, mass: 0.9 });
  const tech = isTech(p);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "24px 28px",
        borderRadius: p.radius.md,
        background: p.card,
        // Cạnh trên sáng hơn → cảm giác khối đặc có bề dày, không phải thẻ phẳng.
        borderTop: `2px solid ${mixColor(p.cardBorder, p.accent, Math.max(lit, 0.15))}`,
        border: `1.5px solid ${p.cardBorder}`,
        boxShadow: `${p.cardShadow}${lit > 0.1 && tech ? `, 0 0 ${lit * 34}px ${p.accentSoft}` : ""}`,
        backdropFilter: p.cardBackdrop !== "none" ? p.cardBackdrop : undefined,
        opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateX(${interpolate(e, [0, 1], [fromLeft ? -80 : 80, 0])}px) scale(${interpolate(e, [0, 1], [0.9, 1])})`,
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          minWidth: 76,
          borderRadius: p.radius.sm,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: lit > 0.1 ? p.accentSoft : "transparent",
          border: `1.5px solid ${lit > 0.2 ? p.accent : p.hairline}`,
        }}
      >
        <Glyph parsed={node} size={46} color={p.accent} p={p} />
      </div>
      <div style={{ flex: 1, fontSize: p.size.card, fontWeight: 650, color: p.text, textAlign: "left", lineHeight: 1.18 }}>
        {node.text}
      </div>
    </div>
  );
};
