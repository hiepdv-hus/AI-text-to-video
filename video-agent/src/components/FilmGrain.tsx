import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * FilmGrain — lớp hạt nhiễu phủ toàn khung.
 *
 * Vì sao đáng có: nền tối phẳng (gradient lớn, mảng đen) khi nén H.264 sẽ bị BANDING —
 * các vòng sọc màu ở chỗ chuyển sắc. Một lớp hạt rất mảnh phá vỡ dải màu đó, và tiện thể
 * cho hình cái "chất phim" mà nền vector thuần không bao giờ có.
 *
 * Hạt phải ĐỘNG. Hạt đứng yên trông như bụi bám ống kính; hạt đổi mỗi frame mới ra
 * nhiễu phim. Ở đây dịch vị trí ảnh nền theo số frame với hai bước nhảy nguyên tố khác
 * nhau, nên mẫu hạt không lặp lại trong thực tế.
 */

// feTurbulence sinh nhiễu ngay trong SVG — nhúng inline nên không cần tải file ngoài
// (asset ngoài sẽ phải delayRender, và ở đây thì thừa).
const NOISE = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter>` +
    `<rect width='180' height='180' filter='url(#n)'/></svg>`,
);

export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.055 }) => {
  const frame = useCurrentFrame();
  const x = (frame * 37) % 180;
  const y = (frame * 61) % 180;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("data:image/svg+xml,${NOISE}")`,
        backgroundRepeat: "repeat",
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        // overlay: hạt sáng lên chỗ tối, tối đi chỗ sáng — giống grain thật, khác hẳn
        // kiểu phủ trắng đều làm bạc màu cả khung.
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
