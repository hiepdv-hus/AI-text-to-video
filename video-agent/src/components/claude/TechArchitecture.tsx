import React from "react";
import { interpolate } from "remotion";
import { evolvePath } from "@remotion/paths";
import type { Palette } from "../../theme/claude";
import { cardSurface, isTech } from "../../theme/claude";
import { TEXT_STACK } from "../textStack";
import { BEAT, useDrift, useEnter, useSweep } from "../motion";
import { Glyph, parseLabel } from "./Icon";

/**
 * TechArchitecture — SƠ ĐỒ LUỒNG cho graphic.kind = "architecture".
 *
 * Dùng khi nội dung nói về một hệ thống có các thành phần NỐI VỚI NHAU: client → API →
 * database, hay pipeline xử lý. `steps` không thay được: steps đánh số 01/02/03 nên mô
 * tả "làm lần lượt", còn ở đây mũi tên mô tả "dữ liệu chảy từ đâu tới đâu".
 *
 * Nhãn — mỗi dòng là một TẦNG, dấu " + " đặt hai thành phần CÙNG tầng:
 *   "@mobile Client"
 *   "@server API Gateway"
 *   "@lock Auth + @cpu Cache"
 *   "@db PostgreSQL"
 *
 * Hai thành phần cùng tầng cố ý KHÔNG vẽ mũi tên rẽ nhánh chữ Y. Khung 9:16 quá hẹp,
 * nhánh chéo ở bề ngang 880px sẽ gần như nằm ngang và đọc ra thành "nối sang bên" chứ
 * không phải "rẽ xuống". Đặt cạnh nhau trong cùng một tầng đã đủ nói chúng ngang hàng.
 */

const CONN_W = 120;
const CONN_H = 54;
/** Đường nối: thẳng đứng, chừa chỗ cuối cho mũi tên. */
const LINE = `M ${CONN_W / 2} 2 L ${CONN_W / 2} 36`;

interface Tier {
  nodes: string[];
}

function parseTiers(labels?: string[]): Tier[] {
  const src = labels?.length ? labels : ["@mobile Client", "@server API", "@db Database"];
  return src.map((raw) => ({
    nodes: raw
      .split(/\s+\+\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2),
  }));
}

export const TechArchitecture: React.FC<{ labels?: string[]; p: Palette }> = ({ labels, p }) => {
  const tiers = parseTiers(labels);
  // Từ 4 tầng trở lên phải thu gọn, nếu không sơ đồ tràn xuống vùng phụ đề.
  const dense = tiers.length >= 4;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: TEXT_STACK,
      }}
    >
      {tiers.map((tier, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Connector delay={7 + i * (BEAT.stagger + 4)} dense={dense} p={p} />}
          <div style={{ display: "flex", gap: 16, width: "100%" }}>
            {tier.nodes.map((n, j) => (
              <Node key={j} raw={n} delay={4 + i * (BEAT.stagger + 4) + j * 3} index={i + j} dense={dense} p={p} />
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * Một thành phần. Icon trái + tên. Không đánh số — đánh số sẽ lại biến sơ đồ thành
 * danh sách các bước, đúng thứ widget này cố tránh.
 */
const Node: React.FC<{ raw: string; delay: number; index: number; dense: boolean; p: Palette }> = ({
  raw,
  delay,
  index,
  dense,
  p,
}) => {
  const e = useEnter(delay, { damping: 17, stiffness: 185, mass: 0.75 });
  const float = useDrift(index, 0.14) * 2.6;
  const parsed = parseLabel(raw);
  const box = dense ? 46 : 54;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: dense ? "18px 20px" : "24px 26px",
        ...cardSurface(p),
        opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${interpolate(e, [0, 1], [22, 0]) + float}px) scale(${interpolate(
          e,
          [0, 1],
          [0.92, 1],
        )})`,
      }}
    >
      <Glyph parsed={parsed} size={box} color={p.accent} p={p} />
      <div
        style={{
          fontSize: dense ? p.size.subhead : p.size.card,
          fontWeight: 650,
          color: p.text,
          lineHeight: 1.15,
          textAlign: "left",
        }}
      >
        {parsed.text}
      </div>
    </div>
  );
};

/**
 * Đường nối giữa hai tầng. Ba lớp chồng lên nhau:
 *   1. đường TỰ VẼ ra bằng evolvePath (dashoffset chạy về 0);
 *   2. mũi tên bật ra khi đường vẽ xong;
 *   3. chấm sáng chạy dọc đường, LẶP MÃI — đây là lớp "SỐNG", thứ khiến sơ đồ đọc ra
 *      là dữ liệu đang chảy chứ không phải hình vẽ tĩnh.
 *
 * SVG cố định 120px và căn giữa (không phải width:100%): viewBox co giãn theo bề ngang
 * container sẽ kéo méo nét vẽ và đầu mũi tên.
 */
const Connector: React.FC<{ delay: number; dense: boolean; p: Palette }> = ({ delay, dense, p }) => {
  const e = useEnter(delay, { damping: 22, stiffness: 120, mass: 0.9 });
  const arrow = useEnter(delay + 8, BEAT.pop);
  const flow = useSweep(1.9);

  const { strokeDasharray, strokeDashoffset } = evolvePath(e, LINE);
  const h = dense ? CONN_H - 14 : CONN_H;
  const cx = CONN_W / 2;
  const dotY = interpolate(flow, [0, 1], [4, 34]);

  return (
    <svg width={CONN_W} height={h} viewBox={`0 0 ${CONN_W} ${CONN_H}`} style={{ flex: "none", overflow: "visible" }}>
      <path
        d={LINE}
        fill="none"
        stroke={p.accent}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.5}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
      />
      {/* Chấm sáng chạy — chỉ hiện sau khi đường đã vẽ xong. */}
      <circle
        cx={cx}
        cy={dotY}
        r={5}
        fill={p.accent}
        opacity={e > 0.98 ? interpolate(flow, [0, 0.12, 0.88, 1], [0, 1, 1, 0]) : 0}
        style={{ filter: isTech(p) ? `drop-shadow(0 0 6px ${p.accent})` : undefined }}
      />
      <polygon
        points={`${cx - 9},36 ${cx + 9},36 ${cx},50`}
        fill={p.accent}
        opacity={interpolate(arrow, [0, 1], [0, 0.85])}
        transform={`translate(${cx} 43) scale(${interpolate(arrow, [0, 1], [0.3, 1])}) translate(${-cx} -43)`}
      />
    </svg>
  );
};
