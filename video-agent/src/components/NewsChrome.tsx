import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BuiltScene, Meta } from "../schema";
import { useTheme, type Palette } from "../theme/claude";
import { safeArea, tokens } from "../theme/tokens";
import { TEXT_STACK } from "./textStack";
import { MONO_FAMILY } from "./fontsMono";
import { BEAT, useEnter } from "./motion";

/**
 * NewsChrome — lớp GIAO DIỆN BÁO phủ lên video kiểu "Từ bài báo"
 * (`meta.visualStyle: "article"`).
 *
 * Lý do tồn tại: kiểu "photo" cố ý KHÔNG vẽ gì ngoài ảnh gốc + phụ đề, nên video dựng từ
 * một bài báo trông y hệt một slideshow ảnh — người xem không biết đang xem bài của báo
 * nào, ảnh chụp ai, nguồn ở đâu. Những dữ liệu đó `article.ts` đã bóc sẵn từ trang báo;
 * lớp này là đường đưa chúng lên màn hình.
 *
 * Chia làm HAI phần vì chúng sống ở hai nhịp khác nhau:
 *   - `NewsBar`   — măng sét + vạch tiến trình, vẽ MỘT LẦN ở VideoComposition, đứng yên
 *                   suốt video (frame ở đó là frame TỔNG, vạch tiến trình mới chạy đúng).
 *   - `NewsSceneChrome` — phần đổi theo từng cảnh (tiêu đề bài, chú thích ảnh, dòng
 *                   nguồn), vẽ trong SceneWrapper, nơi frame đếm lại từ 0 mỗi cảnh nên
 *                   hiệu ứng vào khớp với cảnh.
 *
 * Mọi thứ ở đây `pointerEvents: none` và không nhận tương tác — đây là lớp nhìn, không
 * phải lớp nội dung. Nội dung vẫn nằm hết trong `narration` như kiểu "photo".
 */

export type ArticleInfo = NonNullable<Meta["article"]>;

/**
 * Thông tin bài báo cho các component nằm sâu bên dưới (SceneWrapper → NewsSceneChrome).
 * Dùng context thay vì luồn prop qua 3 tầng: SceneWrapper đã nhận 5 prop, và quên luồn ở
 * một nhánh là cảnh đó mất măng sét trong khi cảnh khác vẫn có — lỗi khó thấy khi xem.
 */
export const ArticleContext = React.createContext<ArticleInfo | undefined>(undefined);
export const useArticle = () => React.useContext(ArticleContext);

