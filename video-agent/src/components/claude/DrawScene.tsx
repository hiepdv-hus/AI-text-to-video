import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene } from "../../schema";
import { TEXT_STACK } from "../textStack";
import { useTheme } from "../../theme/claude";
import {
  P, L, C, Rect, fadeIn, type Ink,
  Figure, SitFigure, Desk, Monitor, CodeWindow, Bubble, Robot,
  Clock, Stopwatch, Magnifier, Bug, Gear, Arrow, LoopArrows, Question, Trophy, Rocket, Mirror,
  Plant, RoomBG, Window, Shelf, WallArt, Hatch, Rug, DeskLamp, Mug, Books, Sparkle, MotionLines,
  Cash, MoneyStack, Scale, Graph, Doc,
} from "./DrawKit";

/** Khung vẽ CAO cho phong cách "cảnh môi trường đầy khung" (lấp trên→dưới). */
const VW = 1000, VH = 1160, SEAM = 940;

/**
 * DrawScene — layout "draw": TRANH NÉT TỰ VẼ (line-art editorial, nền giấy).
 * Mỗi cảnh là một bức SVG hiện dần theo lời kể. Chọn bức qua `scene.art`.
 * Xem bộ bút vẽ + primitive ở DrawKit.tsx.
 */

/* --------------------------- helper icon nhỏ ----------------------------- */

const XMark: React.FC<Ink & { cx: number; cy: number; r: number; delay: number; color?: string }> = ({ frame, muted, cx, cy, r, delay, color }) => {
  const col = color ?? muted;
  return (<g>
    <L x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} stroke={col} sw={7} delay={delay} dur={8} frame={frame} />
    <L x1={cx + r} y1={cy - r} x2={cx - r} y2={cy + r} stroke={col} sw={7} delay={delay + 6} dur={8} frame={frame} />
  </g>);
};
const Check: React.FC<Ink & { cx: number; cy: number; r: number; delay: number; color?: string }> = ({ frame, accent, cx, cy, r, delay, color }) => (
  <P d={`M${cx - r} ${cy} l ${r * 0.7} ${r * 0.8} l ${r * 1.4} ${-r * 1.6}`} stroke={color ?? accent} sw={7} delay={delay} dur={10} frame={frame} />
);
const Cylinder: React.FC<Ink & { cx: number; cy: number; w: number; h: number; delay: number }> = ({ frame, ink, cx, cy, w, h, delay }) => (<g>
  <P d={`M${cx - w / 2} ${cy - h / 2} a ${w / 2} 14 0 1 0 ${w} 0 a ${w / 2} 14 0 1 0 ${-w} 0`} stroke={ink} sw={5} delay={delay} dur={14} frame={frame} />
  <L x1={cx - w / 2} y1={cy - h / 2} x2={cx - w / 2} y2={cy + h / 2} stroke={ink} sw={5} delay={delay + 6} dur={10} frame={frame} />
  <L x1={cx + w / 2} y1={cy - h / 2} x2={cx + w / 2} y2={cy + h / 2} stroke={ink} sw={5} delay={delay + 7} dur={10} frame={frame} />
  <P d={`M${cx - w / 2} ${cy + h / 2} a ${w / 2} 14 0 0 0 ${w} 0`} stroke={ink} sw={5} delay={delay + 10} dur={10} frame={frame} />
</g>);
const Lock: React.FC<Ink & { cx: number; cy: number; delay: number }> = ({ frame, ink, accent, cx, cy, delay }) => (<g>
  <P d={`M${cx - 22} ${cy - 6} v -16 a 22 22 0 0 1 44 0 v 16`} stroke={ink} sw={5} delay={delay} dur={12} frame={frame} />
  <Rect x={cx - 34} y={cy - 6} w={68} h={56} rx={10} stroke={ink} sw={5} delay={delay + 8} dur={12} frame={frame} />
  <C cx={cx} cy={cy + 18} r={6} stroke={accent} sw={4} fill={accent} delay={delay + 16} dur={6} frame={frame} />
</g>);
const Server: React.FC<Ink & { cx: number; cy: number; delay: number }> = ({ frame, ink, accent, cx, cy, delay }) => (<g>
  {[0, 1, 2].map((i) => (<g key={i}>
    <Rect x={cx - 46} y={cy - 54 + i * 38} w={92} h={30} rx={6} stroke={ink} sw={5} delay={delay + i * 4} dur={12} frame={frame} />
    <C cx={cx + 32} cy={cy - 39 + i * 38} r={4} stroke={accent} sw={3} fill={accent} delay={delay + 6 + i * 4} dur={5} frame={frame} />
  </g>))}
</g>);
const MiniCode: React.FC<Ink & { cx: number; cy: number; delay: number }> = ({ frame, ink, cx, cy, delay }) => (<g>
  <Rect x={cx - 40} y={cy - 32} w={80} h={64} rx={8} stroke={ink} sw={4} delay={delay} dur={10} frame={frame} />
  <L x1={cx - 28} y1={cy - 10} x2={cx + 14} y2={cy - 10} stroke={ink} sw={3} delay={delay + 6} dur={5} frame={frame} />
  <L x1={cx - 28} y1={cy + 6} x2={cx + 22} y2={cy + 6} stroke={ink} sw={3} delay={delay + 8} dur={5} frame={frame} />
</g>);

