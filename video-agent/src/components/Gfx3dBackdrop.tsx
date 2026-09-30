import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import type { Palette } from "../theme/claude";

/**
 * Gfx3dBackdrop — NỀN ĐỒ HOẠ 3D TOÀN MÀN, hoạt hình, KHÔNG cần ảnh (media.kind "gfx3d").
 *
 * `src` CHỌN SCENE THEO NỘI DUNG đang nói (không phải khối trang trí chung chung):
 *   "network" — đồ thị 3D nhiều điểm nối nhau → "kết nối / hệ thống / mọi thứ liên quan"
 *   "float"   — khối toon trôi (nền chung khi không có scene khớp hơn)
 * (thêm scene mới = thêm case trong SceneByVariant — xem cuối file)
 *
 * Màu tính NGOÀI canvas rồi truyền vào: react-three-fiber dùng renderer riêng nên React
 * context không tự băng qua ThreeCanvas — nhưng props thì có.
 *
 * KHÔNG dùng Math.random ở đây: render chia nhiều frame-worker, ngẫu nhiên sẽ khiến mỗi
 * worker ra khác nhau → nhấp nháy. Mọi bố cục là hàm xác định của chỉ số.
 */

/* ----------------------------- FLOAT scene ------------------------------ */

type ShapeType = "ico" | "sphere" | "torus" | "knot" | "octa" | "dodeca" | "cone" | "capsule" | "box";
interface ShapeDef { type: ShapeType; pos: [number, number, number]; scale: number; color: number; spin: number; phase: number; amp: number; }

/** Nền chung: khối toon trôi. Dày hơn bản đầu (nhiều khối hơn). */
const FLOAT_SHAPES: ShapeDef[] = [
  { type: "ico", pos: [-1.6, 2.8, -1], scale: 0.9, color: 0, spin: 0.5, phase: 0.0, amp: 0.35 },
  { type: "torus", pos: [1.7, 3.3, -2], scale: 0.8, color: 1, spin: 0.4, phase: 1.1, amp: 0.4 },
  { type: "knot", pos: [1.5, 1.1, 0.3], scale: 0.7, color: 0, spin: 0.35, phase: 2.0, amp: 0.3 },
  { type: "octa", pos: [-1.9, 0.4, -0.5], scale: 0.85, color: 2, spin: 0.6, phase: 0.7, amp: 0.32 },
  { type: "sphere", pos: [0.2, -0.4, -1.5], scale: 0.7, color: 1, spin: 0.2, phase: 3.0, amp: 0.28 },
  { type: "capsule", pos: [-1.4, -2.2, 0.2], scale: 0.7, color: 0, spin: 0.45, phase: 1.7, amp: 0.36 },
  { type: "dodeca", pos: [1.8, -1.7, -1], scale: 0.9, color: 2, spin: 0.5, phase: 2.4, amp: 0.33 },
  { type: "cone", pos: [-0.6, -3.4, -1.8], scale: 0.9, color: 1, spin: 0.3, phase: 0.4, amp: 0.4 },
  { type: "box", pos: [1.2, -3.6, -0.4], scale: 0.7, color: 0, spin: 0.55, phase: 3.4, amp: 0.3 },
  { type: "torus", pos: [-1.8, 4.6, -2.5], scale: 0.7, color: 2, spin: 0.4, phase: 1.3, amp: 0.45 },
  { type: "ico", pos: [1.4, 4.9, -1.6], scale: 0.6, color: 1, spin: 0.5, phase: 2.7, amp: 0.4 },
];

const Geometry: React.FC<{ type: ShapeType }> = ({ type }) => {
  switch (type) {
    case "ico": return <icosahedronGeometry args={[1, 0]} />;
    case "sphere": return <sphereGeometry args={[1, 32, 32]} />;
    case "torus": return <torusGeometry args={[0.78, 0.3, 24, 80]} />;
    case "knot": return <torusKnotGeometry args={[0.7, 0.26, 140, 16]} />;
    case "octa": return <octahedronGeometry args={[1, 0]} />;
    case "dodeca": return <dodecahedronGeometry args={[1, 0]} />;
    case "cone": return <coneGeometry args={[0.9, 1.7, 28]} />;
    case "capsule": return <capsuleGeometry args={[0.5, 1, 8, 20]} />;
    case "box": return <boxGeometry args={[1.25, 1.25, 1.25]} />;
    default: return <icosahedronGeometry args={[1, 0]} />;
  }
};

const FloatScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => (
  <group rotation={[0, t * 0.09, 0]}>
    {FLOAT_SHAPES.map((s, i) => {
      const y = s.pos[1] + Math.sin(t * 0.9 + s.phase) * s.amp;
      return (
        <mesh key={i} position={[s.pos[0], y, s.pos[2]]} rotation={[t * s.spin, t * s.spin * 0.7, s.phase]} scale={s.scale}>
          <Geometry type={s.type} />
          <meshToonMaterial color={colors[s.color % colors.length]} />
        </mesh>
      );
    })}
  </group>
);

/* ---------------------------- NETWORK scene ----------------------------- */
/**
 * Đồ thị 3D: các NÚT rải đều trên mặt cầu (Fibonacci), mỗi nút nối tới vài nút gần nhất.
 * Tự nó ĐÃ DÀY (nhiều điểm + nhiều đường), khớp nội dung "kết nối / hệ thống / mạng lưới".
 */
const N_NODES = 30;
const NET_R = 2.7;

function fibSphere(n: number, radius: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = phi * i;
    pts.push([Math.cos(th) * r * radius, y * radius, Math.sin(th) * r * radius]);
  }
  return pts;
}

const NET_NODES = fibSphere(N_NODES, NET_R);

/** Nối mỗi nút với `k` nút gần nhất (không trùng cạnh). */
function buildEdges(nodes: [number, number, number][], k: number): [number, number][] {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    const d = nodes
      .map((n, j) => ({ j, dist: dist2(nodes[i]!, n) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, k);
    for (const { j } of d) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
    }
  }
  return edges;
}
function dist2(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

const NET_EDGES = buildEdges(NET_NODES, 2);
const NET_EDGE_POS = new Float32Array(NET_EDGES.length * 6);
NET_EDGES.forEach((e, i) => {
  const a = NET_NODES[e[0]]!;
  const b = NET_NODES[e[1]]!;
  NET_EDGE_POS.set([a[0], a[1], a[2], b[0], b[1], b[2]], i * 6);
});

const NetworkScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => (
  <group rotation={[Math.sin(t * 0.08) * 0.15, t * 0.13, 0]}>
    {/* Cạnh nối — một lô đường mảnh mờ. */}
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[NET_EDGE_POS, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={colors[1]} transparent opacity={0.22} />
    </lineSegments>
    {/* Nút — cầu nhỏ phát sáng, thở nhẹ lệch pha. */}
    {NET_NODES.map((p, i) => {
      const s = (0.09 + (i % 3) * 0.03) * (1 + Math.sin(t * 1.3 + i) * 0.12);
      const c = colors[i % 2]!;
      return (
        <mesh key={i} position={p} scale={s}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      );
    })}
  </group>
);

/* --------------------------- PARTICLES scene ---------------------------- */
/** Hash xác định (kiểu GLSL) → toạ độ hạt cố định, không nhấp nháy giữa các frame-worker. */
function hash(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function makeCloud(n: number, seedBase: number): Float32Array {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = (hash(i, seedBase) * 2 - 1) * 4.6;
    a[i * 3 + 1] = (hash(i, seedBase + 1) * 2 - 1) * 7.2;
    a[i * 3 + 2] = (hash(i, seedBase + 2) * 2 - 1) * 4 - 1.5;
  }
  return a;
}
const CLOUD_A = makeCloud(360, 1);
const CLOUD_B = makeCloud(240, 7);

/** Biển hạt trôi — hợp nội dung "dữ liệu / quy mô lớn / dòng chảy". */
const ParticlesScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => (
  <>
    <group rotation={[0, t * 0.06, 0]} position={[0, Math.sin(t * 0.2) * 0.4, 0]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[CLOUD_A, 3]} />
        </bufferGeometry>
        <pointsMaterial color={colors[0]} size={0.07} sizeAttenuation transparent opacity={0.9} toneMapped={false} />
      </points>
    </group>
    <group rotation={[0, -t * 0.04, 0]} position={[0, Math.cos(t * 0.16) * 0.5, 0]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[CLOUD_B, 3]} />
        </bufferGeometry>
        <pointsMaterial color={colors[1]} size={0.05} sizeAttenuation transparent opacity={0.7} toneMapped={false} />
      </points>
    </group>
  </>
);

/* ----------------------------- BARS3D scene ----------------------------- */
/** Lưới cột 3D mọc theo sóng (như "thành phố"/equalizer) — hợp "tăng trưởng / so sánh". */
const BAR_COLS = 7;
const BAR_ROWS = 5;
const BARS: { x: number; z: number; phase: number; color: number }[] = [];
for (let r = 0; r < BAR_ROWS; r++) {
  for (let c = 0; c < BAR_COLS; c++) {
    BARS.push({ x: (c - (BAR_COLS - 1) / 2) * 1.05, z: (r - (BAR_ROWS - 1) / 2) * 1.05 - 1, phase: (c + r) * 0.55, color: (c + r) % 2 });
  }
}
const BarsScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => (
  <group rotation={[-0.42, t * 0.12, 0]} position={[0, -0.4, 0]}>
    {BARS.map((b, i) => {
      const h = 0.5 + (Math.sin(t * 1.1 + b.phase) * 0.5 + 0.5) * 2.6;
      const c = colors[b.color]!;
      return (
        <mesh key={i} position={[b.x, h / 2, b.z]} scale={[0.42, h, 0.42]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} toneMapped={false} />
        </mesh>
      );
    })}
  </group>
);

/* ------------------------------ GLOBE scene ----------------------------- */
const GLOBE_DOTS = fibSphere(96, 2.63);
const GLOBE_DOT_POS = new Float32Array(GLOBE_DOTS.length * 3);
GLOBE_DOTS.forEach((p, i) => GLOBE_DOT_POS.set(p, i * 3));

/** Quả cầu wireframe + chấm sáng trên bề mặt — hợp "toàn cầu / phủ rộng / kết nối quốc tế". */
const GlobeScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => (
  <group rotation={[0.32, t * 0.16, 0]}>
    <mesh>
      <icosahedronGeometry args={[2.6, 2]} />
      <meshBasicMaterial color={colors[1]} wireframe transparent opacity={0.22} />
    </mesh>
    <mesh>
      <sphereGeometry args={[2.5, 32, 32]} />
      <meshBasicMaterial color={colors[2] ?? colors[0]} transparent opacity={0.04} />
    </mesh>
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[GLOBE_DOT_POS, 3]} />
      </bufferGeometry>
      <pointsMaterial color={colors[0]} size={0.1} sizeAttenuation transparent opacity={0.95} toneMapped={false} />
    </points>
    {/* Quầng khí quyển mờ. */}
    <mesh>
      <sphereGeometry args={[2.85, 32, 32]} />
      <meshBasicMaterial color={colors[0]} transparent opacity={0.05} />
    </mesh>
  </group>
);

/* ------------------------------ ORBIT scene ----------------------------- */
const ORBIT_RINGS = [
  { r: 1.7, tilt: [0.5, 0.2, 0] as [number, number, number], speed: 0.5, nodes: 3, color: 0 },
  { r: 2.5, tilt: [-0.4, 0.6, 0.3] as [number, number, number], speed: -0.35, nodes: 4, color: 1 },
  { r: 3.2, tilt: [0.3, -0.5, 0.2] as [number, number, number], speed: 0.28, nodes: 5, color: 0 },
];
/** Lõi trung tâm + vệ tinh quay trên các vành nghiêng — bản 3D của illus-orbit. */
const OrbitScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => (
  <group rotation={[0, t * 0.05, 0]}>
    {/* Lõi */}
    <mesh scale={0.65 * (1 + Math.sin(t * 1.2) * 0.05)}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={colors[0]} emissive={colors[0]} emissiveIntensity={0.7} toneMapped={false} />
    </mesh>
    {ORBIT_RINGS.map((ring, ri) => (
      <group key={ri} rotation={ring.tilt}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ring.r, 0.012, 8, 100]} />
          <meshBasicMaterial color={colors[1]} transparent opacity={0.35} />
        </mesh>
        {Array.from({ length: ring.nodes }).map((_, ni) => {
          const a = t * ring.speed + (ni / ring.nodes) * Math.PI * 2;
          const c = colors[ring.color]!;
          return (
            <mesh key={ni} position={[Math.cos(a) * ring.r, Math.sin(a) * ring.r, 0]} scale={0.16}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    ))}
  </group>
);

/* ------------------------------ CODER scene ----------------------------- */
/**
 * VẼ ĐÚNG NỘI DUNG: một NGƯỜI ĐANG NGỒI GÕ LAPTOP, dựng bằng khối low-poly (toon), tay gõ
 * phím nhấp nhô, đầu gật khẽ, màn hình phát sáng. Đây là kiểu "3D minh hoạ literal cái đang
 * kể" — khác hẳn nền trừu tượng. Mỗi CHỦ THỂ cần một scene riêng như thế này.
 */
const DESK = "#2b3a45"; // màu đồ vật (bàn/laptop/ghế) — trung tính, đọc ra là nội thất
/** Các dòng "code" phát sáng trên màn — độ rộng + thụt đầu dòng khác nhau cho giống editor. */
const CODE_LINES: [number, number, number][] = [
  // [y, width, indent]
  [0.3, 0.62, -0.32], [0.18, 0.42, -0.22], [0.06, 0.5, -0.12], [-0.06, 0.34, -0.12],
  [-0.18, 0.54, -0.22], [-0.3, 0.4, -0.32],
];
const CoderScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => {
  const body = colors[1]!;
  const head = "#dbe4e8";
  const dark = "#18232c";
  const sway = Math.sin(t * 0.3) * 0.05;
  const headBob = Math.sin(t * 1.6) * 0.02;
  const flick = 0.6 + Math.sin(t * 6) * 0.06;
  return (
    <group rotation={[0, sway, 0]} position={[0, -0.2, 0]}>
      {/* Mặt bàn (bo cạnh nhẹ nhờ dùng standard material, đổ bóng mềm) */}
      <mesh position={[0, -0.42, 0.85]} castShadow>
        <boxGeometry args={[3.6, 0.14, 1.5]} />
        <meshStandardMaterial color={dark} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* NGƯỜI (nhìn từ trước, tối giản — đầu cân đối, có tai nghe, KHÔNG mặt hề) */}
      {/* vai/thân */}
      <mesh position={[0, 0.28, -0.15]}>
        <capsuleGeometry args={[0.5, 0.5, 8, 20]} />
        <meshStandardMaterial color={body} roughness={0.55} metalness={0.1} />
      </mesh>
      {/* cổ */}
      <mesh position={[0, 0.82, -0.12]}>
        <cylinderGeometry args={[0.13, 0.15, 0.2, 16]} />
        <meshStandardMaterial color={head} roughness={0.6} />
      </mesh>
      {/* đầu */}
      <mesh position={[0, 1.12 + headBob, -0.1]}>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshStandardMaterial color={head} roughness={0.6} />
      </mesh>
      {/* tóc */}
      <mesh position={[0, 1.22 + headBob, -0.12]} rotation={[-0.15, 0, 0]}>
        <sphereGeometry args={[0.375, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
        <meshStandardMaterial color={dark} roughness={0.8} />
      </mesh>
      {/* tai nghe: chụp hai bên + băng trên */}
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.36, 1.1 + headBob, -0.1]}>
          <capsuleGeometry args={[0.09, 0.12, 6, 12]} />
          <meshStandardMaterial color={dark} roughness={0.5} emissive={body} emissiveIntensity={0.25} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 1.42 + headBob, -0.1]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.37, 0.035, 8, 24, Math.PI]} />
        <meshStandardMaterial color={dark} roughness={0.5} />
      </mesh>

      {/* LAPTOP — ngôi sao: màn hình tối + dòng code phát sáng hướng về camera */}
      {/* đế + bàn phím */}
      <mesh position={[0, -0.3, 1.05]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.7, 0.07, 1.0]} />
        <meshStandardMaterial color="#20303b" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* màn hình (bezel) nghiêng về sau, mặt hướng camera */}
      <group position={[0, 0.28, 0.62]} rotation={[-0.26, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.72, 1.08, 0.06]} />
          <meshStandardMaterial color="#16212a" roughness={0.35} metalness={0.5} />
        </mesh>
        {/* nền panel tối */}
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[1.54, 0.92, 0.02]} />
          <meshStandardMaterial color="#0a1016" roughness={0.3} emissive={colors[0]} emissiveIntensity={0.12 * flick} toneMapped={false} />
        </mesh>
        {/* dòng code phát sáng */}
        {CODE_LINES.map(([y, w, indent], i) => (
          <mesh key={i} position={[indent + w / 2, y, 0.05]}>
            <boxGeometry args={[w, 0.055, 0.015]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? colors[0] : colors[1]}
              emissive={i % 3 === 0 ? colors[0] : colors[1]}
              emissiveIntensity={1.4 * flick}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Cốc cà phê bên bàn */}
      <mesh position={[1.35, -0.18, 1.0]}>
        <cylinderGeometry args={[0.16, 0.14, 0.32, 20]} />
        <meshStandardMaterial color={head} roughness={0.5} />
      </mesh>
      <mesh position={[1.58, -0.16, 1.0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.09, 0.03, 8, 20]} />
        <meshStandardMaterial color={head} roughness={0.5} />
      </mesh>

      {/* Ánh sáng màn hình hắt lên mặt + không khí */}
      <pointLight position={[0, 0.5, 1.4]} intensity={5} color={colors[0]} distance={5} />
    </group>
  );
};

