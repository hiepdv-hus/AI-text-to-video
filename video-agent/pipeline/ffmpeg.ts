import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

/**
 * ffmpeg.ts — tự dò ffmpeg/ffprobe (không hardcode đường dẫn theo máy).
 * Thứ tự: FFMPEG_BIN (.env) → trên PATH → thư mục winget (Windows).
 * Trả về thư mục bin, "" nếu đã có trên PATH, hoặc null nếu không tìm thấy.
 */

let cached: string | null | undefined;

const EXE = process.platform === "win32" ? ".exe" : "";

export function ffmpegBinDir(): string | null {
  if (cached !== undefined) return cached;

  // 1) FFMPEG_BIN trong .env
  const env = process.env.FFMPEG_BIN;
  if (env && existsSync(path.join(env, `ffprobe${EXE}`))) return (cached = env);

  // 2) Đã có trên PATH?
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["ffprobe"], {
    encoding: "utf8",
  });
  if (which.status === 0 && which.stdout.trim()) return (cached = "");

  // 3) Thư mục winget (Windows): ...\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin
  if (process.platform === "win32") {
    const base = path.join(os.homedir(), "AppData", "Local", "Microsoft", "WinGet", "Packages");
    try {
      for (const d of readdirSync(base)) {
        if (!/ffmpeg/i.test(d)) continue;
        for (const sub of readdirSync(path.join(base, d))) {
          const bin = path.join(base, d, sub, "bin");
          if (existsSync(path.join(bin, `ffprobe${EXE}`))) return (cached = bin);
        }
      }
    } catch {
      /* không có winget */
    }
  }

  return (cached = null);
}

/** Đường dẫn ffprobe (tên trần "ffprobe" nếu đã trên PATH). */
export function ffprobeExe(): string {
  const dir = ffmpegBinDir();
  return dir ? path.join(dir, `ffprobe${EXE}`) : `ffprobe${EXE}`;
}

/** Đường dẫn ffmpeg (tên trần "ffmpeg" nếu đã trên PATH). */
export function ffmpegExe(): string {
  const dir = ffmpegBinDir();
  return dir ? path.join(dir, `ffmpeg${EXE}`) : `ffmpeg${EXE}`;
}