/* ============================== CÁC CẢNH ================================= */
/* Phong cách "môi trường đầy khung" (viewBox 1000×1160, SEAM 940): hậu cảnh (tường +
 * cửa sổ/tranh/kệ) → trung cảnh (bàn ghế + nhân vật/khái niệm) → tiền cảnh (thảm + cây). */

/** Nền phòng dùng chung: tường + sàn + thảm + chậu cây góc trái. */
const Base: React.FC<Ink & { plant?: boolean }> = (k) => (<g>
  <RoomBG {...k} seam={SEAM} delay={0} vw={VW} vh={VH} />
  <Rug {...k} cx={500} cy={SEAM + 120} rx={370} delay={14} />
  {(k.plant ?? true) && <Plant {...k} cx={116} floor={SEAM} delay={20} scale={1.15} />}
</g>);

/** Bàn làm việc chuẩn (mặt bàn 832, rộng 440 quanh tâm 520) + bóng gạch dưới. */
const DeskBase: React.FC<Ink & { delay?: number }> = (k) => (<g>
  <Hatch frame={k.frame} x={300} y={SEAM} w={440} h={32} delay={(k.delay ?? 18) + 20} opacity={0.1} />
  <Desk {...k} x={300} floor={SEAM} w={440} delay={k.delay ?? 18} />
</g>);

const AiBuildsSystem: React.FC<Ink> = (k) => (<g>
  <RoomBG {...k} seam={SEAM} delay={0} vw={VW} vh={VH} />
  {/* hậu cảnh */}
  <Window {...k} x={70} y={340} w={220} h={300} view="city" delay={6} />
  <WallArt {...k} x={360} y={360} w={150} h={110} kind="chart" delay={12} />
  {/* người nhỏ bên trái vừa xong 1 nút */}
  <Figure {...k} cx={150} foot={SEAM} delay={22} pose="point" scale={0.82} />
  <Rect x={96} y={SEAM - 150} w={84} h={40} rx={8} stroke={k.ink} sw={4} delay={30} dur={10} frame={k.frame} />
  {/* AI lớn đứng giữa dựng cả hệ thống */}
  <Robot {...k} cx={430} cy={790} delay={26} scale={1.4} />
  <Arrow {...k} x1={560} y1={760} x2={650} y2={720} delay={48} color={k.accent} />
  {/* "cả hệ thống" = cửa sổ code thật bên phải */}
  <CodeWindow {...k} x={620} y={430} w={340} delay={38} title="server.js" highlight={[3, 4]}
    code={["import jwt from 'jwt'", "const app = express()", "app.post('/in', () => {", "  const t = sign(u)", "  res.json({ token:t })", "})"]} />
  {/* tiền cảnh */}
  <Rug {...k} cx={480} cy={SEAM + 120} rx={380} delay={14} />
  <Plant {...k} cx={910} floor={SEAM} delay={20} scale={1.1} />
  <Books {...k} x={120} y={SEAM + 70} delay={44} scale={1.1} />
</g>);

const QuestionScreen: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <Window {...k} x={80} y={360} w={230} h={320} view="city" delay={6} />
  <Shelf {...k} x={700} y={600} w={240} delay={16} />
  <Question {...k} cx={520} cy={520} size={110} delay={30} />
  <DeskBase {...k} delay={18} />
  {/* màn hình = CodeWindow trên chân đế */}
  <L x1={470} y1={786} x2={470} y2={SEAM - 108} stroke={k.ink} sw={6} delay={40} dur={5} frame={k.frame} />
  <L x1={442} y1={SEAM - 110} x2={498} y2={SEAM - 110} stroke={k.ink} sw={6} delay={42} dur={6} frame={k.frame} />
  <CodeWindow {...k} x={320} y={636} w={300} delay={24} title="app.js" code={["function hello() {", "  return 'hi'", "}"]} />
  <Mug {...k} x={690} y={SEAM - 150} delay={30} scale={0.85} />
  <SitFigure {...k} seatX={660} floor={SEAM} delay={32} mirror />
  <Books {...k} x={820} y={SEAM + 70} delay={44} scale={1.05} />
</g>);

