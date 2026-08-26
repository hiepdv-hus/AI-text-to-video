import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { Hello } from "./compositions/Hello";
import { VideoComposition } from "./compositions/VideoComposition";
import { builtPropsSchema, type BuiltProps } from "./schema";
import { DEFAULT_PROPS } from "./compositions/defaultProps";

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
