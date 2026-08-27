import React from "react";

/**
 * NeonGear — bánh răng vẽ bằng SVG, viền neon phát sáng. Nhận góc quay `angle`
 * (độ) để component cha xoay theo frame. Không tự animate.
 */
export const NeonGear: React.FC<{
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

  // Sinh răng bằng cách vẽ path răng cưa quanh vòng tròn.
  const pts: string[] = [];
  const steps = teeth * 2;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    // Bo nhẹ mỗi răng bằng cách thêm điểm hai bên.
    const aw = (toothW / 360) * Math.PI * 2;
    const a1 = a - aw / 2;
    const a2 = a + aw / 2;
    pts.push(`${cx + Math.cos(a1) * r},${cy + Math.sin(a1) * r}`);
    pts.push(`${cx + Math.cos(a2) * r},${cy + Math.sin(a2) * r}`);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ transform: `rotate(${angle}deg)`, filter: glow ? `drop-shadow(0 0 8px ${glow})` : undefined }}
    >
      <polygon
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r={rHub} fill="none" stroke={color} strokeWidth={4} />
      {children && (
        // Nội dung giữa hub (vd tia sét) — bù xoay để đứng yên.
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