const ReplaceVsThrive: React.FC<Ink> = (k) => (<g>
  <RoomBG {...k} seam={SEAM} delay={0} vw={VW} vh={VH} />
  {/* vách ngăn 2 bên */}
  <L x1={500} y1={330} x2={500} y2={SEAM} stroke={k.muted} sw={3} delay={6} dur={18} frame={k.frame} />
  {/* TRÁI: bị thay thế — người gục, bàn trống, ✕ */}
  <WallArt {...k} x={120} y={360} w={170} h={120} kind="lines" delay={10} />
  <Figure {...k} cx={250} foot={SEAM} delay={16} pose="slump" />
  <XMark {...k} cx={250} cy={560} r={40} delay={30} />
  {/* PHẢI: biết dùng AI — người + robot, ✓ */}
  <WallArt {...k} x={720} y={360} w={170} h={120} kind="chart" delay={12} />
  <Figure {...k} cx={640} foot={SEAM} delay={20} pose="stand" />
  <Robot {...k} cx={840} cy={840} delay={34} scale={0.95} />
  <Check {...k} cx={690} cy={540} r={42} delay={44} />
  <Rug {...k} cx={500} cy={SEAM + 120} rx={380} delay={14} />
</g>);

const OldTyping: React.FC<Ink> = (k) => (<g>
  <RoomBG {...k} seam={SEAM} delay={0} vw={VW} vh={VH} />
  {/* hậu cảnh: cửa sổ lớn + tranh + đồng hồ + kệ sách (sát bàn) */}
  <Window {...k} x={80} y={360} w={250} h={320} view="city" delay={6} />
  <WallArt {...k} x={410} y={400} w={160} h={120} kind="lines" delay={12} />
  <Clock {...k} cx={620} cy={470} r={46} hour={9} delay={14} />
  <Shelf {...k} x={690} y={600} w={250} delay={16} />
  {/* trung cảnh: bàn + màn CodeWindow + bàn phím + đèn + sách + cốc + người gõ */}
  <Hatch frame={k.frame} x={300} y={SEAM} w={440} h={34} delay={40} opacity={0.1} />
  <Desk {...k} x={300} floor={SEAM} w={440} delay={20} />
  <L x1={455} y1={810} x2={455} y2={SEAM - 108} stroke={k.ink} sw={6} delay={40} dur={5} frame={k.frame} />
  <L x1={430} y1={SEAM - 110} x2={482} y2={SEAM - 110} stroke={k.ink} sw={6} delay={42} dur={6} frame={k.frame} />
  <CodeWindow {...k} x={330} y={640} w={270} delay={24} title="login.js" code={["function login(u) {", "  check(u)", "  return ok", "}"]} />
  <Rect {...k} x={560} y={SEAM - 120} w={120} h={16} rx={4} stroke={k.ink} sw={4} delay={40} dur={8} />
  <DeskLamp {...k} baseX={350} baseY={SEAM - 108} delay={30} />
  <Mug {...k} x={700} y={SEAM - 150} delay={34} scale={0.85} />
  <SitFigure {...k} seatX={650} floor={SEAM} delay={36} mirror />
  {/* tiền cảnh: thảm + cây + sách dưới sàn */}
  <Rug {...k} cx={500} cy={SEAM + 120} rx={370} delay={14} />
  <Plant {...k} cx={120} floor={SEAM} delay={22} scale={1.2} />
  <Books {...k} x={810} y={SEAM + 70} delay={44} scale={1.1} />
</g>);

const MissingSemicolon: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <Window {...k} x={80} y={360} w={220} h={320} view="city" delay={6} />
  <Clock {...k} cx={780} cy={450} r={70} hour={2} delay={12} />
  <DeskBase {...k} delay={18} />
  <L x1={460} y1={786} x2={460} y2={SEAM - 108} stroke={k.ink} sw={6} delay={40} dur={5} frame={k.frame} />
  <L x1={432} y1={SEAM - 110} x2={488} y2={SEAM - 110} stroke={k.ink} sw={6} delay={42} dur={6} frame={k.frame} />
  <CodeWindow {...k} x={310} y={606} w={300} delay={24} title="auth.js" highlight={[2]} code={["function auth(u) {", "  const t = sign(u)", "  return { token:t }", "}"]} />
  <Magnifier {...k} cx={470} cy={706} r={66} delay={44} color={k.accent} />
  <SitFigure {...k} seatX={660} floor={SEAM} delay={40} mirror />
  <Books {...k} x={820} y={SEAM + 70} delay={46} scale={1.05} />
</g>);

const CulpritMirror: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  {/* bảng điều tra treo tường (mô phỏng clue board) */}
  <WallArt {...k} x={120} y={360} w={210} h={150} kind="lines" delay={8} />
  {/* thám tử cầm kính lúp */}
  <Figure {...k} cx={320} foot={SEAM} delay={16} pose="point" />
  <Magnifier {...k} cx={500} cy={700} r={62} delay={28} color={k.accent} />
  {/* gương lớn → phản chiếu chính mình */}
  <Mirror {...k} cx={770} cy={640} delay={34} />
  <Figure {...k} cx={770} foot={700} delay={48} pose="stand" scale={0.5} />
  <Books {...k} x={150} y={SEAM + 70} delay={44} scale={1.05} />
</g>);