/* ------------------------------ WALK scene ------------------------------ */
/** NGƯỜI ĐANG ĐI BỘ (nhìn nghiêng, hướng đi = +X). Tay GẦN (màu sáng) vung rõ trước thân,
 *  chân sải rộng có bàn chân, thân nhún theo bước — đọc ra ngay là đang bước đi. */
const WalkScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => {
  const body = colors[1]!;
  const head = "#dbe4e8";
  const dark = "#18232c";
  const s = Math.sin(t * 3.5);
  const bob = Math.abs(Math.cos(t * 3.5)) * 0.1;
  const limbMat = (color: string) => <meshStandardMaterial color={color} roughness={0.55} metalness={0.1} />;
  const leg = (rotZ: number, z: number, r: number, len: number) => (
    <group position={[0, 0.62, z]} rotation={[0, 0, rotZ]}>
      <mesh position={[0, -len / 2, 0]}>
        <capsuleGeometry args={[r, len, 8, 16]} />
        {limbMat(body)}
      </mesh>
      <mesh position={[0.1, -len - 0.02, 0]}>
        <boxGeometry args={[0.32, 0.14, 0.2]} />
        {limbMat(dark)}
      </mesh>
    </group>
  );
  const arm = (rotZ: number, z: number, color: string) => (
    <group position={[0, 1.36, z]} rotation={[0, 0, rotZ]}>
      <mesh position={[0, -0.34, 0]}>
        <capsuleGeometry args={[0.1, 0.62, 8, 16]} />
        {limbMat(color)}
      </mesh>
    </group>
  );
  return (
    <group position={[0, -0.35 + bob, 0]} rotation={[0, 0, 0.04]}>
      {arm(s * 0.6, -0.3, body)} {/* tay xa */}
      {leg(-s * 0.7, -0.15, 0.15, 0.82)} {/* chân xa */}
      {leg(s * 0.7, 0.15, 0.16, 0.84)} {/* chân gần */}
      {/* balô sau lưng — vibe "lên đường" */}
      <mesh position={[-0.34, 1.1, 0]} rotation={[0, 0, 0.05]}>
        <capsuleGeometry args={[0.26, 0.42, 8, 16]} />
        {limbMat(dark)}
      </mesh>
      {/* thân */}
      <mesh position={[0, 1.06, 0]}>
        <capsuleGeometry args={[0.32, 0.78, 8, 20]} />
        {limbMat(body)}
      </mesh>
      {arm(-s * 0.6, 0.32, head)} {/* tay GẦN — sáng, vung rõ trước thân */}
      {/* đầu + mũi (hướng đi +X) + tóc */}
      <mesh position={[0, 1.88, 0]}>
        <sphereGeometry args={[0.33, 32, 32]} />
        {limbMat(head)}
      </mesh>
      <mesh position={[0.29, 1.86, 0]}>
        <coneGeometry args={[0.06, 0.14, 12]} />
        {limbMat(head)}
      </mesh>
      <mesh position={[-0.04, 2.02, 0]} rotation={[0, 0, -0.2]}>
        <sphereGeometry args={[0.35, 28, 28, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        {limbMat(dark)}
      </mesh>
      {/* mặt đất */}
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 5]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={0.07} />
      </mesh>
    </group>
  );
};

/* ----------------------------- ROCKET scene ----------------------------- */
/** TÊN LỬA phóng lên — thân + chóp + cánh + lửa phụt nhấp nháy + hạt khói bay lên. */
const RocketScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => {
  const bob = Math.sin(t * 2) * 0.14;
  const flame = 0.7 + Math.sin(t * 22) * 0.3;
  const wob = Math.sin(t * 1.5) * 0.05;
  return (
    <group position={[0, bob, 0]} rotation={[0, 0, wob]}>
      {/* thân */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.8, 24]} />
        <meshToonMaterial color={colors[2]} />
      </mesh>
      {/* chóp */}
      <mesh position={[0, 1.65, 0]}>
        <coneGeometry args={[0.5, 0.95, 24]} />
        <meshToonMaterial color={colors[0]} />
      </mesh>
      {/* cửa sổ */}
      <mesh position={[0, 0.75, 0.46]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial color={colors[1]} emissive={colors[1]} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {/* cánh */}
      {([-1, 1] as const).map((sgn, i) => (
        <mesh key={i} position={[sgn * 0.5, -0.35, 0]} rotation={[0, 0, sgn * -0.5]}>
          <boxGeometry args={[0.5, 0.6, 0.12]} />
          <meshToonMaterial color={colors[0]} />
        </mesh>
      ))}
      {/* lửa phụt (chóp quay xuống) */}
      <mesh position={[0, -1.1, 0]} rotation={[Math.PI, 0, 0]} scale={[1, flame * 1.7, 1]}>
        <coneGeometry args={[0.38, 1, 20]} />
        <meshStandardMaterial color="#ffcf5c" emissive="#ff8a3d" emissiveIntensity={1.3} toneMapped={false} />
      </mesh>
      <pointLight position={[0, -1.4, 0]} intensity={6} color="#ff8a3d" distance={4} />
      {/* hạt khói bay lên hai bên */}
      {Array.from({ length: 8 }).map((_, i) => {
        const yy = -1.6 + ((t * 1.2 + i * 0.5) % 2.4);
        const xx = (i % 2 === 0 ? -1 : 1) * (0.3 + (i % 3) * 0.12);
        return (
          <mesh key={`p${i}`} position={[xx, yy, 0]} scale={0.12 + (i % 3) * 0.03}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color={colors[1]} transparent opacity={0.25} />
          </mesh>
        );
      })}
    </group>
  );
};

/* ------------------------------ PHONE scene ----------------------------- */
/** ĐIỆN THOẠI — thân + màn hình sáng + các icon ứng dụng bay nổi lên quanh máy. */
const PhoneScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => {
  const bob = Math.sin(t * 1.4) * 0.1;
  return (
    <group position={[0, bob, 0]} rotation={[0, Math.sin(t * 0.3) * 0.25, 0]}>
      {/* thân máy */}
      <mesh>
        <boxGeometry args={[1.5, 3, 0.18]} />
        <meshToonMaterial color={DESK} />
      </mesh>
      {/* màn hình sáng */}
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[1.28, 2.7, 0.04]} />
        <meshStandardMaterial color={colors[0]} emissive={colors[0]} emissiveIntensity={0.45} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0, 1]} intensity={4} color={colors[0]} distance={5} />
      {/* icon ứng dụng bay nổi lên quanh máy (thông báo) */}
      {Array.from({ length: 7 }).map((_, i) => {
        const yy = -1.6 + ((t * 0.7 + i * 0.6) % 3.6);
        const side = i % 2 === 0 ? -1 : 1;
        const xx = side * (1.2 + (i % 3) * 0.28);
        const fade = Math.sin((yy + 1.6) / 3.6 * Math.PI); // mờ ở đầu/cuối hành trình
        const c = colors[i % 2]!;
        return (
          <mesh key={i} position={[xx, yy, 0.2]} rotation={[0, 0, t * 0.5 + i]} scale={0.24}>
            <boxGeometry args={[1, 1, 0.3]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} transparent opacity={0.35 + fade * 0.6} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

/* ------------------------------ BRAIN scene ----------------------------- */
/** BỘ NÃO / AI — cụm khối cầu (thuỳ não) phát sáng, thở, xoay; vài "tia" nơ-ron loé quanh. */
const BRAIN_LOBES: [number, number, number, number][] = [
  [-0.5, 0.2, 0, 0.72], [0.5, 0.2, 0, 0.72], [-0.35, 0.72, 0.1, 0.46], [0.35, 0.72, 0.1, 0.46],
  [0, 0.42, 0.5, 0.5], [0, 0.32, -0.5, 0.5], [-0.62, -0.28, 0.1, 0.42], [0.62, -0.28, 0.1, 0.42],
];
const BrainScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => {
  const pulse = 0.5 + Math.sin(t * 2) * 0.5;
  return (
    <group rotation={[0.2, t * 0.3, 0]} position={[0, 0.15, 0]} scale={1 + pulse * 0.03}>
      {BRAIN_LOBES.map((l, i) => (
        <mesh key={i} position={[l[0], l[1], l[2]]}>
          <sphereGeometry args={[l[3], 20, 20]} />
          <meshToonMaterial color={colors[0]} />
        </mesh>
      ))}
      <pointLight intensity={pulse * 4 + 2} color={colors[0]} distance={7} />
      {Array.from({ length: 7 }).map((_, i) => {
        const a = (i / 7) * Math.PI * 2;
        const r = 1.15;
        const f = Math.sin(t * 4 + i) * 0.5 + 0.5;
        return (
          <mesh key={`s${i}`} position={[Math.cos(a) * r, 0.3 + Math.sin(a) * r * 0.75, 0.7]} scale={0.06 + f * 0.07}>
            <sphereGeometry args={[1, 10, 10]} />
            <meshStandardMaterial color={colors[1]} emissive={colors[1]} emissiveIntensity={f * 2} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

/* ------------------------------ IDEA scene ------------------------------ */
/** BÓNG ĐÈN Ý TƯỞNG — bầu thuỷ tinh phát sáng NHẤP NHÁY + đui + tia sáng toả quanh. */
const IdeaScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => {
  const glow = 0.5 + (Math.sin(t * 3) * 0.5 + 0.5) * 1.0;
  const bob = Math.sin(t * 1.5) * 0.12;
  return (
    <group position={[0, bob, 0]} rotation={[0, Math.sin(t * 0.3) * 0.2, 0]}>
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshStandardMaterial color={colors[0]} emissive={colors[0]} emissiveIntensity={glow} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <torusGeometry args={[0.26, 0.045, 8, 24]} />
        <meshStandardMaterial color="#fff3b0" emissive="#ffe066" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.32, 0.36, 0.48, 20]} />
        <meshToonMaterial color={DESK} />
      </mesh>
      <mesh position={[0, -0.66, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.26, 20]} />
        <meshToonMaterial color="#7a8791" />
      </mesh>
      <pointLight position={[0, 0.6, 0]} intensity={glow * 8} color={colors[0]} distance={8} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const r = 1.35;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.6 + Math.sin(a) * r, 0]} rotation={[0, 0, a]} scale={0.5 + glow * 0.35}>
            <boxGeometry args={[0.3, 0.05, 0.05]} />
            <meshBasicMaterial color={colors[0]} transparent opacity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
};

/* ------------------------------ MONEY scene ----------------------------- */
/** TIỀN — hai chồng xu vàng + một đồng xu bay xoay. Vàng cố ý lệch palette (tiền = vàng). */
const GOLD = "#f2c14e";
const GOLD_D = "#d9a441";
const MoneyScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => {
  void colors;
  const bob = Math.sin(t * 1.5) * 0.1;
  return (
    <group position={[-0.2, -0.5 + bob, 0]} rotation={[0, Math.sin(t * 0.25) * 0.3, 0]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, i * 0.28, 0]} rotation={[0, t * 0.3 + i, 0]}>
          <cylinderGeometry args={[0.9, 0.9, 0.24, 32]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD_D} emissiveIntensity={0.18} metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={`b${i}`} position={[1.55, i * 0.28, 0.3]} rotation={[0, -t * 0.25 - i, 0]}>
          <cylinderGeometry args={[0.72, 0.72, 0.22, 32]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD_D} emissiveIntensity={0.18} metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0.6, 1.9 + Math.sin(t * 2) * 0.2, 0.5]} rotation={[0, t * 3, Math.PI / 2.2]}>
        <cylinderGeometry args={[0.62, 0.62, 0.16, 32]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD_D} emissiveIntensity={0.3} metalness={0.4} roughness={0.35} />
      </mesh>
    </group>
  );
};

/* ------------------------------ GEAR scene ------------------------------ */
/** BÁNH RĂNG / QUY TRÌNH — hai bánh răng lồng nhau quay ngược chiều. */
const GearScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => {
  const gear = (cx: number, cy: number, r: number, teeth: number, speed: number, color: string) => (
    <group position={[cx, cy, 0]} rotation={[0, 0, t * speed]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, 0.32, 28]} />
        <meshToonMaterial color={color} />
      </mesh>
      {Array.from({ length: teeth }).map((_, i) => {
        const a = (i / teeth) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * r, Math.sin(a) * r, 0]} rotation={[0, 0, a]}>
            <boxGeometry args={[0.3, 0.24, 0.34]} />
            <meshToonMaterial color={color} />
          </mesh>
        );
      })}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.32, r * 0.32, 0.36, 20]} />
        <meshToonMaterial color={DESK} />
      </mesh>
    </group>
  );
  return (
    <group rotation={[0, Math.sin(t * 0.2) * 0.1, 0]} position={[0, 0.1, 0]}>
      {gear(-0.75, 0.35, 1.15, 10, 0.5, colors[1]!)}
      {gear(1.05, -0.65, 0.85, 8, -0.66, colors[0]!)}
    </group>
  );
};

