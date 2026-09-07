import React from "react";
import { AbsoluteFill } from "remotion";
import { tokens, safeArea } from "../theme/tokens";
import { TEXT_STACK } from "./textStack";

/**
 * BrandHeader — thanh thương hiệu trên cùng (kiểu "SpiderAI News"): nút back,
 * logo emoji + tên kênh, và cụm icon search/menu. Kèm pill gợi ý dưới cùng.
 * Overlay tĩnh, nằm trên mọi scene (render 1 lần ở VideoComposition).
 */

const N = tokens.neon;

const IconCircle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: 58,
      height: 58,
      borderRadius: 999,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 30,
      color: "#fff",
    }}
  >
    {children}
  </div>
);

export const BrandHeader: React.FC<{
  name: string;
  logo?: string;
  hint?: string;
  height: number;
}> = ({ name, logo = "🕷", hint, height }) => {
  const sa = safeArea(height);

  return (
    <AbsoluteFill style={{ fontFamily: TEXT_STACK, pointerEvents: "none" }}>
      {/* Thanh trên cùng */}
      <div
        style={{
          position: "absolute",
          top: Math.round(sa.top * 0.55),
          left: tokens.space.pagePadding * 0.6,
          right: tokens.space.pagePadding * 0.6,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div style={{ fontSize: 40, color: "#fff", opacity: 0.9 }}>‹</div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `linear-gradient(145deg, ${N.purple}, ${N.purpleDeep})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            boxShadow: N.glowSoft,
          }}
        >
          {logo}
        </div>
        <div style={{ width: 2, height: 34, background: "rgba(255,255,255,0.22)" }} />
        <div style={{ fontSize: 34, fontWeight: tokens.weight.bold, color: "#fff", letterSpacing: 0.3 }}>
          {name}
        </div>
        <div style={{ flex: 1 }} />
        <IconCircle>⌕</IconCircle>
        <IconCircle>⋯</IconCircle>
      </div>

      {/* Pill gợi ý dưới cùng */}
      {hint && (
        <div
          style={{
            position: "absolute",
            bottom: Math.round(sa.bottom * 0.4),
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "18px 34px",
              borderRadius: 999,
              background: "rgba(18,16,30,0.82)",
              border: "1px solid rgba(148,120,255,0.28)",
              color: "#EDE7FF",
              fontSize: 32,
              fontWeight: tokens.weight.semibold,
            }}
          >
            <span style={{ fontSize: 30 }}>⤓</span>
            {hint}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
