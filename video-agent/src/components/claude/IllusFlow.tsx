import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { useEnter } from "../motion";
import { Glyph, parseLabel } from "./Icon";
import { mixColor } from "./colorMix";

/**
 * IllusFlow — MINH HOẠ ĐỘNG cho graphic.kind = "illus-flow".
 *
 * Một "gói" năng lượng CHẠY qua các chặng A → B → C → D trên một đường ray ngang; mỗi
 * chặng BỪNG SÁNG đúng lúc gói đi qua rồi tối lại. Kể bằng hình cái mà `steps` (đánh số)
 * và `architecture` (sơ đồ tĩnh) không kể được: "một thứ DI CHUYỂN qua từng chặng".
 *   "Code đi: máy bạn → staging → commit → GitHub"
 *   "Yêu cầu đi: người dùng → app → server → cơ sở dữ liệu"
 *
 * Nhãn (labels): mỗi chặng một nhãn (2–4 chặng), vd
 *   ["@file Code", "@boxes Staging", "@git Commit", "@cloud GitHub"]
 */

const REPEAT_SEC = 4.2; // chu kỳ một lượt gói chạy hết đường

export const IllusFlow: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stages = (labels?.length ? labels : ["@file Code", "@boxes Staging", "@git Commit", "@cloud GitHub"])
    .slice(0, 4)
    .map(parseLabel);
  const n = stages.length;
  const tech = isTech(p);

  const bloom = useEnter(6, { damping: 20, stiffness: 100, mass: 1 });
  // Vị trí gói theo tỉ lệ 0..1 dọc đường ray, LẶP MÃI. Chỉ chạy sau khi các chặng đã vào.
  const travel = ((frame / fps / REPEAT_SEC) % 1);
  const packetActive = bloom > 0.98;

  const chip = 118;
  const railTop = chip / 2;
  // Tâm mỗi chặng theo % bề ngang (chia đều).
  const centerPct = (i: number) => ((i + 0.5) / n) * 100;
  const packetPct = interpolate(travel, [0, 1], [centerPct(0), centerPct(n - 1)]);

  // Độ sáng của chặng i theo khoảng cách từ gói tới tâm chặng (gauss) — chặng nào gói
  // đang tới thì bừng lên.
  const glowOf = (i: number) => {
    if (!packetActive) return 0;
    const d = Math.abs(packetPct - centerPct(i)) / (100 / n);
    return Math.max(0, 1 - d * d * 1.6);
  };

  return (
    <div style={{ width: "100%", position: "relative", fontFamily: TEXT_STACK, paddingTop: 8 }}>
      {/* Đường ray + tô sáng phần đã đi qua, nằm sau các chặng. */}
      <div style={{ position: "absolute", left: `${centerPct(0)}%`, right: `${centerPct(0)}%`, top: railTop, height: 4 }}>
        <div style={{ position: "absolute", inset: 0, background: p.track, borderRadius: 999, transform: `scaleX(${bloom})`, transformOrigin: "left" }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${interpolate(travel, [0, 1], [0, 100])}%`,
            background: p.accentGradient,
            borderRadius: 999,
            opacity: packetActive ? 0.8 : 0,
            boxShadow: tech ? p.glow : "none",
          }}
        />
      </div>

      {/* Gói năng lượng chạy dọc ray. */}
      <div
        style={{
          position: "absolute",
          left: `${packetPct}%`,
          top: railTop,
          width: 26,
          height: 26,
          marginLeft: -13,
          marginTop: -13,
          borderRadius: 999,
          background: p.accent,
          opacity: packetActive ? 1 : 0,
          boxShadow: `0 0 22px ${p.accent}, 0 0 40px ${p.accentSoft}`,
        }}
      />

      {/* Các chặng */}
      <div style={{ display: "flex", width: "100%", position: "relative" }}>
        {stages.map((st, i) => (
          <FlowStage key={i} node={st} delay={6 + i * 6} glow={glowOf(i)} chip={chip} p={p} />
        ))}
      </div>
    </div>
  );
};

/** Một chặng — component riêng để hook useEnter không nằm trong vòng .map. */
const FlowStage: React.FC<{ node: ReturnType<typeof parseLabel>; delay: number; glow: number; chip: number; p: Palette }> = ({
  node,
  delay,
  glow: g,
  chip,
  p,
}) => {
  const e = useEnter(delay, { damping: 18, stiffness: 160, mass: 0.8 });
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: chip,
          height: chip,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: g > 0.1 ? p.accentSoft : p.card,
          border: `${1.5 + g * 1.5}px solid ${mixColor(p.cardBorder, p.accent, g)}`,
          boxShadow: g > 0.1 ? `0 0 ${12 + g * 30}px ${p.accent}, ${p.cardShadow}` : p.cardShadow,
          backdropFilter: p.cardBackdrop !== "none" ? p.cardBackdrop : undefined,
          opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(e, [0, 1], [22, 0])}px) scale(${interpolate(e, [0, 1], [0.8, 1]) * (1 + g * 0.06)})`,
        }}
      >
        <Glyph parsed={node} size={58} color={p.accent} p={p} />
      </div>
      <div
        style={{
          fontSize: p.size.small,
          fontWeight: 650,
          color: g > 0.3 ? p.text : p.textMuted,
          textAlign: "center",
          lineHeight: 1.14,
          padding: "0 4px",
          opacity: interpolate(e, [0.2, 0.7], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {node.text}
      </div>
    </div>
  );
};
