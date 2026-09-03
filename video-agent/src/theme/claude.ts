import React from "react";
import { FONT_FAMILY } from "../components/fonts";
import { MONO_FAMILY } from "../components/fontsMono";

/**
 * claude.ts — SỔ ĐĂNG KÝ THEME. Một Palette gói đủ MÀU + CỠ CHỮ + chất liệu để mọi
 * component đọc từ đây (qua useTheme) → giao diện ĐỒNG BỘ tuyệt đối trong 1 video.
 *
 * Ba theme, chọn bằng meta.background:
 *   - "tech"         : lập trình — nền than xanh, mưa nhị phân, nhấn xanh matrix,
 *                      nhãn monospace. Card là KÍNH MỜ để đọc rõ khi có video nền.
 *   - "claude-dark"  : nền than ấm, chữ kem, nhấn cam đất Anthropic.
 *   - "claude-cream" : nền kem, chữ đen ấm.
 *
 * Mọi theme dùng chung thang typography/spacing → khác nhau ở MÀU và CHẤT LIỆU,
 * không khác ở bố cục. Nền spider/aurora/solid tạm dùng palette claude-dark.
 */

export interface Palette {
  name: "claude-dark" | "claude-cream" | "tech";
  isDark: boolean;
  bg: string;
  bgGradient: string;
  text: string;
  textMuted: string;
  accent: string; // màu nhấn chính (claude: cam đất — tech: xanh matrix)
  accentSoft: string; // nền nhạt của nhấn (highlight keyword)
  onAccent: string; // chữ trên nền accent
  /** Nhấn PHỤ (tech: cyan) — số thứ tự, đường kẻ, chi tiết HUD. */
  accent2: string;
  card: string;
  cardBorder: string;
  cardShadow: string;
  hairline: string;
  /** Bóng phát sáng quanh phần tử nhấn. "none" nếu theme không dùng glow. */
  glow: string;
  /**
   * backdrop-filter cho card. Tech đặt "blur(…)" vì card nằm TRÊN VIDEO NỀN —
   * làm mờ nền sau card là cách giữ chữ đọc rõ mà không cần lớp phủ đen dày.
   */
  cardBackdrop: string;
  /**
   * RGB (dạng "r,g,b") của lớp phủ tối đặt trên VIDEO NỀN. Tách riêng khỏi `bg` vì
   * lớp phủ cần đậm/trung tính hơn nền phẳng để chữ đọc rõ trên cảnh quay động.
   */
  scrimRgb: string;
  /**
   * Màu nhuộm video nền (đè bằng mix-blend-mode "color"). Kết hợp với giảm bão hoà
   * → video Pexels bất kỳ cũng về đúng tông của theme, không "lạc màu".
   */
  mediaTint: string;
  /** Font cho NHÃN kỹ thuật (eyebrow, số thứ tự, timecode). Tech dùng monospace. */
  labelFont: string;
  /** Nhãn viết hoa + giãn chữ (tech) hay để nguyên (claude). */
  labelCase: "uppercase" | "none";
  /**
   * Gradient của màu nhấn — dùng cho thanh biểu đồ, nút số, vạch tiến trình.
   * Một dải màu bao giờ cũng "có chiều sâu" hơn một mảng màu phẳng.
   */
  accentGradient: string;
  /** Nền rãnh (track) của thanh biểu đồ / đường timeline khi chưa được tô. */
  track: string;
  /**
   * Cỡ chữ. Khung 1080x1920 xem trên điện thoại → chữ phải TO. Mốc: chữ thân
   * (card) không dưới 46px, tiêu đề không dưới 72px, nếu không trên máy người
   * xem sẽ bé như con kiến.
   */
  size: {
    hook: number;
    heading: number;
    subhead: number;
    card: number;
    caption: number;
    small: number;
    label: number;
    /** Số liệu lớn (giá trị biểu đồ, số thứ tự) — luôn là thứ to nhất trong widget. */
    value: number;
  };
  radius: { sm: number; md: number; lg: number; pill: number };
  font: string;
  lineHeight: number;
}

const SIZE = {
  hook: 106,
  heading: 78,
  subhead: 44,
  card: 50,
  caption: 68,
  small: 34,
  label: 30,
  value: 66,
} as const;

const RADIUS = { sm: 12, md: 18, lg: 26, pill: 999 } as const;
/** Tech bo góc SẮC hơn — cảm giác kỹ thuật, không "mềm" như Claude. */
const RADIUS_TECH = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const CLAUDE_DARK: Palette = {
  name: "claude-dark",
  isDark: true,
  bg: "#262520",
  bgGradient: "linear-gradient(180deg, #2B2A24 0%, #242320 60%, #201F1B 100%)",
  text: "#ECE9E0",
  textMuted: "#A8A08F",
  accent: "#D97757",
  accentSoft: "rgba(217,119,87,0.18)",
  onAccent: "#201E1A",
  accent2: "#C2A88A",
  card: "#302E27",
  cardBorder: "rgba(236,233,224,0.12)",
  cardShadow: "0 12px 34px rgba(0,0,0,0.32)",
  hairline: "rgba(236,233,224,0.14)",
  glow: "none",
  cardBackdrop: "none",
  accentGradient: "linear-gradient(90deg, #D97757, #E9A176)",
  track: "rgba(236,233,224,0.10)",
  scrimRgb: "20,19,16",
  mediaTint: "rgba(86,52,28,0.42)",
  labelFont: FONT_FAMILY,
  labelCase: "none",
  size: { ...SIZE },
  radius: { ...RADIUS },
  font: FONT_FAMILY,
  lineHeight: 1.24,
};

