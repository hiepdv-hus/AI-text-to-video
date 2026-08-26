import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * AuroraBackground — nền "cực quang": các quầng sáng màu lớn trôi chậm trên nền tối.
 * Hiện đại, mềm mại, khác hẳn nền matrix. Có scrim + vignette để chữ vẫn đọc rõ.
 * Mọi chuyển động theo useCurrentFrame() (xác định).
 */

const BLOBS = [
  { color: "rgba(59,130,246,0.55)", x: 26, y: 26, ax: 9, ay: 6, spd: 0.16, phase: 0, size: 0.95 },
  { color: "rgba(139,92,246,0.50)", x: 74, y: 34, ax: 8, ay: 8, spd: 0.13, phase: 1.4, size: 1.05 },
  { color: "rgba(236,72,153,0.42)", x: 62, y: 74, ax: 10, ay: 7, spd: 0.11, phase: 2.6, size: 0.9 },
  { color: "rgba(20,184,166,0.45)", x: 30, y: 70, ax: 8, ay: 7, spd: 0.14, phase: 3.7, size: 0.85 },
  { color: "rgba(245,158,11,0.32)", x: 50, y: 50, ax: 12, ay: 9, spd: 0.09, phase: 5.0, size: 0.7 },
];

export const AuroraBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #0b0d1a 0%, #0a0812 55%, #060409 100%)", overflow: "hidden" }}>
      {BLOBS.map((b, i) => {
        const x = b.x + Math.sin(t * b.spd + b.phase) * b.ax;
        const y = b.y + Math.cos(t * b.spd * 0.9 + b.phase) * b.ay;
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
              filter: "blur(60px)",
            }}
          />
        );
      })}

      {/* Scrim + vignette để giữ chữ dễ đọc */}
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.22)" }} />
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at center, transparent 48%, rgba(0,0,0,0.55) 100%)" }}
      />
    </AbsoluteFill>
  );
};
