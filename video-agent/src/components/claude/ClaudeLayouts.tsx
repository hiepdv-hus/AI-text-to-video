import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene } from "../../schema";
import { safeArea } from "../../theme/tokens";
import type { Palette } from "../../theme/claude";
import { useTheme } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { EMOJI_FAMILY } from "../fontsEmoji";
import { CodeLayout } from "../CodeLayout";
import { ClaudeFeatureCards } from "./ClaudeFeatureCards";
import { ClaudeSteps } from "./ClaudeSteps";
import { ClaudeChat } from "./ClaudeChat";

/**
 * ClaudeLayouts — bộ layout style Claude: ấm, tối giản, đồng bộ. Mọi màu/cỡ chữ đọc
 * từ Palette (useTheme). Ảnh luôn ĐÓNG KHUNG vừa đủ, nền giữ nguyên nền đã chọn.
 */

export interface LProps {
  scene: BuiltScene;
  height: number;
}

const resolveImg = (src: string) =>
  /^https?:\/\//.test(src) || src.startsWith("data:") ? src : staticFile(src);

/** Cột nội dung tôn trọng safe area + chừa vùng caption. */
const Col: React.FC<React.PropsWithChildren<{ height: number; p: Palette; justify?: React.CSSProperties["justifyContent"] }>> = ({
  height,
  p,
  justify = "center",
  children,
}) => {
  const sa = safeArea(height);
  return (
    <AbsoluteFill
      style={{
        fontFamily: TEXT_STACK,
        color: p.text,
        paddingTop: sa.top,
        paddingBottom: Math.round(height * 0.23),
        paddingLeft: 84,
        paddingRight: 84,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: justify,
        textAlign: "center",
        gap: 26,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Tiêu đề Claude: chữ thường, từ khoá (emphasis) tô CAM (không viền phát sáng). */
export const ClaudeHeading: React.FC<{ text: string; emphasis?: string[]; p: Palette; size?: number }> = ({
  text,
  emphasis = [],
  p,
  size,
}) => {
  const phrases = emphasis.filter((s) => s.trim()).sort((a, b) => b.length - a.length);
  const segs: Array<{ t: string; hot: boolean }> = [];
  let rest = text;
  outer: while (rest.length) {
    for (const ph of phrases) {
      if (rest.toLowerCase().startsWith(ph.toLowerCase())) {
        segs.push({ t: rest.slice(0, ph.length), hot: true });
        rest = rest.slice(ph.length);
        continue outer;
      }
    }
    let nxt = rest.length;
    for (const ph of phrases) {
      const idx = rest.toLowerCase().indexOf(ph.toLowerCase());
      if (idx > 0) nxt = Math.min(nxt, idx);
    }
    const chunk = rest.slice(0, nxt);
    const last = segs[segs.length - 1];
    if (last && !last.hot) last.t += chunk;
    else segs.push({ t: chunk, hot: false });
    rest = rest.slice(nxt);
  }
  return (
    <div style={{ fontSize: size ?? p.size.heading, fontWeight: 700, lineHeight: p.lineHeight, letterSpacing: -0.5 }}>
      {segs.map((s, i) => (
        <span key={i} style={s.hot ? { color: p.accent } : undefined}>
          {s.t}
        </span>
      ))}
    </div>
  );
};

/** Ảnh đóng khung "vừa đủ": bo góc, viền mảnh, bóng nhẹ, contain (không crop). */
const Framed: React.FC<{ src: string; height: number; p: Palette; delay?: number }> = ({ src, height, p, delay = 4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 130, mass: 0.9 } });
  return (
    <div
      style={{
        opacity: e,
        transform: `translateY(${interpolate(e, [0, 1], [22, 0])}px)`,
        width: "100%",
        maxHeight: Math.round(height * 0.42),
        borderRadius: p.radius.lg,
        overflow: "hidden",
        border: `1px solid ${p.cardBorder}`,
        boxShadow: p.cardShadow,
        background: p.card,
        display: "flex",
      }}
    >
      <Img src={resolveImg(src)} style={{ width: "100%", height: "100%", objectFit: "cover", maxHeight: Math.round(height * 0.42) }} />
    </div>
  );
};

const Icon: React.FC<{ icon: string; p: Palette }> = ({ icon, p }) => (
  <div style={{ fontSize: 46, fontFamily: EMOJI_FAMILY, opacity: p.isDark ? 0.95 : 1 }}>{icon}</div>
);

/* ------------------------------- Hook / CTA ------------------------------ */

const Hook: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame, fps, config: { damping: 22, stiffness: 120, mass: 0.9 } });
  const text = scene.heading ?? scene.narration;
  return (
    <Col height={height} p={p}>
      <div style={{ opacity: e, transform: `translateY(${interpolate(e, [0, 1], [18, 0])}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        {scene.icon && <Icon icon={scene.icon} p={p} />}
        <ClaudeHeading text={text} emphasis={scene.emphasis} p={p} size={p.size.hook} />
      </div>
      {scene.media?.kind === "image" && <Framed src={scene.media.src} height={height} p={p} delay={8} />}
    </Col>
  );
};

const Cta: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame, fps, config: { damping: 16, stiffness: 150, mass: 0.8 } });
  return (
    <Col height={height} p={p}>
      {scene.icon && <Icon icon={scene.icon} p={p} />}
      <div
        style={{
          opacity: e,
          transform: `scale(${interpolate(e, [0, 1], [0.94, 1])})`,
          fontSize: p.size.heading,
          fontWeight: 700,
          color: p.onAccent,
          background: p.accent,
          padding: "26px 44px",
          borderRadius: p.radius.pill,
          boxShadow: p.cardShadow,
          lineHeight: 1.2,
        }}
      >
        {scene.heading ?? scene.narration}
      </div>
    </Col>
  );
};

/* -------------------------------- Bullet --------------------------------- */

const Bullet: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bullets = scene.bullets ?? [];
  return (
    <Col height={height} p={p}>
      {scene.heading && <ClaudeHeading text={scene.heading} emphasis={scene.emphasis} p={p} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
        {bullets.map((b, i) => {
          const e = spring({ frame: frame - (6 + i * 5), fps, config: { damping: 18, stiffness: 160, mass: 0.8 } });
          return (
            <div
              key={i}
              style={{
                opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
                transform: `translateY(${interpolate(e, [0, 1], [16, 0])}px)`,
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "22px 26px",
                borderRadius: p.radius.md,
                background: p.card,
                border: `1px solid ${p.cardBorder}`,
                boxShadow: p.cardShadow,
                textAlign: "left",
                fontSize: p.size.card,
                fontWeight: 600,
              }}
            >
              <span style={{ width: 8, height: 8, minWidth: 8, borderRadius: 999, background: p.accent }} />
              {b}
            </div>
          );
        })}
      </div>
    </Col>
  );
};

/* -------------------------------- Compare -------------------------------- */

const Compare: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = scene.bullets ?? [];
  const row = (text: string, ok: boolean, delay: number) => {
    const e = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 160, mass: 0.8 } });
    return (
      <div
        style={{
          opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(e, [0, 1], [18, 0])}px)`,
          display: "flex",
          alignItems: "center",
          gap: 18,
          width: "100%",
          padding: "26px 28px",
          borderRadius: p.radius.md,
          background: ok ? p.accentSoft : p.card,
          border: `1.5px solid ${ok ? p.accent : p.cardBorder}`,
          boxShadow: p.cardShadow,
          textAlign: "left",
          fontSize: p.size.card,
          fontWeight: 700,
          color: p.text,
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            minWidth: 44,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            color: ok ? p.onAccent : p.textMuted,
            background: ok ? p.accent : "transparent",
            border: ok ? "none" : `2px solid ${p.textMuted}`,
          }}
        >
          {ok ? "✓" : "✕"}
        </span>
        {text}
      </div>
    );
  };
  return (
    <Col height={height} p={p}>
      {scene.heading && <ClaudeHeading text={scene.heading} emphasis={scene.emphasis} p={p} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
        {row(b[0] ?? "A", false, 6)}
        {row(b[1] ?? "B", true, 14)}
      </div>
    </Col>
  );
};

