import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { BuiltScene, Captions, TransitionKind } from "../schema";
import { KaraokeCaption } from "./KaraokeCaption";
import { CLAUDE_LAYOUTS } from "./claude/ClaudeLayouts";
import { SceneBackdrop } from "./SceneBackdrop";
import { useDrift, useExit } from "./motion";

/**
 * SceneWrapper — ghép 1 scene: nền + foreground layout + audio + karaoke caption.
 *
 * Ba lớp TÁCH BIỆT, mỗi lớp có chuyển động riêng — đây là điểm mấu chốt:
 *   NỀN      chỉ mờ vào, KHÔNG mờ ra. Nền mà mờ ra thì lộ lớp phía sau → nháy giữa 2 cảnh.
 *   NỘI DUNG có cả vào lẫn RA, cộng thêm trôi ngược chiều nền (parallax).
 *   PHỤ ĐỀ   không dính transition nào — nó phải khớp từng từ với giọng đọc.
 *
 * Về transitions: dùng interpolate() theo frame thay vì @remotion/transitions
 * TransitionSeries. Lý do: TransitionSeries chồng lấn frame giữa các scene → lệch audio
 * đặt theo từng scene. Cách này giữ timing khớp audio tuyệt đối.
 */

const ENTER_FRAMES = 16;

/**
 * Layout có nhiều khối nội dung đè lên nền → video nền phải lùi hẳn ra sau (mờ mạnh).
 * hook/cta/product/image chỉ có một dòng chữ nên để cảnh quay hiện rõ hơn.
 */
const BUSY_LAYOUTS = new Set<BuiltScene["layout"]>(["bullet", "compare", "graphic", "code"]);

/** smoothstep — làm mềm chuyển động vào/ra (đỡ cứng như tuyến tính). */
const smooth = (p: number) => p * p * (3 - 2 * p);

function enterStyle(kind: TransitionKind, frame: number): React.CSSProperties {
  const raw = interpolate(frame, [0, ENTER_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const p = smooth(raw);
  switch (kind) {
    case "none":
      return {};
    case "fade":
      return { opacity: p };
    // Trượt kèm fade + dịch một quãng ngắn (mượt, điện ảnh — không "đẩy" cả màn).
    case "slide-left":
      return { opacity: p, transform: `translateX(${interpolate(p, [0, 1], [120, 0])}px)` };
    case "slide-up":
      return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [120, 0])}px)` };
    case "wipe":
      return { clipPath: `inset(0 ${interpolate(p, [0, 1], [100, 0])}% 0 0)` };
    case "zoom":
      return { opacity: p, transform: `scale(${interpolate(p, [0, 1], [1.14, 1])})` };
    case "blur":
      return { opacity: p, filter: `blur(${interpolate(p, [0, 1], [22, 0])}px)` };
    case "glow":
      return {
        opacity: p,
        transform: `scale(${interpolate(p, [0, 1], [0.92, 1])})`,
        filter: `brightness(${interpolate(p, [0, 1], [1.9, 1])})`,
      };
    default: {
      const _e: never = kind;
      throw new Error(`Transition không tồn tại: ${_e}`);
    }
  }
}

/**
 * Style của lớp NỘI DUNG: transitionIn + trôi parallax + pha RA.
 *
 * Pha ra cố ý ĐẨY LÊN và phóng nhẹ (không phải mờ tại chỗ): nội dung "bay ra khỏi khung"
 * đúng lúc cảnh sau ập vào, nên cú cắt đọc ra là một nhịp có chủ đích chứ không phải
 * hình bị tắt đột ngột. Nền không tham gia pha này nên không có nháy đen.
 */
function contentStyle(
  kind: TransitionKind,
  frame: number,
  exit: number,
  parallaxY: number,
): React.CSSProperties {
  const base = enterStyle(kind, frame);
  const exitOut = 1 - exit; // 0 → 1 trong BEAT.exitFrames frame cuối
  const enterTransform = typeof base.transform === "string" ? base.transform : "";
  return {
    ...base,
    opacity: (typeof base.opacity === "number" ? base.opacity : 1) * exit,
    transform: `${enterTransform} translateY(${parallaxY - exitOut * 46}px) scale(${1 + exitOut * 0.05})`.trim(),
  };
}

export const SceneWrapper: React.FC<{
  scene: BuiltScene;
  captions: Captions;
  width: number;
  height: number;
}> = ({ scene, captions, height }) => {
  const frame = useCurrentFrame();
  // Một bộ layout duy nhất cho mọi theme — màu/chất liệu do Palette quyết định
  // (xem theme/claude.ts). Ảnh luôn ĐÓNG KHUNG trong layout; chỉ VIDEO mới tràn màn.
  const Layout = CLAUDE_LAYOUTS[scene.layout];

  const exit = useExit(scene.durationInFrames);
  // Parallax: nền phóng vào (SceneBackdrop) trong khi nội dung trôi NGƯỢC lên rất chậm.
  // Hai lớp đi khác chiều là cách rẻ nhất để khung hình có chiều sâu thay vì phẳng lì.
  const parallax = interpolate(frame, [0, scene.durationInFrames], [10, -10], {
    extrapolateRight: "clamp",
  });
  const breathe = useDrift(1, 0.09) * 3;

  return (
    <AbsoluteFill>
      {/* NỀN — chỉ mờ vào, giữ nguyên đến hết cảnh. */}
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <SceneBackdrop
          media={scene.media}
          durationInFrames={scene.durationInFrames}
          busy={BUSY_LAYOUTS.has(scene.layout)}
        />
      </AbsoluteFill>

      {/* NỘI DUNG — transitionIn + parallax + pha RA ở cuối cảnh. */}
      <AbsoluteFill style={contentStyle(scene.transitionIn, frame, exit, parallax + breathe)}>
        <Layout scene={scene} height={height} />
      </AbsoluteFill>

      <KaraokeCaption
        words={scene.words}
        style={captions.style}
        position={captions.position}
        maxWordsPerLine={captions.maxWordsPerLine}
        highlightColor={captions.highlightColor}
      />
      <Audio src={staticFile(scene.audioSrc)} />
    </AbsoluteFill>
  );
};
