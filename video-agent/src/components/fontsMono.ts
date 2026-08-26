/**
 * fontsMono.ts — font monospace (JetBrains Mono) cho khối code.
 * Embed như font thường (Chrome headless không có font hệ thống).
 */
import { loadFont } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin", "latin-ext"],
});

export const MONO_FAMILY = fontFamily;
