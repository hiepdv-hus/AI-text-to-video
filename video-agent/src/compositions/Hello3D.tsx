import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";

/**
 * Hello3D — composition CHỨNG MINH đường render WebGL (Chrome headless + @remotion/three).
 * Không phụ thuộc pipeline. Render được file này ra MP4 CÓ HÌNH = WebGL headless đã sống,
 * mọi widget 3D sau này chỉ là chuyện nội dung.
 *
 * Pass/fail rõ ràng: nếu MP4 hiện khối + torus xoay có ĐỔ BÓNG (mặt sáng-tối khác nhau
 * theo hướng đèn) trên nền than → WebGL chạy. Nếu KHUNG ĐEN → GL_RENDERER trong render.ts
 * chưa đúng (thử REMOTION_GL=swangle).
 */

const ACCENT = "#3BE8A0"; // xanh matrix của theme "tech" — để mắt nhận ra màu ra đúng
const ACCENT2 = "#56C7F5";

const Spinner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <>
      {/* Ba nguồn sáng để bề mặt có gradient sáng-tối rõ — đây là "bằng chứng 3D". */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={2.2} color="#ffffff" />
      <pointLight position={[-6, -4, 4]} intensity={40} color={ACCENT2} />

      {/* Khối lập phương xoay ba trục */}
      <mesh rotation={[t * 0.9, t * 1.2, 0]} position={[0, 1.6, 0]}>
        <boxGeometry args={[2.2, 2.2, 2.2]} />
        <meshStandardMaterial color={ACCENT} metalness={0.3} roughness={0.35} />
      </mesh>

      {/* Torus knot — hình cong để thấy rõ đổ bóng mượt, khó "giả" bằng 2D */}
      <mesh rotation={[t * 0.6, t * 0.8, t * 0.3]} position={[0, -1.8, 0]}>
        <torusKnotGeometry args={[1.3, 0.42, 160, 24]} />
        <meshStandardMaterial color={ACCENT2} metalness={0.6} roughness={0.25} />
      </mesh>
    </>
  );
};

export const Hello3D: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#05080D" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0, 9], fov: 50 }}
        style={{ backgroundColor: "transparent" }}
      >
        <Spinner />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
