import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { BuiltScene, Captions, TransitionKind } from "../schema";
import { Background } from "./Background";
import { LAYOUTS } from "./layouts";
import { KaraokeCaption } from "./KaraokeCaption";

/**
 * SceneWrapper — ghép 1 scene: nền + foreground layout + audio + karaoke caption
 * + hiệu ứng transitionIn.
 *
 * Về transitions: dùng interpolate() theo frame cho hiệu ứng VÀO của mỗi scene thay vì
 * @remotion/transitions TransitionSeries. Lý do: TransitionSeries chồng lấn frame giữa
 * các scene → lệch audio đặt theo từng scene. Cách này giữ timing khớp audio tuyệt đối
 * (fade/slide/wipe vẫn có, xem enterStyle()).
 */

const ENTER_FRAMES = 12;

function enterStyle(kind: TransitionKind, frame: number): React.CSSProperties {
  const p = interpolate(frame, [0, ENTER_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  switch (kind) {
    case "none":
      return {};
    case "fade":
      return { opacity: p };
    case "slide-left":
      return { transform: `translateX(${interpolate(p, [0, 1], [100, 0])}%)` };
    case "slide-up":
      return { transform: `translateY(${interpolate(p, [0, 1], [100, 0])}%)` };
    case "wipe":
      return { clipPath: `inset(0 ${interpolate(p, [0, 1], [100, 0])}% 0 0)` };
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
  const Layout = LAYOUTS[scene.layout];
  const kenBurns = scene.layout === "product" && scene.media?.kind === "image";
  // Scrim chỉ phủ lên ẢNH tĩnh cho dễ đọc chữ. KHÔNG phủ lên video (talking-head/
  // b-roll) để không làm tối khuôn mặt.
  const showScrim = scene.layout === "product" && scene.media?.kind === "image";

  return (
    <AbsoluteFill style={enterStyle(scene.transitionIn, frame)}>
      <Background
        // layout "image" tự vẽ ảnh khung → không dùng ảnh làm nền toàn màn.
        media={scene.layout === "image" ? undefined : scene.media}
        durationInFrames={scene.durationInFrames}
        kenBurns={kenBurns}
        scrim={showScrim}
      />
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
