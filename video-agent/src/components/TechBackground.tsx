import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MONO_FAMILY } from "./fontsMono";
import { TECH } from "../theme/claude";

/**
 * TechBackground — nền của theme "tech".
 *
 * Bài học từ bản trước: mưa nhị phân rải kín màn hình thì các chữ số rơi NGAY SAU chữ,
 * mắt phải gạt nhiễu mới đọc được và tổng thể trông rối. Bản này giữ mưa nhị phân làm
 * chữ ký thị giác nhưng ĐẨY NÓ RA HAI MÉP, chừa trọn dải giữa cho nội dung:
 *
 *   [mưa]          vùng nội dung sạch          [mưa]
 *    ~14%                ~72%                   ~14%
 *
 * Chiều sâu đến từ gradient + hai quầng sáng lớn rất mờ, không từ hoạ tiết dày.
 *
 * Hai biến thể:
 *   "full"    — dùng cho scene KHÔNG có video nền.
 *   "overlay" — chỉ mưa ở mép, rất mờ, nền trong suốt; phủ lên video nền để cảnh có
 *               video và cảnh không có video vẫn nhận ra là cùng một video.
 *
 * Mọi chuyển động theo useCurrentFrame() (xác định, không CSS transition, không random runtime).
 */

// Pseudo-random xác định (tính 1 lần lúc import) — không dùng Math.random ở runtime.
function hash(i: number, seed: number): number {
  const x = Math.sin((i + 1) * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Column {
  xPct: number;
  speed: number;
  offset: number;
  len: number;
  fontSize: number;
  digits: string[];
}

/** Dải mép trái/phải mà mưa được phép rơi (theo % chiều ngang). */
const BAND_LEFT: [number, number] = [1.5, 13];
const BAND_RIGHT: [number, number] = [87, 98.5];

/** Sinh cột trong một dải mép. `perBand` cột mỗi bên. */
function makeColumns(perBand: number, seed: number, sizeBase: number): Column[] {
  const cols: Column[] = [];
  for (const [bi, band] of [BAND_LEFT, BAND_RIGHT].entries()) {
    for (let i = 0; i < perBand; i++) {
      const k = bi * perBand + i + seed;
      cols.push({
        xPct: band[0] + ((i + 0.5) / perBand) * (band[1] - band[0]),
        speed: 4 + hash(k, 1) * 7, // hàng/giây
        offset: hash(k, 2) * 60,
        len: 6 + Math.floor(hash(k, 3) * 8), // độ dài vệt sáng
        fontSize: sizeBase + Math.floor(hash(k, 4) * 8),
        digits: Array.from({ length: 64 }, (_, r) => (hash(k, r + 7) > 0.5 ? "1" : "0")),
      });
    }
  }
  return cols;
}

// Overlay dùng seed khác để chồng lên nền không thấy lặp hoạ tiết.
const COLUMNS_FULL = makeColumns(3, 0, 24);
const COLUMNS_OVERLAY = makeColumns(2, 41, 22);

const HEAD_COLOR = "#C8FFE6"; // đầu vệt — gần trắng, ăn với accent
const TRAIL_COLOR = TECH.accent;

/** Mưa nhị phân thuần tuý (không nền) — dùng chung cho cả 2 biến thể. */
const BinaryRain: React.FC<{ columns: Column[]; intensity: number }> = ({ columns, intensity }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;

  return (
    <>
      {columns.map((col, ci) => {
        const rowH = col.fontSize * 1.4;
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
              const op = (0.04 + streak * 0.42) * intensity;
              return (
                <div
                  key={r}
                  style={{
                    height: rowH,
                    lineHeight: `${rowH}px`,
                    color: isHead ? HEAD_COLOR : TRAIL_COLOR,
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
    </>
  );
};

export const TechBackground: React.FC<{
  /** "full" = nền hoàn chỉnh; "overlay" = chỉ mưa ở mép, phủ lên video nền. */
  variant?: "full" | "overlay";
}> = ({ variant = "full" }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;

  if (variant === "overlay") {
    return (
      <AbsoluteFill style={{ overflow: "hidden", opacity: 0.34 }}>
        <BinaryRain columns={COLUMNS_OVERLAY} intensity={1} />
      </AbsoluteFill>
    );
  }

  // Hai quầng sáng lớn trôi rất chậm — nguồn "chiều sâu" chính của nền.
  const g1x = 18 + Math.sin(t * 0.16) * 7;
  const g1y = 24 + Math.cos(t * 0.13) * 5;
  const g2x = 84 + Math.sin(t * 0.11 + 1.4) * 7;
  const g2y = 74 + Math.cos(t * 0.09 + 0.6) * 5;

  return (
    <AbsoluteFill style={{ background: TECH.bgGradient, overflow: "hidden" }}>
      <Glow x={g1x} y={g1y} size={width * 1.35} color="rgba(24,140,104,0.22)" />
      <Glow x={g2x} y={g2y} size={width * 1.15} color="rgba(30,110,168,0.20)" />

      {/* Lưới rất mờ, chỉ hiện ở mép — cùng logic với mưa: giữa khung phải sạch. */}
      <AbsoluteFill
        style={{
          backgroundImage: [
            "linear-gradient(to right, rgba(59,232,160,0.05) 1px, transparent 1px)",
            "linear-gradient(to bottom, rgba(59,232,160,0.05) 1px, transparent 1px)",
          ].join(","),
          backgroundSize: "120px 120px",
          maskImage: "radial-gradient(ellipse 62% 48% at 50% 46%, transparent 40%, #000 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 62% 48% at 50% 46%, transparent 40%, #000 100%)",
        }}
      />

      <BinaryRain columns={COLUMNS_FULL} intensity={1} />

      {/* Vignette tối 4 góc để nội dung ở giữa nổi lên. */}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at 50% 46%, transparent 44%, rgba(0,0,0,0.58) 100%)" }}
      />
    </AbsoluteFill>
  );
};

const Glow: React.FC<{ x: number; y: number; size: number; color: string }> = ({ x, y, size, color }) => (
  <div
    style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      transform: "translate(-50%,-50%)",
      background: `radial-gradient(circle, ${color}, transparent 62%)`,
      filter: "blur(40px)",
    }}
  />
);
