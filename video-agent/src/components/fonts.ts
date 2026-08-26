/**
 * fonts.ts — embed font qua @remotion/google-fonts.
 * BẮT BUỘC embed: Chrome headless không có font hệ thống, dùng font hệ thống
 * sẽ ra ô vuông. Be Vietnam Pro có đủ bộ dấu tiếng Việt.
 *
 * loadFont() tự gọi delayRender()/continueRender() nên render sẽ chờ font tải xong.
 */
import { loadFont } from "@remotion/google-fonts/BeVietnamPro";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext", "vietnamese"],
});

export const FONT_FAMILY = fontFamily;
