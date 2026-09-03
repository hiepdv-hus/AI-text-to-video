import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene } from "../../schema";
import { safeArea } from "../../theme/tokens";
import type { Palette } from "../../theme/claude";
import { useTheme, isTech, cardSurface } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { EMOJI_FAMILY } from "../fontsEmoji";
import { CodeLayout } from "../CodeLayout";
import { ClaudeFeatureCards } from "./ClaudeFeatureCards";
import { ClaudeSteps } from "./ClaudeSteps";
import { ClaudeChat } from "./ClaudeChat";
import { TechBars } from "./TechBars";
import { TechTimeline } from "./TechTimeline";
import { HeadingBlock } from "./Heading";
import { BEAT, useDrift, useEnter, usePulse } from "../motion";

export { ClaudeHeading } from "./Heading";

/**
 * ClaudeLayouts — BỘ LAYOUT DUY NHẤT cho mọi theme. Bố cục giống nhau ở mọi theme;
 * màu và chất liệu đọc hết từ Palette (useTheme) → đổi theme là đổi cả video, đồng bộ.
 *
 * Hai quy ước về media:
 *   - VIDEO → nền toàn màn (SceneBackdrop lo), layout KHÔNG vẽ lại.
 *   - ẢNH   → đóng khung `Framed` vừa đủ trong cột nội dung, không crop tràn màn.
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
        // 26% dưới: chừa đủ cho phụ đề 2 dòng ở cỡ chữ mới (68px) mà không đụng nội dung.
        paddingBottom: Math.round(height * 0.26),
        // 64px hai bên (không phải 84): chữ to hơn thì cần thêm bề ngang, nếu không
        // nhãn tiếng Việt sẽ ngắt dòng vụn.
        paddingLeft: 64,
        paddingRight: 64,
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

/**
 * Framed — ảnh đóng khung "vừa đủ": bo góc, viền mảnh, bóng nhẹ, không crop tràn màn.
 * Theme tech thêm 2 dấu góc kiểu HUD ở góc trên-trái / dưới-phải để khung ảnh cũng
 * mang cùng ngôn ngữ kỹ thuật với phần còn lại.
 */
const Framed: React.FC<{ src: string; height: number; p: Palette; delay?: number }> = ({ src, height, p, delay = 4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useEnter(delay, { damping: 20, stiffness: 130, mass: 0.9 });
  const maxH = Math.round(height * 0.42);
  // Ken Burns liên tục cho ảnh tĩnh: 1.2%/giây. Không có nó thì cảnh layout "image"
  // đứng chết trong khi giọng đọc vẫn chạy — đúng thứ làm video trông như slide.
  const kenBurns = 1 + (frame / fps) * 0.012;
  const float = useDrift(2, 0.12) * 3;
  const tick: React.CSSProperties = { position: "absolute", width: 26, height: 26, borderColor: p.accent, borderStyle: "solid" };
  return (
    <div
      style={{
        position: "relative",
        opacity: e,
        transform: `translateY(${interpolate(e, [0, 1], [22, 0]) + float}px)`,
        width: "100%",
      }}
    >
      <div
        style={{
          maxHeight: maxH,
          borderRadius: p.radius.lg,
          overflow: "hidden",
          border: `1px solid ${p.cardBorder}`,
          boxShadow: isTech(p) ? `${p.cardShadow}, ${p.glow}` : p.cardShadow,
          background: p.card,
          display: "flex",
        }}
      >
        <Img
          src={resolveImg(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            maxHeight: maxH,
            transform: `scale(${kenBurns})`,
          }}
        />
      </div>
      {isTech(p) && (
        <>
          <div style={{ ...tick, top: -3, left: -3, borderWidth: "2px 0 0 2px", borderTopLeftRadius: p.radius.sm }} />
          <div style={{ ...tick, bottom: -3, right: -3, borderWidth: "0 2px 2px 0", borderBottomRightRadius: p.radius.sm }} />
        </>
      )}
    </div>
  );
};

/** Icon cảnh — bật vào rồi bồng bềnh nhẹ, để nó không phải một hình dán bất động. */
const Icon: React.FC<{ icon: string; p: Palette }> = ({ icon, p }) => {
  const e = useEnter(0, BEAT.pop);
  const float = useDrift(5, 0.22) * 6;
  return (
    <div
      style={{
        fontSize: 76,
        fontFamily: EMOJI_FAMILY,
        opacity: p.isDark ? 0.95 : 1,
        transform: `translateY(${float}px) scale(${interpolate(e, [0, 1], [0.4, 1])}) rotate(${interpolate(
          e,
          [0, 1],
          [-18, 0],
        ).toFixed(1)}deg)`,
      }}
    >
      {icon}
    </div>
  );
};

/* ------------------------------- Hook / CTA ------------------------------ */

const Hook: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const text = scene.heading ?? scene.narration;
  // Tiêu đề hook TỰ chạy theo từng chữ (xem Heading.tsx) nên ở đây không bọc thêm
  // hiệu ứng vào nữa — chồng hai lớp animation lên nhau chỉ làm nhoè cả hai.
  return (
    <Col height={height} p={p}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, width: "100%" }}>
        {scene.icon && <Icon icon={scene.icon} p={p} />}
        <HeadingBlock heading={text} emphasis={scene.emphasis} p={p} size={p.size.hook} />
      </div>
      {scene.media?.kind === "image" && <Framed src={scene.media.src} height={height} p={p} delay={8} />}
    </Col>
  );
};

