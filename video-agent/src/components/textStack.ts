import { FONT_FAMILY } from "./fonts";
import { EMOJI_FAMILY } from "./fontsEmoji";

/** Font-stack có emoji màu (dùng cho text có thể chứa icon). Tách riêng để nhiều
 * component dùng chung mà không tạo vòng import qua layouts.tsx. */
export const TEXT_STACK = `${FONT_FAMILY}, ${EMOJI_FAMILY}`;
