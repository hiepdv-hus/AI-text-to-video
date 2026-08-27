import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../../theme/tokens";
import { TEXT_STACK } from "../textStack";
import { EMOJI_FAMILY } from "../fontsEmoji";

/**
 * FeatureCards — lưới thẻ neon xuất hiện theo stagger, dùng cho các cảnh liệt kê
 * tính năng/lợi ích. Mỗi label dạng "🤖 Tự động" (emoji đầu, phần còn lại là chữ).
 */

const N = tokens.neon;

export const FeatureCards: React.FC<{ labels?: string[] }> = ({ labels }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const items = labels && labels.length ? labels : ["🤖 Tự động", "⚡ Nhanh", "🔒 Riêng tư", "✨ Mượt"];

  return (
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: items.length > 2 ? "1fr 1fr" : "1fr",
        gap: 22,
        fontFamily: TEXT_STACK,
      }}
    >
      {items.map((raw, i) => {
        const e = spring({ frame: frame - (8 + i * 6), fps, config: tokens.timing.springIn });
        const m = raw.match(/^(\p{Emoji}️?)\s*(.*)$/u);
        const icon = m?.[1];
        const text = m?.[2] ?? raw;
        return (
          <div
            key={i}
            style={{
              position: "relative",
              overflow: "hidden",
              opacity: e,
              transform: `translateY(${interpolate(e, [0, 1], [40, 0])}px) scale(${interpolate(e, [0, 1], [0.9, 1])})`,
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "26px 28px",
              borderRadius: 20,
              background: "rgba(18,15,32,0.72)",
              border: "1px solid rgba(148,120,255,0.3)",
              boxShadow: "inset 0 0 30px rgba(139,92,246,0.12)",
            }}
          >
            {/* Vệt sáng quét chéo qua thẻ (lặp lại, lệch pha theo thẻ) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "40%",
                left: `${(((t * 45 + i * 40) % 200) - 40)}%`,
                background: "linear-gradient(105deg, transparent, rgba(185,131,255,0.18), transparent)",
                transform: "skewX(-18deg)",
                pointerEvents: "none",
              }}
            />
            {icon && (
              <div
                style={{
                  width: 68,
                  height: 68,
                  minWidth: 68,
                  borderRadius: 16,
                  background: `linear-gradient(145deg, ${N.purple}, ${N.purpleDeep})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  fontFamily: EMOJI_FAMILY,
                  boxShadow: N.glowSoft,
                }}
              >
                {icon}
              </div>
            )}
            <div style={{ fontSize: 40, fontWeight: tokens.weight.bold, color: "#fff" }}>{text}</div>
          </div>
        );
      })}
    </div>
  );
};
