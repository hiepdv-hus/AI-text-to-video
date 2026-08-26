import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MONO_FAMILY } from "./fontsMono";

/**
 * TechBackground — nền "lập trình" kiểu MƯA SỐ NHỊ PHÂN (Matrix): các cột 0/1 rơi
 * xuống, đầu cột sáng, đuôi mờ dần. Đủ tinh tế để không lấn át cửa sổ code.
 * Mọi chuyển động theo useCurrentFrame() (xác định, không CSS transition, không random runtime).
 */

const COLS = 16;

// Pseudo-random xác định (tính 1 lần lúc import) — không dùng Math.random ở runtime.
function hash(i: number, seed: number): number {
  const x = Math.sin((i + 1) * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const COLUMNS = Array.from({ length: COLS }, (_, i) => ({
  xPct: ((i + 0.5) / COLS) * 100,
  speed: 5 + hash(i, 1) * 9, // hàng/giây
  offset: hash(i, 2) * 60,
  len: 7 + Math.floor(hash(i, 3) * 9), // độ dài vệt sáng
  fontSize: 26 + Math.floor(hash(i, 4) * 12),
  digits: Array.from({ length: 64 }, (_, r) => (hash(i, r + 7) > 0.5 ? "1" : "0")),
}));

export const TechBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const blob1x = 22 + Math.sin(t * 0.22) * 6;
  const blob2x = 80 + Math.sin(t * 0.18 + 1) * 6;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(165deg, #08131a 0%, #070d14 45%, #05080d 100%)",
        overflow: "hidden",
      }}
    >
      {/* Quầng sáng nhẹ */}
      <div
        style={{
          position: "absolute",
          left: `${blob1x}%`,
          top: "22%",
          width: width * 0.9,
          height: width * 0.9,
          transform: "translate(-50%,-50%)",
          background: "radial-gradient(circle, rgba(20,120,90,0.16), transparent 62%)",
          filter: "blur(34px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${blob2x}%`,
          top: "80%",
          width: width * 0.8,
          height: width * 0.8,
          transform: "translate(-50%,-50%)",
          background: "radial-gradient(circle, rgba(30,90,140,0.14), transparent 62%)",
          filter: "blur(34px)",
        }}
      />

      {/* Mưa số nhị phân 0/1 */}
      {COLUMNS.map((col, ci) => {
        const rowH = col.fontSize * 1.32;
        const rows = Math.ceil(height / rowH) + 2;
        const head = t * col.speed + col.offset;
        return (
          <div
            key={ci}
            style={{
              position: "absolute",
              left: `${col.xPct}%`,
              top: 0,
              transform: "translateX(-50%)",
              fontFamily: MONO_FAMILY,
              fontSize: col.fontSize,
              fontWeight: 700,
              textAlign: "center",
              userSelect: "none",
            }}
          >
            {Array.from({ length: rows }, (_, r) => {
              const d = (((head - r) % rows) + rows) % rows; // khoảng cách tới đầu vệt (rơi xuống)
              const streak = d < col.len ? 1 - d / col.len : 0;
              const isHead = d < 1;
              const op = 0.05 + streak * 0.5;
              return (
                <div
                  key={r}
                  style={{
                    height: rowH,
                    lineHeight: `${rowH}px`,
                    color: isHead ? "#c8ffe6" : "#2fd08a",
                    opacity: op,
                  }}
                >
                  {col.digits[r % col.digits.length]}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Vignette tối 4 góc để cửa sổ code nổi */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.62) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