/* --------------------------------- Image --------------------------------- */

const ImageL: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  return (
    <Col height={height} p={p}>
      {scene.heading && <ClaudeHeading text={scene.heading} emphasis={scene.emphasis} p={p} />}
      {scene.media && scene.media.kind !== "color" && <Framed src={scene.media.src} height={height} p={p} />}
    </Col>
  );
};

/* -------------------------------- Graphic -------------------------------- */

const Graphic: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame, fps, config: { damping: 22, stiffness: 120 } });
  const g = scene.graphic;
  const labels = g?.labels;
  return (
    <Col height={height} p={p}>
      {scene.heading && (
        <div style={{ opacity: e, transform: `translateY(${interpolate(e, [0, 1], [-14, 0])}px)`, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <ClaudeHeading text={scene.heading} emphasis={scene.emphasis} p={p} />
          {g?.subtitle && <div style={{ color: p.textMuted, fontSize: p.size.subhead, fontWeight: 500 }}>{g.subtitle}</div>}
        </div>
      )}
      {/* Chọn widget Claude theo kind: chat / steps / (mặc định) thẻ liệt kê. */}
      {g?.kind === "chat-ai" ? (
        <ClaudeChat labels={labels} p={p} />
      ) : g?.kind === "steps" ? (
        <ClaudeSteps labels={labels} p={p} />
      ) : (
        <ClaudeFeatureCards labels={labels} p={p} />
      )}
    </Col>
  );
};

/* ------------------------------- Registry -------------------------------- */

export const CLAUDE_LAYOUTS: Record<BuiltScene["layout"], React.FC<LProps>> = {
  hook: Hook,
  bullet: Bullet,
  product: Hook,
  compare: Compare,
  cta: Cta,
  code: CodeLayout,
  image: ImageL,
  graphic: Graphic,
};
