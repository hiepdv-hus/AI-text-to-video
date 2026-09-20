import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { BuiltScene, Captions, Sfx, TransitionKind } from "../schema";
import { KaraokeCaption, type CaptionPosition } from "./KaraokeCaption";
import { CLAUDE_LAYOUTS } from "./claude/ClaudeLayouts";
import { SceneBackdrop, coversFrame, useImageIsBackdrop, useNewsLook } from "./SceneBackdrop";
import { TechBackground } from "./TechBackground";
import { useTheme, isTech, ThemeContext } from "../theme/claude";
import { useExit } from "./motion";
import { NewsSceneChrome } from "./NewsChrome";

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
 * Số frame để lớp NỀN của scene mờ vào. Export ra ngoài vì VideoComposition cần biết
 * CHÍNH XÁC từ frame nào lớp nền đã đục hoàn toàn — để bỏ qua việc vẽ backdrop chung
 * phía sau (xem `backdropIsHidden` ở VideoComposition.tsx).
 */
export const BACKDROP_FADE_FRAMES = 10;

/**
 * Layout có nhiều khối nội dung đè lên nền → video nền phải lùi hẳn ra sau (mờ mạnh).
 * hook/cta/product/image chỉ có một dòng chữ nên để cảnh quay hiện rõ hơn.
 */
const BUSY_LAYOUTS = new Set<BuiltScene["layout"]>(["bullet", "compare", "graphic", "code"]);

/**
 * SFX theo KIỂU CHUYỂN CẢNH, không theo layout — vì tai phải nghe thấy đúng thứ mắt
 * đang thấy. Trượt/xoá là chuyển động ngang → whoosh. Phóng/mờ là tiến vào → riser
 * (cao độ đi lên dẫn người xem vào cảnh mới). Loé sáng là một cú nhấn → impact.
 *
 * `gain` khác nhau từng loại vì bốn file đã chuẩn hoá cùng đỉnh, nhưng tai nghe tiếng
 * trầm (impact) to hơn tiếng cao cùng biên độ.
 */
const SFX_BY_TRANSITION: Record<TransitionKind, { file: string; gain: number } | null> = {
  none: null,
  fade: { file: "sfx/whoosh.wav", gain: 0.45 },
  "slide-left": { file: "sfx/whoosh.wav", gain: 0.9 },
  "slide-up": { file: "sfx/whoosh.wav", gain: 0.9 },
  wipe: { file: "sfx/whoosh.wav", gain: 1 },
  zoom: { file: "sfx/riser.wav", gain: 0.85 },
  blur: { file: "sfx/riser.wav", gain: 0.6 },
  glow: { file: "sfx/impact.wav", gain: 0.7 },
};

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
  // LÀM TRÒN về số nguyên pixel. parallax + breathe chỉ dịch ~0,1px mỗi frame; ở vị trí
  // lệch pixel, Chrome (render bằng CPU, không GPU) rasterize lại chữ với anti-alias khác
  // nhau từng khung → viền chữ "bò" và nhoè, xuất ra video trông như bị mờ/rung. Ghim chữ
  // vào lưới pixel giữ nét tuyệt đối; chuyển động chậm nên bước nhảy 1px gần như không thấy.
  const ty = Math.round(parallaxY - exitOut * 46);
  return {
    ...base,
    opacity: (typeof base.opacity === "number" ? base.opacity : 1) * exit,
    transform: `${enterTransform} translateY(${ty}px) scale(${1 + exitOut * 0.05})`.trim(),
  };
}

