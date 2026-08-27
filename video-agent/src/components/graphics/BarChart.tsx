import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../../theme/tokens";
import { TEXT_STACK } from "../textStack";

/**
 * BarChart — biểu đồ thanh ngang neon, mọc dần + số đếm tăng lên. Dùng cho cảnh
 * so sánh/thống kê. Nhãn dạng "Tên:80" (tên : giá trị 0–100). Không có → mặc định.
 */

const N = tokens.neon;

function parse(labels?: string[]): { name: string; value: number }[] {
  const src = labels && labels.length ? labels : ["React:82", "Vue:61", "Angular:44", "Svelte:38"];
  return src.map((s) => {
    const m = s.match(/^(.*?):\s*(\d+(?:\.\d+)?)\s*$/);
    return m ? { name: m[1]!.trim(), value: Number(m[2]) } : { name: s, value: 50 };
  });
}

export const BarChart: React.FC<{ labels?: string[] }> = ({ labels }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows = parse(labels);
  const max = Math.max(100, ...rows.map((r) => r.value));

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        fontFamily: TEXT_STACK,
        background: N.cardBg,
        border: `1.5px solid ${N.cardBorder}`,
        borderRadius: 24,
        padding: "34px 30px",
        boxShadow: N.cardShadow,
      }}
    >
      {rows.map((r, i) => {
        const e = spring({ frame: frame - (8 + i * 8), fps, config: tokens.timing.springIn });
        const wPct = interpolate(e, [0, 1], [0, (r.value / max) * 100]);
        const shown = Math.round(interpolate(e, [0, 1], [0, r.value]));
        return (
          <div key={i} style={{ opacity: interpolate(e, [0, 0.2], [0, 1]) }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 34, fontWeight: tokens.weight.bold, color: "#fff" }}>{r.name}</span>
              <span style={{ fontSize: 34, fontWeight: tokens.weight.black, color: N.purpleBright }}>{shown}</span>
            </div>
            <div
              style={{
                height: 28,
                borderRadius: 999,
                background: N.cardBg2,
                border: `1px solid ${N.cardBorder}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${wPct}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${N.purpleDeep}, ${N.purpleBright})`,
                  boxShadow: N.glowSoft,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
