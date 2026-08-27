import React from "react";
import { tokens } from "../theme/tokens";

/**
 * GlowHeading — tiêu đề lớn, trong đó CÁC TỪ/CỤM trong `emphasis` được tô tím phát
 * sáng + gạch chân glow (giống "đoạn nổi bật" ở ảnh mẫu). Phần còn lại trắng đậm.
 */

const N = tokens.neon;

/** Cắt text thành các đoạn, đánh dấu đoạn nào thuộc emphasis. */
function segment(text: string, emphasis: string[]): Array<{ t: string; hot: boolean }> {
  const phrases = emphasis.filter((p) => p.trim().length).sort((a, b) => b.length - a.length);
  if (!phrases.length) return [{ t: text, hot: false }];

  const out: Array<{ t: string; hot: boolean }> = [];
  let rest = text;
  outer: while (rest.length) {
    for (const p of phrases) {
      const idx = rest.toLowerCase().indexOf(p.toLowerCase());
      if (idx === 0) {
        out.push({ t: rest.slice(0, p.length), hot: true });
        rest = rest.slice(p.length);
        continue outer;
      }
    }
    // Không khớp ở đầu → gom 1 ký tự vào đoạn thường (gộp với đoạn trước nếu được).
    let next = rest.length;
    for (const p of phrases) {
      const idx = rest.toLowerCase().indexOf(p.toLowerCase());
      if (idx > 0) next = Math.min(next, idx);
    }
    const chunk = rest.slice(0, next);
    const last = out[out.length - 1];
    if (last && !last.hot) last.t += chunk;
    else out.push({ t: chunk, hot: false });
    rest = rest.slice(next);
  }
  return out;
}

export const GlowHeading: React.FC<{ text: string; emphasis?: string[]; size?: number }> = ({
  text,
  emphasis = [],
  size = 88,
}) => {
  const segs = segment(text, emphasis);
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: tokens.weight.black,
        lineHeight: 1.18,
        color: "#fff",
        textShadow: "0 4px 24px rgba(0,0,0,0.6)",
      }}
    >
      {segs.map((s, i) =>
        s.hot ? (
          <span
            key={i}
            style={{
              color: N.purpleBright,
              padding: "2px 14px",
              margin: "0 2px",
              borderRadius: 14,
              background: "rgba(139,92,246,0.16)",
              boxShadow: N.glowSoft,
              borderBottom: `4px solid ${N.purpleBright}`,
              display: "inline-block",
            }}
          >
            {s.t}
          </span>
        ) : (
          <span key={i}>{s.t}</span>
        ),
      )}
    </div>
  );
};
