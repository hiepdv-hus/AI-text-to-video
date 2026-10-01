import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene, Graphic } from "../../schema";
import { safeArea, tokens } from "../../theme/tokens";
import type { Palette } from "../../theme/claude";
import { useTheme, isTech, cardSurface } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { EMOJI_FAMILY } from "../fontsEmoji";
import { CodeLayout } from "../CodeLayout";
import { ClaudeFeatureCards } from "./ClaudeFeatureCards";
import { ClaudeSteps } from "./ClaudeSteps";
import { ClaudeChat } from "./ClaudeChat";
import { TechBars } from "./TechBars";
import { TechBars3D } from "./TechBars3D";
import { IllusOrbit } from "./IllusOrbit";
import { IllusFlow } from "./IllusFlow";
import { IllusCompare } from "./IllusCompare";
import { IllusBuild } from "./IllusBuild";
import { IllusHero } from "./IllusHero";
import { AnimatedIllus } from "./IllusImage";
import { CinematicShot } from "./CinematicShot";
import { HackScene } from "./HackScene";
import { StatementScene } from "./StatementScene";
import { DrawScene } from "./DrawScene";
import { TechTimeline } from "./TechTimeline";
import { TechDevice } from "./TechDevice";
import { StatBig } from "./StatBig";
import { ClaudeChecklist } from "./ClaudeChecklist";
import { TechArchitecture } from "./TechArchitecture";
import { RangeBar } from "./RangeBar";
import { HeadingBlock } from "./Heading";
import { ChipRow } from "./ChipRow";
import { BEAT, useEnter, useFloatPx, usePulse } from "../motion";

export { ClaudeHeading } from "./Heading";

