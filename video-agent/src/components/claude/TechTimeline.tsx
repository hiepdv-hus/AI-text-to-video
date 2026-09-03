import React from "react";
import { interpolate } from "remotion";
import type { Palette } from "../../theme/claude";
import { cardSurface, isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { EMOJI_FAMILY } from "../fontsEmoji";
import { BEAT, useDrift, useEnter, usePulse, useSweep } from "../motion";

/**
 * TechTimeline — mốc thời gian cho graphic.kind = "highlight-timeline".
 *
 * Cấu trúc: một đường ray dọc bên trái, mỗi mốc là một nút phát sáng, nội dung nằm
 * trong thẻ kính bên phải. Đường ray ĐƯỢC VẼ DẦN theo frame nên người xem thấy rõ
 * mạch thời gian chạy từ trên xuống — thứ mà một danh sách gạch đầu dòng không có.
 *
 * Dữ liệu: `labels[i]` là nội dung mốc, `timestamps[i]` là nhãn thời gian ("0:05").
 * Thiếu timestamps thì nút hiện số thứ tự thay cho giờ.
 */

const RAIL_X = 34; // tâm đường ray, tính từ mép trái vùng widget
const NODE = 30; // đường kính nút
const ROW_GAP = 26;

export const TechTimeline: React.FC<{ labels?: string[]; timestamps?: string[]; p: Palette }> = ({
  labels,
  timestamps,
  p,
}) => {
  const items = labels?.length ? labels : ["Mốc một", "Mốc hai", "Mốc ba"];
  // Chấm sáng chạy suốt đường ray, lặp lại — cho người xem cảm giác thời gian đang trôi
  // chứ không phải một danh sách đứng yên.
  const travel = useSweep(3.4);

  return (
    <div style={{ width: "100%", position: "relative", fontFamily: TEXT_STACK, textAlign: "left" }}>
      {/* Đường ray nền — chạy suốt, màu rãnh mờ. */}
      <div
        style={{
          position: "absolute",
          left: RAIL_X - 2,
          top: NODE / 2,
          bottom: NODE / 2,
          width: 4,
          borderRadius: 999,
          background: p.track,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            width: 4,
            height: "22%",
            top: `${travel * 122 - 22}%`,
            borderRadius: 999,
            background: `linear-gradient(180deg, transparent, ${p.accent}, transparent)`,
            opacity: 0.85,
          }}
        />
      </div>

      {items.map((raw, i) => {
        const time = timestamps?.[i];
        const m = raw.match(/^(\p{Extended_Pictographic}️?)\s+(.*)$/u);
        const icon = m?.[1];
        const text = (m?.[2] ?? raw).trim();
        const last = i === items.length - 1;

        return (
          <Row
            key={i}
            index={i}
            last={last}
            time={time}
            icon={icon}
            text={text}
            p={p}
          />
        );
      })}
    </div>
  );
};

/** Một mốc: nút bật lên, đoạn nối vẽ dần, thẻ trượt vào rồi trôi khẽ. */
const Row: React.FC<{
  index: number;
  last: boolean;
  time?: string;
  icon?: string;
  text: string;
  p: Palette;
}> = ({ index, last, time, icon, text, p }) => {
  const e = useEnter(5 + index * (BEAT.stagger + 3));
  const op = interpolate(e, [0, 0.45], [0, 1], { extrapolateRight: "clamp" });
  const float = useDrift(index, 0.14) * 3;
  const pulse = usePulse(0.4, index);

  return (
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "stretch",
              gap: 30,
              paddingLeft: 0,
              marginBottom: last ? 0 : ROW_GAP,
              transform: `translateY(${float}px)`,
            }}
          >
            {/* Cột ray: đoạn nối được TÔ DẦN + nút mốc. */}
            <div style={{ position: "relative", width: RAIL_X * 2, flex: "none" }}>
              {!last && (
                <div
                  style={{
                    position: "absolute",
                    left: RAIL_X - 2,
                    top: NODE,
                    width: 4,
                    height: `calc(100% - ${NODE}px + ${ROW_GAP}px)`,
                    borderRadius: 999,
                    background: p.accentGradient,
                    opacity: 0.55,
                    transform: `scaleY(${e})`,
                    transformOrigin: "top",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  left: RAIL_X - NODE / 2,
                  top: 0,
                  width: NODE,
                  height: NODE,
                  borderRadius: 999,
                  background: p.accentGradient,
                  // Vòng sáng quanh nút THỞ theo nhịp — mỗi nút lệch pha nên đường ray
                  // trông như đang có tín hiệu chạy qua, không phải mấy chấm tròn dán lên.
                  boxShadow: isTech(p)
                    ? `0 0 0 6px rgba(4,10,14,0.9), 0 0 0 ${(8 + pulse * 10).toFixed(1)}px ${p.accentSoft}, ${p.glow}`
                    : `0 0 0 6px ${p.bg}`,
                  transform: `scale(${interpolate(e, [0, 1], [0.2, 1])})`,
                }}
              />
            </div>

            {/* Thẻ nội dung mốc */}
            <div
              style={{
                flex: 1,
                opacity: op,
                transform: `translateX(${interpolate(e, [0, 1], [30, 0])}px)`,
                padding: "24px 30px",
                ...cardSurface(p),
                borderLeft: `3px solid ${p.accent}`,
              }}
            >
              {time && (
                <div
                  style={{
                    fontFamily: p.labelFont,
                    fontSize: p.size.label,
                    fontWeight: 700,
                    letterSpacing: p.labelCase === "uppercase" ? 2 : 0.3,
                    textTransform: p.labelCase,
                    color: p.accent,
                    marginBottom: 10,
                  }}
                >
                  {time}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  fontSize: p.size.card,
                  fontWeight: 650,
                  color: p.text,
                  lineHeight: 1.2,
                }}
              >
                {icon && <span style={{ fontFamily: EMOJI_FAMILY, fontSize: 42, flex: "none" }}>{icon}</span>}
                {text}
              </div>
            </div>
          </div>
  );
};
