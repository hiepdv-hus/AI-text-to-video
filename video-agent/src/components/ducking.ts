import type { BuiltScene } from "../schema";

/**
 * ducking.ts — TỰ HẠ NHẠC NỀN KHI CÓ GIỌNG ĐỌC.
 *
 * Vì sao phải có: nhạc nền để nguyên một mức từ đầu đến cuối sẽ đè lên lời. Tai người
 * xử lý giọng nói và nhạc trong cùng dải tần trung, nên chỉ cần nhạc ở mức "nghe thấy
 * rõ" là lời đã phải gắng sức mới nghe được — và người xem bỏ đi chứ không vặn to lên.
 *
 * Cái hay là hệ này KHÔNG cần phân tích tín hiệu: `words` đã có sẵn mốc từng từ do TTS
 * hoặc Whisper trả về, chính xác hơn bất kỳ bộ dò mức âm nào. Chỉ việc dựng đường bao
 * từ đó.
 *
 * Ba bước:
 *   1. Gộp mốc từng TỪ thành các quãng NÓI (khoảng lặng ngắn giữa các từ không tính là
 *      hết nói — nếu tính thì nhạc sẽ phập phồng theo từng chữ, nghe rất tệ).
 *   2. Đặt mức đích: đang nói = `duck`, im lặng = 1.
 *   3. Làm mượt bằng bộ bám hai tốc độ: hạ NHANH, nâng CHẬM — đúng cách một compressor
 *      thật hành xử. Hạ chậm thì chữ đầu câu bị nhạc nuốt; nâng nhanh thì nhạc "hộc"
 *      lên giữa hai câu.
 */

/** Khoảng lặng ngắn hơn ngần này (giây) thì vẫn coi là đang nói liền mạch. */
const JOIN_GAP_SEC = 0.45;
/** Nhạc hạ xuống trong ~0.12 s và nâng lại trong ~0.6 s. */
const ATTACK_SEC = 0.12;
const RELEASE_SEC = 0.6;

/**
 * Dựng mảng hệ số âm lượng theo từng frame (giá trị 0..1, nhân với music.volume).
 *
 * Trả về mảng thay vì hàm tính tại chỗ vì bộ làm mượt phải chạy tuần tự theo thời gian —
 * tính riêng lẻ từng frame sẽ không có trạng thái để bám.
 */
export function buildDuckEnvelope(
  scenes: BuiltScene[],
  fps: number,
  totalFrames: number,
  duck: number,
): Float32Array {
  const speaking = new Uint8Array(totalFrames);

  for (const scene of scenes) {
    for (const w of scene.words) {
      const a = scene.fromFrame + Math.floor((w.startMs / 1000) * fps);
      const b = scene.fromFrame + Math.ceil((w.endMs / 1000) * fps);
      for (let f = Math.max(0, a); f < Math.min(totalFrames, b); f++) speaking[f] = 1;
    }
  }

  // Nối các quãng cách nhau dưới JOIN_GAP_SEC.
  const joinFrames = Math.round(JOIN_GAP_SEC * fps);
  let lastEnd = -1;
  for (let f = 0; f < totalFrames; f++) {
    if (!speaking[f]) continue;
    if (lastEnd >= 0 && f - lastEnd <= joinFrames) {
      for (let k = lastEnd; k < f; k++) speaking[k] = 1;
    }
    // Chạy tới hết quãng nói hiện tại.
    while (f < totalFrames && speaking[f]) f++;
    lastEnd = f;
  }

  // Bám hai tốc độ. Hệ số alpha đổi theo chiều đi lên hay đi xuống.
  const aDown = 1 - Math.exp(-1 / Math.max(1, ATTACK_SEC * fps));
  const aUp = 1 - Math.exp(-1 / Math.max(1, RELEASE_SEC * fps));
  const env = new Float32Array(totalFrames);
  let cur = 1;
  for (let f = 0; f < totalFrames; f++) {
    const target = speaking[f] ? duck : 1;
    cur += (target - cur) * (target < cur ? aDown : aUp);
    env[f] = cur;
  }
  return env;
}
