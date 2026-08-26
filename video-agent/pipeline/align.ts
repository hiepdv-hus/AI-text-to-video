import path from "node:path";
import { promises as fs } from "node:fs";
import type { WordTiming } from "../src/schema.ts";
import { getAudioDurationSec } from "./audio.ts";
import { evenWordTimings } from "./tts.ts";
import { toNFC } from "./normalize.ts";

/**
 * align.ts — CHỈ chạy khi provider không tự trả word timing (Azure REST, Google).
 *
 * Dùng @remotion/install-whisper-cpp: tự tải & build whisper.cpp về máy, chạy
 * local, miễn phí. Ép language="vi".
 *
 * XỬ LÝ TIẾNG VIỆT (quan trọng):
 *  - Tiếng Việt viết rời từng âm tiết → "word" Whisper trả về ≈ âm tiết.
 *    Với karaoke thế là ĐẸP; KHÔNG gộp thành từ ghép.
 *  - Chuẩn hoá NFC trước khi so khớp, nếu không dấu thanh lệch.
 *
 * Whisper cần WAV 16kHz mono — pipeline đã chuẩn hoá mọi audio về đúng định dạng này.
 *
 * Nếu Whisper không cài được / tắt qua env → fallback chia timing đều theo âm tiết
 * (pipeline không bao giờ bị chặn).
 */

const WHISPER_DIR = path.resolve(process.cwd(), ".cache", "whisper");
const WHISPER_VERSION = "1.5.5";

export interface AlignOptions {
  /** Bật Whisper. Mặc định theo env ALIGN_WITH_WHISPER=1. */
  useWhisper?: boolean;
  /** Model: large-v3 / medium cho tiếng Việt. Mặc định env WHISPER_MODEL hoặc "medium". */
  model?: string;
}

export async function alignWords(
  audioPath: string,
  narration: string,
  opts: AlignOptions = {},
): Promise<WordTiming[]> {
  const useWhisper = opts.useWhisper ?? process.env.ALIGN_WITH_WHISPER === "1";
  if (useWhisper) {
    try {
      return await whisperAlign(audioPath, opts.model);
    } catch (err) {
      console.warn(
        `[align] Whisper thất bại (${(err as Error).message}). ` +
          `Fallback chia timing đều theo âm tiết.`,
      );
    }
  }
  const durationSec = await getAudioDurationSec(audioPath);
  return evenWordTimings(narration, durationSec * 1000);
}

async function whisperAlign(audioPath: string, modelArg?: string): Promise<WordTiming[]> {
  // Import động: chỉ nạp khi thực sự dùng Whisper (tránh cost khi đường mock/elevenlabs).
  // Ép `any`: API @remotion/install-whisper-cpp thay đổi giữa các phiên bản —
  // giữ code không phụ thuộc chặt vào kiểu, đọc doc bản hiện tại nếu cần chỉnh.
  const whisper: any = await import("@remotion/install-whisper-cpp");
  const model = modelArg ?? process.env.WHISPER_MODEL ?? "medium";

  await fs.mkdir(WHISPER_DIR, { recursive: true });
  await whisper.installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION });
  await whisper.downloadWhisperModel({ model, folder: WHISPER_DIR });

  const { transcription } = await whisper.transcribe({
    inputPath: audioPath,
    whisperPath: WHISPER_DIR,
    model,
    tokenLevelTimestamps: true,
    language: "vi",
    splitOnWord: true,
  });

  const words: WordTiming[] = [];
  for (const seg of transcription as Array<{ text: string; offsets: { from: number; to: number } }>) {
    const text = toNFC(seg.text).trim();
    if (!text) continue;
    words.push({
      text,
      startMs: Math.max(0, Math.round(seg.offsets.from)),
      endMs: Math.max(0, Math.round(seg.offsets.to)),
    });
  }
  return words;
}
