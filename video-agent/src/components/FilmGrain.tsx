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
 *
 * ------------------------------------------------------------------------------------
 * VÌ SAO KHÔNG DÙNG `mixBlendMode: overlay`
 *
 * Bản trước là MỘT lớp nhiễu xám phủ `mixBlendMode: overlay`. Overlay đúng về lý thuyết
 * (giữ nguyên màu đen tuyệt đối) nhưng nó là blend-mode: Chrome phải raster TOÀN BỘ cây
 * bên dưới ra texture rồi chạy một lượt trộn trên 2 triệu pixel, MỖI FRAME.
 *
 * Bản này đạt cùng hiệu ứng bằng HAI lớp hạt trộn thường (normal): hạt ĐEN và hạt TRẮNG
 * chồng khít nhau, alpha lấy từ cùng một trường nhiễu với hệ số góc trái dấu. Sáng lên
 * chỗ này, tối đi chỗ kia — đúng cái overlay làm — mà Chrome chỉ phải chồng hai ảnh mờ,
 * không có lượt đọc-lại-nền nào.
 *
 * Đo trên 150 frame cảnh đồ hoạ (mọi tối ưu khác giữ nguyên, chỉ đổi lớp hạt này):
 *     overlay   90 ms/frame · file 1.58 MB
 *     bản này   72 ms/frame · file 1.79 MB
 * và biên độ hạt lệch dưới 0.35 dB, độ sáng trung bình lệch dưới 0.2/255 ở cảnh tối.
 *
 * Khác biệt còn lại: overlay tự GIẢM hạt ở vùng tối (nhân với độ sáng nền), còn trộn
 * thường thì rải đều tay. Vì thế `opacity` ở đây (0.04) thấp hơn hẳn bản overlay (0.055)
 * — dò cho khớp hạt ở VÙNG TỐI, nơi các theme dành gần hết diện tích và cũng là nơi cần
 * hạt để chống banding. Đổi lại vùng sáng (cảnh quay) hạt hơi nhẹ hơn bản cũ một chút.
 * Đừng nâng `opacity` lên nếu chưa đo lại bitrate: hạt là thứ tốn bit nhất trong khung
 * hình, nâng lên 0.14 là file phình gấp 6 lần.
 */

/**
 * Một ô nhiễu 180x180, lặp kín khung.
 *
 * `color-interpolation-filters='sRGB'`: mặc định SVG lọc trong linearRGB, làm nhiễu dồn
 * hết về một đầu → hạt vón cục. Ép sRGB cho phân bố đều.
 *
 * feColorMatrix đặt RGB thành hằng số (đen hoặc trắng) và ĐẨY NHIỄU VÀO ALPHA bằng một
 * hàm bậc nhất có chặn: alpha = clamp(slope × n + offset), với n là kênh đỏ của nhiễu
 * (phân bố quanh 0.5).
 *
 * Hai lớp dùng CÙNG một kênh nhiễu với hệ số góc trái dấu, nên chúng BÙ TRỪ nhau: pixel
 * nào lớp trắng chạm tới thì lớp đen không, và ngược lại — đúng cấu trúc mà overlay tạo
 * ra. Cố ý KHÔNG dùng `feFuncA gamma` để tạo đốm thưa sắc nét: đốm như thế nhìn vẫn ra
 * hạt phim nhưng H.264 rất tốn bit cho nó (thử rồi: cả video phình 16 → 23 MB). Dốc
 * thoai thoải cho ra hạt mịn, đúng chất bản cũ, và bộ nén nuốt trôi.
 */
const noiseTile = (rgb: 0 | 1, slope: number, offset: number): string => {
  const rgbRow = `0 0 0 0 ${rgb}`;
  return encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>` +
      `<filter id='n' color-interpolation-filters='sRGB'>` +
      `<feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>` +
      `<feColorMatrix type='matrix' values='${rgbRow} ${rgbRow} ${rgbRow} ${slope} 0 0 0 ${offset}'/>` +
      `</filter>` +
      `<rect width='180' height='180' filter='url(#n)'/></svg>`,
  );
};

/**
 * Lớp TỐI dốc hơn lớp SÁNG là cố ý. Nền của các theme đều tối, nên hạt trắng có nhiều
 * "chỗ trống" để nâng sáng còn hạt đen thì gần như không còn gì để làm tối thêm — để hai
 * lớp đối xứng thì cả khung bị nâng lên (đo được +2.5/255 ở cảnh tối). Hai cặp số dưới
 * đây được dò cho tới khi độ sáng trung bình khớp lại bản dùng `mixBlendMode: overlay`
 * (lệch còn +0.16 và −0.09 trên hai frame cảnh đồ hoạ đem đo).
 */
const DARK = `url("data:image/svg+xml,${noiseTile(0, -2.4, 1.2)}")`;
const LIGHT = `url("data:image/svg+xml,${noiseTile(1, 1.8, -0.9)}")`;

export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => {
  const frame = useCurrentFrame();
  // Hai lớp phải nằm CHỒNG KHÍT: chúng lấy từ cùng một kênh nhiễu với hệ số góc trái dấu
  // nên chỉ bù trừ đúng khi ở cùng vị trí. Lệch nhau là thành hai trường nhiễu độc lập,
  // chỗ nào cả hai cùng phủ sẽ xám lại.
  const x = (frame * 37) % 180;
  const y = (frame * 61) % 180;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `${DARK}, ${LIGHT}`,
        backgroundRepeat: "repeat, repeat",
        backgroundPosition: `${x}px ${y}px, ${x}px ${y}px`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