const AskAi: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <Window {...k} x={720} y={360} w={210} h={300} view="city" delay={6} />
  {/* người ra lệnh + bong bóng yêu cầu */}
  <Figure {...k} cx={250} foot={SEAM} delay={18} pose="point" />
  <Bubble {...k} x={120} y={420} w={320} h={150} delay={24} fromRight />
  <L x1={162} y1={470} x2={400} y2={470} stroke={k.ink} sw={4} delay={34} dur={8} frame={k.frame} />
  <L x1={162} y1={498} x2={360} y2={498} stroke={k.ink} sw={4} delay={37} dur={8} frame={k.frame} />
  <L x1={162} y1={526} x2={380} y2={526} stroke={k.ink} sw={4} delay={40} dur={8} frame={k.frame} />
  {/* robot gật + bong bóng ✓ */}
  <Robot {...k} cx={740} cy={800} delay={28} scale={1.35} />
  <Bubble {...k} x={600} y={440} w={160} h={100} delay={46} color={k.accent} />
  <Check {...k} cx={662} cy={492} r={26} delay={56} />
  <Books {...k} x={150} y={SEAM + 70} delay={44} scale={1.05} />
</g>);

const FiveSeconds: React.FC<Ink> = (k) => (<g>
  <Base {...k} plant={false} />
  <Window {...k} x={80} y={360} w={200} h={260} view="city" delay={6} />
  {/* người trầm trồ */}
  <Figure {...k} cx={180} foot={SEAM} delay={18} pose="cheer" />
  {/* đồng hồ bấm 5 giây → đống code lớn */}
  <Stopwatch {...k} cx={380} cy={700} r={78} delay={10} />
  <Arrow {...k} x1={470} y1={660} x2={560} y2={600} delay={40} color={k.accent} />
  <CodeWindow {...k} x={560} y={400} w={360} delay={30} title="useAuth.js" highlight={[2]}
    code={["function useAuth() {", "  const [u]=useState()", "  const login=()=>{}", "  return { u, login }", "}"]} />
  <Sparkle frame={k.frame} cx={900} cy={420} delay={50} r={18} color={k.accent} />
  <Sparkle frame={k.frame} cx={540} cy={430} delay={54} r={12} color={k.accent} />
</g>);

const HowRun: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <Window {...k} x={80} y={360} w={210} h={280} view="city" delay={6} />
  {/* người gãi đầu bối rối */}
  <Figure {...k} cx={250} foot={SEAM} delay={18} pose="think" />
  {/* cửa sổ code rối + dấu hỏi lớn */}
  <CodeWindow {...k} x={470} y={420} w={400} delay={24} title="app.js" highlight={[2]}
    code={["const x = fn(a)(b)", "useEffect(()=>{},[z])", "return x?.map(y=>y)", "dispatch({ type:z })"]} />
  <Question {...k} cx={720} cy={360} size={100} delay={48} />
  <Books {...k} x={150} y={SEAM + 70} delay={44} scale={1.05} />
</g>);

const CopyNoUnderstand: React.FC<Ink> = (k) => (<g>
  <Base {...k} plant={false} />
  <Window {...k} x={80} y={360} w={200} h={240} view="city" delay={6} />
  {/* cửa sổ code → mũi tên → người (đầu rỗng dấu hỏi) */}
  <CodeWindow {...k} x={80} y={540} w={330} delay={10} title="copied.js" highlight={[0]}
    code={["// copied from AI", "function doIt(d){", "  return d.map(x=>x)", "}"]} />
  <Arrow {...k} x1={430} y1={640} x2={560} y2={640} delay={30} color={k.accent} />
  <Figure {...k} cx={720} foot={SEAM} delay={22} pose="stand" />
  <Bubble {...k} x={690} y={430} w={180} h={130} delay={40} />
  <Question {...k} cx={778} cy={486} size={78} delay={52} color={k.muted} />
  <Books {...k} x={150} y={SEAM + 70} delay={44} scale={1.05} />
</g>);

const DeadlyLoop: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  {/* vòng lặp lớn giữa tường + 4 chặng */}
  <LoopArrows {...k} cx={540} cy={560} r={220} delay={10} color={k.accent} />
  <Robot {...k} cx={540} cy={330} delay={26} scale={0.62} />
  <MiniCode {...k} cx={760} cy={560} delay={34} />
  <Check {...k} cx={540} cy={790} r={30} delay={42} />
  <Bug {...k} cx={320} cy={560} delay={48} scale={0.95} />
  {/* người bối rối đứng xem */}
  <Figure {...k} cx={170} foot={SEAM} delay={30} pose="think" scale={0.9} />
  <Books {...k} x={800} y={SEAM + 70} delay={50} scale={1.05} />
</g>);

const FixOneSpawnThree: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <Window {...k} x={80} y={360} w={200} h={240} view="rain" delay={6} />
  {/* bug gốc bị gạch ✕ */}
  <Bug {...k} cx={300} cy={560} delay={16} scale={1.35} color={k.accent} />
  <XMark {...k} cx={300} cy={560} r={44} delay={30} color={k.accent} />
  {/* đẻ ra 3 bug mới */}
  <Arrow {...k} x1={400} y1={540} x2={600} y2={410} delay={40} />
  <Arrow {...k} x1={410} y1={580} x2={640} y2={600} delay={44} />
  <Arrow {...k} x1={400} y1={620} x2={600} y2={780} delay={48} />
  <Bug {...k} cx={690} cy={390} delay={52} scale={1} />
  <Bug {...k} cx={730} cy={600} delay={56} scale={1} />
  <Bug {...k} cx={690} cy={800} delay={60} scale={1} />
  <Books {...k} x={150} y={SEAM + 70} delay={46} scale={1.05} />
