import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene } from "../schema";
import { tokens } from "../theme/tokens";
import { FONT_FAMILY } from "./fonts";
import { EMOJI_FAMILY } from "./fontsEmoji";
import { MONO_FAMILY } from "./fontsMono";

/**
 * CodeLayout — cửa sổ code kiểu VS Code cho video lập trình.
 *  - Tô màu cú pháp (token màu do pipeline/shiki sinh sẵn trong scene.codeTokens).
 *  - Hiện CODE TỪNG DÒNG (reveal theo frame), tô sáng dòng quan trọng (codeHighlight),
 *    làm mờ dòng phụ.
 *  - Panel CONSOLE hiện kết quả (scene.output) sau khi code hiện xong — khoảnh khắc "à há".
 */

const REVEAL_PER_LINE = 5; // frame giữa 2 dòng
const FONT_SIZE = 32;
const LINE_HEIGHT = 1.5;

// Màu phụ trợ cho giao diện IDE (tông one-dark-pro).
const IDE = {
  windowBg: "#282c34",
  titleBg: "#21252b",
  border: "#3a3f4b",
  gutter: "#5c6370",
  highlightBar: "rgba(97,175,239,0.14)",
  accent: "#61afef",
  consoleBg: "#1b1f24",
  consoleText: "#e5e9f0",
  consoleGreen: "#98c379",
};

export const CodeLayout: React.FC<{ scene: BuiltScene; height: number }> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = scene.codeTokens ?? [];
  const hlSet = new Set(scene.codeHighlight ?? []);
  const hasHl = hlSet.size > 0;

  const allRevealedAt = lines.length * REVEAL_PER_LINE + 8;
  const dimActive = frame > allRevealedAt && hasHl;

  const outputAt = allRevealedAt + 10;
  const outLocal = frame - outputAt;
  const outEnter = spring({ frame: outLocal, fps, config: tokens.timing.springIn });

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
        paddingTop: Math.round(height * 0.06),
        paddingBottom: Math.round(height * 0.26), // chừa vùng caption lower-third
        paddingLeft: 48,
        paddingRight: 48,
      }}
    >
      {scene.heading && (
        <div
          style={{
            color: tokens.color.text,
            fontSize: 58,
            fontWeight: tokens.weight.black,
            lineHeight: 1.15,
            textShadow: tokens.shadow.text,
            marginBottom: 4,
          }}
        >
          {scene.icon ? `${scene.icon}  ` : ""}
          {scene.heading}
        </div>
      )}

      {/* Cửa sổ code */}
      <div
        style={{
          backgroundColor: IDE.windowBg,
          borderRadius: 24,
          border: `1px solid ${IDE.border}`,
          boxShadow: tokens.shadow.card,
          overflow: "hidden",
        }}
      >
        {/* Thanh tiêu đề */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            backgroundColor: IDE.titleBg,
            padding: "18px 24px",
            borderBottom: `1px solid ${IDE.border}`,
          }}
        >
          <Dot color="#ff5f56" />
          <Dot color="#ffbd2e" />
          <Dot color="#27c93f" />
          <div style={{ marginLeft: 14, color: IDE.gutter, fontFamily: MONO_FAMILY, fontSize: 26 }}>
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
                  backgroundColor: isHl && dimActive ? IDE.highlightBar : "transparent",
                  borderLeft: `4px solid ${isHl && dimActive ? IDE.accent : "transparent"}`,
                  paddingLeft: 14,
                  marginLeft: -18,
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    color: IDE.gutter,
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
                  {lineTokens.length === 0 ? (
                    " "
                  ) : (
                    lineTokens.map((t, j) => (
                      <span key={j} style={{ color: t.color }}>
                        {t.text}
                      </span>
                    ))
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
            backgroundColor: IDE.consoleBg,
            borderRadius: 20,
            border: `1px solid ${IDE.border}`,
            padding: "22px 26px",
            opacity: outEnter,
            transform: `translateY(${interpolate(outEnter, [0, 1], [24, 0])}px)`,
          }}
        >
          <div
            style={{
              color: IDE.gutter,
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
                color: IDE.consoleGreen,
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
