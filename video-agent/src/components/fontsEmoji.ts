/**
 * fontsEmoji.ts — embed Noto Color Emoji để icon/emoji hiện MÀU trong Chrome headless
 * (mặc định headless không có font emoji → emoji ra ô vuông đen).
 * Dùng làm fallback trong font-stack của mọi text có thể chứa emoji.
 */
import { loadFont } from "@remotion/google-fonts/NotoColorEmoji";

const { fontFamily } = loadFont();

export const EMOJI_FAMILY = fontFamily;