</g>);

const BugsMultiply: React.FC<Ink> = (k) => {
  const onScreen: [number, number, number][] = [[440, 760, 1.25], [360, 716, 0.72], [524, 720, 0.72], [340, 804, 0.66], [548, 806, 0.66], [440, 686, 0.58]];
  const escaping: [number, number, number][] = [[230, 904, 0.72], [700, 892, 0.8], [150, 560, 0.55], [860, 470, 0.55], [500, 1090, 0.85]];
  return (<g>
    <RoomBG {...k} seam={SEAM} delay={0} vw={VW} vh={VH} />
    {/* hậu cảnh: cửa sổ mưa + bảng cảnh báo (sát bàn) */}
    <Window {...k} x={70} y={330} w={210} h={300} view="rain" delay={6} />
    <WallArt {...k} x={720} y={360} w={170} h={120} kind="lines" delay={12} />
    {/* trung cảnh: bàn + màn hình lớn đầy bug */}
    <Hatch frame={k.frame} x={260} y={SEAM} w={420} h={34} delay={40} opacity={0.1} />
    <Desk {...k} x={260} floor={SEAM} w={420} delay={18} />
    <Monitor {...k} cx={440} deskTop={SEAM - 108} w={300} h={200} delay={22} />
    {onScreen.map(([x, y, s], i) => (
      <Bug key={`s${i}`} {...k} cx={x} cy={y} delay={30 + i * 6} scale={s} color={i === 0 ? k.accent : k.ink} />
    ))}
    {/* người ôm đầu bên phải */}
    <Figure {...k} cx={840} foot={SEAM} delay={44} pose="slump" scale={0.95} />
    {/* bug tràn ra khắp phòng + vệt bò */}
    {escaping.map(([x, y, s], i) => (
      <Bug key={`e${i}`} {...k} cx={x} cy={y} delay={54 + i * 6} scale={s} color={k.ink} />
    ))}
    <MotionLines frame={k.frame} x={120} y={560} delay={64} len={46} color={k.muted} />
    <MotionLines frame={k.frame} x={560} y={1080} delay={70} len={46} color={k.muted} />
    {/* tiền cảnh */}
    <Rug {...k} cx={480} cy={SEAM + 120} rx={360} delay={14} />
    <Plant {...k} cx={120} floor={SEAM} delay={20} scale={1.05} />
  </g>);
};

const WholeSystem: React.FC<Ink> = (k) => (<g>
  <Base {...k} plant={false} />
  {/* sơ đồ hệ thống lớn trên tường: Frontend → Backend → Database, + Auth, + bánh răng ăn khớp */}
  <Monitor {...k} cx={230} deskTop={560} w={150} h={100} delay={8} />
  <Arrow {...k} x1={320} y1={470} x2={420} y2={470} delay={24} color={k.accent} />
  <Server {...k} cx={520} cy={470} delay={28} />
  <Arrow {...k} x1={620} y1={470} x2={720} y2={470} delay={42} color={k.accent} />
  <Cylinder {...k} cx={820} cy={470} w={130} h={120} delay={46} />
  <Arrow {...k} x1={520} y1={560} x2={520} y2={650} delay={52} color={k.accent} />
  <Lock {...k} cx={520} cy={710} delay={56} />
  {/* bánh răng ăn khớp */}
  <Gear {...k} cx={250} cy={720} r={48} delay={30} teeth={9} />
  <Gear {...k} cx={338} cy={742} r={32} delay={38} teeth={7} color={k.accent} />
  {/* người trình bày */}
  <Figure {...k} cx={120} foot={SEAM} delay={24} pose="point" scale={0.82} />
</g>);

const WhoWins: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <WallArt {...k} x={700} y={360} w={180} h={130} kind="chart" delay={8} />
  {/* bục + người thắng giơ tay */}
  <Rect x={400} y={SEAM - 150} w={180} h={150} rx={6} stroke={k.ink} sw={5} delay={10} dur={14} frame={k.frame} />
  <Hatch frame={k.frame} x={400} y={SEAM - 150} w={180} h={150} delay={30} opacity={0.08} />
  <Figure {...k} cx={490} foot={SEAM - 150} delay={18} pose="cheer" />
  {/* điều khiển AI làm cùng */}
  <Robot {...k} cx={790} cy={840} delay={32} scale={0.95} />
  <Arrow {...k} x1={600} y1={700} x2={710} y2={740} delay={46} color={k.accent} />
  {/* cúp */}
  <Trophy {...k} cx={220} cy={640} delay={34} scale={1} />
  <Sparkle frame={k.frame} cx={490} cy={520} delay={44} r={16} color={k.accent} />