/* ---------------------------- BUILDING scene ---------------------------- */
/** TOÀ NHÀ VĂN PHÒNG — vài toà cao thấp, cửa sổ sáng đều (thành phố/công ty). */
const BuildingScene: React.FC<{ colors: string[]; t: number }> = ({ colors, t }) => {
  const tower = (x: number, w: number, h: number, rows: number, seed: number) => {
    const win: React.ReactNode[] = [];
    const cols = 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = hash(r * 7 + c * 13 + seed * 3, seed) > 0.42;
        win.push(
          <mesh key={`${r}-${c}`} position={[(c - (cols - 1) / 2) * (w / cols) * 0.9, -h / 2 + 0.35 + r * ((h - 0.6) / Math.max(1, rows - 1)), w / 2 + 0.01]}>
            <boxGeometry args={[w / cols * 0.5, 0.18, 0.04]} />
            <meshStandardMaterial color={lit ? colors[0] : DESK} emissive={lit ? colors[0] : "#000"} emissiveIntensity={lit ? 0.7 : 0} toneMapped={false} />
          </mesh>,
        );
      }
    }
    return (
      <group position={[x, h / 2 - 1.6, 0]}>
        <mesh>
          <boxGeometry args={[w, h, w]} />
          <meshToonMaterial color="#2f3d47" />
        </mesh>
        {win}
      </group>
    );
  };
  return (
    <group rotation={[0, Math.sin(t * 0.22) * 0.14, 0]}>
      {tower(-1.5, 1.0, 3.0, 5, 1)}
      {tower(0, 1.25, 4.4, 7, 2)}
      {tower(1.55, 0.9, 2.4, 4, 3)}
    </group>
  );
};

