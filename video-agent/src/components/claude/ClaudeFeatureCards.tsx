import React from "react";
import { interpolate } from "remotion";
import type { Palette } from "../../theme/claude";
import { cardSurface, isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { BEAT, useDrift, useEnter } from "../motion";
import { Glyph, parseLabel, type ParsedLabel } from "./Icon";

/**
 * ClaudeFeatureCards — lưới thẻ liệt kê cho graphic.kind = "feature-cards".
 *
 * Nguyên tắc bố cục: **ưu tiên MỘT CỘT**. Khung dọc 1080px chia đôi thì mỗi thẻ chỉ
 * còn ~440px — chữ buộc phải nhỏ lại và ngắt dòng lung tung, đúng thứ khiến video khó
 * đọc trên điện thoại. Chỉ khi từ 5 mục trở lên (một cột sẽ tràn) mới xếp 2 cột và hạ
 * một nấc cỡ chữ.
 *
 * Mỗi thẻ: huy hiệu icon (hoặc số thứ tự mono) + chữ lớn, gạch nhấn dọc bên trái để
 * mắt bắt được thứ tự đọc.
 *
 * Icon nhận cả hai cú pháp (xem `Icon.tsx`): "@zap Nhanh" cho icon lucide tô theo
 * Palette, hoặc "⚡ Nhanh" cho emoji. Icon lucide là lựa chọn tốt hơn — nó đổi màu theo
 * theme, còn emoji thì không.
 */

export const ClaudeFeatureCards: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const items = labels && labels.length ? labels : ["Tự động", "Nhanh", "Riêng tư", "Mượt"];

  const twoCols = items.length >= 5;
  const fontSize = twoCols ? p.size.subhead : p.size.card;
  const badge = twoCols ? 62 : 78;

  return (
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: twoCols ? "1fr 1fr" : "1fr",
        gap: twoCols ? 16 : 20,
        fontFamily: TEXT_STACK,
        // Cần perspective ở CONTAINER thì rotateX của từng thẻ mới ra chiều sâu thật;
        // đặt perspective trên chính thẻ sẽ cho phối cảnh sai (mỗi thẻ một điểm nhìn).
        perspective: 1400,
      }}
    >
      {items.map((raw, i) => (
        <Card key={i} index={i} parsed={parseLabel(raw)} fontSize={fontSize} badge={badge} compact={twoCols} p={p} />
      ))}
    </div>
  );
};

/** Một thẻ: lật vào từ dưới (rotateX) rồi trôi khẽ. */
const Card: React.FC<{
  index: number;
  parsed: ParsedLabel;
  fontSize: number;
  badge: number;
  compact: boolean;
  p: Palette;
}> = ({ index, parsed, fontSize, badge, compact, p }) => {
  const glyph = <Glyph parsed={parsed} size={Math.round(badge * 0.52)} color={p.accent} p={p} />;
  const e = useEnter(5 + index * BEAT.stagger, { damping: 17, stiffness: 190, mass: 0.75 });
  const op = interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const float = useDrift(index, 0.16) * 3.5;

  return (
          <div
            style={{
              opacity: op,
              // Lật quanh trục ngang khi vào: thẻ "dựng lên" thay vì trượt phẳng —
              // khác biệt nhỏ nhưng đó là ranh giới giữa hoạt hoạ và trình chiếu.
              transform: `translateY(${interpolate(e, [0, 1], [30, 0]) + float}px) rotateX(${interpolate(
                e,
                [0, 1],
                [-32, 0],
              ).toFixed(2)}deg)`,
              transformOrigin: "center bottom",
              display: "flex",
              alignItems: "center",
              gap: compact ? 18 : 24,
              padding: compact ? "22px 24px" : "26px 30px",
              textAlign: "left",
              ...cardSurface(p),
              borderLeft: `4px solid ${p.accent}`,
            }}
          >
            {/* Huy hiệu: ô bo góc nền nhấn mờ. Có emoji thì dùng emoji, không thì dùng
                số thứ tự mono — thẻ nào cũng có "mỏ neo" bên trái, lưới không bị lệch. */}
            <div
              style={{
                width: badge,
                height: badge,
                minWidth: badge,
                borderRadius: p.radius.md,
                background: p.accentSoft,
                border: `1px solid ${p.cardBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isTech(p) ? p.glow : "none",
              }}
            >
              {glyph ?? (
                <span
                  style={{
                    fontFamily: p.labelFont,
                    fontSize: Math.round(badge * 0.42),
                    fontWeight: 800,
                    color: p.accent,
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
            </div>
            <div style={{ fontSize, fontWeight: 650, color: p.text, lineHeight: 1.2 }}>{parsed.text}</div>
          </div>
  );
};
