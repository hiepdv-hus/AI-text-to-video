import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { useEnter, usePulse } from "../motion";

/**
 * AnimatedIllus — khung ẢNH MINH HOẠ AI làm "sống" bằng chuyển động lớp.
 *
 * Đây là fallback cho chủ đề NẰM NGOÀI thư viện illus-* dựng tay: ảnh do Pollinations sinh
 * (style đã khoá theo theme ở pipeline) là ẢNH TĨNH — bốn tầng chuyển động dưới đây khiến
 * nó đọc ra là VIDEO chứ không phải một tấm hình dán lên:
 *   1. KEN BURNS   — ảnh phóng chậm + trôi trong khung (máy quay đang tiến vào).
 *   2. PARALLAX 2.5D — khung nghiêng khẽ quanh trục X/Y (perspective), ảnh bên trong dịch
 *                      NGƯỢC lại → giả chiều sâu từ một ảnh phẳng.
 *   3. VỆT SÁNG    — một dải sáng chéo quét qua mặt ảnh theo chu kỳ (như ánh sáng lướt).
 *   4. KHUNG THỞ   — viền nhấn + quầng glow phồng xẹp nhẹ.
 *
 * Một ảnh tĩnh + bốn tầng này ≈ cảm giác "ảnh động", đủ để xen với các illus-* vẽ tay mà
 * không lạc nhịp. Không phải video thật (nhân vật không cử động) — đó là giới hạn đã biết
 * của hướng "ảnh AI + animate".
 */

const resolveImg = (src: string) =>
  /^https?:\/\//.test(src) || src.startsWith("data:") ? src : staticFile(src);

export const AnimatedIllus: React.FC<{ src: string; height: number; p: Palette }> = ({ src, height, p }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig(); // durationInFrames = độ dài CẢNH (Sequence)
  const t = frame / fps;
  const tech = isTech(p);

  const e = useEnter(4, { damping: 20, stiffness: 130, mass: 0.9 });
  const pulse = usePulse(0.4);

  // 1. Ken Burns: phóng đều suốt cảnh (đơn điệu, không dao động → đọc ra là "tiến vào").
  const kb = interpolate(frame, [0, durationInFrames], [1.06, 1.16], { extrapolateRight: "clamp" });
  const panX = Math.sin(t * 0.18) * 10;
  const panY = Math.cos(t * 0.14) * 8;

  // 2. Parallax 2.5D: khung nghiêng khẽ; ảnh trong dịch ngược để "sâu".
  const tiltY = Math.sin(t * 0.5) * 2.4; // độ
  const tiltX = Math.cos(t * 0.4) * 1.6;
  const depthX = -tiltY * 3;
  const depthY = tiltX * 3;

  const maxH = Math.round(height * 0.56);
  const tick: React.CSSProperties = { position: "absolute", width: 30, height: 30, borderColor: p.accent, borderStyle: "solid" };

  return (
    <div
      style={{
        width: "100%",
        perspective: 1400,
        opacity: e,
        transform: `translateY(${interpolate(e, [0, 1], [26, 0])}px)`,
      }}
    >
      <div
        style={{
          position: "relative",
          maxHeight: maxH,
          borderRadius: p.radius.lg,
          overflow: "hidden",
          border: `1.5px solid ${p.cardBorder}`,
          boxShadow: tech ? `${p.cardShadow}, 0 0 ${26 + pulse * 26}px ${p.accentSoft}` : p.cardShadow,
          background: p.card,
          // Nghiêng 2.5D: giữ nhẹ để không "gãy" phối cảnh.
          transform: `rotateY(${tiltY.toFixed(2)}deg) rotateX(${tiltX.toFixed(2)}deg) scale(${interpolate(e, [0, 1], [0.94, 1])})`,
          transformStyle: "preserve-3d",
        }}
      >
        <Img
          src={resolveImg(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            maxHeight: maxH,
            // Ảnh to hơn khung (kb ≥ 1.06) nên khi trôi/dịch không lộ mép.
            transform: `scale(${kb}) translate(${(panX + depthX).toFixed(1)}px, ${(panY + depthY).toFixed(1)}px)`,
          }}
        />

        {/* 3. Vệt sáng chéo quét qua — chu kỳ ~5s, mảnh, không át hình. */}
        <div
          style={{
            position: "absolute",
            inset: "-30%",
            background: `linear-gradient(115deg, transparent 42%, ${
              tech ? "rgba(59,232,160,0.14)" : "rgba(255,255,255,0.12)"
            } 50%, transparent 58%)`,
            transform: `translateX(${interpolate((t / 5) % 1, [0, 1], [-60, 60])}%)`,
          }}
        />

        {/* Viền trong mảnh cho cạnh ảnh "ăn" vào khung, không cấn. */}
        <div style={{ position: "absolute", inset: 0, borderRadius: p.radius.lg, boxShadow: `inset 0 0 0 1px ${p.hairline}` }} />

        {tech && (
          <>
            <div style={{ ...tick, top: 10, left: 10, borderWidth: "2px 0 0 2px", borderTopLeftRadius: p.radius.sm }} />
            <div style={{ ...tick, bottom: 10, right: 10, borderWidth: "0 2px 2px 0", borderBottomRightRadius: p.radius.sm }} />
          </>
        )}
      </div>
    </div>
  );
};
