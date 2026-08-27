import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { WordTiming, Captions } from "../schema";
import { tokens } from "../theme/tokens";
import { FONT_FAMILY } from "./fonts";
import { chunkIntoLines, activeLineIndex, activeWordIndex } from "./captions";

/**
 * KaraokeCaption — phụ đề chia dòng, từ đang đọc thì nổi bật.
 *
 * Kỹ thuật bắt buộc:
 *  - Font embed (FONT_FAMILY) — không dùng font hệ thống (Chrome headless không có).
 *  - Hiệu ứng bằng spring()/interpolate() theo frame — KHÔNG CSS transition
 *    (Remotion render từng frame rời rạc, transition không chạy).
 *  - line-height cao (dấu thanh tiếng Việt cao hơn Latin, không sẽ bị cắt ngọn).
 *  - Safe area: position="center"/"lower-third" chừa 15% dưới cho UI TikTok.
 */

export interface KaraokeCaptionProps {
  words: WordTiming[];
  style: Captions["style"];
  position: Captions["position"];
  maxWordsPerLine: number;
  highlightColor: string;
}

interface PresetStyle {
  container: React.CSSProperties;
  word: (active: boolean, highlight: string) => React.CSSProperties;
  scaleActive: number;
}

function getPreset(style: Captions["style"]): PresetStyle {
  switch (style) {
    case "tiktok-bold":
      return {
        container: {
          fontWeight: tokens.weight.black,
          fontSize: tokens.size.caption,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        word: (active, highlight) => ({
          color: active ? "#111" : tokens.color.text,
          backgroundColor: active ? highlight : "transparent",
          borderRadius: tokens.radius.md,
          padding: active ? "6px 18px" : "6px 6px",
          textShadow: active ? "none" : tokens.shadow.text,
        }),
        scaleActive: 1.12,
      };
    case "clean-minimal":
      return {
        container: {
          fontWeight: tokens.weight.semibold,
          fontSize: tokens.size.captionSmall,
        },
        word: (active, highlight) => ({
          color: active ? highlight : tokens.color.text,
          textShadow: tokens.shadow.text,
          padding: "4px 8px",
        }),
        scaleActive: 1.06,
      };
    case "outline-pop":
      return {
        container: {
          fontWeight: tokens.weight.black,
          fontSize: tokens.size.caption,
        },
        word: (active, highlight) => ({
          color: active ? highlight : tokens.color.text,
          WebkitTextStroke: "3px #000",
          paintOrder: "stroke fill",
          padding: "4px 10px",
        }),
        scaleActive: 1.16,
      };
    case "chip-glow":
      // "SpiderAI News": mỗi từ là 1 chip tối; từ đang đọc là chip tím phát sáng.
      return {
        container: {
          fontWeight: tokens.weight.bold,
          fontSize: tokens.size.caption,
          gap: 14,
        },
        word: (active) => ({
          color: "#fff",
          background: active
            ? `linear-gradient(180deg, ${tokens.neon.purpleBright}, ${tokens.neon.purple})`
            : tokens.neon.chipBg,
          border: `1px solid ${active ? "transparent" : tokens.neon.chipBorder}`,
          borderRadius: 16,
          padding: "10px 22px",
          boxShadow: active ? tokens.neon.glowStrong : "none",
        }),
        scaleActive: 1.1,
      };
    default: {
      const _e: never = style;
      throw new Error(`Preset không tồn tại: ${_e}`);
    }
  }
}

function positionStyle(position: Captions["position"]): React.CSSProperties {
  switch (position) {
    case "top":
      return { top: "10%", height: "18%", alignItems: "flex-start" };
    case "center":
      return { top: 0, bottom: 0, alignItems: "center" };
    case "lower-third":
    default:
      // Ngay trên vùng safe 15% dưới; không chồng nội dung ở giữa/ trên.
      return { bottom: "17%", height: "22%", alignItems: "flex-end" };
  }
}

export const KaraokeCaption: React.FC<KaraokeCaptionProps> = ({
  words,
  style,
  position,
  maxWordsPerLine,
  highlightColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tMs = (frame / fps) * 1000;

  const lines = React.useMemo(
    () => chunkIntoLines(words, maxWordsPerLine),
    [words, maxWordsPerLine],
  );
  if (lines.length === 0) return null;

  const li = activeLineIndex(lines, tMs);
  const line = lines[li];
  if (!line) return null;
  const wi = activeWordIndex(line, tMs);
  const preset = getPreset(style);

  // Dòng vừa xuất hiện thì trượt lên nhẹ + mờ dần vào (theo frame, không transition).
  const lineAgeMs = tMs - line.startMs;
  const appear = interpolate(lineAgeMs, [0, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        padding: `0 ${tokens.space.pagePadding}px`,
        fontFamily: FONT_FAMILY,
        lineHeight: tokens.font.lineHeight + 0.08, // thêm chỗ cho dấu thanh
        ...positionStyle(position),
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 8,
          textAlign: "center",
          transform: `translateY(${interpolate(appear, [0, 1], [24, 0])}px)`,
          opacity: appear,
          ...preset.container,
        }}
      >
        {line.words.map((w, i) => {
          const active = i === wi;
          const spoken = i < wi;
          // Nảy dứt khoát khi từ VỪA được đọc tới — key theo start của chính từ đó (không phải đầu dòng).
          const wStart = (w.startMs / 1000) * fps;
          const bounce = active
            ? spring({ frame: frame - wStart, fps, config: { damping: 9, stiffness: 210, mass: 0.6 } })
            : 1;
          const scale = active
            ? interpolate(bounce, [0, 1], [0.72, preset.scaleActive])
            : spoken
              ? 0.97
              : 1;
          const wStyle = preset.word(active, highlightColor);
          // chip-glow: chip đang đọc phát sáng theo NHỊP (pulse) cho sinh động.
          if (active && style === "chip-glow") {
            const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 3.2);
            wStyle.boxShadow =
              `0 0 ${18 + pulse * 20}px rgba(139,92,246,${(0.55 + pulse * 0.4).toFixed(2)}), 0 0 12px rgba(185,131,255,0.95)`;
          }
          return (
            <span
              key={`${i}-${w.text}`}
              style={{
                display: "inline-block",
                transform: `scale(${scale})`,
                transformOrigin: "center bottom",
                ...wStyle,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
