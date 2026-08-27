import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../theme/tokens";

/**
 * SpiderBackground — nền "SpiderAI News": gradient tím-teal tối + các quầng neon
 * lớn trôi chậm + lưới mờ perspective. Hiện đại, phù hợp video công nghệ/AI.
 * Mọi chuyển động theo useCurrentFrame() (xác định — không CSS transition/random runtime).
 */

const N = tokens.neon;

// Các quầng sáng neon: vị trí %, biên độ dao động, tốc độ, pha, kích thước (theo width).
const BLOBS = [
  { color: N.glowPurple, x: 28, y: 30, ax: 8, ay: 6, spd: 0.15, phase: 0.0, size: 1.05 },
  { color: N.glowTeal, x: 72, y: 44, ax: 9, ay: 7, spd: 0.12, phase: 1.6, size: 0.95 },
  { color: N.glowPink, x: 52, y: 82, ax: 10, ay: 6, spd: 0.1, phase: 3.1, size: 1.15 },
];

export const SpiderBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(170deg, ${N.bgTop} 0%, ${N.bgMid} 48%, ${N.bgBottom} 100%)`,
        overflow: "hidden",
      }}
    >
      {/* Quầng sáng neon lớn, mờ, trôi chậm */}
      {BLOBS.map((b, i) => {
        const x = b.x + Math.sin(t * b.spd + b.phase) * b.ax;
        const y = b.y + Math.cos(t * b.spd * 0.85 + b.phase) * b.ay;
        const d = width * b.size;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: d,
              height: d,
              transform: "translate(-50%,-50%)",
              background: `radial-gradient(circle, ${b.color}, transparent 66%)`,
              filter: "blur(70px)",
            }}
          />
        );
      })}

      {/* Lưới mờ (grid) tạo chiều sâu tech — tĩnh, rất nhẹ */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,120,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,120,255,0.05) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse at 50% 42%, #000 30%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 42%, #000 30%, transparent 78%)",
        }}
      />

      {/* Vignette tối 4 góc để nội dung/chữ nổi bật */}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.6) 100%)" }}
      />
    </AbsoluteFill>
  );
};
