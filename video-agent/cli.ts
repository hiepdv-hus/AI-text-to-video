import "./pipeline/env.ts"; // nạp .env trước tiên
import path from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { buildSpec } from "./pipeline/build.ts";
import { renderVideo } from "./pipeline/render.ts";
import { getProvider, estimateDurationSec, evenWordTimings } from "./pipeline/tts.ts";
import { normalizeVietnamese } from "./pipeline/normalize.ts";
import type { Voice } from "./src/schema.ts";

/**
 * cli.ts — entrypoint. Chạy qua: pnpm video <lệnh> <args>.
 *
 *   pnpm video build   <spec>   # spec → out/<slug>/props.json
 *   pnpm video render  <spec>   # build + render → out/<slug>/final.mp4
 *   pnpm video preview <spec>   # build + mở Remotion Studio với props thật
 *   pnpm video voices           # liệt kê voice tiếng Việt khả dụng
 *   pnpm video demo-tts "<câu>" [provider] [voiceId]
 *       # tổng hợp thật ra .cache/demo-tts.* để NGHE, kèm bảng word-timing.
 *       # Không chỉ định provider → tự chọn: piper (nếu đã cài) → edge.
 */

const VIETNAMESE_VOICES: Record<string, { id: string; note: string }[]> = {
  edge: [
    { id: "vi-VN-HoaiMyNeural", note: "Nữ Bắc — MIỄN PHÍ, không cần key (khuyến nghị)" },
    { id: "vi-VN-NamMinhNeural", note: "Nam Bắc — MIỄN PHÍ, không cần key" },
  ],
  piper: [
    { id: "vi_VN-vais1000-medium", note: "Rõ nhất (22kHz) — MIỄN PHÍ, offline, không key" },
    { id: "vi_VN-25hours_single-low", note: "Giọng khác (16kHz)" },
    { id: "vi_VN-vivos-x_low#0..64", note: "65 giọng! đổi số sau # (vd vi_VN-vivos-x_low#30)" },
  ],
  elevenlabs: [
    { id: "<voice_id>", note: "Chọn voice đa ngữ (multilingual v2) hỗ trợ tiếng Việt tốt" },
  ],
  azure: [
    { id: "vi-VN-HoaiMyNeural", note: "Nữ, tự nhiên" },
    { id: "vi-VN-NamMinhNeural", note: "Nam, tự nhiên" },
  ],
  google: [
    { id: "vi-VN-Wavenet-A", note: "Nữ" },
    { id: "vi-VN-Wavenet-B", note: "Nam" },
    { id: "vi-VN-Wavenet-C", note: "Nữ" },
    { id: "vi-VN-Wavenet-D", note: "Nam" },
  ],
  mock: [{ id: "default", note: "Im lặng + timing đều — chạy offline không cần API key" }],
};

async function cmdBuild(spec: string) {
  const { propsPath } = await buildSpec(path.resolve(spec));
  console.log(`\n✅ Build xong: ${propsPath}`);
}

async function cmdRender(spec: string) {
  const { slug, props } = await buildSpec(path.resolve(spec));
  const { outputPath } = await renderVideo(slug, props);
  console.log(`\n🎬 MP4: ${outputPath}`);
}

async function cmdPreview(spec: string) {
  const { propsPath } = await buildSpec(path.resolve(spec));
  console.log(`\n▶ Mở Remotion Studio với props: ${propsPath}`);
  const child = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "remotion", "studio", "src/index.ts", `--props=${propsPath}`],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
}

function cmdVoices() {
  console.log("Voice tiếng Việt khả dụng (đặt vào voice.provider / voice.voiceId):\n");
  for (const [provider, voices] of Object.entries(VIETNAMESE_VOICES)) {
    console.log(`● ${provider}`);
    for (const v of voices) console.log(`    ${v.id.padEnd(24)} ${v.note}`);
    console.log();
  }
}

/**
 * Chọn provider để nghe thử khi người dùng không chỉ định.
 *
 * TRƯỚC ĐÂY hàm này ghi cứng "mock" — mà mock là giọng IM LẶNG (nó tồn tại để test
 * timing offline). Nên `demo-tts` luôn ra file câm và không thể dùng để nghe thử giọng,
 * đúng thứ mà tên lệnh hứa hẹn. Giờ nó tự chọn provider TỐT NHẤT đang dùng được.
 */
type ProviderName = Voice["provider"];