export const CLAUDE_CREAM: Palette = {
  name: "claude-cream",
  isDark: false,
  bg: "#F0EEE6",
  bgGradient: "linear-gradient(180deg, #F3F1EA 0%, #F0EEE6 60%, #EAE7DD 100%)",
  text: "#232019",
  textMuted: "#6E6858",
  accent: "#BE5A38",
  accentSoft: "rgba(190,90,56,0.14)",
  onAccent: "#FBFAF6",
  accent2: "#8A7B60",
  card: "#FBFAF6",
  cardBorder: "rgba(35,32,25,0.14)",
  cardShadow: "0 12px 30px rgba(70,58,34,0.10)",
  hairline: "rgba(35,32,25,0.12)",
  glow: "none",
  cardBackdrop: "none",
  accentGradient: "linear-gradient(90deg, #BE5A38, #D98A63)",
  track: "rgba(35,32,25,0.10)",
  // Nền kem: lớp phủ SÁNG trên video để chữ đen ấm vẫn đọc rõ (kiểu editorial).
  scrimRgb: "243,241,234",
  mediaTint: "rgba(120,86,52,0.30)",
  labelFont: FONT_FAMILY,
  labelCase: "none",
  size: { ...SIZE },
  radius: { ...RADIUS },
  font: FONT_FAMILY,
  lineHeight: 1.24,
};

/**
 * TECH — theme "lập trình": nền than xanh của mưa nhị phân, nhấn xanh matrix,
 * nhãn monospace. Hai điểm khiến nó ĐỌC ĐƯỢC trên video nền:
 *   - card là KÍNH MỜ (nền bán trong + backdrop blur) thay vì khối đặc → thấy được
 *     video chạy phía sau nhưng chữ vẫn tương phản đủ.
 *   - viền xanh mảnh + glow nhẹ để cạnh card không "chìm" vào cảnh quay.
 * Màu accent lấy đúng tông đầu vệt mưa nhị phân (#2FD08A) nhưng sáng hơn 1 nấc
 * để nổi trên nền video.
 */
export const TECH: Palette = {
  name: "tech",
  isDark: true,
  bg: "#05080D",
  bgGradient: "linear-gradient(165deg, #08131A 0%, #070D14 45%, #05080D 100%)",
  text: "#E9F6F0",
  textMuted: "#8BA9A2",
  accent: "#3BE8A0",
  accentSoft: "rgba(59,232,160,0.16)",
  onAccent: "#04120C",
  accent2: "#56C7F5",
  card: "rgba(8,20,26,0.72)",
  cardBorder: "rgba(59,232,160,0.30)",
  cardShadow: "0 18px 44px rgba(0,0,0,0.55), inset 0 1px 0 rgba(233,246,240,0.06)",
  hairline: "rgba(59,232,160,0.20)",
  glow: "0 0 26px rgba(59,232,160,0.26)",
  cardBackdrop: "blur(16px) saturate(1.15)",
  accentGradient: "linear-gradient(90deg, #3BE8A0 0%, #56C7F5 100%)",
  track: "rgba(233,246,240,0.09)",
  scrimRgb: "4,10,14",
  mediaTint: "rgba(0,86,64,0.60)",
  labelFont: MONO_FAMILY,
  labelCase: "uppercase",
  size: { ...SIZE },
  radius: { ...RADIUS_TECH },
  font: FONT_FAMILY,
  lineHeight: 1.24,
};

/**
 * Palette theo meta.background — QUYẾT ĐỊNH toàn bộ diện mạo của video:
 *   - "tech"         → palette TECH (mưa nhị phân, xanh matrix, nhãn mono).
 *   - "claude-cream" → palette SÁNG (nền kem).
 *   - còn lại        → palette claude-dark (chữ kem trên than ấm).
 * Backdrop (mưa nhị phân / quầng sáng) do VideoComposition vẽ riêng, nhưng MÀU của
 * nó và màu của card/chữ đều lấy từ palette này → không bao giờ lệch tông.
 */
export function paletteFor(background: string): Palette {
  if (background === "claude-cream") return CLAUDE_CREAM;
  if (background === "tech") return TECH;
  return CLAUDE_DARK;
}

/** true nếu theme dùng ngôn ngữ thị giác "tech" (mưa nhị phân, HUD, mono). */
export const isTech = (p: Palette): boolean => p.name === "tech";

/**
 * cardSurface — MẶT CARD dùng chung cho mọi khối nội dung (bullet, thẻ, bước, chat).
 * Ở đây vì nó là quyết định chất liệu của theme, không phải của riêng layout nào:
 * tech = kính mờ (đọc rõ trên video nền), claude = khối đặc ấm.
 */
export const cardSurface = (p: Palette): React.CSSProperties => ({
  background: p.card,
  border: `1px solid ${p.cardBorder}`,
  boxShadow: p.cardShadow,
  borderRadius: p.radius.md,
  ...(p.cardBackdrop !== "none"
    ? { backdropFilter: p.cardBackdrop, WebkitBackdropFilter: p.cardBackdrop }
    : {}),
});

/** Nền tối/sáng cho backdrop tuỳ chọn (tech/spider…) — palette dùng cho card/chữ. */
export const ThemeContext = React.createContext<Palette>(CLAUDE_DARK);
export const useTheme = (): Palette => React.useContext(ThemeContext);
