import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { WordTiming, Captions } from "../schema";
import { tokens } from "../theme/tokens";
import { FONT_FAMILY } from "./fonts";
import { chunkIntoLines, activeLineIndex, activeWordIndex } from "./captions";
import { useTheme, isTech, type Palette } from "../theme/claude";

/* ------------------------- Tiện ích màu tương phản ------------------------ */

/** Tách "#rgb"/"#rrggbb" thành [r,g,b]. null nếu không parse được. */
function hexRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Màu chữ ĐỌC ĐƯỢC trên nền `bg`. Cần thiết vì `highlightColor` do người dùng chọn tự
 * do: nền vàng thì chữ phải đen, nền tím đậm thì chữ phải trắng. Ép cứng một màu là
 * cách chắc chắn có lúc phụ đề biến mất.
 */
function onColor(bg: string, fallback: string): string {
  const rgb = hexRgb(bg);
  if (!rgb) return fallback;
  const [r, g, b] = rgb;
  // Luminance tương đối (xấp xỉ sRGB) — ngưỡng 0.55 hợp với chữ đậm cỡ lớn.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#111111" : "#FFFFFF";
}

/** "r,g,b" của màu nhấn — để dựng glow theo đúng màu người dùng chọn. */
function rgbTriplet(hex: string, fallback: string): string {
  const rgb = hexRgb(hex);
  return rgb ? rgb.join(",") : fallback;
}

/* ------------------------------- Preset ---------------------------------- */

/** Preset caption cho style Claude: sạch, từ đang đọc tô CAM + đậm, không chip glow. */
function claudePreset(p: Palette): PresetStyle {
  return {
    container: { fontWeight: 600, fontSize: p.size.caption, letterSpacing: -0.3 },
    word: (active) => ({
      color: active ? p.accent : p.text,
      fontWeight: active ? 800 : 600,
      padding: "2px 6px",
      textShadow: p.isDark ? "0 1px 10px rgba(0,0,0,0.35)" : "none",
    }),
    scaleActive: 1.05,
  };
}

/**
 * Preset caption cho theme TECH. Caption thường nằm trên VIDEO NỀN nên cần tương phản
 * cao hơn kiểu Claude: từ đang đọc là KHỐI ĐẶC màu nhấn (chữ tối trên nền xanh) —
 * đọc được kể cả khi cảnh quay phía sau sáng; từ chưa đọc dựa vào đổ bóng mạnh.
 */
function techPreset(p: Palette): PresetStyle {
  return {
    container: { fontWeight: 700, fontSize: p.size.caption, letterSpacing: -0.2 },
    word: (active) => ({
      color: active ? p.onAccent : p.text,
      background: active ? p.accent : "transparent",
      borderRadius: p.radius.sm,
      padding: active ? "4px 16px" : "4px 6px",
      textShadow: active ? "none" : "0 2px 14px rgba(0,0,0,0.8)",
      boxShadow: active ? p.glow : "none",
    }),
    scaleActive: 1.08,
  };
}

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
  word: (active: boolean) => React.CSSProperties;
  scaleActive: number;
}

/**
 * presetFor — chọn preset theo captions.style.
 *
 * NGUYÊN TẮC: `style` quyết định HÌNH DẠNG (chữ trơn / khối đặc / chip / viền),
 * `Palette` quyết định MÀU NỀN-CHỮ và CỠ CHỮ. Nhờ tách đôi như vậy, đổi kiểu phụ đề
 * không bao giờ làm phụ đề lệch tông với phần còn lại của video — đó là lý do trước
 * đây caption bị ép đi theo theme; giờ vẫn đồng bộ nhưng người dùng chọn được.
 *
 * `highlight` = captions.highlightColor, chỉ áp cho các kiểu TỰ CHỌN. Kiểu "auto",
 * "claude", "tech" dùng màu nhấn của theme để giữ đúng bộ nhận diện.
 */
function presetFor(style: Captions["style"], p: Palette, highlight: string): PresetStyle {
  const shadowSoft = p.isDark ? "0 2px 14px rgba(0,0,0,0.75)" : "none";
  switch (style) {
    case "auto":
      // Theo theme — đúng hành vi cũ, giữ cho spec không khai báo gì vẫn đẹp.
      return isTech(p) ? techPreset(p) : claudePreset(p);
    case "claude":
      return claudePreset(p);
    case "tech":
      return techPreset(p);
    case "clean-minimal":
      // CHỈ TÔ MÀU CHỮ — không nền, không viền, không chip. Kiểu nhẹ nhất.
      return {
        container: { fontWeight: 600, fontSize: p.size.caption, letterSpacing: -0.3 },
        word: (active) => ({
          color: active ? highlight : p.text,
          fontWeight: active ? 800 : 600,
          padding: "2px 6px",
          textShadow: shadowSoft,
        }),
        scaleActive: 1.06,
      };
    case "tiktok-bold":
      return {
        container: {
          fontWeight: 800,
          fontSize: p.size.caption,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        word: (active) => ({
          color: active ? onColor(highlight, p.onAccent) : p.text,
          backgroundColor: active ? highlight : "transparent",
          borderRadius: p.radius.md,
          padding: active ? "6px 18px" : "6px 6px",
          textShadow: active ? "none" : shadowSoft,
        }),
        scaleActive: 1.12,
      };
    case "outline-pop":
      return {
        container: { fontWeight: 800, fontSize: p.size.caption },
        word: (active) => ({
          color: active ? highlight : p.text,
          WebkitTextStroke: "3px #000",
          paintOrder: "stroke fill",
          padding: "4px 10px",
        }),
        scaleActive: 1.16,
      };
    case "chip-glow":
      // Mỗi từ là 1 chip; từ đang đọc là chip màu highlight phát sáng.
      return {
        container: { fontWeight: 700, fontSize: p.size.caption, gap: 14 },
        word: (active) => ({
          color: active ? onColor(highlight, "#fff") : p.text,
          background: active ? highlight : p.card,
          border: `1px solid ${active ? "transparent" : p.cardBorder}`,
          borderRadius: 16,
          padding: "10px 22px",
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
  const theme = useTheme();
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
  // captions.style quyết định hình dạng; theme quyết định màu/cỡ. Xem presetFor().
  const preset = presetFor(style, theme, highlightColor);

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
          const wStyle = preset.word(active);
          // chip-glow: chip đang đọc phát sáng theo NHỊP, glow lấy đúng highlightColor.
          if (active && style === "chip-glow") {
            const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 3.2);
            const rgb = rgbTriplet(highlightColor, "139,92,246");
            wStyle.boxShadow =
              `0 0 ${18 + pulse * 20}px rgba(${rgb},${(0.55 + pulse * 0.4).toFixed(2)}), 0 0 12px rgba(${rgb},0.95)`;
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
