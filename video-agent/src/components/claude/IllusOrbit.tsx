import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { useEnter } from "../motion";
import { Glyph, parseLabel } from "./Icon";

/**
 * IllusOrbit — MINH HOẠ ĐỘNG cho graphic.kind = "illus-orbit".
 *
 * Khác các widget cũ (thẻ/biểu đồ pop vào rồi ĐỨNG YÊN): đây là hình minh hoạ CHUYỂN
 * ĐỘNG LIÊN TỤC — một khái niệm trung tâm với các vệ tinh QUAY quanh, năng lượng chạy
 * dọc nan hoa từ tâm ra, hub thở sáng. Dùng để "kể" bằng hình cái mà chữ không nói gọn
 * được: một thứ ở TRUNG TÂM kết nối/điều khiển nhiều thứ khác.
 *   "AI ở giữa, nối tới viết code / tìm lỗi / viết test / tài liệu"
 *   "Điện thoại điều khiển đèn / khoá / camera / máy lạnh"
 *
 * Nhãn (labels):
 *   labels[0]   = HUB trung tâm  — vd "@brain Mô hình AI"
 *   labels[1..] = các vệ tinh    — vd "@code Viết code", "@bug Tìm lỗi", "@file Tài liệu"
 * (3–6 vệ tinh là đẹp; hơn nữa thì chật khung 9:16.)
 *
 * Toàn bộ vẽ trong MỘT <svg> viewBox cố định → mọi thứ (nan hoa, chấm năng lượng, hub,
 * vệ tinh) căn khớp tuyệt đối dù khung co giãn. Icon + chữ nhúng qua <foreignObject> nên
 * tái dùng đúng Glyph + font tiếng Việt như phần còn lại của hệ.
 */

const VB = 1000; // cạnh viewBox (đơn vị ≈ px vì svg width 100% ≈ 950px)
const C = VB / 2; // tâm
const ORBIT_R = 340; // bán kính quỹ đạo vệ tinh
const REV_SEC = 44; // giây cho một vòng quay đầy — chậm để "sống" mà không chóng mặt

interface OrbitNode {
  name?: ReturnType<typeof parseLabel>["name"];
  emoji?: string;
  text: string;
}

function parseNodes(labels?: string[]): { hub: OrbitNode; sats: OrbitNode[] } {
  const src = labels?.length
    ? labels
    : ["@brain Trung tâm", "@code Thành phần 1", "@bug Thành phần 2", "@cloud Thành phần 3"];
  const [hubRaw, ...satRaw] = src;
  return {
    hub: parseLabel(hubRaw ?? "@brain Trung tâm"),
    sats: satRaw.slice(0, 6).map(parseLabel),
  };
}

/** Một "hành tinh" (icon trong chip tròn + nhãn dưới), nhúng qua foreignObject tại (cx,cy). */
const NodeChip: React.FC<{
  cx: number;
  cy: number;
  node: OrbitNode;
  chip: number;
  icon: number;
  fontSize: number;
  hub?: boolean;
  glowT?: number;
  p: Palette;
}> = ({ cx, cy, node, chip, icon, fontSize, hub = false, glowT = 0, p }) => {
  const w = 300;
  const h = chip + 96;
  const tech = isTech(p);
  const ring = hub ? p.accent : p.cardBorder;
  const glowPx = hub ? 30 + glowT * 26 : tech ? 14 : 0;
  return (
    <foreignObject x={Math.round(cx - w / 2)} y={Math.round(cy - chip / 2 - 8)} width={w} height={h} style={{ overflow: "visible" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          fontFamily: TEXT_STACK,
        }}
      >
        <div
          style={{
            width: chip,
            height: chip,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hub ? p.accentSoft : p.card,
            border: `${hub ? 2.5 : 1.5}px solid ${ring}`,
            boxShadow: glowPx ? `0 0 ${glowPx}px ${hub ? p.accent : p.accentSoft}, ${p.cardShadow}` : p.cardShadow,
            backdropFilter: p.cardBackdrop !== "none" ? p.cardBackdrop : undefined,
          }}
        >
          <Glyph parsed={node} size={icon} color={p.accent} p={p} />
        </div>
        <div
          style={{
            fontSize,
            fontWeight: hub ? 800 : 650,
            color: hub ? p.text : p.textMuted,
            textAlign: "center",
            lineHeight: 1.12,
            maxWidth: w,
            textShadow: hub && tech ? `0 0 24px ${p.accentSoft}` : "none",
          }}
        >
          {node.text}
        </div>
      </div>
    </foreignObject>
  );
};

