import type { BuiltProps, Meta } from "../schema";

/**
 * defaultProps.ts — props MẪU để Remotion Studio preview khi chưa nạp props.json thật.
 * Mọi field hợp lệ với builtPropsSchema. Audio trỏ tới public/placeholder-silent.wav.
 * Khi render thật, pipeline truyền inputProps = out/<slug>/props.json (ghi đè cái này).
 */

function demoProps(template: Meta["template"], title: string): BuiltProps {
  const fps = 30;
  const d1 = 60;
  const d2 = 90;
  const words = (t: string, dur: number) => {
    const toks = t.split(/\s+/);
    const per = (dur / fps) * 1000 / toks.length;
    return toks.map((text, i) => ({ text, startMs: Math.round(i * per), endMs: Math.round((i + 1) * per) }));
  };
  return {
    meta: {
      title,
      template,
      width: 1080,
      height: 1920,
      fps,
      locale: "vi-VN",
      background: template === "CodeExplainer" ? "tech" : "solid",
    },
    voice: { provider: "mock", voiceId: "default", speed: 1 },
    captions: { style: "tiktok-bold", position: "lower-third", maxWordsPerLine: 4, highlightColor: "#FFD400" },
    scenes: [
      {
        id: "s1",
        narration: "Đây là bản xem trước mặc định",
        layout: "hook",
        heading: title,
        transitionIn: "fade",
        tailPadSec: 0.35,
        audioSrc: "placeholder-silent.wav",
        words: words("Đây là bản xem trước", d1),
        durationInFrames: d1,
        fromFrame: 0,
      },
      {
        id: "s2",
        narration: "Chạy pnpm video render để tạo video thật",
        layout: "cta",
        heading: "Render thật đi!",
        transitionIn: "slide-up",
        tailPadSec: 0.35,
        audioSrc: "placeholder-silent.wav",
        words: words("Chạy pnpm video render để tạo video thật", d2),
        durationInFrames: d2,
        fromFrame: d1,
      },
    ],
    // Studio preview không có file SFX cho tới lần build đầu → tắt để không 404.
    sfx: { enabled: false, volume: 0.35 },
    totalDurationInFrames: d1 + d2,
  };
}

export const DEFAULT_PROPS: Record<Meta["template"], BuiltProps> = {
  ProductReview: demoProps("ProductReview", "Product Review"),
  ListicleTop5: demoProps("ListicleTop5", "Top 5"),
  StoryHook: demoProps("StoryHook", "Story Hook"),
  CodeExplainer: demoProps("CodeExplainer", "Code Explainer"),
};
