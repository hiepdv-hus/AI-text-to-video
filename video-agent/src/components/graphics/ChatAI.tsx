import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../../theme/tokens";
import { TEXT_STACK } from "../textStack";

/**
 * ChatAI — khung chat kiểu trợ lý AI: bong bóng hiện dần theo lượt (user phải, AI
 * trái), kèm chấm "đang gõ" nhấp nháy ở cuối. Dùng cho cảnh nói về chatbot/hỏi-đáp.
 * Nhãn dạng "u:câu của bạn" (user) hoặc "a:câu của AI" (assistant).
 */

const N = tokens.neon;

function parse(labels?: string[]): { who: "u" | "a"; text: string }[] {
  const src =
    labels && labels.length
      ? labels
      : ["u:Viết caption cho video này giúp mình", "a:Rồi! Đây là 3 gợi ý caption cuốn hút…"];
  return src.map((s) => {
    const m = s.match(/^([ua])\s*:\s*(.*)$/i);
    return m ? { who: m[1]!.toLowerCase() as "u" | "a", text: m[2]! } : { who: "a" as const, text: s };
  });
}

const TypingDots: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <div style={{ display: "flex", gap: 8, padding: "6px 4px" }}>
      {[0, 1, 2].map((d) => {
        const o = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 6 - d * 0.9));
        return <div key={d} style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", opacity: o }} />;
      })}
    </div>
  );
};

export const ChatAI: React.FC<{ labels?: string[] }> = ({ labels }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const msgs = parse(labels);
  const STEP = 26; // frame giữa các bong bóng

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 760,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        fontFamily: TEXT_STACK,
      }}
    >
      {msgs.map((m, i) => {
        const e = spring({ frame: frame - (6 + i * STEP), fps, config: tokens.timing.springIn });
        if (e <= 0.001) return null;
        const isU = m.who === "u";
        return (
          <div
            key={i}
            style={{
              alignSelf: isU ? "flex-end" : "flex-start",
              maxWidth: "82%",
              opacity: e,
              transform: `translateY(${interpolate(e, [0, 1], [24, 0])}px) scale(${interpolate(e, [0, 1], [0.9, 1])})`,
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
            }}
          >
            {!isU && (
              <div
                style={{
                  width: 52,
                  height: 52,
                  minWidth: 52,
                  borderRadius: 14,
                  background: `linear-gradient(145deg, ${N.purple}, ${N.purpleDeep})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  boxShadow: N.glowSoft,
                }}
              >
                🕷
              </div>
            )}
            <div
              style={{
                padding: "20px 26px",
                borderRadius: 22,
                fontSize: 34,
                fontWeight: tokens.weight.medium,
                lineHeight: 1.3,
                color: "#fff",
                background: isU
                  ? `linear-gradient(135deg, ${N.purpleBright}, ${N.purple})`
                  : "rgba(22,18,42,0.9)",
                border: isU ? "none" : "1px solid rgba(148,120,255,0.3)",
                borderBottomRightRadius: isU ? 6 : 22,
                borderBottomLeftRadius: isU ? 22 : 6,
                boxShadow: isU ? N.glowSoft : "none",
              }}
            >
              {m.text}
            </div>
          </div>
        );
      })}

      {/* Bong bóng "đang gõ" của AI ở cuối */}
      {(() => {
        const e = spring({ frame: frame - (6 + msgs.length * STEP), fps, config: tokens.timing.springIn });
        if (e <= 0.001) return null;
        return (
          <div style={{ alignSelf: "flex-start", opacity: e, display: "flex", alignItems: "flex-end", gap: 12 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: `linear-gradient(145deg, ${N.purple}, ${N.purpleDeep})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                boxShadow: N.glowSoft,
              }}
            >
              🕷
            </div>
            <div style={{ padding: "14px 22px", borderRadius: 22, borderBottomLeftRadius: 6, background: "rgba(22,18,42,0.9)", border: "1px solid rgba(148,120,255,0.3)" }}>
              <TypingDots />
            </div>
          </div>
        );
      })()}
    </div>
  );
};
