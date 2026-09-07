import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { cardSurface, isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { BEAT, useDrift, useEnter } from "../motion";

/**
 * TechDevice — MÁY ĐANG LÀM VIỆC cho graphic.kind = "device-editor".
 *
 * Chuyển thể từ `components/graphics/DeviceEditor.tsx` (bản neon cũ, đã ngừng dùng).
 * Khác biệt duy nhất mà cũng là lý do phải viết lại: bản cũ cứng màu tím/teal của
 * `tokens.neon`, nên bật ở theme tech hay claude đều lạc tông. Bản này đọc hết từ
 * Palette — ba track, playhead, bánh răng đều đổi màu theo theme.
 *
 * Dùng khi lời đọc nói về việc XỬ LÝ đang diễn ra trên máy: dựng phim, build, chạy job,
 * "chạy cục bộ, không gửi lên cloud". Đây là widget DUY NHẤT vẽ một thiết bị — các
 * widget khác đều là đồ hoạ trừu tượng.
 */

/* -------------------------------- Bánh răng ------------------------------- */

/**
 * Gear — bánh răng SVG. Nhận `angle` (độ) từ component cha để cha giữ quyền điều khiển
 * theo frame; component này không tự animate (nếu tự animate thì mỗi bánh răng một pha
 * ngẫu nhiên, cụm sẽ trông rời rạc).
 */
const Gear: React.FC<{
  size: number;
  angle: number;
  teeth?: number;
  color: string;
  glow?: string;
  children?: React.ReactNode;
}> = ({ size, angle, teeth = 10, color, glow, children }) => {
  const cx = 50;
  const cy = 50;
  const rOuter = 46;
  const rInner = 36;
  const rHub = 16;
  const toothW = 7;

  const pts: string[] = [];
  const steps = teeth * 2;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    const aw = (toothW / 360) * Math.PI * 2;
    pts.push(`${cx + Math.cos(a - aw / 2) * r},${cy + Math.sin(a - aw / 2) * r}`);
    pts.push(`${cx + Math.cos(a + aw / 2) * r},${cy + Math.sin(a + aw / 2) * r}`);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ transform: `rotate(${angle}deg)`, filter: glow ? `drop-shadow(0 0 8px ${glow})` : undefined }}
    >
      <polygon points={pts.join(" ")} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={rHub} fill="none" stroke={color} strokeWidth={4} />
      {children && (
        // Bù xoay ngược để nội dung ở hub đứng yên trong khi răng vẫn quay.
        <g transform={`rotate(${-angle} ${cx} ${cy})`}>
          <foreignObject x={cx - rHub} y={cy - rHub} width={rHub * 2} height={rHub * 2}>
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: rHub,
              }}
            >
              {children}
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
};

/* --------------------------------- Track ---------------------------------- */

