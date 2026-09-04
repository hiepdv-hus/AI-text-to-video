import React from "react";
import {
  AbsoluteFill,
  Img,
  Loop,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Media } from "../schema";
import { useTheme, type Palette } from "../theme/claude";
import { useDrift } from "./motion";

/**
 * SceneBackdrop — NỀN TOÀN MÀN HÌNH của một scene.
 *
 * Quy tắc (cố ý đơn giản, không cần field thêm trong spec):
 *   media.kind === "video"  → cảnh quay chạy FULL-BLEED làm nền, nội dung đè lên trên.
 *   media.kind === "color"  → màu phẳng.
 *   media.kind === "image"  → KHÔNG làm nền; ảnh được đóng khung trong layout
 *                             (xem `Framed` ở ClaudeLayouts) để giữ bố cục sạch.
 *   không có media          → trong suốt, để backdrop chung (mưa nhị phân) hiện xuyên qua.
 *
 * Cảnh CÓ VIDEO thì video là nền DUY NHẤT — không phủ mưa nhị phân lên nữa. Trộn hai
 * thứ vào nhau chỉ làm bẩn cảnh quay mà chẳng thêm được gì; để tách bạch thì mỗi cảnh
 * có một danh tính rõ ràng: hoặc là cảnh quay thật, hoặc là nền đồ hoạ.
 *
 * Hai lớp, theo đúng thứ tự — đây là phần quyết định "đẹp & đọc được":
 *   1. VIDEO    GIỮ NGUYÊN BẢN màu & độ sáng gốc (độc lập với tông theme), chỉ blur nhẹ
 *               để "xoá phông", phóng chậm và trôi ngang (Ken Burns). Cố ý KHÔNG nhuộm
 *               duotone / không chỉnh brightness theo theme để clip Pexels không bị
 *               "đồng bộ" thành một mảng màu với nền tech.
 *   2. SCRIM    gradient tối trên/dưới + vignette, chừa vùng giữa cho hình ảnh thở.
 */

function resolveSrc(src: string): string {
  if (/^https?:\/\//.test(src) || src.startsWith("data:")) return src;
  return staticFile(src); // đường dẫn trong public/
}

const focusToOrigin: Record<NonNullable<Media["focus"]>, string> = {
  center: "50% 50%",
  top: "50% 20%",
  bottom: "50% 80%",
  left: "20% 50%",
  right: "80% 50%",
};

/**
 * Scrim — lớp phủ giữ chữ đọc rõ, kiểu "letterbox": ĐẬM ở hai đầu (nơi có tiêu đề và
 * caption), NHẠT ở giữa để cảnh quay còn nhìn ra là cảnh gì. Chữ tự có đổ bóng
 * (xem Heading.tsx) nên dải giữa mới dám để nhạt — nếu phủ đều tay thì clip tối sẽ
 * thành một mảng đen, mất luôn lý do dùng video.
 */
const Scrim: React.FC<{ p: Palette }> = ({ p }) => {
  const c = p.scrimRgb;
  const a = (v: number) => `rgba(${c},${v})`;
  const light = !p.isDark;
  return (
    <>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${a(light ? 0.88 : 0.8)} 0%, ${a(light ? 0.58 : 0.42)} 20%, ${a(
            light ? 0.48 : 0.3,
          )} 46%, ${a(light ? 0.84 : 0.8)} 72%, ${a(light ? 0.96 : 0.94)} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{ background: `radial-gradient(ellipse at 50% 44%, transparent 32%, ${a(light ? 0.5 : 0.62)} 100%)` }}
      />
    </>
  );
};

export const SceneBackdrop: React.FC<{
  media?: Media;
  durationInFrames: number;
  /**
   * Cảnh có nhiều nội dung đè lên (thẻ, biểu đồ, timeline, cửa sổ code) hay không.
   * Cảnh "bận" thì video nền phải lùi hẳn ra sau — làm mờ mạnh để nó thành CHẤT LIỆU,
   * không còn là hình để nhìn. Cảnh chỉ có một dòng tiêu đề thì mờ nhẹ thôi, để người
   * xem còn thấy được cảnh quay.
   */
  busy?: boolean;
}> = ({ media, durationInFrames, busy = false }) => {
  const p = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!media) return null;
  if (media.kind === "color") return <AbsoluteFill style={{ backgroundColor: media.src }} />;
  if (media.kind !== "video") return null; // ảnh → đóng khung trong layout, không làm nền

  const origin = focusToOrigin[media.focus];
  // Phóng rất chậm: đủ để khung hình "sống" mà không lộ ra là đang zoom. Không bắt đầu
  // từ 1.0 vì video có blur — không phóng dư ra thì thấy mép mờ ở rìa khung.
  // Đặt transform ở BỌC NGOÀI <Loop>: nếu đặt trong, useCurrentFrame() là frame của
  // vòng lặp nên zoom sẽ giật về đầu mỗi lần clip lặp lại.
  const scale = interpolate(frame, [0, durationInFrames], busy ? [1.1, 1.17] : [1.05, 1.13], {
    extrapolateRight: "clamp",
  });
  // Trôi ngang rất chậm cộng thêm vào phóng: chuyển động 2 chiều đọc ra là "máy quay
  // đang đi", còn phóng đơn thuần chỉ đọc ra là "ảnh đang to dần".
  const driftX = useDrift(0, 0.05) * 22;
  const driftY = useDrift(3, 0.04) * 14;

  // "Xoá phông": clip Pexels rất hay có chữ tiếng Anh to đùng (log, terminal, UI) đá nhau
  // với tiêu đề. Làm mờ là cách duy nhất chắc chắn vô hiệu hoá nó mà vẫn giữ chuyển động
  // và màu. Cảnh bận thì mờ mạnh (8px) để clip thành chất liệu thuần tuý.
  const blur = busy ? 8 : 3;

  const video = (
    <OffthreadVideo
      src={resolveSrc(media.src)}
      muted
      style={{
        width: "100%",
        height: "100%",
        objectFit: media.fit,
        objectPosition: origin,
        filter: `blur(${blur}px)`,
      }}
    />
  );

  // Clip thường ngắn hơn cảnh → lặp lại thay vì đứng hình ở khung cuối.
  // Trừ 1 frame để không dính khung cuối bị lặp/đen ở một số clip.
  const loopFrames = media.durationSec ? Math.max(1, Math.floor(media.durationSec * fps) - 1) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: p.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${driftX}px, ${driftY}px)`,
          transformOrigin: origin,
        }}
      >
        {loopFrames > 0 && loopFrames < durationInFrames ? (
          <Loop durationInFrames={loopFrames}>{video}</Loop>
        ) : (
          video
        )}
      </AbsoluteFill>

      <Scrim p={p} />
    </AbsoluteFill>
  );
};

/**
 * BackdropImage — ảnh nền full-bleed. Không dùng trong luồng mặc định (ảnh được đóng
 * khung trong layout), giữ lại để spec cũ dùng media.kind "image" ở layout hook vẫn
 * có đường render nhất quán nếu cần bật lại.
 */
export const BackdropImage: React.FC<{ src: string; focus: NonNullable<Media["focus"]>; fit: Media["fit"] }> = ({
  src,
  focus,
  fit,
}) => {
  const p = useTheme();
  const origin = focusToOrigin[focus];
  return (
    <AbsoluteFill style={{ backgroundColor: p.bg, overflow: "hidden" }}>
      <Img src={resolveSrc(src)} style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: origin }} />
      <Scrim p={p} />
    </AbsoluteFill>
  );
};