/** Một nan hoa từ tâm ra vệ tinh: đường mờ + chấm năng lượng chạy ra, LẶP MÃI. */
const Spoke: React.FC<{ sx: number; sy: number; ex: number; ey: number; draw: number; flow: number; p: Palette }> = ({
  sx,
  sy,
  ex,
  ey,
  draw,
  flow,
  p,
}) => {
  // Đường vẽ dần ra theo `draw` (0→1) lúc vào cảnh.
  const dx = sx + (ex - sx) * draw;
  const dy = sy + (ey - sy) * draw;
  // Chấm năng lượng: vị trí theo `flow` (0→1) trên đoạn, mờ ở hai đầu.
  const fx = sx + (ex - sx) * flow;
  const fy = sy + (ey - sy) * flow;
  const dotOpacity = draw > 0.98 ? interpolate(flow, [0, 0.12, 0.85, 1], [0, 1, 1, 0]) : 0;
  return (
    <>
      <line x1={sx} y1={sy} x2={dx} y2={dy} stroke={p.accent} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <circle
        cx={fx}
        cy={fy}
        r={7}
        fill={p.accent}
        opacity={dotOpacity}
        style={{ filter: isTech(p) ? `drop-shadow(0 0 7px ${p.accent})` : undefined }}
      />
    </>
  );
};

export const IllusOrbit: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { hub, sats } = parseNodes(labels);
  const n = Math.max(sats.length, 1);

  // Quay chậm liên tục — đây là tầng "SỐNG".
  const spin = (frame / fps / REV_SEC) * Math.PI * 2;
  // Hub thở sáng.
  const hubGlow = (Math.sin((frame / fps) * Math.PI * 2 * 0.4) + 1) / 2;
  // Vào cảnh: nan hoa vẽ ra + vệ tinh bung ra khỏi tâm.
  const bloom = useEnter(6, { damping: 20, stiffness: 90, mass: 1 });

  const positions = sats.map((_, i) => {
    const a = spin + (i / n) * Math.PI * 2 - Math.PI / 2;
    // Bung từ tâm (bloom): bán kính nội suy 0 → ORBIT_R.
    const r = ORBIT_R * bloom;
    return { x: Math.round(C + Math.cos(a) * r), y: Math.round(C + Math.sin(a) * r) };
  });

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <svg width="100%" viewBox={`0 0 ${VB} ${VB}`} style={{ overflow: "visible", maxHeight: 980 }}>
        {/* Vòng quỹ đạo mờ để mắt đọc ra "chúng đang xoay quanh cùng một tâm". */}
        <circle cx={C} cy={C} r={ORBIT_R} fill="none" stroke={p.hairline} strokeWidth={2} strokeDasharray="4 14" opacity={bloom * 0.7} />

        {/* Nan hoa + năng lượng chạy (vẽ trước để nằm dưới các chip). */}
        {positions.map((pos, i) => (
          <Spoke
            key={`spoke-${i}`}
            sx={C}
            sy={C}
            ex={pos.x}
            ey={pos.y}
            draw={bloom}
            flow={sweepAt(frame, fps, 2.2, i * 0.28)}
            p={p}
          />
        ))}

        {/* Vệ tinh */}
        {positions.map((pos, i) => (
          <NodeChip key={`sat-${i}`} cx={pos.x} cy={pos.y} node={sats[i]!} chip={128} icon={62} fontSize={38} p={p} />
        ))}

        {/* Hub trung tâm — vẽ SAU cùng để nổi trên nan hoa. */}
        <NodeChip cx={C} cy={C} node={hub} chip={196} icon={98} fontSize={44} hub glowT={hubGlow} p={p} />
      </svg>
    </div>
  );
};

/** Vệt quét 0..1 (thuần, nhận frame/fps) — gọi trong .map nên KHÔNG đặt tên use* (không phải hook). */
function sweepAt(frame: number, fps: number, periodSec: number, offset: number): number {
  return ((frame / fps / periodSec) % 1 + offset) % 1;
}
