import { promises as fs, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import type { WordTiming, Voice } from "../src/schema.ts";
import { writeSilentWav, getAudioDurationSec } from "./audio.ts";
import { toNFC } from "./normalize.ts";

/**
 * tts.ts — adapter đa provider. Đổi provider = sửa `voice.provider` trong spec.
 *
 * Thứ tự ưu tiên (theo đặc tả):
 *   1. elevenlabs — endpoint with-timestamps, alignment cấp ký tự → gộp thành từ,
 *      KHỎI cần Whisper. Đường nhanh nhất.
 *   2. azure      — REST cho audio WAV; word timing lấy qua align (Whisper).
 *   3. google     — REST LINEAR16 (WAV); word timing lấy qua align.
 *   4. piper       — TTS neural local, miễn phí, không key (offline).
 *   0. mock       — không cần API key: sinh audio im lặng + word timing đều nhau.
 *                   Dùng để chạy toàn bộ pipeline & render offline.
 */

export interface TTSOptions {
  voiceId: string;
  speed: number;
  pitch?: number;
  locale: string;
  /** Đường dẫn file audio đầu ra (nên .wav). */
  outPath: string;
}

export interface TTSResult {
  audioPath: string;
  /** Có nếu provider tự trả timing; nếu không → align.ts sẽ lo. */
  words?: WordTiming[];
  /** Có nếu provider biết sẵn độ dài (vd Edge suy từ word boundary) → khỏi cần ffprobe. */
  durationSec?: number;
}

export interface TTSProvider {
  readonly name: string;
  /** Đuôi file audio provider ghi ra ("wav" | "mp3"). Quyết định cách lấy duration. */
  readonly audioFormat: "wav" | "mp3";
  /** Số request TTS tối đa chạy SONG SONG (vd ElevenLabs free = 2). Bỏ trống = mặc định build. */
  readonly maxConcurrency?: number;
  synthesize(text: string, opts: TTSOptions): Promise<TTSResult>;
}

/* ------------------------- Tiện ích dùng chung -------------------------- */

/** Ước lượng thời lượng đọc theo số âm tiết tiếng Việt (tách theo khoảng trắng). */
export function estimateDurationSec(text: string, speed: number): number {
  const syllables = toNFC(text).trim().split(/\s+/).filter(Boolean).length;
  const perSyllableSec = 0.28; // ~3.5 âm tiết/giây, nhịp kể chuyện tự nhiên
  return Math.max(0.8, (syllables * perSyllableSec) / Math.max(0.5, speed));
}

/** Chia đều timing cho từng âm tiết trong khoảng [0, durationMs]. */
export function evenWordTimings(text: string, durationMs: number): WordTiming[] {
  const tokens = toNFC(text).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const per = durationMs / tokens.length;
  return tokens.map((t, i) => ({
    text: t,
    startMs: Math.round(i * per),
    endMs: Math.round((i + 1) * per),
  }));
}

/** Bọc raw PCM 16-bit mono thành file WAV. */
export async function pcmToWav(
  pcm: Buffer,
  outPath: string,
  sampleRate: number,
): Promise<void> {
  const channels = 1;
  const bitsPerSample = 16;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  await fs.writeFile(outPath, Buffer.concat([header, pcm]));
}

async function ensureDir(file: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
}

/* -------------------------------- Mock ---------------------------------- */

class MockProvider implements TTSProvider {
  readonly name = "mock";
  readonly audioFormat = "wav" as const;
  async synthesize(text: string, opts: TTSOptions): Promise<TTSResult> {
    await ensureDir(opts.outPath);
    const durationSec = estimateDurationSec(text, opts.speed);
    await writeSilentWav(opts.outPath, durationSec);
    return { audioPath: opts.outPath, words: evenWordTimings(text, durationSec * 1000) };
  }
}

/* ----------------------------- ElevenLabs ------------------------------- */

class ElevenLabsProvider implements TTSProvider {
  readonly name = "elevenlabs";
  readonly audioFormat = "wav" as const;
  /** Free/Starter: tối đa 2 request đồng thời. Build sẽ TTS ≤2 scene song song. */
  readonly maxConcurrency = 2;

  /** Bọc _once với tự-thử-lại khi bị giới hạn đồng thời (429 concurrent_limit_exceeded). */
  async synthesize(text: string, opts: TTSOptions): Promise<TTSResult> {
    const maxAttempts = 5;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this._once(text, opts);
      } catch (err) {
        lastErr = err;
        const msg = (err as Error).message;
        // Chỉ thử lại khi vượt giới hạn đồng thời / rate limit; lỗi khác (401, sai voice…) ném luôn.
        if (attempt < maxAttempts && /\b429\b|concurrent|rate_limit/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 700 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  private async _once(text: string, opts: TTSOptions): Promise<TTSResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("Thiếu ELEVENLABS_API_KEY (xem .env.example).");
    await ensureDir(opts.outPath);

    const sampleRate = 16000;
    const url =
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}` +
      `/with-timestamps?output_format=pcm_${sampleRate}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
        voice_settings: { speed: opts.speed },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs lỗi ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      audio_base64: string;
      alignment?: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      };
    };

    await pcmToWav(Buffer.from(data.audio_base64, "base64"), opts.outPath, sampleRate);
    const words = data.alignment ? charsToWords(data.alignment) : undefined;
    return { audioPath: opts.outPath, words };
  }
}

