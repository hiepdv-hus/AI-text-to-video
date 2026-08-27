import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../../theme/tokens";
import { TEXT_STACK } from "../textStack";

/**
 * HighlightTimeline — filmstrip với các cột "Nổi bật" phát sáng tím + thước thời
 * gian, minh hoạ ý "AI tự nhận diện đoạn nổi bật trong video dài". Cột mọc lên
 * theo stagger + nhấp nhẹ. Thước thời gian tô sáng vài mốc.
 */

const N = tokens.neon;

export const HighlightTimeline: React.FC<{ labels?: string[]; timestamps?: string[] }> = ({
  labels,
  timestamps,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = frame / fps;
  const bars = labels && labels.length ? labels : Array.from({ length: 6 }, () => "Nổi bật");
  const ruler =
    timestamps && timestamps.length
      ? timestamps
      : ["0:05", "0:10", "0:15", "0:20", "0:25", "0:30", "0:35", "0:40", "0:45", "0:50", "0:55", "1:00"];
  const hotIdx = new Set([2, 5, 8, 11]); // mốc tô sáng trên thước
  // Đường quét chạy qua lại trên filmstrip.
  const scanX = interpolate(Math.sin(t * 0.8), [-1, 1], [3, 97]);

  return (
    <div style={{ width: "100%", fontFamily: TEXT_STACK }}>
      {/* Panel filmstrip */}
      <div
        style={{
          position: "relative",
          borderRadius: 24,
          background: N.cardBg,
          border: `1.5px solid ${N.cardBorder}`,
          padding: "38px 26px 26px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          height: 300,
          boxShadow: `${N.cardShadow}, inset 0 0 60px rgba(139,92,246,0.1)`,
        }}
      >
        {/* Đường quét dọc chạy qua lại */}
        <div
          style={{
            position: "absolute",
            top: 10,
            bottom: 10,
            left: `${scanX}%`,
            width: 2,
            background: "linear-gradient(180deg, transparent, rgba(185,131,255,0.9), transparent)",
            boxShadow: "0 0 16px rgba(185,131,255,0.9)",
          }}
        />
        {bars.map((label, i) => {
          const e = spring({ frame: frame - (8 + i * 5), fps, config: tokens.timing.springIn });
          const pulse = 1 + 0.05 * Math.sin((frame / fps) * Math.PI * 2 + i);
          const h = interpolate(e, [0, 1], [0, 190]) * pulse;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              {/* Nhãn "Nổi bật" */}
              <div
                style={{
                  opacity: e,
                  transform: `translateY(${interpolate(e, [0, 1], [12, 0])}px)`,
                  marginBottom: 12,
                  padding: "6px 14px",
                  borderRadius: 10,
                  background: `linear-gradient(180deg, ${N.purpleBright}, ${N.purple})`,
                  color: "#fff",
                  fontSize: 22,
                  fontWeight: tokens.weight.bold,
                  whiteSpace: "nowrap",
                  boxShadow: N.glowSoft,
                }}
              >
                {label}
              </div>
              {/* Cột phát sáng + chấm sáng nhấp nháy trên đỉnh */}
              <div
                style={{
                  position: "relative",
                  width: "72%",
                  height: h,
                  borderRadius: 12,
                  background: `linear-gradient(180deg, ${N.purpleBright}, ${N.purpleDeep})`,
                  boxShadow: N.glowStrong,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -7,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: `0 0 ${8 + (0.5 + 0.5 * Math.sin(t * 4 + i)) * 16}px ${N.purpleBright}`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Thước thời gian */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, padding: "0 6px" }}>
        {ruler.map((t, i) => (
          <div
            key={i}
            style={{
              fontSize: 22,
              fontWeight: hotIdx.has(i) ? tokens.weight.bold : tokens.weight.medium,
              color: hotIdx.has(i) ? N.purpleBright : "rgba(201,190,234,0.5)",
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
};