/* ------------------------------ Dispatch -------------------------------- */

/** Vẽ một scene theo tên (dùng cho cả nền lẫn chủ thể). */
function renderScene(name: string, colors: string[], t: number): React.ReactNode {
  switch (name) {
    case "network": return <NetworkScene colors={colors} t={t} />;
    case "particles": return <ParticlesScene colors={colors} t={t} />;
    case "bars3d": return <BarsScene colors={colors} t={t} />;
    case "globe": return <GlobeScene colors={colors} t={t} />;
    case "orbit": return <OrbitScene colors={colors} t={t} />;
    case "coder": return <CoderScene colors={colors} t={t} />;
    case "walk": return <WalkScene colors={colors} t={t} />;
    case "rocket": return <RocketScene colors={colors} t={t} />;
    case "phone": return <PhoneScene colors={colors} t={t} />;
    case "brain": return <BrainScene colors={colors} t={t} />;
    case "idea": return <IdeaScene colors={colors} t={t} />;
    case "money": return <MoneyScene colors={colors} t={t} />;
    case "gear": return <GearScene colors={colors} t={t} />;
    case "building": return <BuildingScene colors={colors} t={t} />;
    default: return <FloatScene colors={colors} t={t} />;
  }
}

/**
 * SceneByVariant — GHÉP nền + chủ thể.
 *   - Có `subject`  → nền (`variant`) ĐẨY LÙI + phóng to (không khí mờ phía sau) và chủ thể
 *     DỊCH XUỐNG nửa dưới (chừa nửa trên cho chữ). Khung giàu: nền + nhân vật + chữ.
 *   - Không `subject` → `variant` vẽ chính giữa như cũ (nền-only hoặc chủ thể-only).
 */
