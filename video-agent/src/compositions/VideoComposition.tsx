import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import type { BuiltProps } from "../schema";
import { tokens } from "../theme/tokens";
import { SceneWrapper } from "../components/SceneWrapper";
import { TechBackground } from "../components/TechBackground";
import { AuroraBackground } from "../components/AuroraBackground";
import { SpiderBackground } from "../components/SpiderBackground";
import { BrandHeader } from "../components/BrandHeader";

/**
 * VideoComposition — renderer chung cho mọi template (ProductReview/ListicleTop5/
 * StoryHook). Template chỉ khác ở CÁCH agent viết scenes, không khác ở cách render.
 *
 * Mỗi scene bọc trong <Sequence from durationInFrames> — cả hai TÍNH TỪ audio thật
 * (pipeline/build.ts), không ước lượng.
 */
export const VideoComposition: React.FC<BuiltProps> = ({ meta, scenes, captions, music }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: tokens.color.bg }}>
      {/* Nền chung — hiện xuyên qua các scene không có media riêng. */}
      {meta.background === "tech" && <TechBackground />}
      {meta.background === "aurora" && <AuroraBackground />}
      {meta.background === "spider" && <SpiderBackground />}

      {scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.fromFrame}
          durationInFrames={scene.durationInFrames}
          name={`${scene.layout}:${scene.id}`}
        >
          <SceneWrapper scene={scene} captions={captions} width={meta.width} height={meta.height} />
        </Sequence>
      ))}

      {/* Thanh thương hiệu (overlay trên mọi scene) */}
      {meta.brand && (
        <BrandHeader name={meta.brand.name} logo={meta.brand.logo} hint={meta.brand.hint} height={meta.height} />
      )}

      {music && <Audio src={staticFile(music.src)} volume={music.volume} loop />}
    </AbsoluteFill>
  );
};
