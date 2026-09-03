import { z } from "zod";

/**
 * schema.ts — RANH GIỚI giữa "nửa sáng tạo" (agent sinh JSON) và
 * "nửa xác định" (pipeline render). Đây là hợp đồng duy nhất giữa 2 nửa.
 *
 *  - videoSpecSchema  : thứ AGENT viết ra (specs/<slug>.json). Không có timing.
 *  - builtPropsSchema : thứ PIPELINE tạo ra (out/<slug>/props.json) và cũng là
 *                       props schema của Remotion composition. Có audio + timing thật.
 *
 * Mọi component/composition chỉ được đọc builtPropsSchema. Không bao giờ tự chế field.
 */

/* ----------------------------- Nguyên thuỷ ------------------------------ */

export const wordTimingSchema = z.object({
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
});
export type WordTiming = z.infer<typeof wordTimingSchema>;

export const layoutSchema = z.enum([
  "hook",
  "bullet",
  "product",
  "compare",
  "cta",
  "code", // cửa sổ code kiểu VS Code + panel console — dùng cho video lập trình
  "image", // ảnh minh họa khung gọn (sắc nét, không crop) + tiêu đề
  "graphic", // đồ hoạ neon minh hoạ khớp nội dung (timeline highlight, laptop editor, thẻ tính năng)
]);
export type Layout = z.infer<typeof layoutSchema>;

/**
 * graphicSchema — cấu hình cho layout "graphic". `kind` chọn widget đồ hoạ neon;
 * các field còn lại là tham số tuỳ widget (đều optional, có mặc định đẹp).
 */
export const graphicSchema = z.object({
  kind: z.enum(["highlight-timeline", "device-editor", "feature-cards", "bar-chart", "chat-ai", "steps"]),
  /** Phụ đề nhỏ dưới tiêu đề (vd "Tích hợp sẵn · Không cần chỉnh thủ công"). */
  subtitle: z.string().optional(),
  /** Nhãn: cột (highlight-timeline) hoặc thẻ "🤖 Tự động" (feature-cards). */
  labels: z.array(z.string()).optional(),
  /** Mốc thước thời gian cho highlight-timeline (vd "0:05","0:10"). */
  timestamps: z.array(z.string()).optional(),
  /** Timecode hiển thị cho device-editor (vd "00:02:17"). */
  timecode: z.string().optional(),
});
export type Graphic = z.infer<typeof graphicSchema>;

/** 1 token đã tô màu (do shiki sinh ở pipeline). */
export const codeTokenSchema = z.object({ text: z.string(), color: z.string() });
export type CodeToken = z.infer<typeof codeTokenSchema>;

export const transitionSchema = z.enum([
  "none",
  "fade",
  "slide-left",
  "slide-up",
  "wipe",
  "zoom", // phóng to nhẹ dần vào — cảm giác điện ảnh
  "blur", // mờ → nét, kèm fade
  "glow", // bừng sáng + phóng nhẹ (flash brightness)
]);
export type TransitionKind = z.infer<typeof transitionSchema>;

export const mediaSchema = z.object({
  /**
   * Loại media. Ba loại cuối được pipeline GIẢI QUYẾT lúc build rồi thay bằng loại thật:
   *   "pexels-video" → src là TỪ KHÓA → tải clip thật từ Pexels → thành kind "video".
   *   "pexels"       → src là TỪ KHÓA → tải ảnh thật từ Pexels  → thành kind "image".
   *   "generate"     → src là MÔ TẢ ẢNH (prompt) → sinh ảnh AI  → thành kind "image".
   *
   * Khác biệt quan trọng khi RENDER:
   *   "video" chạy FULL-BLEED làm nền cả cảnh (nội dung đè lên trên);
   *   "image" được đóng khung gọn trong cột nội dung (không crop tràn màn).
   */
  kind: z.enum(["image", "video", "color", "generate", "pexels", "pexels-video"]),
  /** URL/path/màu / mô tả ảnh (generate) / từ khóa tìm (pexels, pexels-video). */
  src: z.string(),
  fit: z.enum(["cover", "contain"]).default("cover"),
  /** Điểm neo cho Ken Burns / crop. */
  focus: z.enum(["center", "top", "bottom", "left", "right"]).default("center"),
  /**
   * Độ dài clip (giây) — CHỈ với kind "video", do pipeline điền. Composition dùng nó để
   * LẶP clip khi cảnh dài hơn clip (thay vì đứng hình ở khung cuối). Không có = không lặp.
   */
  durationSec: z.number().positive().optional(),
});
export type Media = z.infer<typeof mediaSchema>;

/* ------------------------------- Scene ---------------------------------- */

