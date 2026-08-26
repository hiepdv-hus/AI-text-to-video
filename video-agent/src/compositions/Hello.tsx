import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../theme/tokens";
import { FONT_FAMILY } from "../components/fonts";

/**
 * Hello — composition tối giản để verify toolchain (Chrome headless + FFmpeg + font embed).
 * Không phụ thuộc pipeline. Render được file này = mọi thứ nền tảng đã chạy.
 */
export const Hello: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: tokens.timing.springIn });
  const scale = interpolate(enter, [0, 1], [0.7, 1]);
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.color.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          color: tokens.color.text,
          fontSize: tokens.size.hook,
          fontWeight: tokens.weight.black,
          textAlign: "center",
          padding: tokens.space.pagePadding,
          lineHeight: tokens.font.lineHeight,
          textShadow: tokens.shadow.text,
        }}
      >
        {title}
        <div style={{ color: tokens.color.accent, fontSize: tokens.size.heading, marginTop: 24 }}>
          Toolchain OK ✓
        </div>
      </div>
    </AbsoluteFill>
  );
};
