import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../../theme/tokens";
import { TEXT_STACK } from "../textStack";
import { EMOJI_FAMILY } from "../fontsEmoji";

/**
 * FeatureCards — thẻ liệt kê ý/tính năng.
 *
 * Nguyên tắc thiết kế (rút từ review):
 *  - Lưới THÔNG MINH: 4 hoặc 6 thẻ → 2 cột; còn lại (1,2,3,5) → 1 cột → không có "ô mồ côi".
 *  - Card ĐẶC + viền neon rõ + bóng sâu → tách hẳn khỏi nền, không chìm.
 *  - Chữ to, đậm, CĂN TRÁI nhất quán (icon/thanh nhấn bên trái, chữ căn trái).
 *  - Entrance nhanh, opacity đạt 1 sớm (không đứng lửng ở ~50% trông như lỗi render).
 *  - Icon KHÔNG bắt buộc: label không có emoji → dùng THANH NHẤN tím (giữ kỷ luật màu
 *    tím–xanh, tránh emoji màu lạc quẻ). Chỉ hiện emoji khi label thực sự có.
 *
 * Label: "🤖 Tự động" (emoji đầu) hoặc "Phân tích yêu cầu" (không emoji → thanh nhấn).
 */

const N = tokens.neon;

// Nhận diện emoji THẬT ở đầu (Extended_Pictographic — KHÔNG dính chữ số như "17").
const EMOJI_RE = /^(\p{Extended_Pictographic}️?)\s+(.*)$/u;

export const FeatureCards: React.FC<{ labels?: string[] }> = ({ labels }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = labels && labels.length ? labels : ["Tự động", "Nhanh", "Riêng tư", "Mượt"];
  const cols = items.length === 4 || items.length === 6 ? 2 : 1;

  return (
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: cols === 2 ? "1fr 1fr" : "1fr",
        gap: 20,
        fontFamily: TEXT_STACK,
      }}
    >
      {items.map((raw, i) => {
        const e = spring({ frame: frame - (5 + i * 4), fps, config: { damping: 16, stiffness: 220, mass: 0.6 } });
        const op = interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
        const m = raw.match(EMOJI_RE);
        const icon = m?.[1];
        const text = (m?.[2] ?? raw).trim();
        return (
          <div
            key={i}
            style={{
              opacity: op,
              transform: `translateY(${interpolate(e, [0, 1], [32, 0])}px)`,
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "28px 30px",
              borderRadius: 18,
              background: N.cardBg,
              border: `1.5px solid ${N.cardBorder}`,
              boxShadow: N.cardShadow,
              textAlign: "left",
            }}
          >
            {icon ? (
              <div
                style={{
                  width: 62,
                  height: 62,
                  minWidth: 62,
                  borderRadius: 15,
                  background: `linear-gradient(145deg, ${N.purple}, ${N.purpleDeep})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 34,
                  fontFamily: EMOJI_FAMILY,
                  boxShadow: N.glowSoft,
                }}
              >
                {icon}
              </div>
            ) : (
              <div
                style={{
                  width: 7,
                  height: 48,
                  minWidth: 7,
                  borderRadius: 6,
                  background: `linear-gradient(180deg, ${N.purpleBright}, ${N.purpleDeep})`,
                  boxShadow: N.glowSoft,
                }}
              />
            )}
            <div style={{ fontSize: 44, fontWeight: tokens.weight.black, color: "#fff", lineHeight: 1.22 }}>
              {text}
            </div>
          </div>
        );
      })}
    </div>
  );
};
