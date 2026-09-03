import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * motion.ts — BỘ CHUYỂN ĐỘNG DÙNG CHUNG.
 *
 * Trước đây mỗi component tự gọi spring() với config riêng → nhịp mỗi chỗ một kiểu,
 * video trông rời rạc. Gom về đây để cả video có CÙNG MỘT NHỊP: cùng độ nảy, cùng
 * độ trễ giữa các phần tử, cùng biên độ trôi.
 *
 * Ba tầng chuyển động, cố ý tách bạch:
 *   1. VÀO   (useEnter)       — phần tử xuất hiện. Dứt khoát, có nảy.
 *   2. SỐNG  (useDrift/usePulse/useSweep) — chuyển động LIÊN TỤC rất nhẹ sau khi đã vào.
 *      Đây là thứ phân biệt video "có hồn" với ảnh tĩnh ghép lại: không có nó, sau
 *      giây thứ hai mọi thứ đứng chết trong khi giọng đọc vẫn chạy.
 *   3. RA    (useExit)        — phần tử rút đi trước khi cắt cảnh, để cú cắt có chủ đích.
 *
 * Mọi thứ đều tính từ useCurrentFrame() → xác định, render lại bao nhiêu lần cũng như nhau.
 */

/** Nhịp chuẩn của cả hệ. Đổi ở đây là đổi cảm giác của toàn bộ video. */
export const BEAT = {
  /** Spring "vào" mặc định — nảy vừa, không lò xo quá đà. */
  enter: { damping: 18, stiffness: 160, mass: 0.8 },
  /** Spring cho phần tử nhỏ cần dứt khoát hơn (số, huy hiệu). */
  pop: { damping: 12, stiffness: 220, mass: 0.6 },
  /** Số frame trễ giữa hai phần tử liên tiếp trong một danh sách. */
  stagger: 6,
  /** Số frame của pha "ra". */
  exitFrames: 10,
} as const;

/** Tiến trình 0→1 của hiệu ứng VÀO, trễ `delay` frame. */
export function useEnter(delay = 0, config: Parameters<typeof spring>[0]["config"] = BEAT.enter): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
}

/**
 * Tiến trình 1→0 ở `frames` frame CUỐI cảnh. Dùng cho lớp NỘI DUNG (không dùng cho nền:
 * nền mà mờ đi thì lộ ra lớp phía sau, thành nháy đen giữa hai cảnh).
 */
export function useExit(durationInFrames: number, frames: number = BEAT.exitFrames): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [durationInFrames - frames, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/**
 * Trôi liên tục -1..1. `index` làm lệch pha nên nhiều phần tử cùng trôi mà không
 * đồng loạt như bị giật dây. Biên độ để chỗ gọi quyết định — ở đây chỉ trả dao động.
 */
export function useDrift(index = 0, hz = 0.17): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return Math.sin((frame / fps) * Math.PI * 2 * hz + index * 1.7);
}

/** Nhịp thở 0..1 (mềm, không tuyến tính) — dùng cho quầng sáng, viền phát sáng. */
export function usePulse(hz = 0.35, index = 0): number {
  return (useDrift(index, hz) + 1) / 2;
}

/**
 * Vệt quét 0..1 lặp mỗi `periodSec` giây — dùng cho ánh sáng chạy dọc thanh biểu đồ,
 * chấm sáng chạy trên đường timeline.
 */
export function useSweep(periodSec = 2.6, offset = 0): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return ((frame / fps / periodSec) % 1 + offset) % 1;
}

/** Gói entrance thường dùng: mờ + trượt lên + phóng nhẹ, trả thẳng CSS. */
export function enterUp(e: number, distance = 26): React.CSSProperties {
  return {
    opacity: interpolate(e, [0, 0.55], [0, 1], { extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(e, [0, 1], [distance, 0])}px)`,
  };
}
