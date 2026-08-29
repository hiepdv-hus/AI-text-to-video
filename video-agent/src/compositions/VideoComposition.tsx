import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import type { BuiltProps } from "../schema";
import { SceneWrapper } from "../components/SceneWrapper";
import { TechBackground } from "../components/TechBackground";
import { AuroraBackground } from "../components/AuroraBackground";
import { SpiderBackground } from "../components/SpiderBackground";
import { ClaudeBackground } from "../components/ClaudeBackground";
import { ThemeContext, paletteFor } from "../theme/claude";

/**
 * VideoComposition — renderer chung cho mọi template. Nền do meta.background quyết định.
 * Nếu là nền Claude (claude-dark/claude-cream) → cấp Palette qua ThemeContext để mọi
 * component tự đổi màu/cỡ chữ đồng bộ; nền khác → context = null (giữ đường neon cũ).
 */
export const VideoComposition: React.FC<BuiltProps> = ({ meta, scenes, captions, music }) => {
  const palette = paletteFor(meta.background);
  const isClaudeBg = meta.background === "claude-dark" || meta.background === "claude-cream";
  return (
    <ThemeContext.Provider value={palette}>
      <AbsoluteFill style={{ backgroundColor: palette.bg }}>
        {/* Backdrop tuỳ chọn — presentation (card/chữ) luôn theo style Claude bên trên. */}
        {isClaudeBg && <ClaudeBackground palette={palette} />}
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

        {music && <Audio src={staticFile(music.src)} volume={music.volume} loop />}
      </AbsoluteFill>
    </ThemeContext.Provider>
  );
};
