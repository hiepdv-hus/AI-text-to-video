import React from "react";
import { AbsoluteFill } from "remotion";
import type { Palette } from "../theme/claude";

/**
 * ClaudeBackground — nền Claude: gradient ấm rất nhẹ + một quầng sáng cam mờ tinh tế
 * ở góc trên. Không hoạ tiết ồn ào — giữ tối giản, để nội dung dẫn dắt.
 */
export const ClaudeBackground: React.FC<{ palette: Palette }> = ({ palette }) => {
  return (
    <AbsoluteFill style={{ background: palette.bgGradient }}>
      {/* Quầng cam rất mờ — thêm hơi ấm, không lấn nội dung */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 40% at 78% 12%, ${palette.accentSoft}, transparent 70%)`,
        }}
      />
      {/* Viền tối/sáng nhẹ 4 mép cho chiều sâu tinh tế */}
      <AbsoluteFill
        style={{
          boxShadow: palette.isDark
            ? "inset 0 0 220px rgba(0,0,0,0.28)"
            : "inset 0 0 220px rgba(120,100,70,0.10)",
        }}
      />
    </AbsoluteFill>
  );
};
