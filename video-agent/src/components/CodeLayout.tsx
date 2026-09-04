import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene } from "../schema";
import { tokens } from "../theme/tokens";
import { useTheme, type Palette } from "../theme/claude";
import { FONT_FAMILY } from "./fonts";
import { EMOJI_FAMILY } from "./fontsEmoji";
import { MONO_FAMILY } from "./fontsMono";
import { HeadingBlock } from "./claude/Heading";
import { useDrift, useSweep } from "./motion";

/**
 * CodeLayout — cửa sổ code kiểu VS Code cho video lập trình.
 *  - Tô màu cú pháp (token màu do pipeline/shiki sinh sẵn trong scene.codeTokens).
 *  - Hiện CODE TỪNG DÒNG (reveal theo frame), tô sáng dòng quan trọng (codeHighlight),
 *    làm mờ dòng phụ.
 *  - Panel CONSOLE hiện kết quả (scene.output) sau khi code hiện xong — khoảnh khắc "à há".
 *
 * Khung cửa sổ (chrome) đổi theo THEME: tech dùng kính mờ xanh matrix để hoà với mưa
 * nhị phân và video nền; claude giữ tông one-dark ấm. MÀU CHỮ CODE luôn do shiki quyết
 * định — không đụng vào, để cú pháp đọc đúng như trong IDE.
 */

const REVEAL_PER_LINE = 5; // frame giữa 2 dòng
const FONT_SIZE = 36;
const LINE_HEIGHT = 1.5;

interface Chrome {
  windowBg: string;
  titleBg: string;
  border: string;
  gutter: string;
  highlightBar: string;
  accent: string;
  consoleBg: string;
  consoleText: string;
  shadow: string;
  backdrop: string;
}

/**
 * Chrome cửa sổ code — LUÔN dùng one-dark-pro ĐẶC, rõ nét (giao diện VS Code kinh điển).
 * Cố ý KHÔNG dùng biến thể "kính mờ" theo theme tech: nền trong mờ tuy đẹp nhưng hoà vào
 * mưa nhị phân + video nền làm chữ code khó đọc. Cửa sổ code cần nổi bật, tương phản cao.
 */
function chromeFor(_p: Palette): Chrome {
  return {
    windowBg: "#282c34",
    titleBg: "#21252b",
    border: "#3a3f4b",
    gutter: "#5c6370",
    highlightBar: "rgba(97,175,239,0.14)",
    accent: "#61afef",
    consoleBg: "#1b1f24",
    consoleText: "#98c379",
    shadow: tokens.shadow.card,
    backdrop: "none",
  };
}