const Cta: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const e = useEnter(0, BEAT.pop);
  // Nút CTA THỞ liên tục: phóng ~1.5% và quầng sáng phồng lên xẹp xuống. Cảnh chốt là
  // chỗ người xem quyết định lưu/theo dõi — một nút đứng im ở đó là bỏ phí.
  const pulse = usePulse(0.5);
  return (
    <Col height={height} p={p}>
      {scene.icon && <Icon icon={scene.icon} p={p} />}
      <div
        style={{
          opacity: e,
          transform: `scale(${interpolate(e, [0, 1], [0.9, 1]) * (1 + pulse * 0.015)})`,
          fontSize: p.size.heading,
          fontWeight: 700,
          color: p.onAccent,
          background: p.accentGradient,
          padding: "26px 44px",
          borderRadius: p.radius.pill,
          boxShadow: isTech(p)
            ? `${p.cardShadow}, 0 0 ${(30 + pulse * 40).toFixed(0)}px ${p.accentSoft}`
            : p.cardShadow,
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
  const bullets = scene.bullets ?? [];
  return (
    <Col height={height} p={p}>
      {scene.heading && <HeadingBlock heading={scene.heading} emphasis={scene.emphasis} p={p} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
        {bullets.map((b, i) => (
          <BulletRow key={i} index={i} text={b} p={p} />
        ))}
      </div>
    </Col>
  );
};

/** Một dòng bullet — tách thành component riêng để mỗi dòng có hook chuyển động của nó. */
const BulletRow: React.FC<{ index: number; text: string; p: Palette }> = ({ index, text, p }) => {
  const tech = isTech(p);
  const e = useEnter(6 + index * BEAT.stagger, { damping: 18, stiffness: 160, mass: 0.8 });
  const float = useDrift(index, 0.16) * 3;
  return (
    <div
      style={{
        opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        // Trượt vào TỪ TRÁI (không phải từ dưới): dòng gạch đầu dòng đọc theo chiều
        // ngang, chuyển động cùng chiều đọc thì mắt bám dễ hơn.
        transform: `translateX(${interpolate(e, [0, 1], [-44, 0])}px) translateY(${float}px)`,
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "26px 30px",
        textAlign: "left",
        fontSize: p.size.card,
        fontWeight: 650,
        lineHeight: 1.2,
        ...cardSurface(p),
        // Tech: gạch nhấn bên trái thay cho viền đều 4 cạnh → mắt bắt được thứ tự đọc.
        ...(tech ? { borderLeft: `3px solid ${p.accent}` } : {}),
      }}
    >
      {tech ? (
        // Số thứ tự mono "01, 02…" — rõ ràng hơn chấm tròn, đúng tông kỹ thuật.
        <span
          style={{
            fontFamily: p.labelFont,
            fontSize: p.size.label,
            fontWeight: 800,
            color: p.accent,
            minWidth: 52,
            letterSpacing: 1,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      ) : (
        <span style={{ width: 8, height: 8, minWidth: 8, borderRadius: 999, background: p.accent }} />
      )}
      {text}
    </div>
  );
};

/* -------------------------------- Compare -------------------------------- */

const Compare: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = scene.bullets ?? [];
  const drift = useDrift(0, 0.15) * 3;
  const row = (text: string, ok: boolean, delay: number) => {
    const e = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 160, mass: 0.8 } });
    // Hai vế trôi NGƯỢC chiều nhau — chúng đang đối lập nhau, chuyển động nên nói lên điều đó.
    const float = ok ? drift : -drift;
    return (
      <div
        style={{
          opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(e, [0, 1], [18, 0]) + float}px)`,
          display: "flex",
          alignItems: "center",
          gap: 18,
          width: "100%",
          padding: "26px 28px",
          textAlign: "left",
          fontSize: p.size.card,
          fontWeight: 700,
          color: p.text,
          ...cardSurface(p),
          // Vế ĐÚNG được tô nền nhấn + viền dày hơn → tương phản rõ giữa 2 vế.
          background: ok ? p.accentSoft : p.card,
          border: `1.5px solid ${ok ? p.accent : p.cardBorder}`,
          boxShadow: ok && isTech(p) ? `${p.cardShadow}, ${p.glow}` : p.cardShadow,
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
      {scene.heading && <HeadingBlock heading={scene.heading} emphasis={scene.emphasis} p={p} />}
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
      {scene.heading && <HeadingBlock heading={scene.heading} emphasis={scene.emphasis} p={p} />}
      {/* Chỉ ẢNH mới đóng khung ở đây — VIDEO đã là nền toàn màn (SceneBackdrop). */}
      {scene.media?.kind === "image" && <Framed src={scene.media.src} height={height} p={p} />}
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
        <div style={{ opacity: e, transform: `translateY(${interpolate(e, [0, 1], [-14, 0])}px)`, width: "100%" }}>
          <HeadingBlock heading={scene.heading} emphasis={scene.emphasis} subtitle={g?.subtitle} p={p} />
        </div>
      )}
      {/* Chọn widget theo graphic.kind. Mọi widget đọc màu từ Palette nên đổi theme là
          đổi luôn diện mạo widget — không có widget nào "cứng màu". */}
      {g?.kind === "chat-ai" ? (
        <ClaudeChat labels={labels} p={p} />
      ) : g?.kind === "steps" ? (
        <ClaudeSteps labels={labels} p={p} />
      ) : g?.kind === "bar-chart" ? (
        <TechBars labels={labels} p={p} />
      ) : g?.kind === "highlight-timeline" ? (
        <TechTimeline labels={labels} timestamps={g.timestamps} p={p} />
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