export const sceneSchema = z.object({
  id: z.string().min(1),
  /** Câu thoại — pipeline sẽ TTS phần này. Đây là thứ quyết định độ dài scene. */
  narration: z.string().min(1),
  layout: layoutSchema,
  heading: z.string().optional(),
  /** Icon/emoji của cảnh (vd "🌐", "🤖") — hiện thành huy hiệu cạnh tiêu đề. */
  icon: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  media: mediaSchema.optional(),
  /** Các từ trong narration cần tô nổi bật trên caption. */
  emphasis: z.array(z.string()).optional(),
  transitionIn: transitionSchema.default("fade"),
  /** Khoảng lặng thêm vào cuối scene (giây) để nhịp thở dễ chịu. */
  tailPadSec: z.number().min(0).max(3).default(0.35),

  /* --- Dành cho layout "code" --- */
  /** Mã nguồn hiển thị (dùng khi layout="code"). */
  code: z.string().optional(),
  /** Ngôn ngữ để tô màu (shiki). Mặc định javascript. */
  codeLang: z.string().optional(),
  /** Tên file hiện trên thanh tiêu đề cửa sổ code. */
  codeTitle: z.string().optional(),
  /** Các dòng (1-indexed) cần tô sáng; dòng khác sẽ mờ đi. */
  codeHighlight: z.array(z.number().int().positive()).optional(),
  /** Kết quả console hiện ở panel dưới (vd output của console.log). */
  output: z.string().optional(),

  /* --- Dành cho layout "graphic" --- */
  /** Cấu hình widget đồ hoạ neon (bắt buộc khi layout="graphic"). */
  graphic: graphicSchema.optional(),
});
export type Scene = z.infer<typeof sceneSchema>;

/* ------------------------ Voice / Captions / Music ---------------------- */

export const voiceSchema = z.object({
  provider: z
    .enum(["mock", "edge", "piper", "elevenlabs", "azure", "google"])
    .default("mock"),
  voiceId: z.string().default("default"),
  speed: z.number().min(0.5).max(2).default(1),
  pitch: z.number().min(-12).max(12).optional(),
  /** Bảng phát âm thay thế cho từ tiếng Anh / tên riêng hay bị đọc sai. */
  pronunciations: z.record(z.string(), z.string()).optional(),
});
export type Voice = z.infer<typeof voiceSchema>;

export const captionsSchema = z.object({
  /**
   * Kiểu phụ đề. LƯU Ý: khi meta.background chọn một theme có Palette (tech/claude-*),
   * caption tự đi theo theme để không lệch tông — field này chỉ còn tác dụng ở nền cũ.
   */
  style: z
    .enum(["tiktok-bold", "clean-minimal", "outline-pop", "chip-glow", "claude", "tech"])
    .default("tiktok-bold"),
  position: z.enum(["center", "lower-third", "top"]).default("lower-third"),
  maxWordsPerLine: z.number().int().min(1).max(12).default(4),
  highlightColor: z.string().default("#FFD400"),
});
export type Captions = z.infer<typeof captionsSchema>;

export const musicSchema = z.object({
  src: z.string(),
  volume: z.number().min(0).max(1).default(0.12),
});
export type Music = z.infer<typeof musicSchema>;

/* -------------------------------- Meta ---------------------------------- */

export const metaSchema = z.object({
  title: z.string().min(1),
  template: z.enum(["ProductReview", "ListicleTop5", "StoryHook", "CodeExplainer"]),
  width: z.number().int().positive().default(1080),
  height: z.number().int().positive().default(1920),
  fps: z.number().int().positive().default(30),
  locale: z.string().default("vi-VN"),
  /** Nền chung. claude-dark/claude-cream = style Claude (ấm, tối giản); còn lại là neon/tech. */
  background: z
    .enum(["claude-dark", "claude-cream", "solid", "tech", "aurora", "spider"])
    .default("claude-dark"),
  /** Thanh thương hiệu kiểu "SpiderAI News" (overlay trên mọi scene). Bỏ trống = không hiện. */
  brand: z
    .object({
      name: z.string(),
      logo: z.string().default("🕷"),
      /** Pill gợi ý dưới cùng (vd "Kéo xuống để khoá tốc độ 2x"). */
      hint: z.string().optional(),
    })
    .optional(),
});
export type Meta = z.infer<typeof metaSchema>;

/* ------------------------------ VideoSpec ------------------------------- */
/** Thứ agent viết ra. Không chứa timing — timing sinh ở pipeline. */
export const videoSpecSchema = z.object({
  meta: metaSchema,
  scenes: z.array(sceneSchema).min(1),
  voice: voiceSchema,
  captions: captionsSchema,
  music: musicSchema.optional(),
});
export type VideoSpec = z.infer<typeof videoSpecSchema>;

/* ------------------------------ BuiltProps ------------------------------ */
/**
 * Thứ pipeline sinh ra và composition tiêu thụ. = VideoSpec + audio + timing.
 * durationInFrames của từng scene ĐƯỢC TÍNH từ độ dài file audio thật.
 */
export const builtSceneSchema = sceneSchema.extend({
  /** Đường dẫn audio, tương đối với public/ để dùng với staticFile(). */
  audioSrc: z.string(),
  /** Timestamp từng âm tiết/từ, dùng cho karaoke caption. */
  words: z.array(wordTimingSchema),
  /** Độ dài scene tính bằng frame — DẪN XUẤT từ audio, không do agent quyết định. */
  durationInFrames: z.number().int().positive(),
  /** Frame bắt đầu của scene trong tổng timeline. */
  fromFrame: z.number().int().nonnegative(),
  /** Code đã tô màu (pipeline sinh bằng shiki): mảng dòng, mỗi dòng là mảng token. */
  codeTokens: z.array(z.array(codeTokenSchema)).optional(),
});
export type BuiltScene = z.infer<typeof builtSceneSchema>;

export const builtPropsSchema = z.object({
  meta: metaSchema,
  scenes: z.array(builtSceneSchema).min(1),
  voice: voiceSchema,
  captions: captionsSchema,
  music: musicSchema.optional(),
  /** Tổng số frame — tổng durationInFrames của mọi scene. */
  totalDurationInFrames: z.number().int().positive(),
});
export type BuiltProps = z.infer<typeof builtPropsSchema>;
