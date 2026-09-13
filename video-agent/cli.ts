import "./pipeline/env.ts"; // nạp .env trước tiên
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { buildSpec, slugify } from "./pipeline/build.ts";
import { renderVideo } from "./pipeline/render.ts";
import { cleanWorkspace } from "./pipeline/clean.ts";
import { authorSpec } from "./pipeline/author.ts";
import { resolveLlm, LLM_SETUP_HINT } from "./pipeline/llm.ts";
import { getProvider, estimateDurationSec, evenWordTimings } from "./pipeline/tts.ts";
import { normalizeVietnamese } from "./pipeline/normalize.ts";
import type { Voice } from "./src/schema.ts";

/**
 * cli.ts — entrypoint. Chạy qua: pnpm video <lệnh> <args>.
 *
 *   pnpm video make "<chủ đề>"  # MỘT CÂU → LLM viết spec → render luôn ra MP4
 *   pnpm video build   <spec>   # spec → out/<slug>/props.json
 *   pnpm video render  <spec>   # build + render → out/<slug>/final.mp4
 *   pnpm video preview <spec>   # build + mở Remotion Studio với props thật
 *   pnpm video clean [--yes]    # dọn asset mồ côi trong public/ + rác tạm của Remotion
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
  // piper KHÔNG ghi cứng ở đây — xem piperVoices() bên dưới.
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

/**
 * pnpm video make "<một câu chủ đề>" [--spec-only]
 *
 * Đường đi đầy đủ, không cần đụng JSON: câu chữ → LLM viết spec → specs/<slug>.json
 * → TTS + timing → MP4.
 */
async function cmdMake(brief?: string, ...flags: string[]) {
  if (!brief) {
    throw new Error('Thiếu nội dung. Vd: pnpm video make "Dựng cho tôi video về Trấn Thành"');
  }
  const llm = resolveLlm();
  if (!llm) throw new Error(LLM_SETUP_HINT);

  const { spec, attempts } = await authorSpec(brief, (m) => console.log(m));
  const slug = slugify(spec.meta.title);
  const specPath = path.resolve(process.cwd(), "specs", `${slug}.json`);
  await fs.mkdir(path.dirname(specPath), { recursive: true });
  await fs.writeFile(specPath, JSON.stringify(spec, null, 2), "utf8");
  console.log(`\n📝 Spec: ${specPath}  (${spec.scenes.length} cảnh, ${attempts} lượt viết)`);
  console.log(`   "${spec.meta.title}"`);

  if (flags.includes("--spec-only")) {
    console.log(`\nRender khi nào bạn ưng:  pnpm video render specs/${slug}.json`);
    return;
  }

  const built = await buildSpec(specPath);
  const { outputPath } = await renderVideo(built.slug, built.props);
  console.log(`\n🎬 MP4: ${outputPath}`);
}

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

const MB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

/**
 * pnpm video clean [--yes] [--stock]
 *   không cờ   → chỉ LIỆT KÊ những gì sẽ xoá (an toàn, không đụng đĩa)
 *   --yes      → xoá thật
 *   --stock    → tính luôn .cache/stock (clip Pexels đã tải; xoá là lần sau tải lại)
 */
async function cmdClean(flags: string[]) {
  const apply = flags.includes("--yes");
  const stock = flags.includes("--stock");
  const report = await cleanWorkspace({ apply, stock });

  if (!report.targets.length && !report.tmpRemoved) {
    console.log("Không có gì để dọn. 👌");
    return;
  }
  for (const t of report.targets) console.log(`  ${MB(t.bytes).padStart(8)}  ${t.label}`);
  if (report.tmpRemoved) {
    console.log(`  ${MB(report.tmpBytes).padStart(8)}  ${report.tmpRemoved} thư mục tạm Remotion trong %TEMP%`);
  }
  console.log(`  ${"—".repeat(8)}`);
  console.log(`  ${MB(report.totalBytes).padStart(8)}  ${apply ? "ĐÃ XOÁ" : "sẽ xoá"}`);
  if (!apply) {
    console.log(`\nChạy lại kèm --yes để xoá thật.${stock ? "" : "  (thêm --stock để tính cả clip Pexels đã tải)"}`);
  }
}

/**
 * Giọng Piper ĐỌC THẲNG TỪ ĐĨA, không ghi cứng.
 *
 * Trước đây danh sách piper nằm cứng trong VIETNAMESE_VOICES nên nó nói dối: người dùng
 * thả thêm .onnx vào `tools/piper/voices/` thì lệnh này không thấy, còn giọng đã gỡ thì
 * vẫn hiện. Đọc thư mục là cách duy nhất để danh sách luôn đúng.
 *
 * Piper cần ĐỦ CẶP `<tên>.onnx` + `<tên>.onnx.json`; thiếu file cấu hình là nó không chạy,
 * nên ở đây báo rõ thay vì im lặng bỏ qua.
 */
function piperVoices(): { id: string; note: string }[] {
  const dir = path.resolve(process.env.PIPER_DIR ?? path.join(process.cwd(), "tools", "piper"), "voices");
  if (!existsSync(dir)) return [{ id: "(chưa cài)", note: "Chạy scripts/setup-piper.ps1 để tải Piper + giọng." }];

  const NOTES: Record<string, string> = {
    "vi_VN-vais1000-medium": "Giọng kho — rõ nhất (22kHz)",
    "vi_VN-25hours_single-low": "Giọng kho (16kHz)",
    "vi_VN-vivos-x_low": "Giọng kho — 65 giọng, thêm #N vào sau (vd vi_VN-vivos-x_low#30)",
  };

  return readdirSync(dir)
    .filter((f) => f.endsWith(".onnx"))
    .map((f) => f.replace(/\.onnx$/, ""))
    .sort()
    .map((id) => ({
      id,
      note: existsSync(path.join(dir, `${id}.onnx.json`))
        ? (NOTES[id] ?? "Giọng tự thêm")
        : "⚠ THIẾU file cấu hình .onnx.json → piper sẽ báo lỗi",
    }));
}

function cmdVoices() {
  console.log("Voice tiếng Việt khả dụng (đặt vào voice.provider / voice.voiceId):\n");
  const all: Record<string, { id: string; note: string }[]> = {
    ...VIETNAMESE_VOICES,
    piper: piperVoices(),
  };
  const width = Math.max(24, ...Object.values(all).flat().map((v) => v.id.length));
  for (const [provider, voices] of Object.entries(all)) {
    console.log(`● ${provider}`);
    for (const v of voices) console.log(`    ${v.id.padEnd(width)}  ${v.note}`);
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
      case "make":
      case "tao":
        await cmdMake(arg, ...process.argv.slice(4));
        break;
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
      case "clean":
        await cmdClean(process.argv.slice(3));
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
            '  pnpm video make "<chủ đề>"  MỘT CÂU → spec → MP4 (cần key LLM trong .env)',
            "                              thêm --spec-only để dừng lại ở bước JSON",
            "",
            "  pnpm video build   <spec>   spec → out/<slug>/props.json",
            "  pnpm video render  <spec>   build + render → out/<slug>/final.mp4",
            "  pnpm video preview <spec>   build + mở Remotion Studio",
            "  pnpm video serve            mở Video Studio web (điền form → render)",
            "  pnpm video clean [--yes]    dọn asset mồ côi + thư mục tạm Remotion",
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