/** Chữ quá dài thì cắt ở RANH GIỚI TỪ rồi thêm "…" — cắt giữa từ đọc ra rất nghiệp dư. */
function clamp(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/* -------------------------------- Măng sét ------------------------------- */

/**
 * NewsBar — thanh trên cùng: khối màu mang tên báo + ngày đăng + vạch tiến trình.
 *
 * `progress` là tiến độ của CẢ video (0→1), do VideoComposition truyền vào. Vạch này làm
 * hai việc: ra dáng bản tin, và cho người xem biết còn bao lâu — video từ bài báo dài
 * 2–3 phút, dài gấp ba video ngắn thường, nên tín hiệu "sắp hết" là thứ giữ chân thật sự.
 */
export const NewsBar: React.FC<{ article: ArticleInfo; height: number; progress: number }> = ({
  article,
  height,
  progress,
}) => {
  const p = useTheme();
  const sa = safeArea(height);
  const pad = Math.round(tokens.space.pagePadding * 0.6);
  const top = Math.round(sa.top * 0.5);

  return (
    <AbsoluteFill style={{ fontFamily: TEXT_STACK, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top, left: pad, right: pad }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* Khối tên báo — đặc, màu nhấn: đây là thứ người xem nhận ra trong 1 giây. */}
          <div
            style={{
              padding: "10px 22px",
              borderRadius: p.radius.sm,
              background: p.accentGradient,
              color: p.onAccent,
              fontSize: 34,
              fontWeight: tokens.weight.black,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
            }}
          >
            {article.siteName}
          </div>
          <div style={{ flex: 1 }} />
          {article.publishedAt && (
            <div
              style={{
                fontFamily: MONO_FAMILY,
                fontSize: 28,
                color: "rgba(255,255,255,0.86)",
                textShadow: "0 2px 10px rgba(0,0,0,0.75)",
                letterSpacing: 0.4,
              }}
            >
              {article.publishedAt}
            </div>
          )}
        </div>

        {/* Vạch tiến trình — mảnh, ngay dưới măng sét. */}
        <div
          style={{
            marginTop: 14,
            height: 6,
            borderRadius: 999,
            background: "rgba(255,255,255,0.22)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(1, Math.max(0, progress)) * 100}%`,
              height: "100%",
              background: p.accentGradient,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------- Phần theo từng cảnh ------------------------- */

/** Nền mờ cho chữ nằm trên ảnh gốc — ảnh báo sáng tối khác nhau, không có nền là mất chữ. */
const plate = (p: Palette): React.CSSProperties => ({
  background: p.isDark ? "rgba(14,13,11,0.74)" : "rgba(252,251,248,0.82)",
  border: `1px solid ${p.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)"}`,
  borderRadius: p.radius.md,
  backdropFilter: "blur(10px)",
  boxShadow: "0 16px 40px rgba(0,0,0,0.34)",
});

/**
 * Khối TIÊU ĐỀ BÀI ở cảnh mở — khoảnh khắc "trang nhất".
 *
 * Neo ở 30% tính từ đáy: phụ đề bắt đầu ở 17% và khi tràn hai dòng chỉ cao tới ~25%, nên
 * hai lớp chữ không bao giờ chồng nhau. Đặt cao hơn (giữa khung) thì khối chữ hay rơi
 * đúng vào MẶT người trong ảnh báo — ảnh báo gần như luôn lấy người làm trung tâm.
 */
const Headline: React.FC<{ article: ArticleInfo; p: Palette; onVideo: boolean }> = ({ article, p, onVideo }) => {
  const e = useEnter(4, BEAT.pop);
  const pad = Math.round(tokens.space.pagePadding * 0.6);
  return (
    <div
      style={{
        position: "absolute",
        left: pad,
        right: pad,
        bottom: onVideo ? "56%" : "30%",
        opacity: e,
        transform: `translateY(${interpolate(e, [0, 1], [26, 0]).toFixed(1)}px)`,
      }}
    >
      <div style={{ ...plate(p), padding: "30px 34px", borderLeft: `10px solid ${p.accent}` }}>
        <div
          style={{
            fontSize: 30,
            fontWeight: tokens.weight.bold,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: p.accent,
            marginBottom: 12,
          }}
        >
          {article.source ? `${article.siteName} · theo ${article.source}` : article.siteName}
        </div>
        <div
          style={{
            fontSize: 58,
            lineHeight: 1.18,
            fontWeight: tokens.weight.black,
            color: p.text,
          }}
        >
          {clamp(article.title, 120)}
        </div>
        {article.sapo && (
          <div style={{ marginTop: 16, fontSize: 32, lineHeight: 1.35, color: p.textMuted }}>
            {clamp(article.sapo, 150)}
          </div>
        )}
      </div>
    </div>
  );
};

/** Chú thích ảnh của bài — dải mảnh ngay trên vùng phụ đề. */
const PhotoCaption: React.FC<{ text: string; p: Palette }> = ({ text, p }) => {
  const e = useEnter(8, BEAT.enter);
  const pad = Math.round(tokens.space.pagePadding * 0.6);
  return (
    <div
      style={{
        position: "absolute",
        left: pad,
        right: pad,
        bottom: "29%",
        display: "flex",
        justifyContent: "flex-start",
        opacity: e * 0.96,
        transform: `translateY(${interpolate(e, [0, 1], [14, 0]).toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          ...plate(p),
          padding: "16px 24px",
          borderLeft: `6px solid ${p.accent}`,
          fontSize: 30,
          lineHeight: 1.3,
          color: p.text,
          maxWidth: "100%",
        }}
      >
        {clamp(text, 140)}
      </div>
    </div>
  );
};

/** Dòng nguồn ở cảnh kết — credit phải NHÌN THẤY, không chỉ nằm trong lời đọc. */
const SourceCard: React.FC<{ article: ArticleInfo; p: Palette; onVideo: boolean }> = ({ article, p, onVideo }) => {
  const e = useEnter(6, BEAT.pop);
  const pad = Math.round(tokens.space.pagePadding * 0.6);
  const host = (article.url ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  return (
    <div
      style={{
        position: "absolute",
        left: pad,
        right: pad,
        bottom: onVideo ? "56%" : "30%",
        opacity: e,
        transform: `translateY(${interpolate(e, [0, 1], [22, 0]).toFixed(1)}px)`,
      }}
    >
      <div style={{ ...plate(p), padding: "26px 32px", display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            padding: "8px 18px",
            borderRadius: p.radius.sm,
            background: p.accentGradient,
            color: p.onAccent,
            fontSize: 28,
            fontWeight: tokens.weight.black,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Nguồn
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 38, fontWeight: tokens.weight.bold, color: p.text }}>
            {article.source ? `${article.siteName} (theo ${article.source})` : article.siteName}
          </div>
          {host && (
            <div style={{ fontFamily: MONO_FAMILY, fontSize: 26, color: p.textMuted, marginTop: 6 }}>{host}</div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * NewsSceneChrome — phần giao diện báo ĐỔI THEO CẢNH.
 *
 * Chọn theo `layout` chứ không theo chỉ số cảnh: lint đã buộc cảnh đầu là `hook` và cảnh
 * cuối là `cta`, nên layout đã mang đúng thông tin "mở / giữa / kết" mà không cần đếm.
 */
export const NewsSceneChrome: React.FC<{ scene: BuiltScene }> = ({ scene }) => {
  const p = useTheme();
  const article = useArticle();
  const frame = useCurrentFrame();
  // Cảnh mở: khối tiêu đề lùi đi sau vài giây, trả màn hình lại cho ảnh — để nguyên
  // đến hết cảnh thì nửa khung hình bị một khối chữ tĩnh chiếm suốt 10 giây.
  const fadeTitle = interpolate(frame, [110, 140], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  /**
   * Cảnh chạy CLIP thì phụ đề lời kể đã bị đẩy lên 44% để tránh phụ đề cháy sẵn của clip
   * (xem SceneWrapper). Khối tiêu đề/nguồn neo ở 30% sẽ cao tới ~48% — tức là đâm thẳng
   * vào chỗ phụ đề vừa dọn đến. Nhường lên 56% cho cả hai lớp cùng đọc được.
   */
  const onVideo = scene.media?.kind === "video";
  if (!article) return null;

  return (
    <AbsoluteFill style={{ fontFamily: TEXT_STACK, pointerEvents: "none" }}>
      {scene.layout === "hook" && (
        <div style={{ opacity: fadeTitle, position: "absolute", inset: 0 }}>
          <Headline article={article} p={p} onVideo={onVideo} />
        </div>
      )}
      {scene.layout === "cta" && <SourceCard article={article} p={p} onVideo={onVideo} />}
      {scene.layout !== "hook" && scene.layout !== "cta" && scene.media?.caption && (
        <PhotoCaption text={scene.media.caption} p={p} />
      )}
    </AbsoluteFill>
  );
};