</g>);

const LearnRight: React.FC<Ink> = (k) => (<g>
  <RoomBG {...k} seam={SEAM} delay={0} vw={VW} vh={VH} />
  <L x1={500} y1={330} x2={500} y2={SEAM} stroke={k.muted} sw={3} delay={6} dur={18} frame={k.frame} />
  {/* TRÁI: học sai — vòng lặp + bug + ✕ */}
  <LoopArrows {...k} cx={250} cy={560} r={150} delay={10} color={k.muted} />
  <Bug {...k} cx={250} cy={560} delay={28} scale={1} />
  <XMark {...k} cx={250} cy={800} r={38} delay={44} />
  {/* PHẢI: nền tảng vững → tên lửa + ✓ */}
  <Rect x={590} y={720} w={300} h={40} rx={6} stroke={k.ink} sw={5} delay={16} dur={10} frame={k.frame} />
  <Rect x={620} y={676} w={240} h={40} rx={6} stroke={k.ink} sw={5} delay={22} dur={10} frame={k.frame} />
  <Rect x={650} y={632} w={180} h={40} rx={6} stroke={k.ink} sw={5} delay={28} dur={10} frame={k.frame} />
  <Rocket {...k} cx={740} cy={430} delay={38} scale={1} />
  <Check {...k} cx={740} cy={800} r={34} delay={50} />
  <Rug {...k} cx={500} cy={SEAM + 120} rx={380} delay={14} />
</g>);

const RoadmapCta: React.FC<Ink> = (k) => (<g>
  <RoomBG {...k} seam={SEAM} delay={0} vw={VW} vh={VH} />
  {/* đồi phía xa */}
  <P d={`M0 ${SEAM} Q 240 740 480 ${SEAM}`} stroke={k.muted} sw={3} delay={6} dur={18} frame={k.frame} />
  <P d={`M520 ${SEAM} Q 760 760 1000 ${SEAM}`} stroke={k.muted} sw={3} delay={8} dur={18} frame={k.frame} />
  {/* con đường lộ trình uốn lượn từ dưới-trái lên tên lửa */}
  <P d={`M120 ${SEAM} C 320 900 260 640 480 620 S 760 460 820 400`} stroke={k.ink} sw={6} delay={12} dur={30} frame={k.frame} />
  {([[150, 930], [360, 670], [600, 560]] as [number, number][]).map(([x, y], i) => (
    <g key={i}>
      <C {...k} cx={x} cy={y} r={14} delay={28 + i * 8} dur={8} fill={k.accent} stroke={k.accent} />
      <L x1={x} y1={y - 14} x2={x} y2={y - 54} stroke={k.ink} sw={4} delay={32 + i * 8} dur={6} frame={k.frame} />
      <P d={`M${x} ${y - 54} l 30 10 l -30 12`} stroke={k.accent} sw={4} delay={36 + i * 8} dur={6} frame={k.frame} />
    </g>
  ))}
  <Rocket {...k} cx={850} cy={360} delay={44} scale={1.05} />
  {/* bong bóng nhắn tin (CTA) */}
  <Bubble {...k} x={120} y={400} w={240} h={130} delay={34} color={k.accent} />
  <L x1={160} y1={450} x2={330} y2={450} stroke={k.accent} sw={4} delay={48} dur={8} frame={k.frame} />
  <L x1={160} y1={480} x2={300} y2={480} stroke={k.accent} sw={4} delay={52} dur={8} frame={k.frame} />
  <Plant {...k} cx={120} floor={SEAM} delay={20} scale={1.1} />
</g>);

const OfficeExodus: React.FC<Ink> = (k) => (<g>
  <Base {...k} plant={false} />
  <Clock {...k} cx={235} cy={430} r={70} delay={6} hour={5} />
  <Desk {...k} x={70} floor={SEAM} w={240} delay={12} />
  <Monitor {...k} cx={190} deskTop={SEAM - 108} delay={18} />
  {/* ba người bước ra cửa */}
  <Figure {...k} cx={470} foot={SEAM} delay={40} pose="walk" scale={0.95} />
  <Figure {...k} cx={590} foot={SEAM} delay={50} pose="walk" mirror scale={0.95} />
  <Figure {...k} cx={710} foot={SEAM} delay={60} pose="walk" scale={0.95} />
  {/* cửa mở */}
  <L x1={840} y1={560} x2={840} y2={SEAM} stroke={k.ink} sw={5} delay={26} dur={14} frame={k.frame} />
  <L x1={840} y1={560} x2={950} y2={560} stroke={k.ink} sw={5} delay={28} dur={12} frame={k.frame} />
  <L x1={950} y1={560} x2={950} y2={SEAM} stroke={k.ink} sw={5} delay={30} dur={14} frame={k.frame} />
  <P d={`M840 560 L792 544 L792 ${SEAM - 12} L840 ${SEAM}`} stroke={k.ink} sw={5} delay={34} dur={16} frame={k.frame} />
  <Arrow {...k} x1={748} y1={660} x2={812} y2={660} delay={46} color={k.accent} />
</g>);

