import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { buildDuckEnvelope } from "../components/ducking";
import type { BuiltProps } from "../schema";
import { SceneWrapper, BACKDROP_FADE_FRAMES } from "../components/SceneWrapper";
import { TechBackground } from "../components/TechBackground";
import { AuroraBackground } from "../components/AuroraBackground";
import { SpiderBackground } from "../components/SpiderBackground";
import { ClaudeBackground } from "../components/ClaudeBackground";
import { FilmGrain } from "../components/FilmGrain";
import { ThemeContext, paletteFor } from "../theme/claude";
import { ImageBackdropContext, coversFrame } from "../components/SceneBackdrop";

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
  sfx,
  totalDurationInFrames,
}) => {
  const palette = paletteFor(meta.background);
  const isClaudeBg = meta.background === "claude-dark" || meta.background === "claude-cream";
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [0, totalDurationInFrames], [0, 1], { extrapolateRight: "clamp" });

  // Đường bao ducking dựng MỘT LẦN cho cả video — nó phụ thuộc toàn bộ dòng thời gian
  // nên không tính được cục bộ trong từng scene.
  const duckEnv = React.useMemo(
    () => (music ? buildDuckEnvelope(scenes, fps, totalDurationInFrames, music.duck) : null),
    [music, scenes, fps, totalDurationInFrames],
  );

  /**
   * Backdrop chung (mưa nhị phân / cực quang / neon) có ĐANG BỊ CHE KÍN không?
   *
   * Scene có `media` kiểu video, color, hoặc ảnh ở chế độ photo vẽ một lớp ĐỤC phủ toàn khung (SceneBackdrop),
   * mờ vào trong BACKDROP_FADE_FRAMES frame rồi giữ đục đến hết cảnh. Từ lúc nó đục hẳn,
   * mọi pixel của backdrop chung đều bị đè — nhưng Chrome vẫn phải VẼ đủ: gradient, hai
   * quầng sáng lớn, mưa nhị phân, lưới, vignette. Trên clip đo được, việc vẽ thừa này
   * chiếm ~25% thời gian mỗi frame của cảnh có video.
   *
   * Chrome không tự bỏ qua được vì lớp che nằm trong một stacking context riêng (nó có
   * opacity động), nên phải tự cắt ở đây. Chỉ cắt khi lớp che đã ĐỤC HOÀN TOÀN → hình ra
   * không đổi một pixel nào.
   */
  const imageIsBackdrop = meta.visualStyle === "photo";
  const backdropHidden = React.useMemo(
    () =>
      scenes.some(
        (s) =>
          (coversFrame(s.media, imageIsBackdrop) || s.media?.kind === "color") &&
          frame >= s.fromFrame + BACKDROP_FADE_FRAMES &&
          frame < s.fromFrame + s.durationInFrames,
      ),
    [scenes, frame, imageIsBackdrop],
  );

  return (
    <ThemeContext.Provider value={palette}>
      <ImageBackdropContext.Provider value={imageIsBackdrop}>
        <AbsoluteFill style={{ backgroundColor: palette.bg }}>
          {/* Backdrop tuỳ chọn — presentation (card/chữ) luôn theo style Claude bên trên.
              Kiểu "Chỉ ảnh" KHÔNG BAO GIỜ vẽ backdrop chung (mưa nhị phân, quầng sáng…):
              sau ảnh chỉ là màu nền phẳng, lộ ra đúng vài frame lúc ảnh đang mờ vào. */}
          {!imageIsBackdrop && !backdropHidden && (
            <>
              {isClaudeBg && <ClaudeBackground palette={palette} />}
              {meta.background === "tech" && <TechBackground />}
              {meta.background === "aurora" && <AuroraBackground />}
              {meta.background === "spider" && <SpiderBackground />}
            </>
          )}

          {scenes.map((scene) => (
            <Sequence
              key={scene.id}
              from={scene.fromFrame}
              durationInFrames={scene.durationInFrames}
              name={`${scene.layout}:${scene.id}`}
            >
              <SceneWrapper scene={scene} captions={captions} sfx={sfx} width={meta.width} height={meta.height} />
            </Sequence>
          ))}

          {/* Thanh tiến trình mép trên. Hai việc cùng lúc: cho người xem biết còn bao lâu
              (giữ chân tốt hơn hẳn khi họ thấy sắp hết), và là thứ DUY NHẤT chuyển động
              liên tục suốt video, nối các cảnh lại thành một mạch. */}
          {/* Chế độ "Chỉ ảnh": không có thanh này, không có hạt phim bên dưới — không lớp nào
              được phủ lên ảnh gốc ngoài phụ đề lời kể. */}
          {!imageIsBackdrop && (
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
          )}

          {/* Hạt phim nằm TRÊN mọi thứ (kể cả chữ) — đó là điểm khác giữa "lớp grain" và
              "nền có nhiễu": nó phải phủ đều cả khung thì mắt mới đọc ra là chất phim. */}
          {!imageIsBackdrop && <FilmGrain />}

          {/* Nhạc nền: âm lượng là HÀM theo frame, đọc từ đường bao ducking ở trên.
              Remotion gọi hàm này mỗi frame khi trộn audio, nên nhạc tự lùi xuống đúng
              lúc có giọng đọc mà không cần tách file hay xử lý hậu kỳ. */}
          {music && (
            <Audio
              src={staticFile(music.src)}
              volume={(f) => music.volume * (duckEnv ? (duckEnv[f] ?? 1) : 1)}
              loop
              /* BẮT BUỘC khi dùng `loop` + volume là hàm. Mặc định của Remotion là
                 "repeat": frame truyền vào hàm volume RESET về 0 ở mỗi vòng lặp nhạc, nên
                 nhạc 20 s trên video 30 s sẽ lấy nhầm đoạn đầu đường bao cho 10 giây cuối.
                 "extend" cộng thêm loop.durationInFrames * iteration → frame tuyệt đối,
                 đúng chỉ số của duckEnv. */
              loopVolumeCurveBehavior="extend"
            />
          )}
        </AbsoluteFill>
      </ImageBackdropContext.Provider>
    </ThemeContext.Provider>
  );
};
