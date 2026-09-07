import React from "react";
import { interpolate } from "remotion";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { BEAT, useDrift, useEnter } from "../motion";
import { Glyph, parseLabel } from "./Icon";

/**
 * ChipRow — HÀNG NHÃN NHỎ chở dữ liệu thật, đặt ngay dưới tiêu đề.
 *
 * Đây là thứ làm nên "mật độ" của các kênh review công cụ: một khung hình vừa có tiêu
 * đề lớn, vừa có `⭐ 75.868 sao` `MIT` `Python` bên dưới. Người lướt qua chưa đọc chữ
 * nào đã cảm được là video có thông tin; ai muốn đọc kỹ thì dừng lại đọc được.
 *
 * KHÁC feature-cards: thẻ là NỘI DUNG CHÍNH của cảnh, chiếm cả cột và có nhịp vào riêng.
 * Chip là SIÊU DỮ LIỆU đi kèm tiêu đề — nhỏ, xếp ngang, tràn dòng, không bao giờ là lý
 * do tồn tại của cảnh. Vì thế `chips` là field của SCENE, dùng được ở mọi layout, chứ
 * không phải một `graphic.kind` riêng.
 *
 * CÚ PHÁP mỗi phần tử trong `chips`:
 *   "@star 75.868 sao"              chip thường, có icon
 *   "MIT"                            chip thường, không icon
 *   "* @flame 9,2K fork"             chip NHẤN (viền + chữ màu nhấn)
 *   "$ docker-compose up -d"         chip TERMINAL (nền tối, chữ mono, giữ dấu $)
 */

type Kind = "plain" | "accent" | "term";

interface Chip {
  kind: Kind;
  raw: string;
}

function parseChips(labels?: string[]): Chip[] {
  if (!labels?.length) return [];
  return labels.map((s) => {
    const t = s.trim();
    if (/^\$\s/.test(t)) return { kind: "term" as const, raw: t };
    if (/^\*\s/.test(t)) return { kind: "accent" as const, raw: t.slice(1).trim() };
    return { kind: "plain" as const, raw: t };
  });
}

export const ChipRow: React.FC<{ labels?: string[]; p: Palette; delay?: number }> = ({
  labels,
  p,
  delay = 6,
}) => {
  const chips = parseChips(labels);
  if (chips.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
        width: "100%",
        fontFamily: TEXT_STACK,
      }}
    >
      {chips.map((c, i) => (
        <ChipView key={i} chip={c} index={i} delay={delay} p={p} />
      ))}
    </div>
  );
};

/**
 * Một chip. Vào theo kiểu "nảy ra" lệch pha nhau rồi trôi rất khẽ — chip đứng im thành
 * ra giống ảnh chụp màn hình dán vào, đúng thứ tầng SỐNG trong motion.ts cố tránh.
 */
const ChipView: React.FC<{ chip: Chip; index: number; delay: number; p: Palette }> = ({
  chip,
  index,
  delay,
  p,
}) => {
  const e = useEnter(delay + index * 3, BEAT.pop);
  const float = useDrift(index, 0.19) * 1.8;
  const parsed = parseLabel(chip.raw);

  const term = chip.kind === "term";
  const accent = chip.kind === "accent";
  // Cỡ chip cố ý NHỎ hơn hẳn chữ thân: nó là chú thích, không được tranh chỗ với tiêu đề.
  const size = Math.round(p.size.small * 0.92);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: term ? "10px 16px" : "9px 16px",
        borderRadius: term ? p.radius.sm : p.radius.pill,
        // Ba sắc thái, cùng một Palette: thường = mặt card, nhấn = nền nhấn mờ + viền
        // nhấn, terminal = nền tối đặc hơn để đọc ra là một dòng lệnh.
        background: term ? (p.isDark ? "rgba(0,0,0,0.42)" : "rgba(35,32,25,0.06)") : accent ? p.accentSoft : p.card,
        border: `1px solid ${accent || term ? p.accent : p.cardBorder}`,
        boxShadow: accent && isTech(p) ? p.glow : "none",
        color: accent || term ? p.accent : p.text,
        fontFamily: term ? p.labelFont : TEXT_STACK,
        fontSize: size,
        fontWeight: term ? 600 : 650,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `scale(${interpolate(e, [0, 1], [0.72, 1])}) translateY(${float}px)`,
      }}
    >
      <Glyph parsed={parsed} size={Math.round(size * 1.05)} color={accent || term ? p.accent : p.accent} p={p} />
      <span>{parsed.text}</span>
    </div>
  );
};
