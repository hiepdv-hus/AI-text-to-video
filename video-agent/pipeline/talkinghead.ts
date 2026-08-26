import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { ffmpegBinDir } from "./ffmpeg.ts";

/**
 * talkinghead.ts — biến ẢNH CHÂN DUNG + AUDIO thành video "mặt biết nói" bằng
 * Wav2Lip chạy LOCAL (miễn phí, không cần GPU nhưng CPU thì chậm hơn).
 *
 * Thiết kế adapter giống TTS: có thể thay bằng D-ID/Hedra sau này.
 * Bản này chỉ có Wav2Lip local. Có CACHE theo hash(ảnh + audio + tham số).
 *
 * Yêu cầu (đã cài sẵn ở tools/): venv Python 3.10, Wav2Lip + checkpoints, ffmpeg.
 * Có thể override đường dẫn qua biến môi trường.
 */

const ROOT = process.cwd();

// Cho phép override qua env; mặc định trỏ tới tools/ đã cài.
const WAV2LIP_PYTHON =
  process.env.WAV2LIP_PYTHON ?? path.join(ROOT, "tools", "wav2lip-venv", "Scripts", "python.exe");
const WAV2LIP_DIR = process.env.WAV2LIP_DIR ?? path.join(ROOT, "tools", "Wav2Lip");
const WAV2LIP_CHECKPOINT =
  process.env.WAV2LIP_CHECKPOINT ?? path.join(WAV2LIP_DIR, "checkpoints", "wav2lip_gan.pth");

const CACHE_DIR = path.join(ROOT, ".cache", "talkinghead");

export interface TalkingHeadOptions {
  fps: number;
  /** Giảm độ phân giải cho nhanh (1 = giữ nguyên). */
  resizeFactor?: number;
}

/** Có đủ điều kiện chạy Wav2Lip local không (để build.ts báo lỗi rõ ràng). */
export function talkingHeadAvailable(): { ok: boolean; reason?: string } {
  if (!existsSync(WAV2LIP_PYTHON)) return { ok: false, reason: `Không thấy Python venv: ${WAV2LIP_PYTHON}` };
  if (!existsSync(path.join(WAV2LIP_DIR, "inference.py")))
    return { ok: false, reason: `Không thấy Wav2Lip: ${WAV2LIP_DIR}` };
  if (!existsSync(WAV2LIP_CHECKPOINT))
    return { ok: false, reason: `Không thấy checkpoint: ${WAV2LIP_CHECKPOINT}` };
  return { ok: true };
}

async function fileHash(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

/**
 * Sinh video mặt biết nói. Trả về đường dẫn file .mp4 (trong cache).
 * @param imagePath ảnh chân dung (đường dẫn tuyệt đối)
 * @param audioPath audio scene (wav/mp3, tuyệt đối)
 */
export async function generateTalkingHead(
  imagePath: string,
  audioPath: string,
  opts: TalkingHeadOptions,
): Promise<string> {
  const avail = talkingHeadAvailable();
  if (!avail.ok) {
    throw new Error(
      `Talking-head (Wav2Lip) chưa sẵn sàng: ${avail.reason}\n` +
        `Chạy scripts/setup-wav2lip.ps1 để cài, hoặc đặt lại biến môi trường WAV2LIP_*.`,
    );
  }

  await fs.mkdir(CACHE_DIR, { recursive: true });
  const resizeFactor = opts.resizeFactor ?? 1;
  const key = createHash("sha256")
    .update(`${await fileHash(imagePath)}:${await fileHash(audioPath)}:${opts.fps}:${resizeFactor}`)
    .digest("hex")
    .slice(0, 20);
  const outPath = path.join(CACHE_DIR, `${key}.mp4`);

  if (existsSync(outPath)) {
    console.log(`[talkinghead]   cache hit`);
    return outPath;
  }

  // QUAN TRỌNG (Windows): OpenCV cv2.imread KHÔNG đọc được đường dẫn tuyệt đối có
  // ký tự non-ASCII (dự án nằm dưới "Máy tính"). Truyền đường dẫn TƯƠNG ĐỐI so với
  // thư mục Wav2Lip → chuỗi tham số toàn ASCII, phần Unicode nằm ở cwd (OpenCV xử lý được).
  const rel = (abs: string) => path.relative(WAV2LIP_DIR, abs).split(path.sep).join("/");

  const args = [
    "inference.py",
    "--checkpoint_path",
    rel(WAV2LIP_CHECKPOINT),
    "--face",
    rel(imagePath),
    "--audio",
    rel(audioPath),
    "--outfile",
    rel(outPath),
    "--fps",
    String(opts.fps),
    "--resize_factor",
    String(resizeFactor),
    "--pads",
    "0",
    "15",
    "0",
    "0", // chừa thêm cằm để miệng không bị cắt
  ];

  const env = { ...process.env };
  const ffDir = ffmpegBinDir(); // Wav2Lip gọi 'ffmpeg' qua PATH → thêm vào nếu tìm thấy
  if (ffDir) env.PATH = `${ffDir}${path.delimiter}${env.PATH ?? ""}`;

  console.log(`[talkinghead]   Wav2Lip đang xử lý (CPU, có thể mất 30-120s)…`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(WAV2LIP_PYTHON, args, { cwd: WAV2LIP_DIR, env });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.stdout.on("data", () => {
      /* nuốt log tiến độ của Wav2Lip cho gọn */
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 && existsSync(outPath)) resolve();
      else reject(new Error(`Wav2Lip thất bại (code ${code}). stderr:\n${stderr.slice(-1500)}`));
    });
  });

  return outPath;
}

export { WAV2LIP_DIR, WAV2LIP_PYTHON };
