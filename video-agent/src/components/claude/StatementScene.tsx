import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene } from "../../schema";
import { TEXT_STACK } from "../textStack";
import { useTheme, isTech } from "../../theme/claude";

/**
 * StatementScene — layout "statement": KINETIC TYPOGRAPHY full-frame.
 * Câu chốt/tuyên ngôn hiện thành CHỮ LỚN lấp đầy khung, từng chữ bung vào lệch nhau, từ
 * NHẤN tô màu accent + phát sáng; nền động (quầng sáng trôi + lưới) cho có chiều sâu.
 * Thuần HTML/CSS, không 3D, không khoảng trắng thừa — hợp các beat "câu punch".
 */

const strip = (w: string) => w.replace(/[.,!?;:"'…]/g, "").toLowerCase();

export const StatementScene: React.FC<{ scene: BuiltScene; height: number }> = ({ scene, height }) => {
  const p = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const tech = isTech(p);

  const text = (scene.heading || scene.narration || "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  const emphSet = new Set(
    (scene.emphasis ?? []).flatMap((e) => e.split(/\s+/)).map(strip),
  );

  // Cỡ chữ co theo số từ để LẤP đầy mà không tràn.
  const fs = words.length <= 4 ? 128 : words.length <= 7 ? 104 : 84;

  // Nền động: quầng sáng trôi chậm.
  const gx = 50 + Math.sin(t * 0.3) * 16;
  const gy = 42 + Math.cos(t * 0.24) * 12;

  return (
    <AbsoluteFill style={{ background: p.bgGradient }}>
      {/* quầng sáng accent trôi */}
      <AbsoluteFill style={{ background: `radial-gradient(46% 34% at ${gx}% ${gy}%, ${p.accentSoft} 0%, transparent 70%)` }} />
      {/* lưới mờ (chỉ tech) */}
      {tech && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${p.hairline} 1px, transparent 1px), linear-gradient(90deg, ${p.hairline} 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
            opacity: 0.5,
          }}
        />
      )}

      {/* CHỮ LỚN — kinetic */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `0 ${Math.round(height * 0.04)}px`,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: TEXT_STACK, fontSize: fs, fontWeight: 800, lineHeight: 1.12, maxWidth: "92%" }}>
          {words.map((w, i) => {
            const e = spring({ frame: frame - (4 + i * 3), fps, config: { damping: 16, stiffness: 150, mass: 0.8 } });
            const on = emphSet.has(strip(w));
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: fs * 0.24,
                  opacity: interpolate(e, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
                  transform: `translateY(${interpolate(e, [0, 1], [40, 0])}px) scale(${interpolate(e, [0, 1], [0.8, 1])})`,
                  color: on ? p.accent : p.text,
                  textShadow: on
                    ? `0 0 34px ${p.accentSoft}, 0 2px 16px rgba(0,0,0,0.5)`
                    : p.isDark
                      ? "0 2px 16px rgba(0,0,0,0.5)"
                      : "none",
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* vignette nhẹ */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.35) 100%)" }} />
    </AbsoluteFill>
  );
};