/* ---- Bộ cảnh chủ đề LƯƠNG / GIÁ TRỊ / SỰ NGHIỆP ---- */

const SalaryAsk: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <Window {...k} x={720} y={360} w={210} h={300} view="city" delay={6} />
  <Figure {...k} cx={250} foot={SEAM} delay={18} pose="point" />
  <Bubble {...k} x={120} y={420} w={360} h={170} delay={24} fromRight />
  <Cash {...k} x={170} y={470} delay={34} scale={1.1} />
  <Question {...k} cx={400} cy={505} size={90} delay={42} />
  <Books {...k} x={150} y={SEAM + 70} delay={46} scale={1.05} />
</g>);

const SalaryLadder: React.FC<Ink> = (k) => (<g>
  <Base {...k} plant={false} />
  {/* ba bậc lương tăng dần */}
  {([[150, 820, "30"], [370, 720, "50"], [590, 620, "100"]] as [number, number, string][]).map(([sx, sy, lb], i) => (
    <g key={i}>
      <Rect {...k} x={sx} y={sy} w={190} h={SEAM - sy} rx={4} delay={10 + i * 8} dur={14} />
      <text x={sx + 95} y={sy - 14} textAnchor="middle" fill={k.accent} fontFamily={TEXT_STACK} fontSize={40} fontWeight={800} opacity={fadeIn(k.frame, 24 + i * 8, 10)}>{lb}tr</text>
    </g>
  ))}
  <MoneyStack {...k} cx={685} baseY={610} delay={44} scale={1} n={4} />
  <Figure {...k} cx={300} foot={820} delay={30} pose="point" scale={0.82} />
</g>);

const ValueScale: React.FC<Ink> = (k) => (<g>
  <Base {...k} plant={false} />
  <Scale {...k} cx={540} cy={440} delay={10} tilt={0.14} />
  {/* vế TRÁI (cao): tiền/cú pháp — nhẹ */}
  <Cash {...k} x={348} y={398} delay={26} scale={0.8} />
  {/* vế PHẢI (thấp): giá trị = bánh răng — nặng */}
  <Gear {...k} cx={690} cy={512} r={34} delay={30} teeth={8} color={k.accent} />
  <Figure {...k} cx={160} foot={SEAM} delay={20} pose="point" scale={0.86} />
  <Books {...k} x={830} y={SEAM + 70} delay={46} scale={1.05} />
</g>);

const SyntaxPoor: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <Window {...k} x={80} y={360} w={210} h={280} view="city" delay={6} />
  <Figure {...k} cx={300} foot={SEAM} delay={18} pose="point" />
  <MiniCode {...k} cx={520} cy={580} delay={26} />
  {/* biết code nhưng không ra tiền */}
  <Cash {...k} x={700} y={540} delay={34} scale={1} />
  <XMark {...k} cx={742} cy={563} r={34} delay={44} color={k.accent} />
  <Books {...k} x={150} y={SEAM + 70} delay={46} scale={1.05} />
</g>);

const JuniorSenior: React.FC<Ink> = (k) => (<g>
  <RoomBG {...k} seam={SEAM} delay={0} vw={VW} vh={VH} />
  {/* junior trái hỏi tiền */}
  <Figure {...k} cx={260} foot={SEAM} delay={16} pose="stand" />
  <Bubble {...k} x={120} y={420} w={250} h={130} delay={22} />
  <Cash {...k} x={170} y={450} delay={32} scale={0.82} />
  {/* senior phải hỏi vấn đề */}
  <Figure {...k} cx={740} foot={SEAM} delay={18} pose="stand" mirror />
  <Bubble {...k} x={640} y={420} w={260} h={130} delay={26} fromRight color={k.accent} />
  <Gear {...k} cx={770} cy={485} r={30} delay={36} teeth={8} color={k.accent} />
  <Rug {...k} cx={500} cy={SEAM + 120} rx={380} delay={14} />
</g>);

const ValueGraph: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <Graph {...k} x={300} y={420} w={440} h={320} delay={16} />
  <MoneyStack {...k} cx={720} baseY={470} delay={44} scale={0.95} n={4} />
  <Figure {...k} cx={170} foot={SEAM} delay={22} pose="point" scale={0.9} />
  <Books {...k} x={820} y={SEAM + 70} delay={48} scale={1.05} />
</g>);

const OfferMagnet: React.FC<Ink> = (k) => (<g>
  <Base {...k} plant={false} />
  {/* người giá trị ở giữa, nhiều offer đổ về */}
  <Figure {...k} cx={500} foot={SEAM} delay={18} pose="cheer" />
  <Doc {...k} x={110} y={400} w={150} h={120} money delay={26} />
  <Arrow {...k} x1={270} y1={470} x2={410} y2={620} delay={46} color={k.accent} />
  <Doc {...k} x={760} y={400} w={150} h={120} money delay={30} />
  <Arrow {...k} x1={760} y1={470} x2={600} y2={620} delay={50} color={k.accent} />
  <Doc {...k} x={430} y={300} w={150} h={120} money delay={34} />
  <Arrow {...k} x1={505} y1={430} x2={505} y2={560} delay={54} color={k.accent} />
</g>);

