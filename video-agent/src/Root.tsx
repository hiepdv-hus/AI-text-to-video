import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { Hello } from "./compositions/Hello";
import { Hello3D } from "./compositions/Hello3D";
import { VideoComposition } from "./compositions/VideoComposition";
import { builtPropsSchema, type BuiltProps } from "./schema";
import { DEFAULT_PROPS } from "./compositions/defaultProps";
import { Gfx3dBackdrop } from "./components/Gfx3dBackdrop";
import { TECH, CLAUDE_CREAM, ThemeContext } from "./theme/claude";
import { DrawScene } from "./components/claude/DrawScene";
import type { BuiltScene } from "./schema";

/**
 * Root.tsx — đăng ký compositions.
 *
 * Ba template (ProductReview/ListicleTop5/StoryHook) dùng CHUNG renderer
 * VideoComposition; chỉ khác defaultProps. Schema props = builtPropsSchema (Zod),
 * cũng chính là hợp đồng với pipeline.
 *
 * durationInFrames/width/height/fps được suy ra từ props (đã tính từ audio thật ở
 * pipeline) qua calculateMetadata — không hardcode.
 */

const calcMetadata: CalculateMetadataFunction<BuiltProps> = ({ props }) => ({
  durationInFrames: props.totalDurationInFrames,
  fps: props.meta.fps,
  width: props.meta.width,
  height: props.meta.height,
});

const TEMPLATES = ["ProductReview", "ListicleTop5", "StoryHook", "CodeExplainer"] as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Hello"
        component={Hello}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ title: "Video Agent" }}
      />

      {/* Test WebGL headless (@remotion/three). Render:
          pnpm exec remotion render src/index.ts Hello3D out/hello3d.mp4 */}
      <Composition
        id="Hello3D"
        component={Hello3D}
        durationInFrames={60}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Preview scene 3D VẼ NỘI DUNG. Render still:
          pnpm exec remotion still src/index.ts Gfx3d out/x.png --gl=angle --frame=40 --props={"variant":"walk"} */}
      <Composition
        id="Gfx3d"
        component={({ variant }: { variant: string }) => <Gfx3dBackdrop palette={TECH} variant={variant} />}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ variant: "coder" }}
      />

      {/* Preview TRANH NÉT TỰ VẼ (layout "draw"). Render:
          pnpm exec remotion still src/index.ts Draw out/draw.png --frame=70 --props={"art":"office-exodus"}
          pnpm exec remotion render src/index.ts Draw out/draw.mp4 */}
      <Composition
        id="Draw"
        component={({ art, heading, eyebrow, chips }: { art: string; heading: string; eyebrow: string; chips: string[] }) => (
          <ThemeContext.Provider value={CLAUDE_CREAM}>
            <DrawScene scene={{ art, heading, eyebrow, chips } as unknown as BuiltScene} height={1920} />
          </ThemeContext.Provider>
        )}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          art: "office-exodus",
          heading: "Có một điều rất lạ đang xảy ra với người trẻ",
          eyebrow: "Một nghịch lý đang xảy ra",
          chips: ["Tại chỗ làm · 17:00"],
        }}
      />

      {TEMPLATES.map((tpl) => (
        <Composition
          key={tpl}
          id={tpl}
          component={VideoComposition}
          schema={builtPropsSchema}
          defaultProps={DEFAULT_PROPS[tpl]}
          calculateMetadata={calcMetadata}
          // Giá trị khởi tạo; calculateMetadata sẽ ghi đè theo props thật.
          durationInFrames={DEFAULT_PROPS[tpl].totalDurationInFrames}
          fps={DEFAULT_PROPS[tpl].meta.fps}
          width={DEFAULT_PROPS[tpl].meta.width}
          height={DEFAULT_PROPS[tpl].meta.height}
        />
      ))}
    </>
  );
};