export const SceneWrapper: React.FC<{
  scene: BuiltScene;
  captions: Captions;
  sfx: Sfx;
  width: number;
  height: number;
}> = ({ scene, captions, sfx, height }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  // Kiểu hình ảnh của cả video (meta.visualStyle), tách bạch hai đường:
  //   "mixed" → nền + layout ClaudeLayouts (thẻ, biểu đồ, code, ảnh đóng khung…)
  //   "photo" → CHỈ ẢNH GỐC + phụ đề lời kể. Không layout, không chữ tiêu đề, không đồ hoạ.
  const imageIsBackdrop = useImageIsBackdrop();
  const newsLook = useNewsLook();
  const Layout = CLAUDE_LAYOUTS[scene.layout];

  /**
   * Cảnh có VIDEO nền thì SceneBackdrop vẽ một lớp ĐỤC phủ kín, che mất mưa nhị phân
   * mà VideoComposition vẽ chung cho cả video. Hệ quả: cảnh có video và cảnh không có
   * video trông như hai video khác nhau.
   *
   * Vá bằng cách rắc lại mưa ở mức rất mờ ĐÈ LÊN video (biến thể "overlay": ít cột hơn,
   * seed khác nên không lặp hoạ tiết với nền chung). Chỉ ở hai mép, nơi scrim tối nhất
   * — vùng giữa vẫn sạch cho cảnh quay và cho chữ.
   */
  // "Phủ kín khung" = video, hoặc ảnh ở chế độ photo — hai trường hợp này xử lý y hệt nhau.
  const coversBg = coversFrame(scene.media, imageIsBackdrop);
  // Chế độ "Chỉ ảnh" KHÔNG có mưa nhị phân — kể cả lớp mưa mờ phủ lên nền.
  const rainOverVideo = !imageIsBackdrop && isTech(theme) && coversBg;
  const sfxCue = SFX_BY_TRANSITION[scene.transitionIn];

  /**
   * Palette RIÊNG CỦA CẢNH NÀY: giống palette chung, trừ `cardBackdrop`.
   *
   * Card kính mờ (`backdrop-filter: blur(16px) saturate(1.15)`) tồn tại để chữ đọc rõ khi
   * card nằm TRÊN CẢNH QUAY. Cảnh không có video thì sau card chỉ là gradient + mưa nhị
   * phân ở hai mép — làm mờ cái đó gần như không nhìn ra khác biệt, trong khi mỗi card là
   * một lần Chrome phải đọc lại vùng nền bên dưới rồi blur, lặp lại MỖI FRAME. Đo được
   * ~12% thời gian mỗi frame của cảnh đồ hoạ (cảnh đồ hoạ hay có 4-6 card).
   *
   * Hạ qua Palette thay vì thêm tham số cho `cardSurface()`: mọi widget đã đọc palette qua
   * useTheme() nên không phải sửa 9 chỗ gọi, và không có chỗ nào lỡ quên truyền.
   */
  const scenePalette = React.useMemo(() => {
    if (coversBg || theme.cardBackdrop === "none") return theme;
    return { ...theme, cardBackdrop: "none" };
  }, [theme, coversBg]);

  const exit = useExit(scene.durationInFrames);

  /**
   * Cảnh chạy CLIP CỦA BÀI BÁO thì đẩy phụ đề lên khỏi một phần ba dưới.
   *
   * Clip nhúng trong bài báo gần như luôn là video đã dựng sẵn cho mạng xã hội: có logo,
   * có banner, và có PHỤ ĐỀ CHÁY SẴN ngay trong hình ở đúng chỗ phụ đề của mình. Hai lớp
   * chữ chồng nhau thì không đọc được lớp nào — đây là thứ chỉ lộ ra khi xem khung hình
   * thật, không có cách nào biết trước từ spec.
   *
   * Chỉ áp cho clip của bài (kiểu "article"), không áp cho clip kho ở kiểu "mixed": clip
   * Pexels không có phụ đề cháy sẵn, và ở đó phụ đề đã được lớp phủ tối lo cho dễ đọc.
   */
  const captionPosition: CaptionPosition =
    newsLook && scene.media?.kind === "video" ? "clear-burnt-in" : captions.position;

  return (
    <ThemeContext.Provider value={scenePalette}>
      <AbsoluteFill>
        {/* NỀN — chỉ mờ vào, giữ nguyên đến hết cảnh.
            Chế độ "Chỉ ảnh": KHÔNG mờ vào — ảnh hiện nguyên vẹn ngay frame đầu. Mờ vào là
            10 frame ảnh bị pha với màu nền, tức là không còn là ảnh gốc. */}
        <AbsoluteFill
          style={
            imageIsBackdrop
              ? undefined
              : {
                  opacity: interpolate(frame, [0, BACKDROP_FADE_FRAMES], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }
          }
        >
          <SceneBackdrop
            media={scene.media}
            durationInFrames={scene.durationInFrames}
            busy={BUSY_LAYOUTS.has(scene.layout)}
          />
          {/* Đặt SAU SceneBackdrop để nằm trên video, nhưng vẫn trong lớp NỀN nên nó
              mờ vào cùng nhịp với cảnh quay, không bật ra thành một lớp riêng. */}
          {rainOverVideo && <TechBackground variant="overlay" />}
        </AbsoluteFill>

        {/* NỘI DUNG — transitionIn + pha RA ở cuối cảnh (không còn parallax/thở: nội dung
            đứng yên giữa cảnh). Chế độ "Chỉ ảnh" không có lớp này: chỉ ảnh và phụ đề lời kể. */}
        {!imageIsBackdrop && (
          <AbsoluteFill style={contentStyle(scene.transitionIn, frame, exit, 0)}>
            <Layout scene={scene} height={height} />
          </AbsoluteFill>
        )}

        {/* Lớp giao diện báo (kiểu "Từ bài báo"): tiêu đề bài ở cảnh mở, chú thích ảnh ở
            cảnh giữa, dòng nguồn ở cảnh kết. Tự tắt khi meta.article trống. */}
        <NewsSceneChrome scene={scene} />

        <KaraokeCaption
          words={scene.words}
          style={captions.style}
          position={captionPosition}
          maxWordsPerLine={captions.maxWordsPerLine}
          highlightColor={captions.highlightColor}
        />
        <Audio src={staticFile(scene.audioSrc)} />

        {/* SFX chuyển cảnh. Nằm trong Sequence của scene nên tự phát đúng frame đầu cảnh —
            không cần tính mốc thời gian tuyệt đối. Cảnh ĐẦU TIÊN không có SFX: chưa
            chuyển từ đâu cả, đánh một tiếng whoosh vào giây 0 nghe như lỗi ghép. */}
        {sfx.enabled && scene.fromFrame > 0 && sfxCue && (
          <Audio src={staticFile(sfxCue.file)} volume={sfx.volume * sfxCue.gain} />
        )}
      </AbsoluteFill>
    </ThemeContext.Provider>
  );
};
