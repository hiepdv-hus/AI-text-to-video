import React from "react";
import { interpolate } from "remotion";
import { Check, X } from "lucide-react";
import type { Palette } from "../../theme/claude";
import { cardSurface, isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { BEAT, useDrift, useEnter } from "../motion";

/**
 * ClaudeChecklist — danh sách ĐÚNG / SAI cho graphic.kind = "checklist".
 *
 * Khác `steps` (thứ tự) và `feature-cards` (liệt kê ngang hàng): widget này mang một
 * PHÁN XÉT. Nội dung dạng "nên thế này, đừng thế kia" trước đây phải mượn `steps`, mà
 * steps đánh số 01/02/03 nên vô tình biến lời khuyên thành quy trình các bước — sai hẳn
 * ý. Ở đây dấu ✓/✗ và màu nói thẳng cái nào đúng cái nào sai.
 *
 * Nhãn mở đầu bằng dấu:
 *   "+ Hỏi rõ đề bài trước khi code"   → ✓ xanh (đúng)
 *   "- Lao vào code ngay"              → ✗ đỏ  (sai)
 *   "Không có dấu"                     → mặc định ✓
 *
 * Màu SAI cố ý KHÔNG lấy từ Palette: sai/nguy hiểm là quy ước đỏ chung của người xem,
 * đổi theo theme sẽ mất nghĩa. Nhưng vẫn hai tông đỏ để hợp nền sáng/tối.
 */

const BAD_DARK = "#FF6B6B";
const BAD_LIGHT = "#C0392B";

interface Item {
  ok: boolean;
  text: string;
}

function parseItems(labels?: string[]): Item[] {
  const src = labels?.length ? labels : ["+ Việc nên làm", "- Việc nên tránh"];
  return src.map((raw) => {
    const m = raw.match(/^([+-])\s+(.*)$/);
    if (!m) return { ok: true, text: raw.trim() };
    return { ok: m[1] === "+", text: m[2]!.trim() };
  });
}

export const ClaudeChecklist: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const items = parseItems(labels);
  // Từ 5 mục trở lên thì hạ cỡ chữ một nấc — cùng ngưỡng với feature-cards để hai
  // widget đứng cạnh nhau trong một video không lệch nhịp đọc.
  const dense = items.length >= 5;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: dense ? 12 : 16,
        fontFamily: TEXT_STACK,
        textAlign: "left",
      }}
    >
      {items.map((it, i) => (
        <Row key={i} item={it} index={i} dense={dense} p={p} />
      ))}
    </div>
  );
};

/** Một dòng: trượt ngang vào, dấu ✓/✗ nảy ra sau chữ một nhịp rồi trôi khẽ. */
const Row: React.FC<{ item: Item; index: number; dense: boolean; p: Palette }> = ({ item, index, dense, p }) => {
  const e = useEnter(5 + index * BEAT.stagger, { damping: 17, stiffness: 180, mass: 0.75 });
  const mark = useEnter(9 + index * BEAT.stagger, BEAT.pop);
  const float = useDrift(index, 0.15) * 3;

  const bad = p.isDark ? BAD_DARK : BAD_LIGHT;
  const color = item.ok ? p.accent : bad;
  const box = dense ? 52 : 62;
  const Mark = item.ok ? Check : X;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: dense ? 18 : 22,
        padding: dense ? "18px 22px" : "22px 26px",
        ...cardSurface(p),
        // Gạch nhấn trái mang màu phán xét — đọc được cái nào đúng/sai kể cả khi
        // lướt nhanh không kịp nhìn dấu.
        borderLeft: `4px solid ${color}`,
        opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateX(${interpolate(e, [0, 1], [-26, 0])}px) translateY(${float}px)`,
      }}
    >
      <div
        style={{
          width: box,
          height: box,
          minWidth: box,
          borderRadius: 999,
          background: item.ok ? p.accentSoft : `${bad}22`,
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isTech(p) && item.ok ? p.glow : "none",
          // Dấu "đóng" vào sau khi thẻ đã yên chỗ — như thể vừa được tick tay.
          transform: `scale(${interpolate(mark, [0, 1], [0.2, 1])}) rotate(${interpolate(
            mark,
            [0, 1],
            [item.ok ? -50 : 50, 0],
          ).toFixed(1)}deg)`,
        }}
      >
        <Mark size={Math.round(box * 0.56)} color={color} strokeWidth={3} absoluteStrokeWidth />
      </div>

      <div
        style={{
          fontSize: dense ? p.size.subhead : p.size.card,
          fontWeight: 650,
          color: item.ok ? p.text : p.textMuted,
          lineHeight: 1.2,
          // Việc nên tránh gạch ngang rất mờ: đọc vẫn rõ nhưng mắt biết ngay là phủ định.
          textDecoration: item.ok ? "none" : "line-through",
          textDecorationColor: `${bad}80`,
          textDecorationThickness: 2,
        }}
      >
        {item.text}
      </div>
    </div>
  );
};
