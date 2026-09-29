import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { parseRows, formatValue, type Row } from "./TechBars";

/**
 * TechBars3D — biểu đồ CỘT 3D THẬT cho graphic.kind = "bar-chart-3d".
 *
 * Cùng hợp đồng dữ liệu với `bar-chart` (nhãn "Tên:giá trị đơn vị", hàng cuối là điểm
 * nhấn) — đổi `kind` là đổi được từ thanh phẳng sang khối 3D mà KHÔNG phải sửa spec.
 *
 * Hai lớp chồng khít:
 *   - LỚP 3D  : ThreeCanvas nền trong suốt → nền cảnh (mưa nhị phân / video) vẫn lộ qua,
 *               nên khối 3D "ngồi trong" video chứ không phải dán một hộp đen lên trên.
 *   - LỚP CHỮ : hàng nhãn + số ĐẾM LÊN nằm DƯỚI canvas, chia cột đều nhau. Vì cả cột 3D
 *               lẫn nhãn đều dàn đều theo trục X nên chúng tự thẳng hàng, không cần chiếu
 *               toạ độ 3D → 2D (thứ rất dễ lệch mỗi khi đổi camera).
 *
 * Màu đọc hết từ Palette: cột nhấn = accent (phát sáng emissive), cột thường = xám trung
 * tính (accent2/muted) → một cột sáng nổi bật giữa các cột trầm, đúng luật "tô sáng cái
 * đáng nhớ" của bộ 2D.
 */

const CANVAS_H = 560; // chiều cao vùng vẽ 3D (px). Nhãn nằm dưới, ngoài vùng này.
const MAX_BAR_H = 4.2; // chiều cao cột cao nhất trong không gian 3D (đơn vị three)
const BAR_W = 0.92; // bề ngang/sâu của mỗi cột

/** Một cột 3D: hộp mọc từ mặt sàn lên, xoay nhẹ để thấy khối. */
const Bar3D: React.FC<{
  row: Row;
  index: number;
  count: number;
  max: number;
  isPeak: boolean;
  colorHex: string;
  peakHex: string;
}> = ({ index, count, max, isPeak, colorHex, peakHex, row }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cột MỌC lên: spring 0→1, lệch nhau theo index để chạy lần lượt.
  const grow = spring({
    frame: frame - (8 + index * 5),
    fps,
    config: { damping: 18, stiffness: 90, mass: 1 },
  });
  const targetH = Math.max((row.value / max) * MAX_BAR_H, 0.02);
  const h = targetH * grow;

  // Dàn đều theo trục X, tâm ở 0.
  const step = BAR_W + 0.55;
  const x = (index - (count - 1) / 2) * step;

  const hex = isPeak ? peakHex : colorHex;

  return (
    <mesh position={[x, h / 2, 0]}>
      <boxGeometry args={[BAR_W, Math.max(h, 0.001), BAR_W]} />
      <meshStandardMaterial
        color={hex}
        metalness={isPeak ? 0.45 : 0.2}
        roughness={isPeak ? 0.25 : 0.55}
        emissive={hex}
        // Cột nhấn tự phát sáng để "bừng" lên giữa các cột trầm; cột thường gần như tắt.
        emissiveIntensity={isPeak ? 0.55 : 0.06}
      />
    </mesh>
  );
};

const Scene: React.FC<{ rows: Row[]; max: number; colorHex: string; peakHex: string; accentHex: string }> = ({
  rows,
  max,
  colorHex,
  peakHex,
  accentHex,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Cả cụm ĐUNG ĐƯA rất khẽ quanh trục dọc → thấy được chiều sâu của khối mà không chóng
  // mặt. Đây là tầng "SỐNG" của motion.ts áp cho 3D.
  const yaw = Math.sin((frame / fps) * 0.5) * 0.18;

  return (
    <group rotation={[0, yaw, 0]} position={[0, -1.6, 0]}>
      {/* Ánh sáng: key trắng tạo khối, fill màu nhấn cho cả cụm ăn tông theme. */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 9, 6]} intensity={2.4} color="#ffffff" />
      <pointLight position={[-5, 3, 5]} intensity={26} color={accentHex} />

      {rows.map((row, i) => (
        <Bar3D
          key={i}
          row={row}
          index={i}
          count={rows.length}
          max={max}
          isPeak={i === rows.length - 1}
          colorHex={colorHex}
          peakHex={peakHex}
        />
      ))}

      {/* Mặt sàn mờ để các cột "đứng" trên một nền chung, không lơ lửng. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color={colorHex} transparent opacity={0.06} roughness={1} />
      </mesh>
    </group>
  );
};

export const TechBars3D: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const { width } = useVideoConfig();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows = parseRows(labels);
  const max = Math.max(...rows.map((r) => r.value), 1);

  // Cột thường: xám trung tính của theme (accent2/muted) — trầm để cột nhấn nổi lên.
  const colorHex = p.textMuted;
  const peakHex = p.accent;

  return (
    <div style={{ width: "100%", fontFamily: TEXT_STACK }}>
      <ThreeCanvas
        width={Math.round(width - 128)}
        height={CANVAS_H}
        camera={{ position: [0, 2.4, 9.2], fov: 42 }}
        style={{ backgroundColor: "transparent", width: "100%", height: CANVAS_H }}
      >
        <Scene rows={rows} max={max} colorHex={colorHex} peakHex={peakHex} accentHex={p.accent} />
      </ThreeCanvas>

      {/* Nhãn + số đếm lên, chia cột ĐỀU → tự thẳng hàng với các cột 3D bên trên. */}
      <div style={{ display: "flex", width: "100%", marginTop: 6 }}>
        {rows.map((row, i) => {
          const isPeak = i === rows.length - 1;
          const e = spring({ frame: frame - (8 + i * 5), fps, config: { damping: 18, stiffness: 90 } });
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  fontFamily: p.labelFont,
                  fontSize: p.size.value,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: isPeak ? p.accent : p.text,
                  textShadow: isPeak && isTech(p) ? `0 0 30px ${p.accentSoft}` : "none",
                  transform: `scale(${interpolate(e, [0.75, 1], [1.12, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })})`,
                }}
              >
                {formatValue(row.value, e)}
                {row.unit && (
                  <span style={{ fontSize: p.size.subhead, fontWeight: 700, marginLeft: 4, color: p.textMuted }}>
                    {row.unit}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: p.size.small,
                  fontWeight: 650,
                  color: isPeak ? p.text : p.textMuted,
                  textAlign: "center",
                  lineHeight: 1.15,
                  padding: "0 6px",
                }}
              >
                {row.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