const Track: React.FC<{
  label: string;
  color: string;
  /** [left%, width%] của từng khối clip trên track. */
  blocks: Array<[number, number]>;
  p: Palette;
  progress: number;
}> = ({ label, color, blocks, p, progress }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 44 }}>
    <div
      style={{
        width: 52,
        flex: "none",
        fontSize: p.size.small * 0.7,
        fontFamily: p.labelFont,
        color: p.textMuted,
        fontWeight: 700,
        border: `1px solid ${p.cardBorder}`,
        borderRadius: p.radius.sm,
        textAlign: "center",
        padding: "4px 0",
      }}
    >
      {label}
    </div>
    <div style={{ position: "relative", flex: 1, height: "100%" }}>
      {blocks.map(([l, w], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${l}%`,
            // Các khối clip "mọc" ra theo tiến trình vào — track đang được dựng dần.
            width: `${w * progress}%`,
            top: 6,
            bottom: 6,
            borderRadius: p.radius.sm,
            background: color,
            opacity: 0.85,
            boxShadow: isTech(p) ? `0 0 12px ${color}` : "none",
          }}
        />
      ))}
    </div>
  </div>
);

/* ------------------------------ Device editor ----------------------------- */

export const TechDevice: React.FC<{ timecode?: string; p: Palette }> = ({ timecode = "00:02:17", p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const e = useEnter(4, BEAT.enter);
  const float = useDrift(0, 0.12) * 4;

  // Playhead chạy tới lui — chuyển động liên tục, không phụ thuộc độ dài cảnh nên
  // cảnh dài bao nhiêu nó cũng không "chạy hết rồi đứng".
  const playX = interpolate(Math.sin(t * 0.5), [-1, 1], [6, 92]);

  return (
    <div
      style={{
        width: "100%",
        fontFamily: TEXT_STACK,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${interpolate(e, [0, 1], [26, 0]) + float}px)`,
      }}
    >
      {/* Màn hình */}
      <div
        style={{
          width: "94%",
          ...cardSurface(p),
          borderRadius: p.radius.lg,
          padding: 26,
          position: "relative",
          boxShadow: isTech(p) ? `${p.cardShadow}, ${p.glow}` : p.cardShadow,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 24,
            fontFamily: p.labelFont,
            fontSize: p.size.small * 0.8,
            color: p.accent,
            letterSpacing: 1.5,
          }}
        >
          {timecode}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 34, position: "relative" }}>
          <Track label="V1" color={p.accent} blocks={[[0, 22], [26, 20], [50, 24]]} p={p} progress={e} />
          <Track label="V2" color={p.accent2} blocks={[[2, 40], [46, 30]]} p={p} progress={e} />

          {/* Track âm thanh: waveform bằng các vạch dọc. Chiều cao sinh xác định từ
              sin(i) — cùng một hình sóng ở mọi lần render, không dùng Math.random. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: 44 }}>
            <div
              style={{
                width: 52,
                flex: "none",
                fontSize: p.size.small * 0.7,
                fontFamily: p.labelFont,
                color: p.textMuted,
                fontWeight: 700,
                border: `1px solid ${p.cardBorder}`,
                borderRadius: p.radius.sm,
                textAlign: "center",
                padding: "4px 0",
              }}
            >
              AU
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, height: "100%" }}>
              {Array.from({ length: 26 }, (_, i) => {
                // Sóng "thở" nhẹ theo thời gian để track audio không đứng chết.
                const base = 8 + Math.abs(Math.sin(i * 1.7)) * 24;
                const live = 1 + Math.sin(t * 2.4 + i * 0.6) * 0.16;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: base * live * e,
                      background: p.accent2,
                      opacity: 0.75,
                      borderRadius: 2,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Playhead */}
          <div
            style={{
              position: "absolute",
              top: -8,
              bottom: -8,
              left: `${6 + playX * 0.9}%`,
              width: 3,
              background: p.text,
              opacity: 0.9,
              boxShadow: `0 0 10px ${p.text}`,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -7,
                left: -5,
                width: 13,
                height: 13,
                borderRadius: "50% 50% 50% 0",
                background: p.text,
                transform: "rotate(-45deg)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Đế máy */}
      <div
        style={{
          width: "100%",
          height: 30,
          marginTop: -2,
          borderRadius: `0 0 ${p.radius.lg}px ${p.radius.lg}px`,
          border: `1px solid ${p.cardBorder}`,
          borderTop: "none",
          background: p.card,
        }}
      />

      {/* Cụm bánh răng — quay ngược chiều nhau như bánh răng ăn khớp thật.
          Chỉ chồm lên ĐẾ máy (-30), không chồm lên màn hình: kéo cao hơn nữa thì răng
          che mất track audio, mà track mới là thứ nói lên "đang xử lý". */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: -30 }}>
        <div style={{ marginBottom: -30 }}>
          <Gear size={90} angle={t * 60} teeth={9} color={p.accent2} glow={isTech(p) ? p.accent2 : undefined} />
        </div>
        <Gear size={140} angle={-t * 45} teeth={11} color={p.accent} glow={isTech(p) ? p.accent : undefined} />
        <div style={{ marginBottom: -30 }}>
          <Gear size={96} angle={t * 50} teeth={10} color={p.accent} glow={isTech(p) ? p.accent : undefined} />
        </div>
      </div>
    </div>
  );
};
