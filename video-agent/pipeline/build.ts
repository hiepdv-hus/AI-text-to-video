import { promises as fs } from "node:fs";
import path from "node:path";
import {
  videoSpecSchema,
  builtPropsSchema,
  type VideoSpec,
  type BuiltScene,
  type BuiltProps,
  type WordTiming,
} from "../src/schema.ts";
import { normalizeVietnamese, restoreDisplayWords, mergePronunciations } from "./normalize.ts";
import { getProvider, getAudioDurationSec, PIPER_SENTENCE_SILENCE } from "./tts.ts";
import { alignWords } from "./align.ts";
import { cacheKey, readCache, writeCache } from "./cache.ts";
import { downloadAsset } from "./assets.ts";
import { generateImage } from "./imagegen.ts";
import { fetchStockImage, fetchStockVideo } from "./stock.ts";
import { highlightCode } from "./highlight.ts";
import { ensureSfx } from "./sfx.ts";
import type { CodeToken } from "../src/schema.ts";

/**
 * build.ts — VideoSpec → props.json hoàn chỉnh. KHÔNG có LLM ở đây (nửa xác định).
 *
 * Trình tự:
 *   1. Validate Zod, fail sớm với thông báo rõ.
 *   2. normalizeVietnamese() từng narration.
 *   3. TTS song song (concurrency 3), có cache theo hash(text+voiceId+speed).
 *   4. Align lấy word timing nếu provider không trả sẵn.
 *   5. Lấy duration THẬT từng file audio → durationInFrames.
 *   6. Tải asset về public/.
 *   7. Ghi out/<slug>/props.json + copy toàn bộ audio vào public/audio/<slug>/.
 */

const OUT_DIR = path.resolve(process.cwd(), "out");
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

/**
 * copyIntoPublic — chép file vào public/ theo kiểu NGUYÊN TỬ: ghi ra tên tạm rồi đổi tên.
 *
 * Vì sao không dùng thẳng fs.copyFile: Remotion Studio (`pnpm video preview`) vừa chạy vừa
 * PHỤC VỤ thư mục public/ qua HTTP. Nếu build ghi đè clip trong lúc Studio đang mở, Studio
 * có thể đọc trúng file mới chép được một nửa, rồi CACHE bản cụt đó vào thư mục asset tạm
 * của nó. Kết quả là lỗi "No frame found at position N" trong khi file trên đĩa hoàn toàn
 * lành — rất khó lần ra vì mọi công cụ soi file đều báo bình thường.
 *
 * fs.rename trên cùng một ổ đĩa là thao tác nguyên tử: người đọc thấy hoặc file cũ trọn
 * vẹn, hoặc file mới trọn vẹn, không bao giờ thấy trạng thái dở dang.
 */
