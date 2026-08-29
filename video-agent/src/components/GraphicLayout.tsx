import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene } from "../schema";
import { tokens, safeArea } from "../theme/tokens";
import { TEXT_STACK } from "./textStack";
import { EMOJI_FAMILY } from "./fontsEmoji";
import { HighlightTimeline } from "./graphics/HighlightTimeline";
import { DeviceEditor } from "./graphics/DeviceEditor";
import { FeatureCards } from "./graphics/FeatureCards";
import { BarChart } from "./graphics/BarChart";
import { ChatAI } from "./graphics/ChatAI";
import { GlowHeading } from "./GlowHeading";

/**
 * GraphicLayout — layout "graphic": tiêu đề (keyword tô tím phát sáng) + phụ đề nhỏ
 * + một widget đồ hoạ neon khớp nội dung (do scene.graphic.kind chọn).
 * Đây là tầng "kết hợp hoàn hảo": nói tới nội dung nào thì hiện đúng đồ hoạ đó.
 */

const N = tokens.neon;

const GRAPHICS: Record<string, React.FC<any>> = {
  "highlight-timeline": HighlightTimeline,
  "device-editor": DeviceEditor,
  "feature-cards": FeatureCards,
  "bar-chart": BarChart,
  "chat-ai": ChatAI,
};

export const GraphicLayout: React.FC<{ scene: BuiltScene; height: number }> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sa = safeArea(height);
  const g = scene.graphic;
  const Widget = g ? GRAPHICS[g.kind] : undefined;

  const eTitle = spring({ frame, fps, config: tokens.timing.springIn });
  const eSub = spring({ frame: frame - 6, fps, config: tokens.timing.springIn });

  return (
    <AbsoluteFill
      style={{
        fontFamily: TEXT_STACK,
        color: tokens.color.text,
        paddingTop: sa.top + Math.round(height * 0.02),
        paddingBottom: Math.round(height * 0.24),
        paddingLeft: tokens.space.pagePadding,
        paddingRight: tokens.space.pagePadding,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 10,
      }}
    >
      {scene.heading && (
        <div
          style={{
            opacity: eTitle,
            transform: `translateY(${interpolate(eTitle, [0, 1], [-26, 0])}px)`,
            marginBottom: 4,
          }}
        >
          {scene.icon && (
            <div style={{ fontSize: 52, fontFamily: EMOJI_FAMILY, marginBottom: 6 }}>{scene.icon}</div>
          )}
          <GlowHeading text={scene.heading} emphasis={scene.emphasis} />
        </div>
      )}

      {g?.subtitle && (
        <div
          style={{
            opacity: eSub,
            color: N.textSoft,
            fontSize: 34,
            fontWeight: tokens.weight.medium,
            marginBottom: 18,
          }}
        >
          {g.subtitle}
        </div>
      )}

      {/* Widget đồ hoạ — nằm ngay dưới tiêu đề, cả cụm được căn giữa dọc (không trôi lửng) */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
        {Widget ? (
          <Widget labels={g?.labels} timestamps={g?.timestamps} timecode={g?.timecode} />
        ) : (
          <div style={{ color: N.textSoft }}>⚠ graphic không hợp lệ</div>
        )}
      </div>
    </AbsoluteFill>
  );
};