const AiSolve: React.FC<Ink> = (k) => (<g>
  <Base {...k} />
  <Figure {...k} cx={210} foot={SEAM} delay={18} pose="point" />
  <Robot {...k} cx={430} cy={800} delay={26} scale={1.1} />
  <Arrow {...k} x1={560} y1={700} x2={660} y2={640} delay={44} color={k.accent} />
  {/* giải quyết vấn đề → tiền */}
  <Gear {...k} cx={720} cy={520} r={30} delay={36} teeth={8} />
  <Cash {...k} x={820} y={620} delay={48} scale={1} />
  <Check {...k} cx={690} cy={430} r={30} delay={54} />
</g>);

export const LINE_SCENES: Record<string, React.FC<Ink>> = {
  "salary-ask": SalaryAsk,
  "salary-ladder": SalaryLadder,
  "value-scale": ValueScale,
  "syntax-poor": SyntaxPoor,
  "junior-senior": JuniorSenior,
  "value-graph": ValueGraph,
  "offer-magnet": OfferMagnet,
  "ai-solve": AiSolve,
  "office-exodus": OfficeExodus,
  "ai-builds-system": AiBuildsSystem,
  "question-screen": QuestionScreen,
  "replace-vs-thrive": ReplaceVsThrive,
  "old-typing": OldTyping,
  "missing-semicolon": MissingSemicolon,
  "culprit-mirror": CulpritMirror,
  "ask-ai": AskAi,
  "five-seconds": FiveSeconds,
  "how-run": HowRun,
  "copy-no-understand": CopyNoUnderstand,
  "deadly-loop": DeadlyLoop,
  "fix-one-spawn-three": FixOneSpawnThree,
  "bugs-multiply": BugsMultiply,
  "whole-system": WholeSystem,
  "who-wins": WhoWins,
  "learn-right": LearnRight,
  "roadmap-cta": RoadmapCta,
};

/** Mọi cảnh đã theo phong cách "môi trường đầy khung" (khung cao 1000×1160). */
const ENV_SCENES = new Set<string>(Object.keys(LINE_SCENES));

/* ------------------------------- Layout ---------------------------------- */

export const DrawScene: React.FC<{ scene: BuiltScene; height: number }> = ({ scene, height }) => {
  const p = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const Art = (scene.art && LINE_SCENES[scene.art]) || null;
  const inkProps: Ink = { frame, ink: p.text, accent: p.accent, muted: p.textMuted };

  const eyebrow = scene.eyebrow;
  const chips = (scene.chips ?? []).map((c) => c.replace(/^@\S+\s*/, ""));
  const titleIn = interpolate(frame, [2, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Cảnh "môi trường đầy khung" dùng khung CAO (1000×1240) lấp trên→dưới; cảnh cũ giữ khung 640.
  const isEnv = !!(scene.art && ENV_SCENES.has(scene.art));
  const viewBox = isEnv ? `0 0 ${VW} ${VH}` : "0 0 1000 640";
  const artTop = isEnv ? height * 0.12 : height * 0.3;
  const artH = isEnv ? height * 0.66 : height * 0.5;

  return (
    <AbsoluteFill style={{ background: p.bgGradient, fontFamily: TEXT_STACK, color: p.text }}>
      {/* vân giấy: lưới rất mờ */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${p.hairline} 1px, transparent 1px), linear-gradient(90deg, ${p.hairline} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          opacity: 0.6,
        }}
      />

      {/* Tiêu đề editorial canh trái */}
      <div style={{ position: "absolute", top: Math.round(height * 0.055), left: 72, right: 72, opacity: titleIn, transform: `translateY(${interpolate(titleIn, [0, 1], [-14, 0])}px)` }}>
        {eyebrow && (
          <div style={{ fontFamily: p.labelFont, fontSize: 26, letterSpacing: 3, textTransform: "uppercase", color: p.textMuted, marginBottom: 14 }}>{eyebrow}</div>
        )}
        {scene.heading && (
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.5 }}>{scene.heading}</div>
        )}
        <div style={{ height: 4, width: 140, background: p.accent, marginTop: 20, borderRadius: 2 }} />
      </div>

      {/* Tranh line-art tự vẽ */}
      <div style={{ position: "absolute", top: Math.round(artTop), left: 40, right: 40, height: Math.round(artH) }}>
        <svg viewBox={viewBox} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
          {Art ? <Art {...inkProps} /> : null}
        </svg>
        {chips.length > 0 && (
          <div style={{ position: "absolute", top: 0, left: "4%", fontFamily: p.labelFont, fontSize: 24, letterSpacing: 2, textTransform: "uppercase", color: p.textMuted, opacity: fadeIn(frame, 20, 12) }}>
            {chips.join("  ·  ")}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
