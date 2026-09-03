import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { BuiltProps } from "../schema";
import { SceneWrapper } from "../components/SceneWrapper";
import { TechBackground } from "../components/TechBackground";
import { AuroraBackground } from "../components/AuroraBackground";
import { SpiderBackground } from "../components/SpiderBackground";
import { ClaudeBackground } from "../components/ClaudeBackground";
import { FilmGrain } from "../components/FilmGrain";
import { ThemeContext, paletteFor } from "../theme/claude";

/**
 * VideoComposition — renderer chung cho mọi template. Nền do meta.background quyết định.
 * Nếu là nền Claude (claude-dark/claude-cream) → cấp Palette qua ThemeContext để mọi
 * component tự đổi màu/cỡ chữ đồng bộ; nền khác → context = null (giữ đường neon cũ).
 */
export const VideoComposition: React.FC<BuiltProps> = ({
  meta,
  scenes,
  captions,
  music,
  totalDurationInFrames,
}) => {
  const palette = paletteFor(meta.background);
  const isClaudeBg = meta.background === "claude-dark" || meta.background === "claude-cream";
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, totalDurationInFrames], [0, 1], { extrapolateRight: "clamp" });
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

        {/* Thanh tiến trình mép trên. Hai việc cùng lúc: cho người xem biết còn bao lâu
            (giữ chân tốt hơn hẳn khi họ thấy sắp hết), và là thứ DUY NHẤT chuyển động
            liên tục suốt video, nối các cảnh lại thành một mạch. */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "rgba(0,0,0,0.35)" }}>
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: palette.accentGradient,
              boxShadow: palette.glow,
            }}
          />
        </div>

        {/* Hạt phim nằm TRÊN mọi thứ (kể cả chữ) — đó là điểm khác giữa "lớp grain" và
            "nền có nhiễu": nó phải phủ đều cả khung thì mắt mới đọc ra là chất phim. */}
        <FilmGrain />

        {music && <Audio src={staticFile(music.src)} volume={music.volume} loop />}
      </AbsoluteFill>
    </ThemeContext.Provider>
  );
};
