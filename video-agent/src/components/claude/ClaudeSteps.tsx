import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";

/**
 * ClaudeSteps — sơ đồ CÁC BƯỚC (process/flow) style Claude: cột số tròn cam nối bằng
 * ĐƯỜNG DỌC (SVG), mỗi bước là 1 thẻ chữ. Dùng cho nội dung "từng bước" — trực quan
 * hơn hẳn chỉ liệt kê text. Vẽ tuần tự: đường nối "chảy" xuống, số tròn bật lên.
 */
export const ClaudeSteps: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = labels && labels.length ? labels : ["Bước một", "Bước hai", "Bước ba"];

  const ROW = 128; // cao mỗi bước (px)
  const CX = 40; // tâm cột số
  const total = items.length;

  return (
    <div style={{ width: "100%", position: "relative", fontFamily: TEXT_STACK, height: ROW * total }}>
      {/* Đường nối dọc — "chảy" xuống theo frame */}
      <svg width="80" height={ROW * total} viewBox={`0 0 80 ${ROW * total}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {items.slice(0, -1).map((_, i) => {
          const y1 = i * ROW + ROW / 2;
          const y2 = (i + 1) * ROW + ROW / 2;
          const grow = spring({ frame: frame - (10 + i * 8), fps, config: { damping: 20, stiffness: 120 } });
          return (
            <line
              key={i}
              x1={CX}
              y1={y1}
              x2={CX}
              y2={interpolate(grow, [0, 1], [y1, y2])}
              stroke={p.accent}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.5}
            />
          );
        })}
      </svg>

      {items.map((raw, i) => {
        const e = spring({ frame: frame - (6 + i * 8), fps, config: { damping: 15, stiffness: 200, mass: 0.7 } });
        const op = interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: i * ROW,
              left: 0,
              right: 0,
              height: ROW,
              display: "flex",
              alignItems: "center",
              gap: 22,
            }}
          >
            {/* Số tròn */}
            <div
              style={{
                width: 66,
                height: 66,
                minWidth: 66,
                borderRadius: 999,
                background: p.accent,
                color: p.onAccent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 800,
                transform: `scale(${interpolate(e, [0, 1], [0.4, 1])})`,
                boxShadow: p.cardShadow,
                zIndex: 2,
                marginLeft: 7,
              }}
            >
              {i + 1}
            </div>
            {/* Thẻ nội dung bước */}
            <div
              style={{
                flex: 1,
                opacity: op,
                transform: `translateX(${interpolate(e, [0, 1], [24, 0])}px)`,
                padding: "22px 26px",
                borderRadius: p.radius.md,
                background: p.card,
                border: `1px solid ${p.cardBorder}`,
                boxShadow: p.cardShadow,
                fontSize: p.size.card,
                fontWeight: 600,
                color: p.text,
                textAlign: "left",
                lineHeight: 1.2,
              }}
            >
              {raw}
            </div>
          </div>
        );
      })}
    </div>
  );
};