async function copyIntoPublic(src: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.tmp`;
  await fs.copyFile(src, tmp);
  await fs.rename(tmp, dest);
}

export interface BuildResult {
  slug: string;
  propsPath: string;
  props: BuiltProps;
}

/** Chạy tối đa `limit` promise cùng lúc, giữ nguyên thứ tự kết quả. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function buildSpec(specPath: string): Promise<BuildResult> {
  const raw = await fs.readFile(specPath, "utf8");
  const json = JSON.parse(raw) as unknown;

  const parsed = videoSpecSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Spec không hợp lệ (${specPath}):\n${issues}`);
  }
  const spec: VideoSpec = parsed.data;
  const slug = slugify(path.basename(specPath).replace(/\.json$/i, "") || spec.meta.title);

  const audioDir = path.join(PUBLIC_DIR, "audio", slug);
  await fs.mkdir(audioDir, { recursive: true });
  // SFX tổng hợp một lần rồi dùng lại; hàm tự bỏ qua nếu file đã có.
  await ensureSfx(PUBLIC_DIR);
  await fs.mkdir(path.join(OUT_DIR, slug), { recursive: true });

  const provider = getProvider(spec.voice.provider);

  // Concurrency theo provider (vd ElevenLabs free chỉ cho 2 request song song → 429 nếu hơn).
  const concurrency = provider.maxConcurrency ?? 3;
  console.log(`[build] ${slug}: ${spec.scenes.length} scene, provider=${provider.name}, song song=${concurrency}`);

  // Bước 2-5: xử lý audio + timing từng scene (song song, giới hạn theo provider).
  const perScene = await mapLimit(spec.scenes, concurrency, async (scene, idx) => {
    const normalized = normalizeVietnamese(scene.narration, {
      pronunciations: spec.voice.pronunciations,
    });

    const ext = provider.audioFormat; // "wav" | "mp3"
    // Với piper, khoảng lặng giữa câu là một phần "chất giọng" → đưa vào khóa cache để đổi
    // PIPER_SENTENCE_SILENCE là tự re-TTS, không dính audio cũ đọc liền.
    const silenceSalt = provider.name === "piper" ? `:ss${PIPER_SENTENCE_SILENCE}` : "";
    const key = cacheKey(
      normalized,
      `${provider.name}:${spec.voice.voiceId}:p${spec.voice.pitch ?? 0}${silenceSalt}`,
      spec.voice.speed,
    );
    const audioRel = `audio/${slug}/${scene.id}.${ext}`;
    const publicAbs = path.join(PUBLIC_DIR, audioRel);

    let words: WordTiming[] | undefined;
    let durationSec: number | undefined;
    const cached = await readCache(key, ext);
    if (cached) {
      await copyIntoPublic(cached.audioPath, publicAbs);
      words = cached.words;
      console.log(`[build]   scene ${idx + 1}/${spec.scenes.length} "${scene.id}" (cache hit)`);
    } else {
      const res = await provider.synthesize(normalized, {
        voiceId: spec.voice.voiceId,
        speed: spec.voice.speed,
        pitch: spec.voice.pitch,
        locale: spec.meta.locale,
        outPath: publicAbs,
      });
      words = res.words;
      durationSec = res.durationSec;
      await writeCache(key, publicAbs, words, ext);
      console.log(`[build]   scene ${idx + 1}/${spec.scenes.length} "${scene.id}" (TTS ${provider.name})`);
    }

    // Bước 4: align nếu provider không trả timing.
    if (!words || words.length === 0) {
      words = await alignWords(publicAbs, normalized);
    }

    // Khôi phục chữ gốc cho caption (vd "ây ai" → "AI") sau khi TTS đã đọc đúng phát âm.
    words = restoreDisplayWords(words ?? [], mergePronunciations(spec.voice.pronunciations));

    // Bước 5: duration THẬT → frames.
    //  - provider tự báo durationSec (Edge) → dùng luôn.
    //  - file WAV → đọc header.
    //  - file MP3 không có ffprobe → suy từ word timing (endMs lớn nhất).
    if (durationSec === undefined) {
      if (ext === "wav") durationSec = await getAudioDurationSec(publicAbs);
      else {
        const lastEnd = words.reduce((mx, w) => Math.max(mx, w.endMs), 0);
        durationSec = lastEnd > 0 ? lastEnd / 1000 + 0.15 : 1;
      }
    }
    const totalSec = durationSec + scene.tailPadSec;
    const durationInFrames = Math.max(1, Math.round(totalSec * spec.meta.fps));

    // Bước 6: xử lý media. Ba kind "ảo" (pexels-video / pexels / generate) được GIẢI QUYẾT
    // ở đây thành file thật trong public/ + kind thật ("video" / "image") để composition
    // không bao giờ phải biết chúng từ đâu ra.
    let media = scene.media;
    if (media && media.kind === "pexels-video") {
      // Video LUÔN dọc: nó chạy full-bleed làm nền cả khung 1080x1920.
      const clip = await fetchStockVideo(media.src, { orientation: "portrait" });
      const rel = `video/${slug}/${scene.id}.mp4`;
      const abs = path.join(PUBLIC_DIR, rel);
      await copyIntoPublic(clip.filePath, abs);
      console.log(`[build]   scene "${scene.id}" → video nền Pexels (${clip.durationSec}s)`);
      media = {
        kind: "video",
        src: rel,
        fit: media.fit,
        focus: media.focus,
        durationSec: clip.durationSec > 0 ? clip.durationSec : undefined,
      };
    } else if (media && (media.kind === "generate" || media.kind === "pexels")) {
      // Ảnh DỌC cho mọi nền toàn màn (hook/cta/product…); NGANG chỉ cho khung "image" gọn.
      const portrait = scene.layout !== "image";
      let imgPath: string;
      if (media.kind === "generate") {
        imgPath = await generateImage(media.src, portrait ? { width: 896, height: 1216 } : { width: 1216, height: 832 });
        console.log(`[build]   scene "${scene.id}" → ảnh AI`);
      } else {
        imgPath = await fetchStockImage(media.src, { orientation: portrait ? "portrait" : "landscape" });
        console.log(`[build]   scene "${scene.id}" → ảnh Pexels`);
      }
      const rel = `images/${slug}/${scene.id}.jpg`;
      const abs = path.join(PUBLIC_DIR, rel);
      await copyIntoPublic(imgPath, abs);
      media = { kind: "image", src: rel, fit: media.fit, focus: media.focus };
    } else if (media && media.kind !== "color") {
      const rel = await downloadAsset(media.src, media.kind === "video" ? ".mp4" : ".jpg");
      media = { ...media, src: rel };
    }

    // Tô màu code (nếu là layout code) — sinh sẵn token ở pipeline.
    let codeTokens: CodeToken[][] | undefined;
    if (scene.layout === "code" && scene.code) {
      codeTokens = await highlightCode(scene.code, scene.codeLang);
    }

    return { scene, words, durationInFrames, media, audioRel, codeTokens };
  });

  // Ghép fromFrame cộng dồn.
  let cursor = 0;
  const builtScenes: BuiltScene[] = perScene.map(
    ({ scene, words, durationInFrames, media, audioRel, codeTokens }) => {
      const fromFrame = cursor;
      cursor += durationInFrames;
      return {
        ...scene,
        media,
        audioSrc: audioRel,
        words: words ?? [],
        durationInFrames,
        fromFrame,
        codeTokens,
      };
    },
  );

  // Music asset.
  let music = spec.music;
  if (music) {
    const rel = await downloadAsset(music.src, ".mp3");
    music = { ...music, src: rel };
  }

  const props: BuiltProps = {
    meta: spec.meta,
    voice: spec.voice,
    captions: spec.captions,
    music,
    sfx: spec.sfx,
    scenes: builtScenes,
    totalDurationInFrames: cursor,
  };

  // Validate lần cuối để chắc chắn props hợp đồng.
  const check = builtPropsSchema.safeParse(props);
  if (!check.success) {
    throw new Error(`props.json sinh ra không hợp lệ:\n${JSON.stringify(check.error.issues, null, 2)}`);
  }

  const propsPath = path.join(OUT_DIR, slug, "props.json");
  await fs.writeFile(propsPath, JSON.stringify(props, null, 2), "utf8");
  console.log(
    `[build] ✓ ${propsPath}  (${props.totalDurationInFrames} frames ≈ ${(props.totalDurationInFrames / spec.meta.fps).toFixed(1)}s)`,
  );

  return { slug, propsPath, props };
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "video";
}

export { OUT_DIR };
