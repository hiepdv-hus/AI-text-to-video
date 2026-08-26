import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, staticFile } from "remotion";
import type { Media } from "../schema";
import { tokens } from "../theme/tokens";

/**
 * Background — nền của scene.
 *  - image → <Img> (tự delayRender chờ load) + Ken Burns (zoom/pan chậm).
 *  - video → <OffthreadVideo> (nhanh hơn <Video> khi render).
 *  - color → màu phẳng.
 *  KHÔNG dùng <img>/<Video>/<video>.
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

export const Background: React.FC<{
  media?: Media;
  durationInFrames: number;
  kenBurns?: boolean;
  scrim?: boolean;
}> = ({ media, durationInFrames, kenBurns = false, scrim = true }) => {
  const frame = useCurrentFrame();

  // Không có media → trong suốt, để nền chung (VideoComposition) hiện xuyên qua.
  if (!media) return null;
  if (media.kind === "color") {
    return <AbsoluteFill style={{ backgroundColor: media.src }} />;
  }

  const origin = focusToOrigin[media.focus];

  if (media.kind === "video") {
    return (
      <AbsoluteFill style={{ backgroundColor: tokens.color.bg }}>
        <OffthreadVideo
          src={resolveSrc(media.src)}
          muted
          style={{ width: "100%", height: "100%", objectFit: media.fit, objectPosition: origin }}
        />
        {scrim && <AbsoluteFill style={{ backgroundColor: tokens.color.scrim }} />}
      </AbsoluteFill>
    );
  }

  // image
  const scale = kenBurns
    ? interpolate(frame, [0, durationInFrames], [1.06, 1.16], { extrapolateRight: "clamp" })
    : 1;
  const pan = kenBurns
    ? interpolate(frame, [0, durationInFrames], [0, media.focus === "center" ? 0 : 20], {
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: tokens.color.bg, overflow: "hidden" }}>
      <Img
        src={resolveSrc(media.src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: media.fit,
          objectPosition: origin,
          transform: `scale(${scale}) translateX(${pan}px)`,
          transformOrigin: origin,
        }}
      />
      {scrim && <AbsoluteFill style={{ backgroundColor: tokens.color.scrim }} />}
    </AbsoluteFill>
  );
};
