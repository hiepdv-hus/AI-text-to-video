import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { cardSurface } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";

/**
 * ClaudeChat — khung chat: bong bóng người dùng (phải, nền màu nhấn), trợ lý (trái,
 * thẻ, avatar tròn). Nhãn "u:..." / "a:...". Màu theo Palette.
 */
function parse(labels?: string[]): { who: "u" | "a"; text: string }[] {
  const src = labels && labels.length ? labels : ["u:Câu hỏi của bạn", "a:Trả lời của trợ lý"];
  return src.map((s) => {
    const m = s.match(/^([ua])\s*:\s*(.*)$/i);
    return m ? { who: m[1]!.toLowerCase() as "u" | "a", text: m[2]! } : { who: "a" as const, text: s };
  });
}

export const ClaudeChat: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const msgs = parse(labels);
  const STEP = 26;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16, fontFamily: TEXT_STACK }}>
      {msgs.map((m, i) => {
        const e = spring({ frame: frame - (6 + i * STEP), fps, config: { damping: 16, stiffness: 180, mass: 0.7 } });
        if (e <= 0.001) return null;
        const isU = m.who === "u";
        return (
          <div
            key={i}
            style={{
              alignSelf: isU ? "flex-end" : "flex-start",
              maxWidth: "86%",
              opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(e, [0, 1], [18, 0])}px)`,
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
            }}
          >
            {!isU && (
              <div
                style={{
                  width: 46,
                  height: 46,
                  minWidth: 46,
                  borderRadius: 999,
                  background: p.accent,
                  color: p.onAccent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 800,
                  boxShadow: p.cardShadow,
                }}
              >
                AI
              </div>
            )}
            <div
              style={{
                padding: "20px 24px",
                fontSize: p.size.card,
                fontWeight: 500,
                lineHeight: 1.3,
                textAlign: "left",
                ...cardSurface(p),
                borderRadius: 22,
                color: isU ? p.onAccent : p.text,
                background: isU ? p.accent : p.card,
                border: isU ? "none" : `1px solid ${p.cardBorder}`,
                borderBottomRightRadius: isU ? 6 : 22,
                borderBottomLeftRadius: isU ? 22 : 6,
              }}
            >
              {m.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};
