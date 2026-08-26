import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * env.ts — nạp biến môi trường từ file .env (không cần thư viện ngoài).
 * Import file này SỚM NHẤT ở entrypoint (cli.ts, server.ts) để mọi provider
 * đọc được API key. Giá trị từ shell env vẫn được ưu tiên (không ghi đè).
 */
function loadEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = val;
  }
}

loadEnv(path.resolve(process.cwd(), ".env"));