const SceneByVariant: React.FC<{ variant: string; subject?: string; colors: string[]; bg: string }> = ({
  variant,
  subject,
  colors,
  bg,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const composed = !!subject;
  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, composed ? 8 : 9, composed ? 20 : 24]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 7, 7]} intensity={2.1} color="#ffffff" />
      <directionalLight position={[-6, -3, 2]} intensity={0.6} color={colors[1]} />

      {/* NỀN — đẩy lùi + phóng to khi có chủ thể để thành lớp không khí phía sau. */}
      <group position={[0, composed ? 0.5 : 0, composed ? -4 : 0]} scale={composed ? 1.5 : 1}>
        {renderScene(variant, colors, t)}
      </group>

      {/* CHỦ THỂ — ở trước, dịch xuống nửa dưới để chừa chỗ cho chữ ở trên. */}
      {subject && (
        <group position={[0, -1.55, 0.6]} scale={0.82}>
          {renderScene(subject, colors, t)}
        </group>
      )}
    </>
  );
};

export const Gfx3dBackdrop: React.FC<{ palette: Palette; variant?: string; subject?: string }> = ({ palette, variant, subject }) => {
  const { width, height } = useVideoConfig();
  const colors = [palette.accent, palette.accent2, palette.text];
  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0, 9], fov: 46 }}
        gl={{ antialias: true }}
        style={{ backgroundColor: palette.bg }}
      >
        <SceneByVariant variant={variant ?? "float"} subject={subject} colors={colors} bg={palette.bg} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
