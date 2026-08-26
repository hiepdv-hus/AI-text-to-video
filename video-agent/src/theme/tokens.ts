/**
 * tokens.ts — nguồn chân lý duy nhất về màu / font / spacing.
 * MỌI component đọc từ đây. Đổi diện mạo cả hệ thống = sửa 1 file này.
 */

export const tokens = {
  color: {
    bg: "#0B0B0F",
    surface: "#15151D",
    text: "#FFFFFF",
    textMuted: "#B9B9C6",
    accent: "#FFD400", // vàng nhấn
    accent2: "#FF2D74", // hồng nhấn phụ
    good: "#39D98A",
    bad: "#FF5C5C",
    scrim: "rgba(0,0,0,0.45)", // lớp phủ tối trên ảnh cho chữ dễ đọc
  },
  font: {
    // Tên family khớp với font embed qua @remotion/google-fonts (xem components/fonts.ts).
    heading: "Be Vietnam Pro",
    body: "Be Vietnam Pro",
    // line-height cao hơn Latin thường vì dấu thanh tiếng Việt cao hơn.
    lineHeight: 1.22,
  },
  size: {
    // px trong khung 1080x1920. (Đã giảm ~12% cho gọn, đỡ chiếm chỗ.)
    hook: 116,
    heading: 80,
    bullet: 52,
    caption: 66,
    captionSmall: 54,
    cta: 82,
  },
  weight: {
    black: 800,
    bold: 700,
    semibold: 600,
    medium: 500,
  },
  space: {
    pagePadding: 90,
    // Safe area: chừa 15% dưới cho UI TikTok/Reels che.
    bottomSafeFraction: 0.15,
    topSafeFraction: 0.08,
    gap: 28,
  },
  radius: {
    md: 28,
    lg: 44,
    pill: 999,
  },
  shadow: {
    text: "0px 4px 24px rgba(0,0,0,0.55)",
    card: "0px 18px 60px rgba(0,0,0,0.45)",
  },
  timing: {
    // Dùng cho spring stiffness/damping mặc định.
    springIn: { damping: 18, stiffness: 140, mass: 0.9 },
  },
} as const;

export type Tokens = typeof tokens;

/** Vùng an toàn (px) tính theo chiều cao khung. */
export const safeArea = (height: number) => ({
  top: Math.round(height * tokens.space.topSafeFraction),
  bottom: Math.round(height * tokens.space.bottomSafeFraction),
});
