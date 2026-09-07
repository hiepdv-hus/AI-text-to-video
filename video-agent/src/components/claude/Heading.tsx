import React from "react";
import { interpolate } from "remotion";
import type { Palette } from "../../theme/claude";
import { BEAT, useDrift, useEnter } from "../motion";

/**
 * Heading.tsx — THỨ BẬC CHỮ dùng chung cho mọi layout (kể cả CodeLayout). Tách khỏi
 * ClaudeLayouts để CodeLayout dùng được mà không tạo vòng import.
 *
 * Ba mức, luôn theo đúng thứ tự này:
 *   Eyebrow (nhãn nhỏ) → Heading (tiêu đề) → subtitle (phụ đề).
 */

/**
 * splitEyebrow — tách "Bước 3 — Viết API đầu tiên" thành nhãn nhỏ + tiêu đề.
 * Chỉ tách khi có gạch dài " — " và vế trái NGẮN (≤ 22 ký tự), để không cắt nhầm
 * một tiêu đề bình thường có chứa gạch.
 */
export function splitEyebrow(heading: string): { eyebrow?: string; title: string } {
  const i = heading.indexOf(" — ");
  if (i > 0 && i <= 22) return { eyebrow: heading.slice(0, i).trim(), title: heading.slice(i + 3).trim() };
  return { title: heading };
}

/** Nhãn nhỏ trên tiêu đề: vạch nhấn + chữ mono viết hoa (tech) / chữ thường (claude). */
export const Eyebrow: React.FC<{ text: string; p: Palette; delay?: number }> = ({ text, p, delay = 0 }) => {
  const e = useEnter(delay, BEAT.pop);
  return (
    <div
      style={{
        opacity: interpolate(e, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${interpolate(e, [0, 1], [10, 0])}px)`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: p.labelFont,
        fontSize: p.size.label,
        fontWeight: 700,
        letterSpacing: p.labelCase === "uppercase" ? 2.4 : 0.4,
        textTransform: p.labelCase,
        color: p.accent,
        // Chữ tự mang độ tương phản của nó → lớp phủ trên video không cần dày,
        // cảnh quay giữ được chi tiết mà chữ vẫn đọc rõ.
        textShadow: p.isDark ? "0 2px 14px rgba(0,0,0,0.7)" : "none",
      }}
    >
      {/* Vạch nhấn tự kéo dài ra — một chi tiết nhỏ nhưng cho cảm giác "đang vẽ".
          Dày 4 và dài 52 để cân với cỡ chữ nhãn: vạch mảnh hơn chữ thì cụm nhãn trông
          như bị gạch chân hụt. */}
      <span
        style={{
          width: 52,
          height: 4,
          borderRadius: 999,
          background: p.accent,
          boxShadow: p.glow,
          transform: `scaleX(${e})`,
          transformOrigin: "left",
        }}
      />
      {text}
    </div>
  );
};

/**
 * Tiêu đề ĐỘNG THEO TỪNG CHỮ: mỗi từ tự bay lên, nét dần từ mờ, lệch nhau vài frame.
 *
 * Vì sao không fade cả khối: một khối chữ mờ vào rồi đứng im là thứ khiến video trông
 * như slide PowerPoint. Chữ chạy theo từng từ kéo mắt đi đúng thứ tự đọc, và vì trễ chỉ
 * ~3 frame nên vẫn kịp với giọng đọc, không thành lê thê.
 *
 * Từ khoá (emphasis) tô MÀU NHẤN và nảy mạnh hơn một chút.
 */
export const ClaudeHeading: React.FC<{
  text: string;
  emphasis?: string[];
  p: Palette;
  size?: number;
  /** Frame bắt đầu chạy chữ. */
  delay?: number;
}> = ({ text, emphasis = [], p, size, delay = 0 }) => {
  const phrases = emphasis.filter((s) => s.trim()).sort((a, b) => b.length - a.length);
  const segs: Array<{ t: string; hot: boolean }> = [];
  let rest = text;
  outer: while (rest.length) {
    for (const ph of phrases) {
      if (rest.toLowerCase().startsWith(ph.toLowerCase())) {
        segs.push({ t: rest.slice(0, ph.length), hot: true });
        rest = rest.slice(ph.length);
        continue outer;
      }
    }
    let nxt = rest.length;
    for (const ph of phrases) {
      const idx = rest.toLowerCase().indexOf(ph.toLowerCase());
      if (idx > 0) nxt = Math.min(nxt, idx);
    }
    const chunk = rest.slice(0, nxt);
    const last = segs[segs.length - 1];
    if (last && !last.hot) last.t += chunk;
    else segs.push({ t: chunk, hot: false });
    rest = rest.slice(nxt);
  }
  // Bẻ các đoạn thành TỪ, giữ nguyên cờ "hot" để mỗi từ chạy riêng được.
  const words: Array<{ t: string; hot: boolean }> = [];
  for (const s of segs) {
    for (const w of s.t.split(/(\s+)/)) {
      if (w === "") continue;
      if (/^\s+$/.test(w)) words.push({ t: " ", hot: false });
      else words.push({ t: w, hot: s.hot });
    }
  }

  return (
    <div
      style={{
        fontSize: size ?? p.size.heading,
        fontWeight: 700,
        lineHeight: p.lineHeight,
        letterSpacing: -0.5,
        // Xem ghi chú ở Eyebrow: tiêu đề tự đủ tương phản kể cả khi nằm trên video nền.
        textShadow: p.isDark ? "0 4px 26px rgba(0,0,0,0.62)" : "none",
      }}
    >
      {words.map((w, i) => (w.t === " " ? " " : <Word key={i} {...w} p={p} index={i} delay={delay} />))}
    </div>
  );
};

/** Phụ đề dưới tiêu đề — vào sau cùng, nhẹ nhàng, không tranh chỗ. */
const Subtitle: React.FC<{ text: string; p: Palette }> = ({ text, p }) => {
  const e = useEnter(14);
  return (
    <div
      style={{
        color: p.textMuted,
        fontSize: p.size.subhead,
        fontWeight: 500,
        opacity: interpolate(e, [0, 0.7], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${interpolate(e, [0, 1], [12, 0])}px)`,
      }}
    >
      {text}
    </div>
  );
};