export const CodeLayout: React.FC<{ scene: BuiltScene; height: number }> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = useTheme();
  const ide = chromeFor(p);
  const lines = scene.codeTokens ?? [];
  const hlSet = new Set(scene.codeHighlight ?? []);
  const hasHl = hlSet.size > 0;

  const allRevealedAt = lines.length * REVEAL_PER_LINE + 8;
  const dimActive = frame > allRevealedAt && hasHl;

  const outputAt = allRevealedAt + 10;
  const outLocal = frame - outputAt;
  const outEnter = spring({ frame: outLocal, fps, config: tokens.timing.springIn });

  // Con trỏ nhấp nháy ở cuối dòng đang hiện — chi tiết nhỏ nhất nhưng là thứ khiến
  // khối code đọc ra là "đang được gõ" chứ không phải ảnh chụp màn hình dán vào.
  const caretLine = Math.min(Math.floor(frame / REVEAL_PER_LINE), Math.max(lines.length - 1, 0));
  const caretOn = useSweep(1.06) < 0.55;
  const windowFloat = useDrift(0, 0.11) * 3;

  const glass = ide.backdrop !== "none" ? { backdropFilter: ide.backdrop, WebkitBackdropFilter: ide.backdrop } : {};

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 28,
        fontFamily: `${FONT_FAMILY}, ${EMOJI_FAMILY}`,
        color: p.text,
        paddingTop: Math.round(height * 0.06),
        paddingBottom: Math.round(height * 0.27), // chừa vùng caption lower-third
        paddingLeft: 44,
        paddingRight: 44,
      }}
    >
      {scene.heading && (
        <HeadingBlock
          heading={scene.icon ? `${scene.icon}  ${scene.heading}` : scene.heading}
          emphasis={scene.emphasis}
          p={p}
          align="left"
        />
      )}

      {/* Cửa sổ code */}
      <div
        style={{
          backgroundColor: ide.windowBg,
          borderRadius: p.radius.lg,
          border: `1px solid ${ide.border}`,
          boxShadow: ide.shadow,
          overflow: "hidden",
          transform: `translateY(${windowFloat}px)`,
          ...glass,
        }}
      >
        {/* Thanh tiêu đề */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            backgroundColor: ide.titleBg,
            padding: "18px 24px",
            borderBottom: `1px solid ${ide.border}`,
          }}
        >
          <Dot color="#ff5f56" />
          <Dot color="#ffbd2e" />
          <Dot color="#27c93f" />
          <div style={{ marginLeft: 14, color: ide.gutter, fontFamily: MONO_FAMILY, fontSize: 26 }}>
            {scene.codeTitle ?? "script.js"}
          </div>
        </div>

        {/* Vùng code — TẮT ligature để "=>" hiện đúng chữ, không thành mũi tên ⟹
            (người học gõ "=>" nên phải thấy đúng ký tự đó). */}
        <div
          style={{
            padding: "28px 26px",
            fontFamily: MONO_FAMILY,
            fontSize: FONT_SIZE,
            fontVariantLigatures: "none",
            fontFeatureSettings: '"liga" 0, "calt" 0',
          }}
        >
          {lines.map((lineTokens, i) => {
            const local = frame - i * REVEAL_PER_LINE;
            const revealOpacity = interpolate(local, [0, 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const ty = interpolate(local, [0, 6], [10, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isHl = hlSet.has(i + 1);
            const dim = dimActive && !isHl ? 0.4 : 1;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  lineHeight: LINE_HEIGHT,
                  opacity: Math.min(revealOpacity, dim),
                  transform: `translateY(${ty}px)`,
                  backgroundColor: isHl && dimActive ? ide.highlightBar : "transparent",
                  borderLeft: `4px solid ${isHl && dimActive ? ide.accent : "transparent"}`,
                  paddingLeft: 14,
                  marginLeft: -18,
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    color: ide.gutter,
                    width: 44,
                    flexShrink: 0,
                    userSelect: "none",
                    textAlign: "right",
                    marginRight: 24,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ whiteSpace: "pre" }}>
                  {lineTokens.length === 0
                    ? " "
                    : lineTokens.map((t, j) => (
                        <span key={j} style={{ color: t.color }}>
                          {t.text}
                        </span>
                      ))}
                  {i === caretLine && caretOn && (
                    <span
                      style={{
                        display: "inline-block",
                        width: FONT_SIZE * 0.55,
                        height: FONT_SIZE * 1.05,
                        marginLeft: 2,
                        verticalAlign: "text-bottom",
                        background: ide.accent,
                        opacity: 0.85,
                      }}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel console */}
      {scene.output && outLocal > -1 && (
        <div
          style={{
            backgroundColor: ide.consoleBg,
            borderRadius: p.radius.md,
            border: `1px solid ${ide.border}`,
            padding: "22px 26px",
            opacity: outEnter,
            transform: `translateY(${interpolate(outEnter, [0, 1], [24, 0])}px)`,
            ...glass,
          }}
        >
          <div
            style={{
              color: ide.gutter,
              fontFamily: MONO_FAMILY,
              fontSize: 24,
              marginBottom: 12,
              letterSpacing: 1,
            }}
          >
            ▶ Console
          </div>
          {scene.output.split("\n").map((line, i) => (
            <div
              key={i}
              style={{
                color: ide.consoleText,
                fontFamily: MONO_FAMILY,
                fontSize: FONT_SIZE,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: color }} />
);
