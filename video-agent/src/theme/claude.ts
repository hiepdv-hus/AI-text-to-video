import React from "react";
import { FONT_FAMILY } from "../components/fonts";

/**
 * claude.ts — hệ thiết kế "Claude": ấm, tối giản, tinh tế, ĐỒNG BỘ.
 *
 * Một Palette gói đủ MÀU + CỠ CHỮ để mọi component đọc từ đây (qua useTheme).
 * Có 2 nền Claude do người dùng chọn (meta.background):
 *   - "claude-dark"  : nền than ấm, chữ kem.
 *   - "claude-cream" : nền kem, chữ đen ấm.
 * Nhấn cam đất Anthropic. Nền nào cũng dùng chung typography/spacing → đồng bộ.
 *
 * Nền KHÔNG phải Claude (spider/tech/aurora/solid) → paletteFor() trả null,
 * component giữ nguyên đường neon cũ (không đụng video cũ).
 */

export interface Palette {
  name: "claude-dark" | "claude-cream";
  isDark: boolean;
  bg: string;
  bgGradient: string;
  text: string;
  textMuted: string;
  accent: string; // cam đất
  accentSoft: string; // nền nhạt của nhấn (highlight keyword)
  onAccent: string; // chữ trên nền cam
  card: string;
  cardBorder: string;
  cardShadow: string;
  hairline: string;
  /** Cỡ chữ "bình thường" — nhỏ hơn hẳn kiểu neon cũ, sạch sẽ. */
  size: {
    hook: number;
    heading: number;
    subhead: number;
    card: number;
    caption: number;
    small: number;
  };
  radius: { sm: number; md: number; lg: number; pill: number };
  font: string;
  lineHeight: number;
}

const SIZE = {
  hook: 74,
  heading: 58,
  subhead: 34,
  card: 40,
  caption: 52,
  small: 28,
} as const;

const RADIUS = { sm: 12, md: 18, lg: 26, pill: 999 } as const;

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
  card: "#302E27",
  cardBorder: "rgba(236,233,224,0.12)",
  cardShadow: "0 12px 34px rgba(0,0,0,0.32)",
  hairline: "rgba(236,233,224,0.14)",
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
  card: "#FBFAF6",
  cardBorder: "rgba(35,32,25,0.14)",
  cardShadow: "0 12px 30px rgba(70,58,34,0.10)",
  hairline: "rgba(35,32,25,0.12)",
  size: { ...SIZE },
  radius: { ...RADIUS },
  font: FONT_FAMILY,
  lineHeight: 1.24,
};

/**
 * Palette theo meta.background. Style Claude áp cho MỌI nền — chỉ khác sáng/tối:
 *   - claude-cream → palette SÁNG (nền kem).
 *   - còn lại (claude-dark/tech/spider/solid/aurora) → palette TỐI (chữ kem).
 * Nền (backdrop) do VideoComposition vẽ riêng; presentation luôn là Claude.
 */
export function paletteFor(background: string): Palette {
  if (background === "claude-cream") return CLAUDE_CREAM;
  return CLAUDE_DARK;
}

/** Nền tối/sáng cho backdrop tuỳ chọn (tech/spider…) — palette dùng cho card/chữ. */
export const ThemeContext = React.createContext<Palette>(CLAUDE_DARK);
export const useTheme = (): Palette => React.useContext(ThemeContext);
