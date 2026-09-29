import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { useEnter } from "../motion";
import { Glyph, parseLabel } from "./Icon";

/**
 * IllusHero — MINH HOẠ ĐỘNG cho graphic.kind = "illus-hero".
 *
 * Một CHỦ THỂ lớn ở giữa (điện thoại, laptop, người, bộ não…) toả quầng sáng thở, quanh
 * nó các yếu tố bối cảnh TRÔI TỰ DO (mỗi cái bồng bềnh lệch pha nhau). Khác `illus-orbit`
 * ở chỗ: orbit là các nhánh QUAY đều theo vòng (nói về "hệ thống"); hero là một chủ thể
 * CỤ THỂ với bối cảnh lơ lửng quanh (nói về "một thứ và thế giới của nó") — gần cảm giác
 * "cảnh phim" nhất.
 *   "Điện thoại của bạn: đèn, khoá, camera, loa đều nghe lệnh"
 *   "Một lập trình viên: cà phê, deadline, bug, commit lúc nửa đêm"
 *
 * Nhãn (labels):
 *   labels[0]   = chủ thể trung tâm — vd "@mobile Điện thoại"
 *   labels[1..] = bối cảnh trôi quanh (3–5) — vd "@lightbulb Đèn", "@lock Khoá", "@eye Camera"
 */

const GOLDEN = 2.399963; // góc vàng → rải đều mà không thành vòng tròn máy móc

export const IllusHero: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const src = labels?.length
    ? labels
    : ["@rocket Sản phẩm", "@zap Nhanh", "@shield An toàn", "@users Nhiều người", "@gauge Ổn định"];
  const hero = parseLabel(src[0] ?? "@rocket Sản phẩm");
  const ctx = src.slice(1, 6).map(parseLabel);

  const eHero = useEnter(4, { damping: 16, stiffness: 150, mass: 0.9 });
  const aura = (Math.sin((frame / fps) * Math.PI * 2 * 0.35) + 1) / 2;
  const tech = isTech(p);

  return (
    <div style={{ width: "100%", height: 900, position: "relative", fontFamily: TEXT_STACK }}>
      {/* Bối cảnh trôi quanh — vẽ trước để nằm dưới chủ thể. */}
      {ctx.map((c, i) => {
        const a = -Math.PI / 2 + i * GOLDEN;
        // Bán kính lệch nhau chút cho "rải" tự nhiên, không thành vòng đều.
        const rx = 30 + (i % 2) * 6;
        const ry = 26 + ((i + 1) % 2) * 6;
        const left = 50 + Math.cos(a) * rx;
        const top = 42 + Math.sin(a) * ry;
        return <FloatChip key={i} node={c} leftPct={left} topPct={top} index={i} delay={12 + i * 5} p={p} />;
      })}

      {/* Chủ thể trung tâm */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          transform: `translate(-50%, -50%) scale(${interpolate(eHero, [0, 1], [0.6, 1])})`,
          opacity: eHero,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 230,
            height: 230,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: p.accentSoft,
            border: `3px solid ${p.accent}`,
            boxShadow: `0 0 ${40 + aura * 44}px ${p.accent}, 0 0 ${80 + aura * 60}px ${p.accentSoft}, ${p.cardShadow}`,
            backdropFilter: p.cardBackdrop !== "none" ? p.cardBackdrop : undefined,
          }}
        >
          <Glyph parsed={hero} size={120} color={p.accent} p={p} />
        </div>
        <div
          style={{
            fontSize: p.size.heading,
            fontWeight: 800,
            color: p.text,
            textAlign: "center",
            lineHeight: 1.1,
            textShadow: tech ? `0 0 28px ${p.accentSoft}` : "none",
          }}
        >
          {hero.text}
        </div>
      </div>
    </div>
  );
};

/** Một yếu tố bối cảnh: icon nhỏ trong chip + nhãn, bồng bềnh trôi lệch pha. */
const FloatChip: React.FC<{
  node: ReturnType<typeof parseLabel>;
  leftPct: number;
  topPct: number;
  index: number;
  delay: number;
  p: Palette;
}> = ({ node, leftPct, topPct, index, delay, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useEnter(delay, { damping: 15, stiffness: 170, mass: 0.75 });
  // Trôi bồng bềnh: mỗi chip lệch pha theo index → không đồng loạt như bị giật dây.
  const bobY = Math.sin((frame / fps) * Math.PI * 2 * 0.2 + index * 1.7) * 8;
  const bobX = Math.cos((frame / fps) * Math.PI * 2 * 0.16 + index * 2.1) * 6;
  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `translate(-50%, -50%) translate(${Math.round(bobX)}px, ${Math.round(bobY)}px) scale(${interpolate(e, [0, 1], [0.3, 1])})`,
        opacity: interpolate(e, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 20px 14px 14px",
        borderRadius: 999,
        background: p.card,
        border: `1.5px solid ${p.cardBorder}`,
        boxShadow: p.cardShadow,
        backdropFilter: p.cardBackdrop !== "none" ? p.cardBackdrop : undefined,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          minWidth: 60,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: p.accentSoft,
        }}
      >
        <Glyph parsed={node} size={34} color={p.accent} p={p} />
      </div>
      <div style={{ fontSize: p.size.small, fontWeight: 650, color: p.text, whiteSpace: "nowrap", lineHeight: 1.1 }}>
        {node.text}
      </div>
    </div>
  );
};
