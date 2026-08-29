import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { BuiltScene, Captions, TransitionKind } from "../schema";
import { KaraokeCaption } from "./KaraokeCaption";
import { CLAUDE_LAYOUTS } from "./claude/ClaudeLayouts";

/**
 * SceneWrapper — ghép 1 scene: nền + foreground layout + audio + karaoke caption
 * + hiệu ứng transitionIn.
 *
 * Về transitions: dùng interpolate() theo frame cho hiệu ứng VÀO của mỗi scene thay vì
 * @remotion/transitions TransitionSeries. Lý do: TransitionSeries chồng lấn frame giữa
 * các scene → lệch audio đặt theo từng scene. Cách này giữ timing khớp audio tuyệt đối
 * (fade/slide/wipe vẫn có, xem enterStyle()).
 */

const ENTER_FRAMES = 16;

/** smoothstep — làm mềm chuyển động vào/ra (đỡ cứng như tuyến tính). */
const smooth = (p: number) => p * p * (3 - 2 * p);

function enterStyle(kind: TransitionKind, frame: number): React.CSSProperties {
  const raw = interpolate(frame, [0, ENTER_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const p = smooth(raw);
  switch (kind) {
    case "none":
      return {};
    case "fade":
      return { opacity: p };
    // Trượt kèm fade + dịch một quãng ngắn (mượt, điện ảnh — không "đẩy" cả màn).
    case "slide-left":
      return { opacity: p, transform: `translateX(${interpolate(p, [0, 1], [120, 0])}px)` };
    case "slide-up":
      return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [120, 0])}px)` };
    case "wipe":
      return { clipPath: `inset(0 ${interpolate(p, [0, 1], [100, 0])}% 0 0)` };
    case "zoom":
      return { opacity: p, transform: `scale(${interpolate(p, [0, 1], [1.14, 1])})` };
    case "blur":
      return { opacity: p, filter: `blur(${interpolate(p, [0, 1], [22, 0])}px)` };
    case "glow":
      return {
        opacity: p,
        transform: `scale(${interpolate(p, [0, 1], [0.92, 1])})`,
        filter: `brightness(${interpolate(p, [0, 1], [1.9, 1])})`,
      };
    default: {
      const _e: never = kind;
      throw new Error(`Transition không tồn tại: ${_e}`);
    }
  }
}

export const SceneWrapper: React.FC<{
  scene: BuiltScene;
  captions: Captions;
  width: number;
  height: number;
}> = ({ scene, captions, height }) => {
  const frame = useCurrentFrame();
  // Style Claude cho MỌI nền: ảnh luôn ĐÓNG KHUNG trong layout (không tràn màn),
  // nền (backdrop) giữ nguyên nền đã chọn.
  const Layout = CLAUDE_LAYOUTS[scene.layout];

  return (
    <AbsoluteFill style={enterStyle(scene.transitionIn, frame)}>
      <Layout scene={scene} height={height} />
      <KaraokeCaption
        words={scene.words}
        style={captions.style}
        position={captions.position}
        maxWordsPerLine={captions.maxWordsPerLine}
        highlightColor={captions.highlightColor}
      />
      <Audio src={staticFile(scene.audioSrc)} />
    </AbsoluteFill>
  );
};
