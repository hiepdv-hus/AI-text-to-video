import "../pipeline/env.ts";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getProvider } from "../pipeline/tts.ts";

/**
 * gen-adam-sample.ts — render giọng Adam (ElevenLabs) 1 câu tiếng Việt + 1 câu
 * tiếng Anh vào out/voice-samples/ để nghe thử. Cần ELEVENLABS_API_KEY trong .env.
 */

const ADAM = "pNInz6obpgDQGcFmaJgB"; // giọng premade "Adam"

const CLIPS = [
  { id: "adam-vi", lang: "vi-VN", text: "Xin chào, chúng tôi giúp bạn biên tập video bằng trí tuệ nhân tạo ngay trên máy của bạn." },
  { id: "adam-en", lang: "en-US", text: "This is the Adam voice from ElevenLabs, the viral AI narration voice on TikTok." },
];

async function main() {
  const outDir = path.resolve(process.cwd(), "out", "voice-samples");
  await fs.mkdir(outDir, { recursive: true });
  const provider = getProvider("elevenlabs");

  for (const c of CLIPS) {
    const outPath = path.join(outDir, `${c.id}.wav`);
    process.stdout.write(`${c.id} (${c.lang}) … `);
    try {
      await provider.synthesize(c.text, { voiceId: ADAM, speed: 1, locale: c.lang, outPath });
      console.log("✓ " + outPath);
    } catch (err) {
      console.log("✗ " + (err as Error).message);
    }
  }
}

void main();
