import "../pipeline/env.ts";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getProvider } from "../pipeline/tts.ts";

/**
 * gen-voice-samples.ts — render 1 câu mẫu bằng TẤT CẢ giọng Piper tiếng Việt
 * (vais1000, 25hours, và 65 speaker của vivos) rồi sinh 1 trang index.html có
 * trình phát để nghe A/B và copy voiceId. Chạy: pnpm tsx scripts/gen-voice-samples.ts
 *
 * Output: out/voice-samples/*.wav + out/voice-samples/index.html
 */

const SAMPLE_TEXT =
  "Xin chào, Chúng tôi giúp bạn biên tập video bằng trí tuệ nhân tạo ngay trên máy của bạn.";

const VIVOS_SPEAKERS = 65; // #0..#64

interface VoiceDef {
  voiceId: string;
  label: string;
  group: "single" | "vivos";
}

const VOICES: VoiceDef[] = [
  { voiceId: "vi_VN-vais1000-medium", label: "vais1000 (rõ nhất, 22kHz)", group: "single" },
  { voiceId: "vi_VN-25hours_single-low", label: "25hours (16kHz)", group: "single" },
  ...Array.from({ length: VIVOS_SPEAKERS }, (_, i) => ({
    voiceId: `vi_VN-vivos-x_low#${i}`,
    label: `vivos #${i}`,
    group: "vivos" as const,
  })),
];

/** Tên file an toàn (thay '#' để dùng được trong URL <audio src>). */
const fileFor = (voiceId: string) => voiceId.replace("#", "_s") + ".wav";

async function main() {
  const outDir = path.resolve(process.cwd(), "out", "voice-samples");
  await fs.mkdir(outDir, { recursive: true });
  const provider = getProvider("piper");

  const ok: VoiceDef[] = [];
  const failed: { v: VoiceDef; err: string }[] = [];

  for (let i = 0; i < VOICES.length; i++) {
    const v = VOICES[i]!;
    const outPath = path.join(outDir, fileFor(v.voiceId));
    process.stdout.write(`[${i + 1}/${VOICES.length}] ${v.voiceId} … `);
    try {
      await provider.synthesize(SAMPLE_TEXT, {
        voiceId: v.voiceId,
        speed: 1.1,
        locale: "vi-VN",
        outPath,
      });
      ok.push(v);
      console.log("✓");
    } catch (err) {
      failed.push({ v, err: (err as Error).message });
      console.log("✗ " + (err as Error).message.slice(0, 60));
    }
  }

  await fs.writeFile(path.join(outDir, "index.html"), renderHtml(ok), "utf8");
  console.log(`\n✅ ${ok.length}/${VOICES.length} giọng. Lỗi: ${failed.length}`);
  console.log(`▶ Mở: ${path.join(outDir, "index.html")}`);
}

function card(v: VoiceDef): string {
  const src = fileFor(v.voiceId);
  return `
    <div class="card">
      <div class="label">${v.label}</div>
      <code class="vid" onclick="copy(this)" title="Bấm để copy">${v.voiceId}</code>
      <audio controls preload="none" src="${src}"></audio>
    </div>`;
}

function renderHtml(voices: VoiceDef[]): string {
  const singles = voices.filter((v) => v.group === "single");
  const vivos = voices.filter((v) => v.group === "vivos");
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nghe thử giọng Piper tiếng Việt</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; font-family: system-ui, "Segoe UI", sans-serif; background:#0e0a20; color:#eee; padding:24px; }
  h1 { font-size:22px; } h2 { margin-top:32px; color:#B983FF; }
  .sample { background:#1a1530; border:1px solid #3a2f5e; border-radius:10px; padding:12px 16px; color:#c9beea; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; margin-top:16px; }
  .card { background:#17122b; border:1px solid #2e2650; border-radius:12px; padding:14px; }
  .label { font-weight:700; margin-bottom:6px; }
  .vid { display:inline-block; font-size:12px; background:#241c40; border:1px solid #3a2f5e; border-radius:6px;
         padding:3px 8px; margin-bottom:10px; cursor:pointer; color:#B983FF; user-select:all; }
  .vid:hover { background:#2e2450; }
  audio { width:100%; }
  .hint { color:#8a7fb0; font-size:13px; }
</style></head><body>
  <h1>🕷 Nghe thử giọng Piper tiếng Việt <span class="hint">(${voices.length} giọng)</span></h1>
  <p class="sample">Câu mẫu: “${SAMPLE_TEXT}”</p>
  <p class="hint">Bấm vào mã <code>voiceId</code> để copy. Chọn xong nói mình biết để mình đưa vào dropdown Studio.</p>

  <h2>Giọng đơn (${singles.length})</h2>
  <div class="grid">${singles.map(card).join("")}</div>

  <h2>Vivos — đa giọng (${vivos.length})</h2>
  <div class="grid">${vivos.map(card).join("")}</div>

  <script>
    function copy(el){ navigator.clipboard?.writeText(el.textContent); el.style.background="#4a3a80"; setTimeout(()=>el.style.background="",400); }
  </script>
</body></html>`;
}

void main();
