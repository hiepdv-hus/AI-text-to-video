import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { EMOJI_FAMILY } from "../fontsEmoji";

/**
 * ClaudeFeatureCards — thẻ liệt kê style Claude. Cùng nguyên tắc như bản neon (lưới
 * thông minh, tách nền, căn trái, entrance dứt khoát) nhưng màu ấm theo Palette.
 */

const EMOJI_RE = /^(\p{Extended_Pictographic}️?)\s+(.*)$/u;

export const ClaudeFeatureCards: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = labels && labels.length ? labels : ["Tự động", "Nhanh", "Riêng tư", "Mượt"];
  const cols = items.length === 4 || items.length === 6 ? 2 : 1;

  return (
    <div style={{ width: "100%", display: "grid", gridTemplateColumns: cols === 2 ? "1fr 1fr" : "1fr", gap: 16, fontFamily: TEXT_STACK }}>
      {items.map((raw, i) => {
        const e = spring({ frame: frame - (5 + i * 4), fps, config: { damping: 17, stiffness: 200, mass: 0.7 } });
        const op = interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
        const m = raw.match(EMOJI_RE);
        const icon = m?.[1];
        const text = (m?.[2] ?? raw).trim();
        return (
          <div
            key={i}
            style={{
              opacity: op,
              transform: `translateY(${interpolate(e, [0, 1], [26, 0])}px)`,
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "24px 26px",
              borderRadius: p.radius.md,
              background: p.card,
              border: `1px solid ${p.cardBorder}`,
              boxShadow: p.cardShadow,
              textAlign: "left",
            }}
          >
            {icon ? (
              <span style={{ fontSize: 32, fontFamily: EMOJI_FAMILY, minWidth: 40 }}>{icon}</span>
            ) : (
              <span style={{ width: 6, height: 40, minWidth: 6, borderRadius: 6, background: p.accent }} />
            )}
            <div style={{ fontSize: p.size.card, fontWeight: 600, color: p.text, lineHeight: 1.22 }}>{text}</div>
          </div>
        );
      })}
    </div>
  );
};