const PROVIDER_NAMES: ProviderName[] = ["mock", "edge", "piper", "elevenlabs", "azure", "google"];

/** Ép chuỗi người dùng gõ về đúng tên provider hợp lệ, báo lỗi rõ nếu sai. */
function asProvider(s: string): ProviderName {
  const hit = PROVIDER_NAMES.find((p) => p === s);
  if (!hit) throw new Error(`Provider không hợp lệ: "${s}". Chọn một trong: ${PROVIDER_NAMES.join(", ")}`);
  return hit;
}

function pickDemoProvider(): { name: ProviderName; voiceId: string } {
  if (existsSync(path.resolve(process.cwd(), "tools", "piper"))) {
    return { name: "piper", voiceId: "tranthanh3870" };
  }
  // Không có piper → edge để ít nhất còn nghe được giọng Việt thật khi thử.
  return { name: "edge", voiceId: "vi-VN-NamMinhNeural" };
}

async function cmdDemoTts(text?: string, providerArg?: string, voiceArg?: string) {
  const sample = text ?? "Mua iPhone 15 chỉ 25.990.000đ, giảm 30% hôm nay!";
  const normalized = normalizeVietnamese(sample, { pronunciations: { iPhone: "ai phôn" } });
  console.log(`Gốc:        ${sample}`);
  console.log(`Chuẩn hoá:  ${normalized}\n`);

  const picked = providerArg
    ? { name: asProvider(providerArg), voiceId: voiceArg ?? "default" }
    : pickDemoProvider();
  console.log(`Provider:   ${picked.name}  (giọng: ${picked.voiceId})`);
  if (picked.name === "mock") console.log("LƯU Ý:      mock là giọng IM LẶNG — file sẽ không có tiếng.\n");
  else console.log();

  const provider = getProvider(picked.name);
  const ext = provider.audioFormat === "wav" ? "wav" : "mp3";
  const outPath = path.resolve(process.cwd(), ".cache", `demo-tts.${ext}`);
  const res = await provider.synthesize(normalized, {
    voiceId: picked.voiceId,
    speed: 1,
    locale: "vi-VN",
    outPath,
  });
  const words = res.words ?? evenWordTimings(normalized, estimateDurationSec(normalized, 1) * 1000);

  console.log("Bảng word-timing (kiểm tra bằng mắt xem có khớp không):");
  console.log("  #  từ            start(ms)  end(ms)");
  words.forEach((w, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}  ${w.text.padEnd(12)}  ${String(w.startMs).padStart(7)}  ${String(w.endMs).padStart(7)}`,
    );
  });
  console.log(`\nAudio demo: ${res.audioPath}`);
  console.log(`Nghe thử:   start "" "${res.audioPath}"`);
}

async function main() {
  const [cmd, arg, arg2, arg3] = process.argv.slice(2);
  try {
    switch (cmd) {
      case "build":
        if (!arg) throw new Error("Thiếu đường dẫn spec. Vd: pnpm video build specs/demo.json");
        await cmdBuild(arg);
        break;
      case "render":
        if (!arg) throw new Error("Thiếu đường dẫn spec. Vd: pnpm video render specs/demo.json");
        await cmdRender(arg);
        break;
      case "preview":
        if (!arg) throw new Error("Thiếu đường dẫn spec. Vd: pnpm video preview specs/demo.json");
        await cmdPreview(arg);
        break;
      case "serve":
        await import("./server.ts"); // mở Studio web ở http://localhost:4321
        break;
      case "voices":
        cmdVoices();
        break;
      case "demo-tts":
        // pnpm video demo-tts "<câu>" [provider] [voiceId]
        await cmdDemoTts(arg, arg2, arg3);
        break;
      default:
        console.log(
          [
            "Video Agent CLI",
            "",
            "  pnpm video build   <spec>   spec → out/<slug>/props.json",
            "  pnpm video render  <spec>   build + render → out/<slug>/final.mp4",
            "  pnpm video preview <spec>   build + mở Remotion Studio",
            "  pnpm video serve            mở Video Studio web (điền form → render)",
            "  pnpm video voices           liệt kê voice tiếng Việt",
            "  pnpm video demo-tts [text]  in bảng word-timing",
          ].join("\n"),
        );
    }
  } catch (err) {
    console.error(`\n❌ ${(err as Error).message}`);
    process.exit(1);
  }
}

void main();