/** Gộp alignment cấp ký tự → cấp từ/âm tiết (ngắt theo khoảng trắng). */
function charsToWords(al: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): WordTiming[] {
  const words: WordTiming[] = [];
  let cur = "";
  let start = 0;
  let end = 0;
  const flush = () => {
    if (cur.trim()) words.push({ text: cur.trim(), startMs: Math.round(start * 1000), endMs: Math.round(end * 1000) });
    cur = "";
  };
  for (let i = 0; i < al.characters.length; i++) {
    const ch = al.characters[i]!;
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (cur === "") start = al.character_start_times_seconds[i] ?? end;
    cur += ch;
    end = al.character_end_times_seconds[i] ?? end;
  }
  flush();
  return words;
}

/* ------------------------------- Azure ---------------------------------- */

class AzureProvider implements TTSProvider {
  readonly name = "azure";
  readonly audioFormat = "wav" as const;
  async synthesize(text: string, opts: TTSOptions): Promise<TTSResult> {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) throw new Error("Thiếu AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.");
    await ensureDir(opts.outPath);

    const ssml =
      `<speak version='1.0' xml:lang='${opts.locale}'>` +
      `<voice name='${opts.voiceId}'>` +
      `<prosody rate='${Math.round((opts.speed - 1) * 100)}%'>${escapeXml(text)}</prosody>` +
      `</voice></speak>`;
    const res = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm",
        },
        body: ssml,
      },
    );
    if (!res.ok) throw new Error(`Azure lỗi ${res.status}: ${await res.text()}`);
    await fs.writeFile(opts.outPath, Buffer.from(await res.arrayBuffer()));
    // REST không kèm word boundary → để align.ts (Whisper) lo timing.
    return { audioPath: opts.outPath };
  }
}

/* ------------------------------- Google --------------------------------- */

