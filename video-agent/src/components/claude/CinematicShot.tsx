import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene, Camera } from "../../schema";

/**
 * CinematicShot — renderer cho layout "shot": một KHUNG PHIM full-bleed với CHUYỂN ĐỘNG
 * MÁY QUAY thật, thay cho cảm giác "slide".
 *
 * Ảnh (do pipeline sinh từ công thức shot) chạy TRÀN KHUNG; `camera.move` quyết định cú
 * máy: đẩy vào (dolly-in), lia ngang (pan), cẩu (crane), rung tay (handheld), hay tĩnh
 * (vẫn thở rất khẽ). Ảnh luôn được phóng dư (base > 1) để lia/rung không lộ mép đen.
 *
 * Ba lớp "chất phim" phủ lên: vignette (tối bốn góc, hút mắt vào giữa), scrim đáy (cho phụ
 * đề đọc rõ + chiều sâu), và grain toàn video (FilmGrain có sẵn) → khung tĩnh đọc ra là
 * cảnh quay. KHÔNG có tiêu đề to / bullet — chữ để cho phụ đề, đúng gu điện ảnh.
 */

const resolveImg = (src: string) =>
  /^https?:\/\//.test(src) || src.startsWith("data:") ? src : staticFile(src);

interface Cam {
  scale: number;
  x: number; // % theo bề ngang phần tử
  y: number;
  rotate: number; // độ
}

/** Tính transform máy quay theo `move`, tiến trình cảnh p∈[0,1] và thời gian t (giây). */
function cameraTransform(move: Camera["move"], p: number, t: number): Cam {
  const ease = p * p * (3 - 2 * p); // smoothstep — vào/ra mềm
  switch (move) {
    case "dolly-in":
      return { scale: interpolate(ease, [0, 1], [1.06, 1.22]), x: 0, y: 0, rotate: 0 };
    case "dolly-out":
      return { scale: interpolate(ease, [0, 1], [1.22, 1.06]), x: 0, y: 0, rotate: 0 };
    case "pan-left":
      return { scale: 1.18, x: interpolate(ease, [0, 1], [5, -5]), y: 0, rotate: 0 };
    case "pan-right":
      return { scale: 1.18, x: interpolate(ease, [0, 1], [-5, 5]), y: 0, rotate: 0 };
    case "crane-up":
      return { scale: 1.18, x: 0, y: interpolate(ease, [0, 1], [5, -5]), rotate: 0 };
    case "crane-down":
      return { scale: 1.18, x: 0, y: interpolate(ease, [0, 1], [-5, 5]), rotate: 0 };
    case "handheld":
      // Rung tay: nhiều tần số lệch nhau cho tự nhiên (không tuần hoàn lộ liễu) + phóng khẽ.
      return {
        scale: 1.12 + Math.sin(t * 1.3) * 0.006,
        x: Math.sin(t * 2.1) * 0.7 + Math.sin(t * 3.7) * 0.4,
        y: Math.cos(t * 1.8) * 0.6 + Math.sin(t * 4.3) * 0.3,
        rotate: Math.sin(t * 1.1) * 0.35,
      };
    case "static":
      // "Tĩnh" nhưng vẫn thở rất khẽ — máy để yên hoàn toàn thì khung chết như ảnh.
      return { scale: interpolate(ease, [0, 1], [1.04, 1.08]), x: 0, y: 0, rotate: 0 };
    default: {
      const _e: never = move;
      throw new Error(`camera.move không tồn tại: ${_e}`);
    }
  }
}

export const CinematicShot: React.FC<{ scene: BuiltScene; height: number }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const move = scene.shot?.camera?.move ?? "dolly-in";
  const p = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], { extrapolateRight: "clamp" });
  const cam = cameraTransform(move, p, frame / fps);
  const src = scene.media?.kind === "image" ? scene.media.src : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {src && (
        <AbsoluteFill
          style={{
            transform: `scale(${cam.scale}) translate(${cam.x.toFixed(2)}%, ${cam.y.toFixed(2)}%) rotate(${cam.rotate.toFixed(2)}deg)`,
          }}
        >
          <Img src={resolveImg(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}

      {/* Vignette — tối bốn góc, kéo mắt vào chủ thể. Radial tan sang trong suốt (không blur). */}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 38%, rgba(0,0,0,0.55) 100%)" }}
      />
      {/* Scrim đáy — nền tối thoải cho phụ đề, đồng thời "đặt" khung xuống mặt đất. */}
      <AbsoluteFill
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, transparent 22%, transparent 60%, rgba(0,0,0,0.72) 100%)" }}
      />
    </AbsoluteFill>
  );
};
