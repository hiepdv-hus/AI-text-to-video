import React from "react";
import { interpolate } from "remotion";
import { MONO_FAMILY } from "../fontsMono";

/**
 * DrawKit — "cây bút" vẽ nét + bộ PRIMITIVE line-art tái dùng cho layout "draw".
 *
 * Mọi nét là SVG tự vẽ dần (stroke draw-on qua stroke-dashoffset, pathLength=1 nên tiến độ
 * chạy trong [0..1] bất kể độ dài thật). Mỗi primitive nhận `delay` (frame bắt đầu vẽ) để
 * các bộ phận trong một cảnh hiện lần lượt — "nói đến đâu, hình vẽ ra đến đó".
 *
 * Toạ độ theo viewBox chuẩn 0..1000 (ngang) × 0..640 (dọc); sàn thường đặt ở y≈540.
 */

export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

export function drawProg(frame: number, delay: number, dur: number): number {
  return easeOut(interpolate(frame, [delay, delay + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
}

export interface Ink {
  frame: number;
  ink: string;
  accent: string;
  muted: string;
}

type Common = { delay?: number; dur?: number; stroke?: string; sw?: number; fill?: string; frame: number };

export const P: React.FC<Common & { d: string }> = ({ d, delay = 0, dur = 16, stroke = "#222", sw = 5, fill = "none", frame }) => {
  const prog = drawProg(frame, delay, dur);
  return (
    <path
      d={d}
      pathLength={1}
      fill={fill}
      fillOpacity={fill === "none" ? undefined : interpolate(prog, [0.6, 1], [0, 1], { extrapolateLeft: "clamp" })}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={1}
      strokeDashoffset={1 - prog}
    />
  );
};

export const L: React.FC<Common & { x1: number; y1: number; x2: number; y2: number }> = ({ x1, y1, x2, y2, delay = 0, dur = 12, stroke = "#222", sw = 5, frame }) => {
  const prog = drawProg(frame, delay, dur);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - prog} />;
};

export const C: React.FC<Common & { cx: number; cy: number; r: number }> = ({ cx, cy, r, delay = 0, dur = 16, stroke = "#222", sw = 5, fill = "none", frame }) => {
  const prog = drawProg(frame, delay, dur);
  return <circle cx={cx} cy={cy} r={r} pathLength={1} fill={fill} fillOpacity={fill === "none" ? undefined : interpolate(prog, [0.6, 1], [0, 1], { extrapolateLeft: "clamp" })} stroke={stroke} strokeWidth={sw} strokeDasharray={1} strokeDashoffset={1 - prog} />;
};

export const Rect: React.FC<Common & { x: number; y: number; w: number; h: number; rx?: number }> = ({ x, y, w, h, rx = 10, delay = 0, dur = 16, stroke = "#222", sw = 5, fill = "none", frame }) => {
  const prog = drawProg(frame, delay, dur);
  return <rect x={x} y={y} width={w} height={h} rx={rx} pathLength={1} fill={fill} fillOpacity={fill === "none" ? undefined : interpolate(prog, [0.6, 1], [0, 1], { extrapolateLeft: "clamp" })} stroke={stroke} strokeWidth={sw} strokeDasharray={1} strokeDashoffset={1 - prog} />;
};

/** opacity hiện dần (cho phần KHÔNG vẽ nét: tô đặc, chấm nhỏ). */
export const fadeIn = (frame: number, delay: number, dur = 8) =>
  interpolate(frame, [delay, delay + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/* =============================== PRIMITIVES =============================== */

type Pose = "stand" | "walk" | "think" | "cheer" | "slump" | "point";
type Pt = [number, number];

/** Chi (tay/chân) 2 khúc: polyline 3 điểm, có thể kèm BÀN TAY (chấm tròn) hoặc GIÀY (nét đậm). */
const Limb: React.FC<{ a: Pt; b: Pt; c: Pt; delay: number; frame: number; col: string; sw?: number; hand?: boolean; shoe?: Pt }> = ({ a, b, c, delay, frame, col, sw = 5, hand, shoe }) => (
  <g>
    <P d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]}`} stroke={col} sw={sw} delay={delay} dur={12} frame={frame} />
    {hand && <C cx={c[0]} cy={c[1]} r={5} stroke={col} sw={3} fill={col} delay={delay + 8} dur={6} frame={frame} />}
    {shoe && <L x1={c[0]} y1={c[1]} x2={shoe[0]} y2={shoe[1]} stroke={col} sw={7} delay={delay + 8} dur={6} frame={frame} />}
  </g>
);

/**
 * Figure — người vẽ NÉT CHI TIẾT (không phải que): đầu có tóc, thân thon (vai rộng → hông),
 * tay/chân 2 khúc có bàn tay và giày, bóng đổ dưới chân. Nhiều tư thế. `foot`=y chân chạm đất.
 * Cao ~182·scale.
 */
export const Figure: React.FC<Ink & { cx: number; foot: number; delay: number; pose?: Pose; scale?: number; mirror?: boolean; color?: string; alive?: boolean }> = ({
  frame, ink, cx, foot, delay, pose = "stand", scale = 1, mirror = false, color, alive = true,
}) => {
  const s = scale;
  const m = mirror ? -1 : 1;
  const col = color ?? ink;
  const headR = 23 * s;
  const headShift = pose === "slump" ? 9 * s * m : 0;
  const headCy = foot - 178 * s;
  const neckY = headCy + headR;
  const shY = neckY + 12 * s;          // vai
  const hipY = foot - 74 * s;
  const sx = 18 * s, hx = 11 * s;      // nửa bề rộng vai / hông
  const legLen = foot - hipY;
  const bob = alive ? Math.sin((frame / 30) * 2.4 + cx) * 2 * fadeIn(frame, delay + 30, 12) : 0;

  // ---- chân ----
  let legs: React.ReactNode;
  if (pose === "walk") {
    legs = (<>
      <Limb a={[cx + hx, hipY]} b={[cx + 16 * s, hipY + legLen * 0.5]} c={[cx + 28 * s, foot]} shoe={[cx + 42 * s, foot]} delay={delay + 10} frame={frame} col={col} />
      <Limb a={[cx - hx, hipY]} b={[cx - 6 * s, hipY + legLen * 0.55]} c={[cx - 22 * s, foot]} shoe={[cx - 10 * s, foot]} delay={delay + 12} frame={frame} col={col} />
    </>);
  } else {
    legs = (<>
      <Limb a={[cx - hx, hipY]} b={[cx - hx - 2 * s, hipY + legLen * 0.52]} c={[cx - hx - 1 * s, foot]} shoe={[cx - hx - 14 * s, foot]} delay={delay + 10} frame={frame} col={col} />
      <Limb a={[cx + hx, hipY]} b={[cx + hx + 2 * s, hipY + legLen * 0.52]} c={[cx + hx + 1 * s, foot]} shoe={[cx + hx + 14 * s, foot]} delay={delay + 12} frame={frame} col={col} />
    </>);
  }

  // ---- tay ----
  const shL: Pt = [cx - sx, shY], shR: Pt = [cx + sx, shY];
  let arms: React.ReactNode;
  if (pose === "cheer") {
    arms = (<>
      <Limb a={shL} b={[cx - sx - 10 * s, shY - 12 * s]} c={[cx - sx - 18 * s, shY - 46 * s]} hand delay={delay + 8} frame={frame} col={col} />
      <Limb a={shR} b={[cx + sx + 10 * s, shY - 12 * s]} c={[cx + sx + 18 * s, shY - 46 * s]} hand delay={delay + 9} frame={frame} col={col} />
    </>);
  } else if (pose === "think") {
    arms = (<>
      <Limb a={shR} b={[cx + sx + 12 * s, shY + 30 * s]} c={[cx + 5 * s, neckY + 6 * s]} hand delay={delay + 8} frame={frame} col={col} />
      <Limb a={shL} b={[cx - sx - 6 * s, shY + 34 * s]} c={[cx - sx - 2 * s, shY + 62 * s]} hand delay={delay + 9} frame={frame} col={col} />
    </>);
  } else if (pose === "point") {
    const ps: Pt = m > 0 ? shR : shL;
    arms = (<>
      <Limb a={ps} b={[cx + 26 * s * m, shY + 10 * s]} c={[cx + 58 * s * m, shY + 2 * s]} hand delay={delay + 8} frame={frame} col={col} />
      <Limb a={m > 0 ? shL : shR} b={[cx - sx * m - 6 * s * m, shY + 34 * s]} c={[cx - sx * m - 2 * s * m, shY + 62 * s]} hand delay={delay + 9} frame={frame} col={col} />
    </>);
  } else if (pose === "slump") {
    arms = (<>
      <Limb a={shL} b={[cx - sx - 4 * s, shY + 36 * s]} c={[cx - sx + 2 * s, shY + 66 * s]} hand delay={delay + 8} frame={frame} col={col} />
      <Limb a={shR} b={[cx + sx + 4 * s, shY + 36 * s]} c={[cx + sx - 2 * s, shY + 66 * s]} hand delay={delay + 9} frame={frame} col={col} />
    </>);
  } else {
    arms = (<>
      <Limb a={shL} b={[cx - sx - 7 * s, shY + 34 * s]} c={[cx - sx - 2 * s, shY + 66 * s]} hand delay={delay + 8} frame={frame} col={col} />
      <Limb a={shR} b={[cx + sx + 7 * s, shY + 34 * s]} c={[cx + sx + 2 * s, shY + 66 * s]} hand delay={delay + 9} frame={frame} col={col} />
    </>);
  }

  return (
    <g transform={`translate(0 ${bob.toFixed(2)})`}>
      {/* bóng đổ dưới chân */}
      <ellipse cx={cx} cy={foot + 6 * s} rx={34 * s} ry={7 * s} fill={col} opacity={0.1 * fadeIn(frame, delay + 20, 12)} />
      {/* đầu + tóc */}
      <C cx={cx + headShift} cy={headCy} r={headR} stroke={col} sw={5} delay={delay} dur={14} frame={frame} />
      <P d={`M${cx + headShift - headR * 0.92} ${headCy - headR * 0.08} Q ${cx + headShift} ${headCy - headR * 1.5} ${cx + headShift + headR * 0.92} ${headCy - headR * 0.08}`} stroke={col} sw={5} delay={delay + 3} dur={10} frame={frame} />
      {/* cổ */}
      <L x1={cx + headShift} y1={headCy + headR} x2={cx} y2={shY - 2 * s} stroke={col} sw={5} delay={delay + 5} dur={5} frame={frame} />
      {/* thân thon: vai rộng → hông hẹp */}
      <P d={`M${cx - sx} ${shY} Q ${cx - sx - 3 * s} ${(shY + hipY) / 2} ${cx - hx} ${hipY} L ${cx + hx} ${hipY} Q ${cx + sx + 3 * s} ${(shY + hipY) / 2} ${cx + sx} ${shY} Z`} stroke={col} sw={5} delay={delay + 6} dur={14} frame={frame} />
      {legs}
      {arms}
    </g>
  );
};

/** Bóng đổ mềm dưới vật thể (ellipse mờ, hiện dần). */
export const ShadowBlob: React.FC<{ frame: number; cx: number; cy: number; rx: number; delay: number; ry?: number; color?: string }> = ({ frame, cx, cy, rx, delay, ry, color = "#232019" }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry ?? rx * 0.2} fill={color} opacity={0.1 * fadeIn(frame, delay, 12)} />
);

/** Người NGỒI ở bàn (nhìn nghiêng) trên GHẾ xoay, gõ máy. anchor=(seatX, floorY). Mặt quay về +m. */
export const SitFigure: React.FC<Ink & { seatX: number; floor: number; delay: number; mirror?: boolean; color?: string }> = ({ frame, ink, seatX, floor, delay, mirror = false, color }) => {
  const m = mirror ? -1 : 1;
  const col = color ?? ink;
  const seatY = floor - 72;            // mặt ghế / hông
  const shY = seatY - 54;              // vai (hơi chồm tới trước)
  const shX = seatX + 7 * m;
  const headCy = shY - 30;
  const headR = 21;
  const headX = seatX + 12 * m;
  // nhịp sống: gõ phím (tay nhấp nhô nhanh) + đầu gật nhẹ, hiện sau khi vẽ xong
  const live = fadeIn(frame, delay + 28, 10);
  const typeBob = Math.sin(frame * 0.9) * 5 * live;
  const nod = Math.sin(frame * 0.9 + 1) * 1.6 * live;
  return (
    <g>
      <ShadowBlob frame={frame} color={col} cx={seatX + 8 * m} cy={floor + 5} rx={48} delay={delay + 18} />
      {/* ghế: lưng tựa + đệm + trụ + chân sao */}
      <P d={`M${seatX - 20 * m} ${seatY + 6} L ${seatX - 20 * m} ${seatY - 50} Q ${seatX - 20 * m} ${seatY - 64} ${seatX - 6 * m} ${seatY - 62}`} stroke={col} sw={5} delay={delay + 2} dur={12} frame={frame} />
      <L x1={seatX - 24 * m} y1={seatY + 8} x2={seatX + 22 * m} y2={seatY + 8} stroke={col} sw={6} delay={delay + 4} dur={8} frame={frame} />
      <L x1={seatX - 2 * m} y1={seatY + 8} x2={seatX - 2 * m} y2={floor - 24} stroke={col} sw={5} delay={delay + 6} dur={8} frame={frame} />
      <L x1={seatX - 30 * m} y1={floor} x2={seatX + 26 * m} y2={floor} stroke={col} sw={5} delay={delay + 7} dur={8} frame={frame} />
      <L x1={seatX - 2 * m} y1={floor - 24} x2={seatX - 26 * m} y2={floor} stroke={col} sw={4} delay={delay + 8} dur={6} frame={frame} />
      <L x1={seatX - 2 * m} y1={floor - 24} x2={seatX + 22 * m} y2={floor} stroke={col} sw={4} delay={delay + 8} dur={6} frame={frame} />
      {/* đầu + tóc (gật nhẹ) */}
      <g transform={`translate(0 ${nod.toFixed(2)})`}>
        <C cx={headX} cy={headCy} r={headR} stroke={col} sw={5} delay={delay} dur={14} frame={frame} />
        <P d={`M${headX - headR * 0.9} ${headCy - 2} Q ${headX} ${headCy - headR * 1.5} ${headX + headR * 0.95} ${headCy - 4}`} stroke={col} sw={5} delay={delay + 3} dur={9} frame={frame} />
      </g>
      {/* lưng hơi khom tới trước */}
      <P d={`M${shX} ${shY} Q ${seatX + 2 * m} ${(shY + seatY) / 2} ${seatX} ${seatY}`} stroke={col} sw={5} delay={delay + 6} dur={12} frame={frame} />
      {/* đùi ngang + cẳng chân xuống + bàn chân */}
      <L x1={seatX} y1={seatY} x2={seatX + 46 * m} y2={seatY} stroke={col} sw={5} delay={delay + 10} dur={10} frame={frame} />
      <Limb a={[seatX + 46 * m, seatY]} b={[seatX + 46 * m, (seatY + floor) / 2]} c={[seatX + 46 * m, floor]} shoe={[seatX + 60 * m, floor]} delay={delay + 12} frame={frame} col={col} />
      {/* cánh tay chồm ra bàn gõ phím (bàn tay nhấp nhô) */}
      <Limb a={[shX, shY + 4]} b={[seatX + 30 * m, shY + 26]} c={[seatX + 64 * m, seatY - 16 + typeBob]} hand delay={delay + 13} frame={frame} col={col} />
    </g>
  );
};

export const Desk: React.FC<Ink & { x: number; floor: number; w: number; delay: number }> = ({ frame, ink, x, floor, w, delay }) => {
  const top = floor - 108;
  return (
    <g>
      <ShadowBlob frame={frame} color={ink} cx={x + w / 2} cy={floor + 5} rx={w * 0.52} delay={delay + 12} />
      {/* mặt bàn dày (2 nét) */}
      <L x1={x} y1={top} x2={x + w} y2={top} stroke={ink} sw={6} delay={delay} dur={12} frame={frame} />
      <L x1={x + 6} y1={top + 9} x2={x + w - 6} y2={top + 9} stroke={ink} sw={3} delay={delay + 4} dur={10} frame={frame} />
      {/* chân bàn */}
      <L x1={x + 24} y1={top + 9} x2={x + 24} y2={floor} stroke={ink} sw={5} delay={delay + 5} dur={10} frame={frame} />
      <L x1={x + w - 24} y1={top + 9} x2={x + w - 24} y2={floor} stroke={ink} sw={5} delay={delay + 6} dur={10} frame={frame} />
      {/* ngăn kéo bên phải */}
      <Rect x={x + w - 92} y={top + 14} w={68} h={76} rx={6} stroke={ink} sw={4} delay={delay + 10} dur={12} frame={frame} />
      <L x1={x + w - 80} y1={top + 36} x2={x + w - 60} y2={top + 36} stroke={ink} sw={4} delay={delay + 16} dur={6} frame={frame} />
    </g>
  );
};

/**
 * Monitor — màn hình desktop, MÀN TỐI kiểu editor (đồng bộ với CodeWindow): bezel + màn đen
 * + 3 nút đèn mac. Mặc định màn trống (để cảnh đặt bug/đồ lên trên); truyền `code` để hiện
 * code thật tô màu. Luôn kèm chân đế.
 */
export const Monitor: React.FC<Ink & { cx: number; deskTop: number; delay: number; w?: number; h?: number; code?: string[]; title?: string }> = ({ frame, ink, accent, cx, deskTop, delay, w = 160, h = 104, code, title }) => {
  const top = deskTop - h - 26;
  const sx = cx - w / 2 + 8, sy = top + 8, sw = w - 16, sh = h - 16;
  const T = CODE_THEME;
  const fs = 15, lineH = 22, gutterW = 30;
  return (
    <g>
      {/* bezel */}
      <Rect x={cx - w / 2} y={top} w={w} h={h} rx={10} stroke={ink} sw={5} delay={delay} dur={16} frame={frame} />
      {/* màn tối */}
      <rect x={sx} y={sy} width={sw} height={sh} rx={5} fill={T.bg} opacity={fadeIn(frame, delay + 8, 12)} />
      {/* nút đèn mac */}
      {MAC_DOTS.map((c, i) => (
        <circle key={i} cx={sx + 14 + i * 13} cy={sy + 13} r={3.6} fill={c} opacity={fadeIn(frame, delay + 12 + i, 6)} />
      ))}
      {title && <text x={sx + 56} y={sy + 17} fill={T.gutter} fontFamily={MONO_FAMILY} fontSize={12} opacity={fadeIn(frame, delay + 14, 8)}>{title}</text>}
      <line x1={sx} y1={sy + 24} x2={sx + sw} y2={sy + 24} stroke={T.border} strokeWidth={1} opacity={fadeIn(frame, delay + 14, 8)} />
      {/* code thật (nếu có) */}
      {code && code.map((ln, i) => {
        const baseline = sy + 24 + 18 + i * lineH;
        const la = fadeIn(frame, delay + 16 + i * 4, 7);
        return (
          <g key={i} opacity={la}>
            <text x={sx + gutterW - 8} y={baseline} textAnchor="end" fill={T.gutter} fontFamily={MONO_FAMILY} fontSize={fs - 3}>{i + 1}</text>
            <text x={sx + gutterW} y={baseline} fontFamily={MONO_FAMILY} fontSize={fs} xmlSpace="preserve">
              {tokenizeCode(ln).map((t, j) => <tspan key={j} fill={t.color}>{t.text}</tspan>)}
            </text>
          </g>
        );
      })}
      {/* chân đế */}
      <L x1={cx} y1={top + h} x2={cx} y2={deskTop - 8} stroke={ink} sw={6} delay={delay + 10} dur={6} frame={frame} />
      <L x1={cx - 28} y1={deskTop - 6} x2={cx + 28} y2={deskTop - 6} stroke={ink} sw={6} delay={delay + 13} dur={7} frame={frame} />
    </g>
  );
};

/** Laptop nhìn nghiêng mở nắp, có bàn phím + màn hình nội dung. anchor=(cx, baseY). */
export const Laptop: React.FC<Ink & { cx: number; baseY: number; delay: number; scale?: number }> = ({ frame, ink, accent, cx, baseY, delay, scale = 1 }) => {
  const w = 128 * scale, h = 82 * scale;
  return (
    <g>
      {/* màn hình + viền + nội dung */}
      <Rect x={cx - w / 2} y={baseY - h} w={w} h={h} rx={8} stroke={ink} sw={5} delay={delay} dur={14} frame={frame} />
      <L x1={cx - w / 2 + 16} y1={baseY - h + 22} x2={cx - w / 2 + 16 + (w - 32) * 0.6} y2={baseY - h + 22} stroke={accent} sw={4} delay={delay + 10} dur={6} frame={frame} />
      <L x1={cx - w / 2 + 16} y1={baseY - h + 40} x2={cx - w / 2 + 16 + (w - 32) * 0.85} y2={baseY - h + 40} stroke={ink} sw={3} delay={delay + 12} dur={6} frame={frame} />
      <L x1={cx - w / 2 + 16} y1={baseY - h + 56} x2={cx - w / 2 + 16 + (w - 32) * 0.45} y2={baseY - h + 56} stroke={ink} sw={3} delay={delay + 14} dur={6} frame={frame} />
      {/* bàn phím (hình thang) + rãnh */}
      <P d={`M${cx - w / 2} ${baseY} l ${w} 0 l ${16 * scale} ${14 * scale} l ${-(w + 32 * scale)} 0 z`} stroke={ink} sw={5} delay={delay + 8} dur={12} frame={frame} />
      <L x1={cx - w / 2 + 8} y1={baseY + 7 * scale} x2={cx + w / 2 + 2 * scale} y2={baseY + 7 * scale} stroke={ink} sw={2} delay={delay + 16} dur={8} frame={frame} />
    </g>
  );
};

/** Chậu cây trang trí góc cảnh — thêm "đời sống" cho khung. */
export const Plant: React.FC<Ink & { cx: number; floor: number; delay: number; scale?: number }> = ({ frame, ink, accent, cx, floor, delay, scale = 1 }) => {
  const s = scale;
  const potTop = floor - 46 * s;
  return (
    <g>
      <ShadowBlob frame={frame} color={ink} cx={cx} cy={floor + 4} rx={36 * s} delay={delay + 14} />
      {/* chậu hình thang */}
      <P d={`M${cx - 28 * s} ${potTop} L ${cx + 28 * s} ${potTop} L ${cx + 22 * s} ${floor} L ${cx - 22 * s} ${floor} Z`} stroke={ink} sw={5} delay={delay + 6} dur={12} frame={frame} />
      <L x1={cx - 28 * s} y1={potTop} x2={cx + 28 * s} y2={potTop} stroke={ink} sw={5} delay={delay + 10} dur={6} frame={frame} />
      {/* lá — đung đưa nhẹ sau khi vẽ xong */}
      <g transform={`rotate(${(Math.sin(frame * 0.05) * 2.2 * fadeIn(frame, delay + 16, 12)).toFixed(2)} ${cx} ${potTop})`}>
        <P d={`M${cx} ${potTop} Q ${cx - 40 * s} ${potTop - 40 * s} ${cx - 10 * s} ${potTop - 70 * s}`} stroke={ink} sw={5} delay={delay} dur={12} frame={frame} />
        <P d={`M${cx} ${potTop} Q ${cx + 44 * s} ${potTop - 36 * s} ${cx + 12 * s} ${potTop - 74 * s}`} stroke={ink} sw={5} delay={delay + 2} dur={12} frame={frame} />
        <P d={`M${cx} ${potTop} Q ${cx + 4 * s} ${potTop - 50 * s} ${cx + 2 * s} ${potTop - 88 * s}`} stroke={accent} sw={5} delay={delay + 4} dur={12} frame={frame} />
      </g>
    </g>
  );
};

/** Nút đèn giao thông kiểu macOS (đỏ/vàng/xanh). */
const MAC_DOTS = ["#D1584B", "#DDA94A", "#6FB06A"] as const;

/** Cửa sổ code kiểu macOS: bo góc, thanh tiêu đề + 3 nút đèn + tên file, dòng code (dòng nhấn cam). */
export const CodeBlock: React.FC<Ink & { x: number; y: number; w: number; lines: number; delay: number; accentRows?: number[] }> = ({ frame, ink, accent, muted, x, y, w, lines, delay, accentRows = [] }) => {
  const bar = 40;
  const h = bar + lines * 26 + 18;
  const rowY = (i: number) => y + bar + 26 + i * 26;
  const rowW = (i: number) => (w - 48) * ([0.8, 0.55, 0.9, 0.45, 0.7, 0.6, 0.85, 0.5][i % 8] ?? 0.6);
  return (
    <g>
      {/* khung cửa sổ bo góc */}
      <Rect x={x} y={y} w={w} h={h} rx={16} stroke={ink} sw={5} delay={delay} dur={16} frame={frame} />
      {/* thanh tiêu đề */}
      <L x1={x} y1={y + bar} x2={x + w} y2={y + bar} stroke={ink} sw={3} delay={delay + 6} dur={10} frame={frame} />
      {/* 3 nút đèn giao thông đỏ/vàng/xanh */}
      {MAC_DOTS.map((c, i) => (
        <C key={i} cx={x + 24 + i * 22} cy={y + bar / 2} r={7} stroke={c} sw={2} fill={c} delay={delay + 4 + i} dur={5} frame={frame} />
      ))}
      {/* "tên file" ở giữa thanh tiêu đề (viên thuốc + gạch mờ) */}
      <Rect x={x + w / 2 - 70} y={y + bar / 2 - 11} w={140} h={22} rx={11} stroke={muted} sw={2} delay={delay + 10} dur={10} frame={frame} />
      <L x1={x + w / 2 - 44} y1={y + bar / 2} x2={x + w / 2 + 44} y2={y + bar / 2} stroke={muted} sw={3} delay={delay + 16} dur={8} frame={frame} />
      {/* dòng code */}
      {Array.from({ length: lines }).map((_, i) => {
        const on = accentRows.includes(i);
        return <L key={i} x1={x + 24 + (i % 2) * 16} y1={rowY(i)} x2={x + 24 + (i % 2) * 16 + rowW(i)} y2={rowY(i)} stroke={on ? accent : ink} sw={on ? 6 : 4} delay={delay + 12 + i * 4} dur={8} frame={frame} />;
      })}
      {/* con trỏ nháy cuối dòng cuối */}
      {(() => {
        const li = lines - 1;
        const cx0 = x + 24 + (li % 2) * 16 + rowW(li) + 10;
        const blink = Math.floor(frame / 16) % 2 === 0 ? 1 : 0;
        return <rect x={cx0} y={rowY(li) - 11} width={4} height={22} fill={accent} opacity={blink * fadeIn(frame, delay + 12 + lines * 4, 6)} />;
      })()}
    </g>
  );
};

/* ---- CodeWindow: cửa sổ editor TỐI, code THẬT + số dòng + tô màu cú pháp (kiểu VS Code/Mac) ---- */

const CODE_THEME = {
  bg: "#1E2A33", bar: "#16202733", border: "#33444F", gutter: "#5C7079",
  text: "#B9C6D1", kw: "#C792EA", str: "#C3E88D", tag: "#F07178",
  num: "#F78C6C", punct: "#7FD4E8", fn: "#82AAFF", com: "#5C6A72",
};

type Tok = { text: string; color: string };
function tokenizeCode(line: string): Tok[] {
  const T = CODE_THEME;
  const re = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b(?:import|from|export|const|let|var|function|return|async|await|if|else|new|res|req)\b)|(<\/?[A-Za-z][\w-]*|\/?>)|(\b\d+\b)|([{}()\[\];,.=><:+\-*/!?&|])|([A-Za-z_$][\w$]*)|(\s+)/g;
  const out: Tok[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) out.push({ text: m[1], color: T.com });
    else if (m[2]) out.push({ text: m[2], color: T.str });
    else if (m[3]) out.push({ text: m[3], color: T.kw });
    else if (m[4]) out.push({ text: m[4], color: T.tag });
    else if (m[5]) out.push({ text: m[5], color: T.num });
    else if (m[6]) out.push({ text: m[6], color: T.punct });
    else if (m[7]) out.push({ text: m[7], color: line[re.lastIndex] === "(" ? T.fn : T.text });
    else out.push({ text: m[8] ?? " ", color: T.text });
  }
  return out;
}

/**
 * CodeWindow — cửa sổ editor TỐI kiểu macOS: thanh tiêu đề (3 nút đèn + tên file), gutter số
 * dòng, code THẬT tô màu cú pháp, dòng nhấn (highlight), con trỏ nháy. Code hiện DẦN từng
 * dòng (như đang gõ). Dùng cho các cảnh "màn hình code".
 */
export const CodeWindow: React.FC<Ink & { x: number; y: number; w: number; delay: number; code: string[]; title?: string; highlight?: number[] }> = ({ frame, accent, x, y, w, delay, code, title = "index.js", highlight = [] }) => {
  const T = CODE_THEME;
  const fs = 19, lineH = 30, bar = 42, gutterW = 46;
  const h = bar + code.length * lineH + 18;
  const appear = fadeIn(frame, delay, 10);
  const scaleIn = interpolate(appear, [0, 1], [0.96, 1]);
  const charW = fs * 0.6;
  return (
    <g opacity={appear} transform={`translate(${x} ${y}) scale(${scaleIn}) translate(${-x} ${-y})`}>
      {/* khung tối + thanh tiêu đề */}
      <rect x={x} y={y} width={w} height={h} rx={14} fill={T.bg} stroke={T.border} strokeWidth={2} />
      <line x1={x} y1={y + bar} x2={x + w} y2={y + bar} stroke={T.border} strokeWidth={1.5} />
      {MAC_DOTS.map((c, i) => (
        <circle key={i} cx={x + 22 + i * 20} cy={y + bar / 2} r={6} fill={c} />
      ))}
      <text x={x + 90} y={y + bar / 2 + 6} fill={T.gutter} fontFamily={MONO_FAMILY} fontSize={16}>{title}</text>
      {/* dòng code hiện dần */}
      {code.map((ln, i) => {
        const ly = y + bar + 6 + i * lineH;
        const baseline = ly + fs - 2;
        const la = fadeIn(frame, delay + 8 + i * 5, 7);
        const isHi = highlight.includes(i);
        return (
          <g key={i} opacity={la}>
            {isHi && <rect x={x + 2} y={ly - 1} width={w - 4} height={lineH} fill={accent} opacity={0.14} />}
            {isHi && <rect x={x + 2} y={ly - 1} width={3} height={lineH} fill={accent} />}
            <text x={x + gutterW - 12} y={baseline} textAnchor="end" fill={T.gutter} fontFamily={MONO_FAMILY} fontSize={fs - 4}>{i + 1}</text>
            <text x={x + gutterW + 4} y={baseline} fontFamily={MONO_FAMILY} fontSize={fs} xmlSpace="preserve">
              {tokenizeCode(ln).map((t, j) => (
                <tspan key={j} fill={t.color}>{t.text}</tspan>
              ))}
            </text>
          </g>
        );
      })}
      {/* con trỏ nháy ở cuối dòng cuối */}
      {(() => {
        const li = code.length - 1;
        const last = code[li] ?? "";
        const cx0 = x + gutterW + 4 + last.length * charW + 2;
        const cy0 = y + bar + 6 + li * lineH + 3;
        const blink = Math.floor(frame / 16) % 2 === 0 ? 1 : 0;
        return <rect x={cx0} y={cy0} width={3} height={fs} fill={accent} opacity={blink * fadeIn(frame, delay + 8 + code.length * 5, 6)} />;
      })()}
    </g>
  );
};

/** Bong bóng thoại với đuôi; `fromRight` = đuôi ở đáy-phải. */
export const Bubble: React.FC<Ink & { x: number; y: number; w: number; h: number; delay: number; fromRight?: boolean; color?: string }> = ({ frame, ink, x, y, w, h, delay, fromRight = false, color }) => {
  const col = color ?? ink;
  const tx = fromRight ? x + w - 40 : x + 40;
  return (
    <g>
      <Rect x={x} y={y} w={w} h={h} rx={18} stroke={col} sw={5} delay={delay} dur={16} frame={frame} />
      <P d={`M${tx} ${y + h} l 10 26 l 22 -26`} stroke={col} sw={5} delay={delay + 10} dur={8} frame={frame} />
    </g>
  );
};

/** Robot/AI (đầu + thân + tay + đế) — hiện thân "AI". `cy` = tâm ĐẦU. Cao ~130·scale. */
export const Robot: React.FC<Ink & { cx: number; cy: number; delay: number; scale?: number; color?: string }> = ({ frame, ink, accent, cx, cy, delay, scale = 1, color }) => {
  const s = scale, col = color ?? ink;
  // nhịp sống: lắc nhẹ + đèn ăng-ten/đèn thân nhấp nháy, hiện sau khi vẽ xong
  const live = fadeIn(frame, delay + 24, 10);
  const bob = Math.sin(frame * 0.11) * 4 * s * live;
  const pulse = ((Math.sin(frame * 0.3) + 1) / 2) * live;
  return (
    <g>
      <ShadowBlob frame={frame} color={col} cx={cx} cy={cy + 108 * s} rx={48 * s} delay={delay + 20} />
      <g transform={`translate(0 ${bob.toFixed(2)})`}>
      {/* ăng-ten */}
      <L x1={cx} y1={cy - 26 * s} x2={cx} y2={cy - 44 * s} stroke={col} sw={5} delay={delay} dur={6} frame={frame} />
      <C cx={cx} cy={cy - 50 * s} r={6 * s} stroke={accent} sw={5} fill={accent} delay={delay + 2} dur={6} frame={frame} />
      <circle cx={cx} cy={cy - 50 * s} r={11 * s} fill={accent} opacity={0.4 * pulse} />
      {/* đầu + mắt + miệng */}
      <Rect x={cx - 35 * s} y={cy - 26 * s} w={70 * s} h={52 * s} rx={12} stroke={col} sw={5} delay={delay + 4} dur={14} frame={frame} />
      <C cx={cx - 14 * s} cy={cy - 2 * s} r={7 * s} stroke={col} sw={4} fill={col} delay={delay + 12} dur={6} frame={frame} />
      <C cx={cx + 14 * s} cy={cy - 2 * s} r={7 * s} stroke={col} sw={4} fill={col} delay={delay + 13} dur={6} frame={frame} />
      <P d={`M${cx - 12 * s} ${cy + 14 * s} Q ${cx} ${cy + 20 * s} ${cx + 12 * s} ${cy + 14 * s}`} stroke={col} sw={3} delay={delay + 15} dur={6} frame={frame} />
      {/* cổ */}
      <L x1={cx} y1={cy + 26 * s} x2={cx} y2={cy + 32 * s} stroke={col} sw={5} delay={delay + 10} dur={4} frame={frame} />
      {/* thân + bảng điều khiển + đèn */}
      <Rect x={cx - 42 * s} y={cy + 32 * s} w={84 * s} h={58 * s} rx={12} stroke={col} sw={5} delay={delay + 8} dur={16} frame={frame} />
      <L x1={cx - 24 * s} y1={cy + 50 * s} x2={cx + 24 * s} y2={cy + 50 * s} stroke={col} sw={3} delay={delay + 18} dur={6} frame={frame} />
      <C cx={cx} cy={cy + 70 * s} r={6 * s} stroke={accent} sw={4} fill={accent} delay={delay + 20} dur={6} frame={frame} />
      <circle cx={cx} cy={cy + 70 * s} r={11 * s} fill={accent} opacity={0.4 * (1 - pulse)} />
      {/* tay 2 bên */}
      <Limb a={[cx - 42 * s, cy + 44 * s]} b={[cx - 56 * s, cy + 56 * s]} c={[cx - 58 * s, cy + 76 * s]} hand delay={delay + 14} frame={frame} col={col} />
      <Limb a={[cx + 42 * s, cy + 44 * s]} b={[cx + 56 * s, cy + 56 * s]} c={[cx + 58 * s, cy + 76 * s]} hand delay={delay + 15} frame={frame} col={col} />
      {/* đế */}
      <P d={`M${cx - 38 * s} ${cy + 90 * s} L ${cx + 38 * s} ${cy + 90 * s} L ${cx + 48 * s} ${cy + 104 * s} L ${cx - 48 * s} ${cy + 104 * s} Z`} stroke={col} sw={5} delay={delay + 16} dur={12} frame={frame} />
      </g>
    </g>
  );
};

/** Đồng hồ treo tường; `hour` 0..12. Sau khi vẽ xong, KIM GIÂY (cam) quét liên tục. */
export const Clock: React.FC<Ink & { cx: number; cy: number; r: number; delay: number; hour?: number }> = ({ frame, ink, accent, cx, cy, r, delay, hour = 5 }) => {
  const a = (hour / 12) * Math.PI * 2;
  const hx = cx + Math.sin(a) * r * 0.5;
  const hy = cy - Math.cos(a) * r * 0.5;
  // kim giây quét 1 vòng mỗi ~4s (120 frame @30fps), hiện sau khi mặt đồng hồ vẽ xong
  const alive = fadeIn(frame, delay + 24, 10);
  const secA = (frame / 120) * Math.PI * 2;
  const sx = cx + Math.sin(secA) * r * 0.8;
  const sy = cy - Math.cos(secA) * r * 0.8;
  return (
    <g>
      <C cx={cx} cy={cy} r={r} stroke={ink} sw={5} delay={delay} dur={18} frame={frame} />
      {/* vạch giờ */}
      {[0, 3, 6, 9].map((h) => {
        const ta = (h / 12) * Math.PI * 2;
        return <L key={h} x1={cx + Math.sin(ta) * r * 0.82} y1={cy - Math.cos(ta) * r * 0.82} x2={cx + Math.sin(ta) * r * 0.94} y2={cy - Math.cos(ta) * r * 0.94} stroke={ink} sw={3} delay={delay + 6 + h} dur={5} frame={frame} />;
      })}
      <L x1={cx} y1={cy} x2={cx} y2={cy - r * 0.68} stroke={ink} sw={5} delay={delay + 12} dur={8} frame={frame} />
      <L x1={cx} y1={cy} x2={hx} y2={hy} stroke={ink} sw={6} delay={delay + 14} dur={8} frame={frame} />
      <line x1={cx} y1={cy} x2={sx} y2={sy} stroke={accent} strokeWidth={3} strokeLinecap="round" opacity={alive} />
      <C cx={cx} cy={cy} r={5} stroke={ink} sw={3} fill={ink} delay={delay + 12} dur={6} frame={frame} />
    </g>
  );
};

/** Đồng hồ bấm giờ (stopwatch) — kim quét nhanh sau khi vẽ xong. */
export const Stopwatch: React.FC<Ink & { cx: number; cy: number; r: number; delay: number }> = ({ frame, ink, accent, cx, cy, r, delay }) => {
  const live = fadeIn(frame, delay + 24, 8);
  const a = (frame / 45) * Math.PI * 2; // 1 vòng ~1.5s → cảm giác "đếm nhanh"
  return (
    <g>
      <L x1={cx} y1={cy - r - 18} x2={cx} y2={cy - r + 4} stroke={ink} sw={5} delay={delay} dur={6} frame={frame} />
      <L x1={cx - 18} y1={cy - r - 18} x2={cx + 18} y2={cy - r - 18} stroke={ink} sw={5} delay={delay + 1} dur={6} frame={frame} />
      <C cx={cx} cy={cy} r={r} stroke={ink} sw={5} delay={delay + 4} dur={18} frame={frame} />
      <line x1={cx} y1={cy} x2={cx + Math.sin(a) * r * 0.72} y2={cy - Math.cos(a) * r * 0.72} stroke={accent} strokeWidth={6} strokeLinecap="round" opacity={live} />
      <C cx={cx} cy={cy} r={4} stroke={ink} sw={3} fill={ink} delay={delay + 16} dur={5} frame={frame} />
    </g>
  );
};

/** Kính lúp (tay cầm hướng xuống-phải mặc định). */
export const Magnifier: React.FC<Ink & { cx: number; cy: number; r: number; delay: number; color?: string }> = ({ frame, ink, cx, cy, r, delay, color }) => {
  const col = color ?? ink;
  const hx = cx + r * 0.72, hy = cy + r * 0.72;
  return (
    <g>
      <C cx={cx} cy={cy} r={r} stroke={col} sw={6} delay={delay} dur={18} frame={frame} />
      <L x1={hx} y1={hy} x2={hx + r * 0.8} y2={hy + r * 0.8} stroke={col} sw={9} delay={delay + 14} dur={8} frame={frame} />
    </g>
  );
};

/** Con bug: thân oval + chân ngọ nguậy + râu. Sau khi vẽ xong thì rung/bò nhẹ. */
export const Bug: React.FC<Ink & { cx: number; cy: number; delay: number; scale?: number; color?: string }> = ({ frame, ink, cx, cy, delay, scale = 1, color }) => {
  const s = scale, col = color ?? ink;
  const rx = 22 * s, ry = 28 * s;
  const live = fadeIn(frame, delay + 16, 10);
  const ph = cx * 0.05; // lệch pha theo vị trí → bầy bug nhúc nhích không đồng loạt
  const jx = Math.sin(frame * 0.35 + ph) * 3 * s * live;
  const jy = Math.cos(frame * 0.3 + ph) * 2 * s * live;
  const wob = Math.sin(frame * 0.4 + ph) * 3 * live; // độ (rung chân/râu)
  const legW = Math.sin(frame * 0.6 + ph) * 4 * s * live; // chân vẫy
  return (
    <g transform={`translate(${jx.toFixed(2)} ${jy.toFixed(2)})`}>
      <P d={`M${cx} ${cy - ry} a ${rx} ${ry} 0 1 0 0.1 0 z`} stroke={col} sw={5} delay={delay} dur={14} frame={frame} />
      <L x1={cx} y1={cy - ry} x2={cx} y2={cy + ry} stroke={col} sw={3} delay={delay + 8} dur={8} frame={frame} />
      {[-1, 1].map((d) => (
        <g key={d}>
          <L x1={cx + d * rx * 0.7} y1={cy - 8 * s} x2={cx + d * rx * 1.7} y2={cy - 18 * s + legW} stroke={col} sw={4} delay={delay + 6} dur={8} frame={frame} />
          <L x1={cx + d * rx * 0.8} y1={cy + 6 * s} x2={cx + d * rx * 1.8} y2={cy + 8 * s - legW} stroke={col} sw={4} delay={delay + 7} dur={8} frame={frame} />
          <L x1={cx + d * rx * 0.7} y1={cy + 18 * s} x2={cx + d * rx * 1.6} y2={cy + 32 * s + legW} stroke={col} sw={4} delay={delay + 8} dur={8} frame={frame} />
          <L x1={cx + d * 7 * s} y1={cy - ry} x2={cx + d * 16 * s + wob} y2={cy - ry - 16 * s} stroke={col} sw={4} delay={delay + 4} dur={6} frame={frame} />
        </g>
      ))}
    </g>
  );
};

/** Bánh răng. */
export const Gear: React.FC<Ink & { cx: number; cy: number; r: number; delay: number; teeth?: number; color?: string; spin?: boolean }> = ({ frame, ink, cx, cy, r, delay, teeth = 8, color, spin = true }) => {
  const col = color ?? ink;
  const rot = spin ? (frame / 30) * 18 * fadeIn(frame, delay + 20, 12) : 0;
  return (
    <g transform={`rotate(${rot.toFixed(2)} ${cx} ${cy})`}>
      <C cx={cx} cy={cy} r={r} stroke={col} sw={5} delay={delay} dur={16} frame={frame} />
      <C cx={cx} cy={cy} r={r * 0.4} stroke={col} sw={4} delay={delay + 8} dur={10} frame={frame} />
      {Array.from({ length: teeth }).map((_, i) => {
        const a = (i / teeth) * Math.PI * 2;
        const x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
        const x2 = cx + Math.cos(a) * (r + 12), y2 = cy + Math.sin(a) * (r + 12);
        return <L key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} sw={5} delay={delay + 4 + i} dur={5} frame={frame} />;
      })}
    </g>
  );
};

/** Mũi tên thẳng. */
export const Arrow: React.FC<Ink & { x1: number; y1: number; x2: number; y2: number; delay: number; color?: string; sw?: number }> = ({ frame, ink, x1, y1, x2, y2, delay, color, sw = 6 }) => {
  const col = color ?? ink;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ah = 16;
  const axL = x2 - Math.cos(ang - 0.5) * ah, ayL = y2 - Math.sin(ang - 0.5) * ah;
  const axR = x2 - Math.cos(ang + 0.5) * ah, ayR = y2 - Math.sin(ang + 0.5) * ah;
  return (
    <g>
      <L x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} sw={sw} delay={delay} dur={10} frame={frame} />
      <P d={`M${axL} ${ayL} L ${x2} ${y2} L ${axR} ${ayR}`} stroke={col} sw={sw} delay={delay + 8} dur={6} frame={frame} />
    </g>
  );
};

/** Vòng lặp tròn (mũi tên cong) — quay tròn liên tục sau khi vẽ xong. */
export const LoopArrows: React.FC<Ink & { cx: number; cy: number; r: number; delay: number; color?: string }> = ({ frame, ink, cx, cy, r, delay, color }) => {
  const col = color ?? ink;
  const spin = (frame - (delay + 22)) * 0.7 * fadeIn(frame, delay + 22, 12);
  return (
    <g transform={`rotate(${spin.toFixed(2)} ${cx} ${cy})`}>
      <P d={`M${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r * 0.2} ${cy - r * 0.98}`} stroke={col} sw={6} delay={delay} dur={20} frame={frame} />
      <P d={`M${cx - r * 0.2} ${cy - r * 0.98} l -6 -22 l 26 6`} stroke={col} sw={6} delay={delay + 16} dur={6} frame={frame} />
    </g>
  );
};

/** Dấu hỏi lớn. */
export const Question: React.FC<Ink & { cx: number; cy: number; size: number; delay: number; color?: string }> = ({ frame, ink, accent, cx, cy, size, delay, color }) => {
  const col = color ?? accent;
  const s = size / 100;
  return (
    <g>
      <P d={`M${cx - 26 * s} ${cy - 20 * s} a ${30 * s} ${30 * s} 0 1 1 ${44 * s} ${26 * s} q ${-18 * s} ${12 * s} ${-18 * s} ${30 * s}`} stroke={col} sw={9 * s} delay={delay} dur={18} frame={frame} />
      <C cx={cx} cy={cy + 60 * s} r={5 * s} stroke={col} sw={8 * s} fill={col} delay={delay + 16} dur={6} frame={frame} />
    </g>
  );
};

/** Cúp vô địch. */
export const Trophy: React.FC<Ink & { cx: number; cy: number; delay: number; scale?: number; color?: string }> = ({ frame, ink, accent, cx, cy, delay, scale = 1, color }) => {
  const s = scale, col = color ?? ink;
  return (
    <g>
      <P d={`M${cx - 44 * s} ${cy - 50 * s} L ${cx + 44 * s} ${cy - 50 * s} L ${cx + 36 * s} ${cy} q 0 ${26 * s} ${-36 * s} ${26 * s} q ${-36 * s} 0 ${-36 * s} ${-26 * s} z`} stroke={col} sw={5} delay={delay} dur={18} frame={frame} />
      <P d={`M${cx - 44 * s} ${cy - 44 * s} q ${-30 * s} 0 ${-30 * s} ${24 * s} q 0 ${18 * s} ${30 * s} ${18 * s}`} stroke={col} sw={5} delay={delay + 8} dur={12} frame={frame} />
      <P d={`M${cx + 44 * s} ${cy - 44 * s} q ${30 * s} 0 ${30 * s} ${24 * s} q 0 ${18 * s} ${-30 * s} ${18 * s}`} stroke={col} sw={5} delay={delay + 9} dur={12} frame={frame} />
      <L x1={cx} y1={cy + 26 * s} x2={cx} y2={cy + 50 * s} stroke={col} sw={5} delay={delay + 14} dur={8} frame={frame} />
      <L x1={cx - 34 * s} y1={cy + 56 * s} x2={cx + 34 * s} y2={cy + 56 * s} stroke={col} sw={6} delay={delay + 16} dur={8} frame={frame} />
      <P d={`M${cx - 14 * s} ${cy - 30 * s} l ${8 * s} ${16 * s} l ${18 * s} ${2 * s} l ${-13 * s} ${12 * s} l ${4 * s} ${18 * s} l ${-17 * s} ${-9 * s} l ${-17 * s} ${9 * s} l ${4 * s} ${-18 * s} l ${-13 * s} ${-12 * s} l ${18 * s} ${-2 * s} z`} stroke={accent} sw={4} delay={delay + 18} dur={10} frame={frame} />
    </g>
  );
};

/** Tên lửa bay chéo lên-phải + lửa cam phụt (nhấp nháy) + bay bồng bềnh. */
export const Rocket: React.FC<Ink & { cx: number; cy: number; delay: number; scale?: number }> = ({ frame, ink, accent, cx, cy, delay, scale = 1 }) => {
  const s = scale;
  const live = fadeIn(frame, delay + 24, 10);
  const hover = Math.sin(frame * 0.12) * 5 * live;        // bồng bềnh
  const flick = 1 + Math.sin(frame * 0.8) * 0.28 * live;  // lửa dài/ngắn
  return (
    <g transform={`translate(${(-hover).toFixed(2)} ${hover.toFixed(2)}) rotate(45 ${cx} ${cy})`}>
      <P d={`M${cx} ${cy - 70 * s} q ${34 * s} ${40 * s} 0 ${110 * s} q ${-34 * s} ${-70 * s} 0 ${-110 * s} z`} stroke={ink} sw={5} delay={delay} dur={18} frame={frame} />
      <C cx={cx} cy={cy - 20 * s} r={13 * s} stroke={ink} sw={4} delay={delay + 12} dur={10} frame={frame} />
      <P d={`M${cx - 18 * s} ${cy + 20 * s} l ${-24 * s} ${24 * s} l ${24 * s} ${2 * s}`} stroke={ink} sw={5} delay={delay + 10} dur={8} frame={frame} />
      <P d={`M${cx + 18 * s} ${cy + 20 * s} l ${24 * s} ${24 * s} l ${-24 * s} ${2 * s}`} stroke={ink} sw={5} delay={delay + 11} dur={8} frame={frame} />
      <P d={`M${cx - 12 * s} ${cy + 42 * s} q ${12 * s} ${40 * s} ${12 * s} ${54 * s} q 0 ${-14 * s} ${12 * s} ${-54 * s}`} stroke={accent} sw={5} delay={delay + 16} dur={12} frame={frame} />
      {live > 0 && <path d={`M${cx - 7 * s} ${cy + 44 * s} q ${7 * s} ${30 * s * flick} ${7 * s} ${40 * s * flick} q 0 ${-10 * s} ${7 * s} ${-40 * s * flick}`} stroke={accent} strokeWidth={4} fill="none" strokeLinecap="round" opacity={live} />}
    </g>
  );
};

/** Gương/khung chân dung (cho "soi chính mình"). */
export const Mirror: React.FC<Ink & { cx: number; cy: number; delay: number; color?: string }> = ({ frame, ink, cx, cy, delay, color }) => {
  const col = color ?? ink;
  return (
    <g>
      <P d={`M${cx} ${cy - 90} a 70 90 0 1 0 0.1 0 z`} stroke={col} sw={6} delay={delay} dur={20} frame={frame} />
      <P d={`M${cx} ${cy - 66} a 46 64 0 1 0 0.1 0 z`} stroke={col} sw={3} delay={delay + 10} dur={14} frame={frame} />
    </g>
  );
};

/* =========================== MÔI TRƯỜNG / BỐI CẢNH ========================= *
 * Dùng cho phong cách "cảnh môi trường đầy khung": hậu cảnh (tường + cửa sổ + kệ) →
 * trung cảnh (bàn ghế + nhân vật) → tiền cảnh (thảm + cây + đồ nhỏ). Toạ độ theo viewBox
 * CAO 1000×1300 (SEAM tường/sàn ≈ 1040). Shading bằng Hatch (pattern chéo, rẻ + như khắc).
 * ------------------------------------------------------------------------- */

/** Đổ bóng gạch (cross-hatch) tô một vùng chữ nhật — như khắc, tạo khối. */
export const Hatch: React.FC<{ frame: number; x: number; y: number; w: number; h: number; delay: number; gap?: number; opacity?: number; color?: string; angle?: number }> = ({ frame, x, y, w, h, delay, gap = 13, opacity = 0.14, color = "#232019", angle = 45 }) => {
  const id = `hx${Math.round(x)}_${Math.round(y)}_${Math.round(w)}_${Math.round(angle)}`;
  return (
    <g opacity={opacity * fadeIn(frame, delay, 16)}>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform={`rotate(${angle})`}>
          <line x1={0} y1={0} x2={0} y2={gap} stroke={color} strokeWidth={1.5} />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
    </g>
  );
};

/** Nền phòng: tường (trên) + sàn (dưới) + chân tường + ván sàn ngang mờ. */
export const RoomBG: React.FC<Ink & { seam: number; delay: number; vw?: number; vh?: number }> = ({ frame, ink, muted, seam, delay, vw = 1000, vh = 1300 }) => (
  <g>
    {/* đường tường gặp sàn */}
    <L x1={20} y1={seam} x2={vw - 20} y2={seam} stroke={ink} sw={5} delay={delay} dur={18} frame={frame} />
    {/* chân tường */}
    <L x1={20} y1={seam + 16} x2={vw - 20} y2={seam + 16} stroke={muted} sw={3} delay={delay + 6} dur={16} frame={frame} />
    {/* vài ván sàn ngang mờ cho chiều sâu (không cắt chéo) */}
    <L x1={60} y1={seam + (vh - seam) * 0.42} x2={vw - 60} y2={seam + (vh - seam) * 0.42} stroke={muted} sw={2} delay={delay + 12} dur={16} frame={frame} />
    <L x1={40} y1={seam + (vh - seam) * 0.74} x2={vw - 40} y2={seam + (vh - seam) * 0.74} stroke={muted} sw={2} delay={delay + 14} dur={16} frame={frame} />
  </g>
);

/** Cửa sổ treo tường, có khung kép + nan + cảnh ngoài (city skyline hoặc mưa). */
export const Window: React.FC<Ink & { x: number; y: number; w: number; h: number; delay: number; view?: "city" | "rain" }> = ({ frame, ink, accent, muted, x, y, w, h, delay, view = "city" }) => (
  <g>
    <Rect x={x - 8} y={y - 8} w={w + 16} h={h + 16} rx={6} stroke={ink} sw={5} delay={delay} dur={16} frame={frame} />
    <Rect x={x} y={y} w={w} h={h} rx={2} stroke={ink} sw={4} delay={delay + 4} dur={14} frame={frame} />
    <L x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke={ink} sw={4} delay={delay + 10} dur={10} frame={frame} />
    <L x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={ink} sw={4} delay={delay + 11} dur={10} frame={frame} />
    {view === "city" ? (
      <g>
        {/* skyline */}
        <P d={`M${x + 8} ${y + h - 6} V ${y + h * 0.5} h ${w * 0.16} V ${y + h * 0.3} h ${w * 0.12} V ${y + h * 0.62} h ${w * 0.14} V ${y + h * 0.42} h ${w * 0.16} V ${y + h - 6}`} stroke={muted} sw={3} delay={delay + 14} dur={18} frame={frame} />
        <C cx={x + w - 24} cy={y + 24} r={12} stroke={accent} sw={3} delay={delay + 18} dur={10} frame={frame} />
      </g>
    ) : (
      <g>
        {[0, 1, 2, 3, 4].map((i) => (
          <L key={i} x1={x + 12 + i * (w / 5)} y1={y + 10} x2={x + 12 + i * (w / 5) - 14} y2={y + h - 10} stroke={muted} sw={2} delay={delay + 14 + i} dur={10} frame={frame} />
        ))}
      </g>
    )}
  </g>
);

/** Kệ sách treo tường: giá + sách đứng cao thấp + chậu cây nhỏ + hộp. */
export const Shelf: React.FC<Ink & { x: number; y: number; w: number; delay: number }> = ({ frame, ink, accent, x, y, w, delay }) => (
  <g>
    <L x1={x} y1={y} x2={x + w} y2={y} stroke={ink} sw={6} delay={delay} dur={12} frame={frame} />
    <L x1={x + 10} y1={y} x2={x + 10} y2={y + 10} stroke={ink} sw={3} delay={delay + 4} dur={5} frame={frame} />
    <L x1={x + w - 10} y1={y} x2={x + w - 10} y2={y + 10} stroke={ink} sw={3} delay={delay + 5} dur={5} frame={frame} />
    {/* sách nghiêng/đứng */}
    {[0, 1, 2, 3].map((i) => {
      const bx = x + 16 + i * 26;
      const bh = [54, 44, 60, 40][i] ?? 48;
      return <Rect key={i} x={bx} y={y - bh} w={18} h={bh} rx={2} stroke={i === 2 ? accent : ink} sw={4} delay={delay + 6 + i * 3} dur={10} frame={frame} />;
    })}
    {/* hộp */}
    <Rect x={x + w - 56} y={y - 36} w={44} h={36} rx={4} stroke={ink} sw={4} delay={delay + 16} dur={10} frame={frame} />
    <L x1={x + w - 56} y1={y - 20} x2={x + w - 12} y2={y - 20} stroke={ink} sw={2} delay={delay + 22} dur={6} frame={frame} />
  </g>
);

/** Tranh/poster treo tường trong khung. kind: "mountain" | "lines" | "chart". */
export const WallArt: React.FC<Ink & { x: number; y: number; w: number; h: number; delay: number; kind?: "mountain" | "lines" | "chart" }> = ({ frame, ink, accent, muted, x, y, w, h, delay, kind = "mountain" }) => (
  <g>
    <Rect x={x} y={y} w={w} h={h} rx={4} stroke={ink} sw={5} delay={delay} dur={14} frame={frame} />
    {kind === "mountain" && (
      <g>
        <P d={`M${x + 8} ${y + h - 10} L ${x + w * 0.4} ${y + h * 0.35} L ${x + w * 0.6} ${y + h * 0.6} L ${x + w * 0.8} ${y + h * 0.3} L ${x + w - 8} ${y + h - 10}`} stroke={muted} sw={3} delay={delay + 8} dur={14} frame={frame} />
        <C cx={x + w * 0.72} cy={y + h * 0.26} r={9} stroke={accent} sw={3} delay={delay + 16} dur={8} frame={frame} />
      </g>
    )}
    {kind === "lines" && [0, 1, 2].map((i) => (
      <L key={i} x1={x + 14} y1={y + 18 + i * 16} x2={x + w - 14 - i * 10} y2={y + 18 + i * 16} stroke={i === 0 ? accent : muted} sw={3} delay={delay + 8 + i * 3} dur={8} frame={frame} />
    ))}
    {kind === "chart" && (
      <g>
        {[0, 1, 2, 3].map((i) => {
          const bh = [20, 34, 26, 44][i] ?? 24;
          return <L key={i} x1={x + 16 + i * ((w - 32) / 4)} y1={y + h - 12} x2={x + 16 + i * ((w - 32) / 4)} y2={y + h - 12 - bh} stroke={i === 3 ? accent : muted} sw={6} delay={delay + 8 + i * 3} dur={8} frame={frame} />;
        })}
      </g>
    )}
  </g>
);

/** Thảm elip trên sàn (có viền trong). */
export const Rug: React.FC<Ink & { cx: number; cy: number; rx: number; delay: number; ry?: number }> = ({ frame, muted, cx, cy, rx, delay, ry }) => {
  const r2 = ry ?? rx * 0.3;
  return (
    <g>
      <P d={`M${cx - rx} ${cy} a ${rx} ${r2} 0 1 0 ${2 * rx} 0 a ${rx} ${r2} 0 1 0 ${-2 * rx} 0`} stroke={muted} sw={3} delay={delay} dur={16} frame={frame} />
      <P d={`M${cx - rx * 0.7} ${cy} a ${rx * 0.7} ${r2 * 0.7} 0 1 0 ${1.4 * rx} 0 a ${rx * 0.7} ${r2 * 0.7} 0 1 0 ${-1.4 * rx} 0`} stroke={muted} sw={2} delay={delay + 8} dur={14} frame={frame} />
    </g>
  );
};

/** Đèn bàn kiểu cần gập. */
export const DeskLamp: React.FC<Ink & { baseX: number; baseY: number; delay: number; mirror?: boolean }> = ({ frame, ink, accent, baseX, baseY, delay, mirror = false }) => {
  const m = mirror ? -1 : 1;
  return (
    <g>
      <L x1={baseX - 16} y1={baseY} x2={baseX + 16} y2={baseY} stroke={ink} sw={5} delay={delay} dur={6} frame={frame} />
      <P d={`M${baseX} ${baseY} L ${baseX + 14 * m} ${baseY - 44} L ${baseX + 44 * m} ${baseY - 70}`} stroke={ink} sw={5} delay={delay + 4} dur={12} frame={frame} />
      <P d={`M${baseX + 44 * m} ${baseY - 70} l ${18 * m} ${-14} l ${8 * m} ${18} z`} stroke={ink} sw={4} delay={delay + 12} dur={8} frame={frame} />
      <C cx={baseX + 54 * m} cy={baseY - 62} r={4} stroke={accent} sw={4} fill={accent} delay={delay + 18} dur={6} frame={frame} />
    </g>
  );
};

/** Cốc cà phê + hơi bốc lên liên tục (loop). */
export const Mug: React.FC<Ink & { x: number; y: number; delay: number; scale?: number }> = ({ frame, ink, muted, x, y, delay, scale = 1 }) => {
  const s = scale;
  const live = fadeIn(frame, delay + 20, 10);
  // hơi bay lên theo chu kỳ: 2 vệt lệch pha, càng lên càng mờ
  const steam = (col: number, phase: number) => {
    const p = ((frame * 0.02 + phase) % 1 + 1) % 1;
    const rise = p * 26 * s;
    const op = Math.sin(p * Math.PI) * live;
    const sx = x + col * s;
    return <path d={`M${sx} ${y - 6 * s - rise} q ${7 * s} ${-9 * s} 0 ${-18 * s}`} stroke={muted} strokeWidth={3} fill="none" strokeLinecap="round" opacity={op} />;
  };
  return (
    <g>
      <P d={`M${x} ${y} L ${x} ${y + 34 * s} q 0 ${8 * s} ${10 * s} ${8 * s} L ${x + 24 * s} ${y + 42 * s} q ${10 * s} 0 ${10 * s} ${-8 * s} L ${x + 34 * s} ${y}`} stroke={ink} sw={5} delay={delay} dur={12} frame={frame} />
      <L x1={x} y1={y} x2={x + 34 * s} y2={y} stroke={ink} sw={5} delay={delay + 6} dur={6} frame={frame} />
      <P d={`M${x + 34 * s} ${y + 6 * s} q ${16 * s} 0 ${16 * s} ${14 * s} q 0 ${12 * s} ${-16 * s} ${12 * s}`} stroke={ink} sw={4} delay={delay + 8} dur={8} frame={frame} />
      {steam(12, 0)}
      {steam(22, 0.5)}
    </g>
  );
};

/** Chồng sách/giấy trên bàn. */
export const Books: React.FC<Ink & { x: number; y: number; delay: number; scale?: number }> = ({ frame, ink, accent, x, y, delay, scale = 1 }) => {
  const s = scale;
  return (
    <g>
      <Rect x={x} y={y} w={70 * s} h={14 * s} rx={2} stroke={ink} sw={4} delay={delay} dur={8} frame={frame} />
      <Rect x={x + 6 * s} y={y - 13 * s} w={64 * s} h={14 * s} rx={2} stroke={accent} sw={4} delay={delay + 4} dur={8} frame={frame} />
      <Rect x={x - 2 * s} y={y - 26 * s} w={72 * s} h={14 * s} rx={2} stroke={ink} sw={4} delay={delay + 8} dur={8} frame={frame} />
    </g>
  );
};

/** Doodle: tia sáng nhỏ (★ 4 cánh). */
export const Sparkle: React.FC<{ frame: number; cx: number; cy: number; delay: number; r?: number; color?: string }> = ({ frame, cx, cy, delay, r = 14, color = "#BE5A38" }) => (
  <P d={`M${cx} ${cy - r} Q ${cx + r * 0.2} ${cy - r * 0.2} ${cx + r} ${cy} Q ${cx + r * 0.2} ${cy + r * 0.2} ${cx} ${cy + r} Q ${cx - r * 0.2} ${cy + r * 0.2} ${cx - r} ${cy} Q ${cx - r * 0.2} ${cy - r * 0.2} ${cx} ${cy - r} Z`} stroke={color} sw={4} fill={color} delay={delay} dur={8} frame={frame} />
);

/** Doodle: vệt chuyển động (mấy gạch ngang). */
export const MotionLines: React.FC<{ frame: number; x: number; y: number; delay: number; len?: number; color?: string; gap?: number }> = ({ frame, x, y, delay, len = 40, color = "#6E6858", gap = 12 }) => (
  <g>
    {[0, 1, 2].map((i) => (
      <L key={i} x1={x} y1={y + i * gap} x2={x + len - i * 8} y2={y + i * gap} stroke={color} sw={3} delay={delay + i * 2} dur={6} frame={frame} />
    ))}
  </g>
);

/* =========================== TIỀN BẠC / SỰ NGHIỆP ========================= */

/** Tờ tiền: khung + vòng tròn giữa + ký hiệu ₫ + góc. */
export const Cash: React.FC<Ink & { x: number; y: number; delay: number; scale?: number }> = ({ frame, ink, accent, x, y, delay, scale = 1 }) => {
  const s = scale, w = 84 * s, h = 46 * s, cx = x + w / 2, cy = y + h / 2;
  return (
    <g>
      <Rect x={x} y={y} w={w} h={h} rx={6} stroke={ink} sw={4} delay={delay} dur={12} frame={frame} />
      <C cx={cx} cy={cy} r={13 * s} stroke={accent} sw={3} delay={delay + 6} dur={8} frame={frame} />
      {/* ₫ */}
      <L x1={cx} y1={cy - 9 * s} x2={cx} y2={cy + 9 * s} stroke={accent} sw={3} delay={delay + 10} dur={5} frame={frame} />
      <L x1={cx - 5 * s} y1={cy - 9 * s} x2={cx + 5 * s} y2={cy - 9 * s} stroke={accent} sw={3} delay={delay + 11} dur={4} frame={frame} />
      <L x1={cx - 6 * s} y1={cy + 4 * s} x2={cx + 6 * s} y2={cy + 4 * s} stroke={accent} sw={3} delay={delay + 12} dur={4} frame={frame} />
      <C cx={x + 12 * s} cy={y + 11 * s} r={4 * s} stroke={ink} sw={2} delay={delay + 8} dur={4} frame={frame} />
      <C cx={x + w - 12 * s} cy={y + h - 11 * s} r={4 * s} stroke={ink} sw={2} delay={delay + 9} dur={4} frame={frame} />
    </g>
  );
};

/** Chồng xu (coin stack) — n đồng xếp lên, đồng trên cùng nhấn cam. */
export const MoneyStack: React.FC<Ink & { cx: number; baseY: number; delay: number; scale?: number; n?: number }> = ({ frame, ink, accent, cx, baseY, delay, scale = 1, n = 4 }) => {
  const s = scale, rx = 34 * s, ry = 10 * s, gap = 15 * s;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const cy = baseY - i * gap;
        const col = i === n - 1 ? accent : ink;
        return <P key={i} d={`M${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`} stroke={col} sw={4} delay={delay + i * 4} dur={10} frame={frame} />;
      })}
      <text x={cx} y={baseY - (n - 1) * gap + 6 * s} textAnchor="middle" fill={accent} fontSize={22 * s} fontWeight={800} opacity={fadeIn(frame, delay + n * 4 + 4, 8)}>₫</text>
    </g>
  );
};

/** Cân thăng bằng — `tilt` rad (>0: vế phải nặng/chúc xuống). Đặt đồ lên 2 đĩa qua children-less; toạ độ đĩa trả về khó, nên vẽ sẵn 2 đĩa, cảnh đặt đồ gần panL/panR. */
export const Scale: React.FC<Ink & { cx: number; cy: number; delay: number; tilt?: number }> = ({ frame, ink, cx, cy, delay, tilt = 0.14 }) => {
  const half = 150;
  const lx = cx - half * Math.cos(tilt), ly = cy - half * Math.sin(tilt);
  const rx = cx + half * Math.cos(tilt), ry = cy + half * Math.sin(tilt);
  const pan = (px: number, py: number, d: number) => (
    <g>
      <L x1={px} y1={py} x2={px} y2={py + 36} stroke={ink} sw={3} delay={d} dur={8} frame={frame} />
      <P d={`M${px - 40} ${py + 36} a 40 20 0 0 0 80 0`} stroke={ink} sw={4} delay={d + 4} dur={10} frame={frame} />
    </g>
  );
  return (
    <g>
      {/* trụ + đế */}
      <L x1={cx} y1={cy} x2={cx} y2={cy + 150} stroke={ink} sw={6} delay={delay} dur={12} frame={frame} />
      <L x1={cx - 54} y1={cy + 150} x2={cx + 54} y2={cy + 150} stroke={ink} sw={6} delay={delay + 6} dur={8} frame={frame} />
      {/* xà cân */}
      <L x1={lx} y1={ly} x2={rx} y2={ry} stroke={ink} sw={5} delay={delay + 4} dur={14} frame={frame} />
      <C cx={cx} cy={cy} r={6} stroke={ink} sw={4} fill={ink} delay={delay + 2} dur={5} frame={frame} />
      {pan(lx, ly, delay + 10)}
      {pan(rx, ry, delay + 12)}
    </g>
  );
};

/** Đồ thị đi lên (trục + đường tăng + mũi tên). */
export const Graph: React.FC<Ink & { x: number; y: number; w: number; h: number; delay: number }> = ({ frame, ink, accent, x, y, w, h, delay }) => {
  const ex = x + w, ey = y + h * 0.12;
  return (
    <g>
      <L x1={x} y1={y} x2={x} y2={y + h} stroke={ink} sw={4} delay={delay} dur={10} frame={frame} />
      <L x1={x} y1={y + h} x2={x + w} y2={y + h} stroke={ink} sw={4} delay={delay + 4} dur={10} frame={frame} />
      <P d={`M${x + 8} ${y + h - 14} C ${x + w * 0.4} ${y + h - 20} ${x + w * 0.55} ${y + h * 0.5} ${ex} ${ey}`} stroke={accent} sw={6} delay={delay + 10} dur={20} frame={frame} />
      <P d={`M${ex - 18} ${ey - 4} L ${ex} ${ey} L ${ex - 6} ${ey + 18}`} stroke={accent} sw={6} delay={delay + 26} dur={6} frame={frame} />
    </g>
  );
};

/** Tờ giấy / văn bản (offer) — khung + gấp góc + dòng chữ + ký ₫ tuỳ chọn. */
export const Doc: React.FC<Ink & { x: number; y: number; w: number; h: number; delay: number; money?: boolean }> = ({ frame, ink, accent, x, y, w, h, delay, money = false }) => (
  <g>
    <P d={`M${x} ${y} L ${x + w - 16} ${y} L ${x + w} ${y + 16} L ${x + w} ${y + h} L ${x} ${y + h} Z`} stroke={ink} sw={4} delay={delay} dur={14} frame={frame} />
    <P d={`M${x + w - 16} ${y} L ${x + w - 16} ${y + 16} L ${x + w} ${y + 16}`} stroke={ink} sw={3} delay={delay + 8} dur={6} frame={frame} />
    <L x1={x + 12} y1={y + 24} x2={x + w - 14} y2={y + 24} stroke={ink} sw={3} delay={delay + 10} dur={6} frame={frame} />
    <L x1={x + 12} y1={y + 40} x2={x + w - 24} y2={y + 40} stroke={ink} sw={3} delay={delay + 12} dur={6} frame={frame} />
    {money && <text x={x + w / 2} y={y + h - 14} textAnchor="middle" fill={accent} fontSize={26} fontWeight={800} opacity={fadeIn(frame, delay + 16, 8)}>₫</text>}
  </g>
);