/** Một từ trong tiêu đề: bay lên + nét dần + nảy nhẹ, rồi trôi rất khẽ để không đứng chết. */
const Word: React.FC<{ t: string; hot: boolean; p: Palette; index: number; delay: number }> = ({
  t,
  hot,
  p,
  index,
  delay,
}) => {
  const e = useEnter(delay + index * 3, hot ? BEAT.pop : BEAT.enter);
  const drift = useDrift(index, 0.13) * 2.2;
  return (
    <span
      style={{
        display: "inline-block",
        color: hot ? p.accent : undefined,
        opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${interpolate(e, [0, 1], [34, 0]) + drift}px) scale(${interpolate(
          e,
          [0, 1],
          [0.94, 1],
        )})`,
        // Nét dần từ mờ: mắt đọc ra là chữ "lấy nét", mượt hơn hẳn fade đơn thuần.
        filter: `blur(${interpolate(e, [0, 0.7], [10, 0], { extrapolateRight: "clamp" }).toFixed(2)}px)`,
      }}
    >
      {t}
    </span>
  );
};

/**
 * HeadingBlock — khối tiêu đề CHUẨN của mọi layout: nhãn nhỏ (tự tách từ "Bước 1 — …")
 * + tiêu đề + phụ đề. Gom về một chỗ để mọi cảnh có cùng nhịp dọc và cùng thứ bậc chữ.
 */
export const HeadingBlock: React.FC<{
  heading: string;
  emphasis?: string[];
  subtitle?: string;
  p: Palette;
  size?: number;
  /** Căn khối: giữa (mặc định) hay trái (CodeLayout). */
  align?: "center" | "left";
}> = ({ heading, emphasis, subtitle, p, size, align = "center" }) => {
  const { eyebrow, title } = splitEyebrow(heading);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align,
        gap: 14,
        width: "100%",
      }}
    >
      {eyebrow && <Eyebrow text={eyebrow} p={p} />}
      {/* Tiêu đề chạy SAU nhãn nhỏ vài frame → mắt đi từ nhãn xuống tiêu đề, đúng thứ tự đọc. */}
      <ClaudeHeading text={title} emphasis={emphasis} p={p} size={size} delay={eyebrow ? 5 : 0} />
      {subtitle && <Subtitle text={subtitle} p={p} />}
    </div>
  );
};
