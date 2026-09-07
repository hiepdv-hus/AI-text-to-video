import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import { ffprobeExe } from "./ffmpeg.ts";

/**
 * audio.ts — đọc/ghi WAV thuần bằng Node, KHÔNG cần ffmpeg cho đường mock.
 * Mọi provider được chuẩn hoá về WAV 16-bit PCM để lấy duration trực tiếp
 * từ header, tránh phụ thuộc ffprobe (audio lệch phụ đề nếu ước lượng theo ký tự).
 */

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSec: number;
}

/** Ghi 1 file WAV im lặng dài `durationSec` (mock TTS). */
export async function writeSilentWav(
  path: string,
  durationSec: number,
  sampleRate = 16000,
): Promise<void> {
  const channels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.max(1, Math.round(durationSec * sampleRate));
  const dataBytes = numSamples * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataBytes); // phần data để 0 = im lặng

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28); // byte rate
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  await fs.writeFile(path, buffer);
}

/**
 * Ghi WAV 16-bit từ mẫu float trong khoảng [-1, 1]. Dùng cho SFX tổng hợp (xem sfx.ts).
 * Giá trị ngoài khoảng bị kẹp thay vì cho tràn — tràn số nguyên 16-bit sẽ đổi dấu và
 * biến một đỉnh sóng thành tiếng rè rất chói.
 */
export async function writeWavFromFloat(
  path: string,
  samples: Float32Array,
  sampleRate = 44100,
): Promise<void> {
  const channels = 1;
  const bitsPerSample = 16;
  const dataBytes = samples.length * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]!));
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  await fs.writeFile(path, buffer);
}

/** Đọc thông tin WAV từ 44 byte header. */
export async function readWavInfo(path: string): Promise<WavInfo> {
  const fh = await fs.open(path, "r");
  try {
    const head = Buffer.alloc(64);
    await fh.read(head, 0, 64, 0);
    if (head.toString("ascii", 0, 4) !== "RIFF" || head.toString("ascii", 8, 12) !== "WAVE") {
      throw new Error(`Không phải file WAV hợp lệ: ${path}`);
    }
    const channels = head.readUInt16LE(22);
    const sampleRate = head.readUInt32LE(24);
    const bitsPerSample = head.readUInt16LE(34);
    // Tìm chunk "data" (thường ở offset 36 nhưng có thể có chunk phụ).
    const stat = await fh.stat();
    let dataBytes = head.readUInt32LE(40);
    if (head.toString("ascii", 36, 40) !== "data") {
      // fallback: suy ra từ kích thước file.
      dataBytes = stat.size - 44;
    }
    const durationSec = dataBytes / (sampleRate * channels * (bitsPerSample / 8));
    return { sampleRate, channels, bitsPerSample, durationSec };
  } finally {
    await fh.close();
  }
}

/**
 * Lấy duration (giây) của file audio bất kỳ.
 *  - .wav  → đọc header (không cần binary ngoài)
 *  - khác  → thử ffprobe nếu có trên PATH, không thì báo lỗi rõ ràng.
 */
export async function getAudioDurationSec(path: string): Promise<number> {
  if (path.toLowerCase().endsWith(".wav")) {
    return (await readWavInfo(path)).durationSec;
  }
  const probe = spawnSync(
    ffprobeExe(),
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
    { encoding: "utf8" },
  );
  if (probe.status === 0 && probe.stdout.trim()) {
    return parseFloat(probe.stdout.trim());
  }
  throw new Error(
    `Không lấy được duration của "${path}". File không phải WAV và không tìm thấy ffprobe. ` +
      `Đặt FFMPEG_BIN trong .env (thư mục chứa ffprobe), hoặc cài ffmpeg lên PATH.`,
  );
}
