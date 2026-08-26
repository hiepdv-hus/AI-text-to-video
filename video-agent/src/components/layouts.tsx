import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene } from "../schema";
import { tokens, safeArea } from "../theme/tokens";
import { FONT_FAMILY } from "./fonts";
import { EMOJI_FAMILY } from "./fontsEmoji";
import { CodeLayout } from "./CodeLayout";

/** Font-stack có emoji màu (dùng cho text có thể chứa icon). */
export const TEXT_STACK = `${FONT_FAMILY}, ${EMOJI_FAMILY}`;

/** Huy hiệu icon: emoji lớn trong ô bo góc gradient. */
const IconBadge: React.FC<{ icon: string; delay?: number }> = ({ icon, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 170, mass: 0.7 } });
  return (
    <div
      style={{
        transform: `scale(${interpolate(e, [0, 1], [0.4, 1])})`,
        width: 108,
        height: 108,
        borderRadius: tokens.radius.lg,
        background: `linear-gradient(145deg, ${tokens.color.accent}, ${tokens.color.accent2})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 60,
        fontFamily: EMOJI_FAMILY,
        boxShadow: tokens.shadow.card,
        marginBottom: tokens.space.gap,
      }}
    >
      {icon}
    </div>
  );
};

/**
 * layouts.tsx — foreground của từng layout. Nhận props ĐÃ typed (BuiltScene),
 * không nhận `any`. Mọi timing bằng interpolate()/spring() theo frame — tuyệt đối
 * KHÔNG setTimeout/setInterval/requestAnimationFrame.
 */

export interface LayoutProps {
  scene: BuiltScene;
  height: number;
}

/** Khung nội dung tôn trọng safe area (chừa UI TikTok che). */
const SafeArea: React.FC<React.PropsWithChildren<{ height: number; justify?: React.CSSProperties["justifyContent"] }>> = ({
  height,
  justify = "center",
  children,
}) => {
  const sa = safeArea(height);
  return (
    <AbsoluteFill
      style={{
        fontFamily: TEXT_STACK,
        color: tokens.color.text,
        paddingTop: sa.top,
        // Chừa vùng caption lower-third (~26%) để nội dung không chồng phụ đề.
        paddingBottom: Math.round(height * 0.26),
        paddingLeft: tokens.space.pagePadding,
        paddingRight: tokens.space.pagePadding,
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/* --------------------------------- Hook --------------------------------- */

export const HookLayout: React.FC<LayoutProps> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 180, mass: 0.8 } });
  const scale = interpolate(s, [0, 1], [0.6, 1]);
  const rot = interpolate(s, [0, 1], [-4, 0]);

  return (
    <SafeArea height={height}>
      {scene.icon && <IconBadge icon={scene.icon} />}
      <div
        style={{
          transform: `scale(${scale}) rotate(${rot}deg)`,
          fontSize: tokens.size.hook,
          fontWeight: tokens.weight.black,
          lineHeight: tokens.font.lineHeight,
          textShadow: tokens.shadow.text,
          textTransform: "uppercase",
        }}
      >
        {scene.heading ?? scene.narration}
      </div>
    </SafeArea>
  );
};

/* -------------------------------- Bullet -------------------------------- */

export const BulletLayout: React.FC<LayoutProps> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bullets = scene.bullets ?? [];

  return (
    <SafeArea height={height} justify="center">
      {scene.icon && <IconBadge icon={scene.icon} />}
      {scene.heading && (
        <div
          style={{
            fontSize: tokens.size.heading,
            fontWeight: tokens.weight.bold,
            marginBottom: tokens.space.gap * 1.6,
            textShadow: tokens.shadow.text,
          }}
        >
          {scene.heading}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.space.gap, width: "100%" }}>
        {bullets.map((b, i) => {
          // Stagger: mỗi dòng xuất hiện trễ dần.
          const delay = 8 + i * 7;
          const e = spring({ frame: frame - delay, fps, config: tokens.timing.springIn });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: e,
                transform: `translateX(${interpolate(e, [0, 1], [-60, 0])}px)`,
                backgroundColor: tokens.color.surface,
                borderRadius: tokens.radius.md,
                padding: "22px 28px",
                boxShadow: tokens.shadow.card,
                textAlign: "left",
              }}
            >
              <div
                style={{
                  minWidth: 16,
                  height: 16,
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.color.accent,
                }}
              />
              <div style={{ fontSize: tokens.size.bullet, fontWeight: tokens.weight.semibold }}>{b}</div>
            </div>
          );
        })}
      </div>
    </SafeArea>
  );
};

/* -------------------------------- Product ------------------------------- */
/** Background (ảnh + Ken Burns) do SceneWrapper lo; đây chỉ là heading overlay. */
export const ProductLayout: React.FC<LayoutProps> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - 6, fps, config: tokens.timing.springIn });

  return (
    <SafeArea height={height} justify="flex-start">
      {scene.heading && (
        <div
          style={{
            opacity: e,
            transform: `translateY(${interpolate(e, [0, 1], [-40, 0])}px)`,
            fontSize: tokens.size.heading,
            fontWeight: tokens.weight.black,
            padding: "24px 32px",
            borderRadius: tokens.radius.lg,
            backgroundColor: tokens.color.scrim,
            textShadow: tokens.shadow.text,
            marginTop: height * 0.04,
          }}
        >
          {scene.heading}
        </div>
      )}
    </SafeArea>
  );
};

/* -------------------------------- Compare ------------------------------- */

export const CompareLayout: React.FC<LayoutProps> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bullets = scene.bullets ?? [];
  const left = bullets[0] ?? "A";
  const right = bullets[1] ?? "B";
  const eL = spring({ frame, fps, config: tokens.timing.springIn });
  const eR = spring({ frame: frame - 8, fps, config: tokens.timing.springIn });

  const panel = (text: string, color: string, e: number, from: number): React.CSSProperties => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: tokens.size.heading,
    fontWeight: tokens.weight.black,
    color: tokens.color.text,
    backgroundColor: color,
    opacity: e,
    transform: `translateY(${interpolate(e, [0, 1], [from, 0])}px)`,
    padding: tokens.space.pagePadding,
    textAlign: "center",
  });

  return (
    <AbsoluteFill style={{ fontFamily: TEXT_STACK, flexDirection: "column" }}>
      <div style={panel(left, tokens.color.bad, eL, -80)}>{left}</div>
      <div style={panel(right, tokens.color.good, eR, 80)}>{right}</div>
      {scene.heading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: tokens.size.heading,
            fontWeight: tokens.weight.black,
            color: "#111",
            backgroundColor: tokens.color.accent,
            padding: "16px 28px",
            borderRadius: tokens.radius.pill,
            boxShadow: tokens.shadow.card,
          }}
        >
          {scene.heading}
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ---------------------------------- CTA --------------------------------- */

export const CtaLayout: React.FC<LayoutProps> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Nhịp "nhấn": pulse nhẹ lặp lại.
  const pulse = 1 + 0.04 * Math.sin((frame / fps) * Math.PI * 3);
  const e = spring({ frame, fps, config: tokens.timing.springIn });

  return (
    <SafeArea height={height}>
      {scene.icon && <IconBadge icon={scene.icon} />}
      <div
        style={{
          opacity: e,
          transform: `scale(${interpolate(e, [0, 1], [0.7, 1]) * pulse})`,
          fontSize: tokens.size.cta,
          fontWeight: tokens.weight.black,
          color: "#111",
          backgroundColor: tokens.color.accent,
          padding: "40px 56px",
          borderRadius: tokens.radius.lg,
          boxShadow: tokens.shadow.card,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {scene.heading ?? scene.narration}
      </div>
    </SafeArea>
  );
};

/* -------------------------------- Image --------------------------------- */
/** Ảnh minh họa khung gọn: bo góc, sắc nét (contain, không crop) + tiêu đề/icon. */
const resolveImgSrc = (src: string): string =>
  /^https?:\/\//.test(src) || src.startsWith("data:") ? src : staticFile(src);

export const ImageLayout: React.FC<LayoutProps> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame, fps, config: tokens.timing.springIn });
  const media = scene.media;

  return (
    <SafeArea height={height} justify="center">
      {(scene.icon || scene.heading) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginBottom: 28,
            fontSize: Math.round(tokens.size.heading * 0.8),
            fontWeight: tokens.weight.black,
            textShadow: tokens.shadow.text,
          }}
        >
          {scene.icon && <span style={{ fontFamily: EMOJI_FAMILY }}>{scene.icon}</span>}
          {scene.heading && <span>{scene.heading}</span>}
        </div>
      )}

      {media && media.kind !== "color" && (
        <div
          style={{
            opacity: e,
            transform: `scale(${interpolate(e, [0, 1], [0.9, 1])})`,
            width: "100%",
            maxHeight: Math.round(height * 0.52),
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.lg,
            border: `1px solid ${tokens.color.surface}`,
            boxShadow: tokens.shadow.card,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <Img
            src={resolveImgSrc(media.src)}
            style={{
              maxWidth: "100%",
              maxHeight: Math.round(height * 0.5),
              objectFit: "contain",
              borderRadius: tokens.radius.md,
              display: "block",
            }}
          />
        </div>
      )}
    </SafeArea>
  );
};

/* ------------------------------- Registry ------------------------------- */

export const LAYOUTS: Record<BuiltScene["layout"], React.FC<LayoutProps>> = {
  hook: HookLayout,
  bullet: BulletLayout,
  product: ProductLayout,
  compare: CompareLayout,
  cta: CtaLayout,
  code: CodeLayout,
  image: ImageLayout,
};
