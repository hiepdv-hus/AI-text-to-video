import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import type { Palette } from "../../theme/claude";
import { isTech } from "../../theme/claude";
import { tokens } from "../../theme/tokens";
import { TEXT_STACK } from "../textStack";
import { BEAT, useDrift, useEnter, usePulse } from "../motion";

/**
 * StatBig — CON SỐ LỚN cho graphic.kind = "stat-big".
 *
 * Widget rẻ nhất mà hiệu quả nhất cho short: một con số to choán màn hình đọc được
 * trong nửa giây, trong khi biểu đồ cần người xem dừng lại phân tích — thứ không ai
 * làm khi đang lướt. Dùng khi lời đọc nêu một số liệu đáng nhớ.
 *
 * Nhãn dạng "giá trị:diễn giải":
 *   "73%:Tin tuyển dụng 2026 yêu cầu AI"
 *   "3.5x:Nhanh hơn cách làm cũ"
 *   "12 triệu:Lương khởi điểm trung bình"
 *
 * Một mục → số khổng lồ giữa khung. Hai đến ba mục → xếp dọc, số vẫn to nhưng nhường
 * chỗ cho nhau. Quá 3 mục thì đây là widget sai — dùng bar-chart.
 */

interface Stat {
  prefix: string;
  value: number;
  /** Chữ số thập phân của giá trị gốc, để đếm lên không nhảy từ "3.5" thành "4". */
  decimals: number;
  suffix: string;
  caption: string;
}

/** "3.5x:Nhanh hơn" → { prefix:"", value:3.5, suffix:"x", caption:"Nhanh hơn" }. */
function parseStats(labels?: string[]): Stat[] {
  const src = labels?.length ? labels : ["73%:Lập trình viên đã dùng AI hằng ngày"];
  return src.slice(0, 3).map((raw) => {
    const [head, ...rest] = raw.split(":");
    const caption = rest.join(":").trim();
    const m = (head ?? "").match(/^(\D*?)([\d.,]+)(.*)$/);
    if (!m) return { prefix: "", value: 0, decimals: 0, suffix: (head ?? "").trim(), caption };
    const numRaw = m[2]!.replace(/,/g, ".");
    const dot = numRaw.indexOf(".");
    return {
      prefix: m[1]!.trim(),
      value: parseFloat(numRaw) || 0,
      decimals: dot < 0 ? 0 : numRaw.length - dot - 1,
      suffix: m[3]!.trim(),
      caption,
    };
  });
}

/**
 * Cỡ chữ của con số, tính để nó LẤP ĐẦY bề ngang thay vì đặt cứng một số px.
 *
 * Cần thiết vì giá trị dài ngắn rất khác nhau: "3x" chỉ 2 ký tự còn "1.250 tỷ" thì 9.
 * Đặt cứng một cỡ thì hoặc số ngắn bé tí giữa khung trống (đúng lỗi đang gặp: "73%"
 * chỉ chiếm 33% bề ngang), hoặc số dài tràn ra ngoài lề.
 *
 * `prefix`/`suffix` hiển thị ở nửa cỡ nên chỉ tính nửa trọng số. ADV là bề ngang trung
 * bình của một ký tự tính theo em — 0.62 lấy dư một chút so với chữ số mono thực tế
 * (~0.6) để dấu "." và "%" rộng hơn vẫn không đẩy số tràn lề.
 */
const ADV = 0.62;

function fitSize(stat: Stat, avail: number, solo: boolean): number {
  // Đo trên giá trị ĐÍCH, không phải giá trị đang đếm — nếu đo giá trị đang đếm thì
  // "7" rồi "73" sẽ ra hai cỡ khác nhau và con số co giật trong lúc đếm lên.
  const units =
    stat.value.toFixed(stat.decimals).length + stat.prefix.length * 0.5 + stat.suffix.length * 0.5;
  const raw = avail / (units * ADV);
  // Một mục thì cho phép rất to; nhiều mục phải nhường chỗ theo chiều dọc.
  const max = solo ? 400 : 150;
  const min = solo ? 150 : 90;
  return Math.round(Math.min(max, Math.max(min, raw)));
}

export const StatBig: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const stats = parseStats(labels);
  const solo = stats.length === 1;
  const { width } = useVideoConfig();
  // Bề ngang thật của cột nội dung — trừ đúng lề trang mà Col đang dùng.
  const avail = width - tokens.space.pagePadding * 2;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: solo ? 0 : 46,
        fontFamily: TEXT_STACK,
      }}
    >
      {stats.map((s, i) => (
        <Item key={i} stat={s} index={i} solo={solo} size={fitSize(s, avail, solo)} p={p} />
      ))}
    </div>
  );
};

const Item: React.FC<{ stat: Stat; index: number; solo: boolean; size: number; p: Palette }> = ({
  stat,
  index,
  solo,
  size,
  p,
}) => {
  const e = useEnter(4 + index * (BEAT.stagger + 2), { damping: 15, stiffness: 150, mass: 0.8 });
  const float = useDrift(index, 0.13) * (solo ? 4 : 2.5);
  const pulse = usePulse(0.3, index);

  // Số đếm lên cùng nhịp phóng to. Đếm xong thì con số "chốt" lại — mắt bắt được
  // khoảnh khắc dừng, đó là lúc giọng đọc vừa nói tới nó.
  const shown = (stat.value * Math.min(e, 1)).toFixed(stat.decimals);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: solo ? 18 : 8,
        transform: `translateY(${float}px)`,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "center",
          gap: 4,
          fontFamily: p.labelFont,
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1,
          // Giãn chữ theo cỡ, không phải hằng số: -4px ở cỡ 400 là không đáng kể, còn
          // ở cỡ 150 lại bóp chữ dính vào nhau.
          letterSpacing: Math.round(-size * 0.025),
          color: p.accent,
          // Quầng sáng thở quanh con số — chỉ ở theme tech, nơi glow là một phần
          // ngôn ngữ thị giác. Theme claude cố ý phẳng, thêm glow sẽ lạc tông.
          textShadow: isTech(p) ? `0 0 ${(30 + pulse * 34).toFixed(0)}px ${p.accentSoft}` : "none",
          transform: `scale(${interpolate(e, [0, 1], [0.55, 1])})`,
          opacity: interpolate(e, [0, 0.35], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {stat.prefix && <span style={{ fontSize: Math.round(size * 0.5) }}>{stat.prefix}</span>}
        {shown}
        {stat.suffix && <span style={{ fontSize: Math.round(size * 0.5) }}>{stat.suffix}</span>}
      </div>

      {stat.caption && (
        <div
          style={{
            fontSize: solo ? p.size.subhead : p.size.small,
            fontWeight: 600,
            color: p.textMuted,
            textAlign: "center",
            lineHeight: 1.25,
            maxWidth: "92%",
            // Diễn giải vào SAU con số: số đập vào mắt trước, chữ giải thích theo sau.
            opacity: interpolate(e, [0.5, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(e, [0.5, 1], [12, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          {stat.caption}
        </div>
      )}
    </div>
  );
};