class GoogleProvider implements TTSProvider {
  readonly name = "google";
  readonly audioFormat = "wav" as const;
  async synthesize(text: string, opts: TTSOptions): Promise<TTSResult> {
    const key = process.env.GOOGLE_TTS_API_KEY;
    if (!key) throw new Error("Thiếu GOOGLE_TTS_API_KEY.");
    await ensureDir(opts.outPath);

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: opts.locale, name: opts.voiceId },
          audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 16000, speakingRate: opts.speed },
        }),
      },
    );
    if (!res.ok) throw new Error(`Google lỗi ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { audioContent: string };
    await fs.writeFile(opts.outPath, Buffer.from(data.audioContent, "base64"));
    return { audioPath: opts.outPath }; // không có word timestamp → align sau
  }
}

/* -------------------------------- Piper --------------------------------- */
/**
 * Piper — TTS neural chạy LOCAL, MIỄN PHÍ, KHÔNG cần key/mạng. Xuất WAV.
 * Không kèm word timing → align đều theo duration (đọc từ header WAV, khỏi ffprobe).
 * Cần cài sẵn: tools/piper (binary) + tools/piper/voices/<voiceId>.onnx.
 * voiceId mặc định: "vi_VN-vais1000-medium".
 */
const PIPER_DIR = process.env.PIPER_DIR ?? path.join(process.cwd(), "tools", "piper");

class PiperProvider implements TTSProvider {
  readonly name = "piper";
  readonly audioFormat = "wav" as const;

  async synthesize(text: string, opts: TTSOptions): Promise<TTSResult> {
    const exe = path.join(PIPER_DIR, process.platform === "win32" ? "piper.exe" : "piper");
    // voiceId có thể kèm speaker: "vi_VN-vivos-x_low#5" → model + speaker 5 (model đa giọng).
    const [model, speaker] = opts.voiceId.split("#");
    const modelAbs = path.join(PIPER_DIR, "voices", `${model}.onnx`);
    if (!existsSync(exe)) throw new Error(`Không thấy Piper: ${exe}. Chạy scripts/setup-piper.ps1.`);
    if (!existsSync(modelAbs))
      throw new Error(`Không thấy giọng Piper "${model}": ${modelAbs}. Xem scripts/setup-piper.ps1.`);
    await ensureDir(opts.outPath);

    // Đường dẫn TƯƠNG ĐỐI so với thư mục piper (tránh lỗi Unicode "Máy tính" ở path tuyệt đối).
    const relOut = path.relative(PIPER_DIR, opts.outPath).split(path.sep).join("/");
    // length_scale: <1 = đọc nhanh hơn. Map từ speed (nhanh dứt khoát → speed>1).
    const lengthScale = (1 / Math.max(0.5, opts.speed)).toFixed(3);

    const args = [
      "--model",
      `voices/${model}.onnx`,
      "--espeak_data",
      "espeak-ng-data",
      "--length_scale",
      lengthScale,
      "--output_file",
      relOut,
    ];
    if (speaker) args.push("--speaker", speaker);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(exe, args, { cwd: PIPER_DIR });
      let err = "";
      child.stderr.on("data", (d) => (err += d.toString()));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0 && existsSync(opts.outPath)) resolve();
        else reject(new Error(`Piper lỗi (code ${code}): ${err.slice(-500)}`));
      });
      child.stdin.write(text);
      child.stdin.end();
    });

    return { audioPath: opts.outPath }; // không có words → align đều theo duration WAV
  }
}

/* ------------------------------- Edge TTS ------------------------------- */
/**
 * Microsoft Edge "read aloud" — MIỄN PHÍ, KHÔNG cần API key. Giọng vi-VN tự nhiên.
 * Trả word boundary kèm timing → khỏi cần Whisper, và suy ra duration luôn
 * (không cần ffprobe). Output MP3; Remotion tự xử lý MP3 khi render.
 * Cần có kết nối mạng lúc chạy.
 */
class EdgeProvider implements TTSProvider {
  readonly name = "edge";
  readonly audioFormat = "mp3" as const;

  /** Dịch vụ Edge free thỉnh thoảng rớt kết nối ("no turn.end") → thử lại vài lần. */
  async synthesize(text: string, opts: TTSOptions): Promise<TTSResult> {
    const maxAttempts = 4;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this._once(text, opts);
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
    }
    throw new Error(`Edge TTS lỗi sau ${maxAttempts} lần thử: ${(lastErr as Error).message}`);
  }

  private async _once(text: string, opts: TTSOptions): Promise<TTSResult> {
    const { MsEdgeTTS, OUTPUT_FORMAT } = (await import("msedge-tts")) as typeof import("msedge-tts");
    await ensureDir(opts.outPath);

    const tts = new MsEdgeTTS();
    await tts.setMetadata(opts.voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
    });

    const prosody: { rate?: string; pitch?: string } = {};
    const rateDelta = Math.round((opts.speed - 1) * 100);
    if (rateDelta !== 0) prosody.rate = `${rateDelta >= 0 ? "+" : ""}${rateDelta}%`;
    if (opts.pitch) prosody.pitch = `${opts.pitch >= 0 ? "+" : ""}${opts.pitch}st`;

    const { audioStream, metadataStream } = tts.toStream(text, prosody);

    const audioChunks: Buffer[] = [];
    const metaChunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (d: Buffer) => audioChunks.push(d));
      audioStream.on("end", () => resolve());
      audioStream.on("error", reject);
      metadataStream?.on("data", (d: Buffer) => metaChunks.push(d));
      metadataStream?.on("error", reject);
    });
    tts.close();

    await fs.writeFile(opts.outPath, Buffer.concat(audioChunks));

    // Gom toàn bộ metadata rồi tách từng object JSON (stream không phải objectMode
    // nên các message có thể bị dính vào nhau) → lấy WordBoundary.
    const words: WordTiming[] = [];
    for (const obj of extractJsonObjects(Buffer.concat(metaChunks).toString("utf8"))) {
      const list = (obj as { Metadata?: unknown[] }).Metadata ?? [];
      for (const m of list as Array<{
        Type?: string;
        Data?: { Offset?: number; Duration?: number; text?: { Text?: string } };
      }>) {
        if (m.Type !== "WordBoundary" || !m.Data) continue;
        const startMs = Math.round((m.Data.Offset ?? 0) / 10000); // 100ns → ms
        const durMs = Math.round((m.Data.Duration ?? 0) / 10000);
        const t = toNFC(m.Data.text?.Text ?? "").trim();
        if (t) words.push({ text: t, startMs, endMs: startMs + durMs });
      }
    }
    words.sort((a, b) => a.startMs - b.startMs);

    const last = words[words.length - 1];
    const durationSec = last ? (last.endMs + 150) / 1000 : undefined;
    return { audioPath: opts.outPath, words: words.length ? words : undefined, durationSec };
  }
}

/** Tách các object JSON top-level trong 1 chuỗi ghép "{...}{...}" (an toàn với string). */
function extractJsonObjects(s: string): unknown[] {
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          out.push(JSON.parse(s.slice(start, i + 1)));
        } catch {
          /* bỏ qua mảnh hỏng */
        }
        start = -1;
      }
    }
  }
  return out;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
  );
}

/* ------------------------------ Factory --------------------------------- */

export function getProvider(name: Voice["provider"]): TTSProvider {
  switch (name) {
    case "mock":
      return new MockProvider();
    case "edge":
      return new EdgeProvider();
    case "piper":
      return new PiperProvider();
    case "elevenlabs":
      return new ElevenLabsProvider();
    case "azure":
      return new AzureProvider();
    case "google":
      return new GoogleProvider();
    default: {
      const _exhaustive: never = name;
      throw new Error(`Provider không hỗ trợ: ${_exhaustive}`);
    }
  }
}

export { getAudioDurationSec };
