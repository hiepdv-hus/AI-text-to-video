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
    // px trong khung 1080x1920. (Đã giảm thêm ~14% cho gọn, đỡ chiếm chỗ.)
    hook: 100,
    heading: 68,
    bullet: 48,
    caption: 56,
    captionSmall: 46,
    cta: 70,
  },
  weight: {
    black: 800,
    bold: 700,
    semibold: 600,
    medium: 500,
  },
  space: {
    // Lề ngang dùng chung cho MỌI lớp (nội dung, đồ hoạ, phụ đề) — một con số duy nhất
    // để không lớp nào sát mép hơn lớp khác. 100/1080 ≈ 9.3% mỗi bên.
    pagePadding: 100,
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

  /**
   * neon — bảng màu "SpiderAI News": nền tím-teal tối + neon tím phát sáng.
   * Dùng cho background "spider", caption "chip-glow", các graphic minh hoạ và
   * brand header. Tách riêng để không đụng bảng màu mặc định (tech/aurora).
   */
  neon: {
    // Gradient nền chính (tối, hơi tím + teal).
    bgTop: "#0B0A16",
    bgMid: "#0E0A20",
    bgBottom: "#080711",
    // Quầng sáng.
    glowPurple: "rgba(139,92,246,0.55)",
    glowTeal: "rgba(45,212,191,0.28)",
    glowPink: "rgba(217,110,255,0.30)",
    // Tím nhấn — dùng cho chip active, keyword highlight, viền glow.
    purple: "#8B5CF6",
    purpleBright: "#B983FF",
    purpleDeep: "#6D28D9",
    // Chip phụ đề khi CHƯA đọc tới: nền tối trong, chữ trắng.
    chipBg: "rgba(14,12,24,0.72)",
    chipBorder: "rgba(148,120,255,0.22)",
    // Text phụ (mô tả nhỏ dưới tiêu đề).
    textSoft: "#C9BEEA",
    // Bóng phát sáng tím quanh phần tử nổi bật.
    glowSoft: "0 0 24px rgba(139,92,246,0.55)",
    glowStrong: "0 0 36px rgba(139,92,246,0.85), 0 0 12px rgba(185,131,255,0.9)",

    // "Card solid" — panel/biểu đồ đặc, viền neon rõ, bóng sâu → sắc nét, tương phản cao.
    cardBg: "#150F26", // nền đặc (không trong suốt) để chữ/cạnh sắc nét
    cardBg2: "#1C1440", // rãnh/ô con bên trong card
    cardBorder: "rgba(163,135,255,0.55)", // viền neon rõ ~1.5px
    cardShadow: "0 22px 54px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
  },
} as const;

export type Tokens = typeof tokens;

/** Vùng an toàn (px) tính theo chiều cao khung. */
export const safeArea = (height: number) => ({
  top: Math.round(height * tokens.space.topSafeFraction),
  bottom: Math.round(height * tokens.space.bottomSafeFraction),
});