/**
 * ClaudeLayouts — bộ layout của kiểu hình ảnh "Đầy đủ" (visualStyle "mixed"), dùng cho mọi theme.
 * Kiểu "Chỉ ảnh" KHÔNG dùng layout nào — chỉ ảnh gốc + phụ đề (xem SceneWrapper).
 * Bố cục giống nhau ở mọi theme;
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
        // Lề ngang lấy từ tokens.space.pagePadding — CÙNG một con số với đồ hoạ và phụ đề.
        // Trước đây hardcode 64px nên nội dung sát mép hơn hẳn hai lớp kia.
        paddingLeft: tokens.space.pagePadding,
        paddingRight: tokens.space.pagePadding,
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
  const float = useFloatPx(2, 0.12, 3);
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
  const float = useFloatPx(5, 0.22, 6);
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
        <ChipRow labels={scene.chips} p={p} delay={10} />
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
      {/* Chip dưới nút CTA: chỗ đặt link, tên repo, giấy phép — thông tin người xem cần
          ghi lại đúng lúc họ đang quyết định lưu video. */}
      <ChipRow labels={scene.chips} p={p} delay={10} />
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
      <ChipRow labels={scene.chips} p={p} />
      {/* perspective + preserve-3d → các thẻ con nằm ở CHIỀU SÂU thật (translateZ), không phẳng. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          width: "100%",
          perspective: 1300,
          perspectiveOrigin: "50% 40%",
          transformStyle: "preserve-3d",
        }}
      >
        {bullets.map((b, i) => (
          <BulletRow key={i} index={i} count={bullets.length} text={b} p={p} />
        ))}
      </div>
    </Col>
  );
};

/**
 * Một dòng bullet — thẻ CÓ CHIỀU SÂU 3D (không phẳng như chữ dán):
 *   - VÀO   : lật lên quanh cạnh trên (rotateX) + bay từ xa lại (translateZ âm → 0).
 *   - XẾP LỚP: mỗi thẻ lùi sâu dần (translateZ theo index) → nhìn qua perspective thấy
 *             các thẻ ở các độ sâu khác nhau, như một chồng panel nổi trong không gian.
 *   - SỐNG  : "thở" theo trục Z rất khẽ (to/nhỏ nhẹ) cho thẻ có sức sống mà chữ vẫn đọc rõ.
 * Số thứ tự được đẩy NỔI LÊN TRƯỚC mặt thẻ (translateZ dương) → chiều sâu ngay trong thẻ.
 */
const BulletRow: React.FC<{ index: number; count: number; text: string; p: Palette }> = ({ index, count, text, p }) => {
  const tech = isTech(p);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useEnter(6 + index * BEAT.stagger, { damping: 16, stiffness: 150, mass: 0.9 });
  const t = frame / fps;
  // Lật vào quanh cạnh trên; bay từ xa; xếp lớp lùi dần; thở nhẹ theo Z.
  const rx = interpolate(e, [0, 1], [-72, 0]);
  const zBreath = Math.sin(t * 0.7 + index * 0.9) * 9;
  const z = interpolate(e, [0, 1], [-200, -index * 22]) + zBreath;
  const tx = interpolate(e, [0, 1], [-40, 0]);
  return (
    <div
      style={{
        opacity: interpolate(e, [0, 0.45], [0, 1], { extrapolateRight: "clamp" }),
        transformStyle: "preserve-3d",
        transform: `translateX(${tx.toFixed(1)}px) translateZ(${z.toFixed(1)}px) rotateX(${rx.toFixed(1)}deg)`,
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "26px 30px",
        textAlign: "left",
        fontSize: p.size.card,
        fontWeight: 650,
        lineHeight: 1.2,
        ...cardSurface(p),
        // Bóng đổ SÂU hơn để thẻ "nổi" khỏi nền — đây là thứ bán được cảm giác 3D.
        boxShadow: tech ? `0 26px 55px rgba(0,0,0,0.55), ${p.glow}` : `0 26px 55px rgba(0,0,0,0.38)`,
        ...(tech ? { borderLeft: `3px solid ${p.accent}` } : {}),
      }}
    >
      {tech ? (
        // Số thứ tự mono "01, 02…" — ĐẨY NỔI lên trước mặt thẻ cho có chiều sâu.
        <span
          style={{
            fontFamily: p.labelFont,
            fontSize: p.size.label,
            fontWeight: 800,
            color: p.accent,
            minWidth: 52,
            letterSpacing: 1,
            transform: "translateZ(34px)",
            textShadow: isTech(p) ? `0 0 18px ${p.accentSoft}` : "none",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      ) : (
        <span style={{ width: 8, height: 8, minWidth: 8, borderRadius: 999, background: p.accent, transform: "translateZ(28px)" }} />
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
  const drift = useFloatPx(0, 0.15, 3);
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

/**
 * IllusL — layout "illus": ẢNH AI minh hoạ LỚN được làm "sống" (AnimatedIllus). Khác
 * `image` (khung nhỏ, tĩnh Ken Burns nhẹ) ở chỗ ảnh to hơn, có parallax 2.5D + vệt sáng
 * + khung thở → dùng làm cảnh minh hoạ chính cho chủ đề ngoài thư viện illus-* vẽ tay.
 * Dùng với `media.kind:"generate"` (prompt tiếng Anh) là chính; ảnh/pexels cũng chạy.
 */
const IllusL: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  return (
    <Col height={height} p={p}>
      {scene.heading && <HeadingBlock heading={scene.heading} emphasis={scene.emphasis} p={p} />}
      <ChipRow labels={scene.chips} p={p} delay={8} />
      {scene.media?.kind === "image" && <AnimatedIllus src={scene.media.src} height={height} p={p} />}
    </Col>
  );
};

/* ---------------------------------- Gfx ---------------------------------- */

/**
 * GfxL — layout "gfx" (GIÀU): kết hợp ĐỒ HOẠ 3D + CHỮ trong một khung, chia zone gọn:
 *   NỬA TRÊN  — tiêu đề + chip + bullet (chữ), căn TRÊN.
 *   NỬA DƯỚI  — chủ thể 3D (media gfx3d + `subject`, đã dịch xuống trong 3D) trên nền 3D mờ.
 * Nhờ chia trên/dưới, chữ và hình 3D không đè nhau mà vẫn cùng một khung dày dặn.
 */
const GfxL: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const bullets = (scene.bullets ?? []).slice(0, 3);
  const sa = safeArea(height);
  return (
    <AbsoluteFill
      style={{
        fontFamily: TEXT_STACK,
        color: p.text,
        paddingTop: sa.top,
        paddingBottom: Math.round(height * 0.48),
        paddingLeft: tokens.space.pagePadding,
        paddingRight: tokens.space.pagePadding,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 20,
      }}
    >
      {scene.heading && <HeadingBlock heading={scene.heading} emphasis={scene.emphasis} p={p} />}
      <ChipRow labels={scene.chips} p={p} />
      {bullets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", perspective: 1300, transformStyle: "preserve-3d" }}>
          {bullets.map((b, i) => (
            <BulletRow key={i} index={i} count={bullets.length} text={b} p={p} />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

/* -------------------------------- Graphic -------------------------------- */

/**
 * Props chung của mọi widget đồ hoạ. Widget nào cần gì thì đọc nấy — gom về một kiểu
 * để `GRAPHICS` dưới đây khai báo được dưới dạng bảng tra thay vì chuỗi if-else.
 */
export interface GProps {
  labels?: string[];
  timestamps?: string[];
  timecode?: string;
  p: Palette;
}

/**
 * GRAPHICS — bảng tra widget theo `graphic.kind`.
 *
 * Kiểu `Record<Graphic["kind"], …>` là phần QUAN TRỌNG NHẤT ở đây: thêm một kind vào
 * enum trong schema mà quên nối widget sẽ thành LỖI BIÊN DỊCH. Trước đây chỗ này là
 * chuỗi if-else có nhánh `else` bắt tất — nên `device-editor` đã nằm trong schema hàng
 * tháng trời mà lặng lẽ render ra feature-cards, không ai biết.
 */
const GRAPHICS: Record<Graphic["kind"], React.FC<GProps>> = {
  "chat-ai": ({ labels, p }) => <ClaudeChat labels={labels} p={p} />,
  steps: ({ labels, p }) => <ClaudeSteps labels={labels} p={p} />,
  "bar-chart": ({ labels, p }) => <TechBars labels={labels} p={p} />,
  "bar-chart-3d": ({ labels, p }) => <TechBars3D labels={labels} p={p} />,
  "illus-orbit": ({ labels, p }) => <IllusOrbit labels={labels} p={p} />,
  "illus-flow": ({ labels, p }) => <IllusFlow labels={labels} p={p} />,
  "illus-compare": ({ labels, p }) => <IllusCompare labels={labels} p={p} />,
  "illus-build": ({ labels, p }) => <IllusBuild labels={labels} p={p} />,
  "illus-hero": ({ labels, p }) => <IllusHero labels={labels} p={p} />,
  "highlight-timeline": ({ labels, timestamps, p }) => <TechTimeline labels={labels} timestamps={timestamps} p={p} />,
  "feature-cards": ({ labels, p }) => <ClaudeFeatureCards labels={labels} p={p} />,
  "device-editor": ({ timecode, p }) => <TechDevice timecode={timecode} p={p} />,
  "stat-big": ({ labels, p }) => <StatBig labels={labels} p={p} />,
  checklist: ({ labels, p }) => <ClaudeChecklist labels={labels} p={p} />,
  architecture: ({ labels, p }) => <TechArchitecture labels={labels} p={p} />,
  "range-bar": ({ labels, p }) => <RangeBar labels={labels} p={p} />,
};

const Graphic: React.FC<LProps> = ({ scene, height }) => {
  const p = useTheme()!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame, fps, config: { damping: 22, stiffness: 120 } });
  const g = scene.graphic;
  // Không có graphic thì rơi về feature-cards — cảnh vẫn có nội dung thay vì trống trơn.
  const Widget = (g && GRAPHICS[g.kind]) || GRAPHICS["feature-cards"];
  return (
    <Col height={height} p={p}>
      {scene.heading && (
        <div style={{ opacity: e, transform: `translateY(${interpolate(e, [0, 1], [-14, 0])}px)`, width: "100%" }}>
          <HeadingBlock heading={scene.heading} emphasis={scene.emphasis} subtitle={g?.subtitle} p={p} />
        </div>
      )}
      <ChipRow labels={scene.chips} p={p} />
      {/* Mọi widget đọc màu từ Palette nên đổi theme là đổi luôn diện mạo widget —
          không có widget nào "cứng màu". */}
      <Widget labels={g?.labels} timestamps={g?.timestamps} timecode={g?.timecode} p={p} />
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
  illus: IllusL,
  shot: CinematicShot,
  gfx: GfxL,
  hack: HackScene,
  statement: StatementScene,
  draw: DrawScene,
  graphic: Graphic,
};
