import React from "react";
import { interpolate } from "remotion";
import type { Palette } from "../../theme/claude";
import { cardSurface, isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { BEAT, useDrift, useEnter, usePulse } from "../motion";

/**
 * ClaudeSteps — sơ đồ CÁC BƯỚC cho graphic.kind = "steps".
 *
 * Khác TechTimeline ở chỗ nhấn vào THỨ TỰ chứ không phải thời điểm: nút là số to
 * (01, 02, 03) tô gradient nhấn, nối bằng đoạn dọc được vẽ dần. Dùng khi nội dung là
 * quy trình "làm cái này rồi làm cái kia".
 *
 * Chiều cao mỗi bước co theo nội dung (không đặt cứng) để bước có chữ dài không bị
 * chồng lên bước sau.
 */

const NODE = 88;
const ROW_GAP = 22;

export const ClaudeSteps: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const items = labels && labels.length ? labels : ["Bước một", "Bước hai", "Bước ba"];
  return (
    <div style={{ width: "100%", fontFamily: TEXT_STACK, textAlign: "left" }}>
      {items.map((raw, i) => (
        <Step key={i} index={i} text={raw} last={i === items.length - 1} p={p} />
      ))}
    </div>
  );
};

/** Một bước: số bật lên và XOAY vào, đoạn nối vẽ dần, thẻ trượt ngang rồi trôi khẽ. */
const Step: React.FC<{ index: number; text: string; last: boolean; p: Palette }> = ({ index, text, last, p }) => {
  const e = useEnter(5 + index * (BEAT.stagger + 3), { damping: 16, stiffness: 170, mass: 0.75 });
  const op = interpolate(e, [0, 0.45], [0, 1], { extrapolateRight: "clamp" });
  const float = useDrift(index, 0.15) * 3;
  const pulse = usePulse(0.38, index);

  return (
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "stretch",
              gap: 26,
              marginBottom: last ? 0 : ROW_GAP,
              transform: `translateY(${float}px)`,
            }}
          >
            <div style={{ position: "relative", width: NODE, flex: "none" }}>
              {/* Đoạn nối xuống bước sau — vẽ dần từ trên xuống. */}
              {!last && (
                <div
                  style={{
                    position: "absolute",
                    left: NODE / 2 - 2,
                    top: NODE,
                    width: 4,
                    height: `calc(100% - ${NODE}px + ${ROW_GAP}px)`,
                    borderRadius: 999,
                    background: p.accent,
                    opacity: 0.4,
                    transform: `scaleY(${e})`,
                    transformOrigin: "top",
                  }}
                />
              )}
              <div
                style={{
                  width: NODE,
                  height: NODE,
                  borderRadius: 999,
                  background: p.accentGradient,
                  color: p.onAccent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: p.labelFont,
                  fontSize: 40,
                  fontWeight: 800,
                  letterSpacing: -1,
                  // Xoay khi bật ra: số "vặn" vào chỗ thay vì chỉ phình to.
                  transform: `scale(${interpolate(e, [0, 1], [0.35, 1])}) rotate(${interpolate(
                    e,
                    [0, 1],
                    [-40, 0],
                  ).toFixed(1)}deg)`,
                  boxShadow: isTech(p)
                    ? `${p.cardShadow}, 0 0 0 ${(6 + pulse * 12).toFixed(1)}px ${p.accentSoft}, ${p.glow}`
                    : p.cardShadow,
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
            </div>

            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                opacity: op,
                transform: `translateX(${interpolate(e, [0, 1], [28, 0])}px)`,
                padding: "24px 30px",
                ...cardSurface(p),
                fontSize: p.size.card,
                fontWeight: 650,
                color: p.text,
                lineHeight: 1.2,
              }}
            >
              {text}
            </div>
          </div>
  );
};
