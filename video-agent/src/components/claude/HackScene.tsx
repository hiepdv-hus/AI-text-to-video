import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { BuiltScene } from "../../schema";
import { MONO_FAMILY } from "../fontsMono";
import { useTheme } from "../../theme/claude";

/**
 * HackScene — layout "hack": MÀN HÌNH CODE ĐANG CHẢY kiểu "AI hack/viết cả hệ thống".
 * Full-frame, thuần HTML/CSS (không 3D): terminal chiếm trọn khung, code hiện dần theo kiểu
 * gõ máy + tự cuộn, số dòng đếm lên, con trỏ nhấp nháy, scanline + vignette cho chất hacking.
 * Lấp đầy khung, không khoảng trắng thừa — hợp nội dung "AI viết code/chiếm hệ thống".
 *
 * Nội dung code lấy từ `scene.code` (mỗi dòng \n). Tô màu bằng tokenizer nhẹ (client-side),
 * không phụ thuộc pipeline.
 */

interface Span { t: string; c: string }

const CODE_COLORS = {
  comment: "#4f6b62",
  string: "#8CE8B0",
  keyword: "#56C7F5",
  number: "#E9A176",
  fn: "#B98CFF",
  def: "#C9D6D0",
};
const KEYWORDS = new Set([
  "const", "let", "var", "function", "async", "await", "return", "import", "export", "from",
  "if", "else", "for", "while", "new", "class", "type", "interface", "extends", "try", "catch",
  "throw", "default", "public", "private", "app", "router",
]);

/** Tách một dòng code thành các span có màu (đơn giản, đủ đẹp). */
function tokenize(line: string): Span[] {
  if (line.trimStart().startsWith("//")) return [{ t: line, c: CODE_COLORS.comment }];
  const spans: Span[] = [];
  const re = /(["'`][^"'`]*["'`])|([A-Za-z_$][\w$]*)|(\d+)|(\s+)|([^\w\s])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) spans.push({ t: m[1], c: CODE_COLORS.string });
    else if (m[2]) spans.push({ t: m[2], c: KEYWORDS.has(m[2]) ? CODE_COLORS.keyword : CODE_COLORS.def });
    else if (m[3]) spans.push({ t: m[3], c: CODE_COLORS.number });
    else if (m[4]) spans.push({ t: m[4], c: CODE_COLORS.def });
    else spans.push({ t: m[5]!, c: "#7f9a92" });
  }
  return spans;
}

const DEFAULT_CODE = [
  "// ai_agent: building entire system…",
  "import express from 'express'",
  "import jwt from 'jsonwebtoken'",
  "",
  "const app = express()",
  "",
  "app.post('/auth/login', async (req, res) => {",
  "  const { user, pass } = req.body",
  "  if (!user || !pass) return res.status(400)",
  "  const token = signAccess(user)",
  "  const refresh = signRefresh(user)",
  "  return res.json({ token, refresh })",
  "})",
  "",
  "function signAccess(u) {",
  "  return jwt.sign({ u }, SECRET, { expiresIn: '15m' })",
  "}",
  "",
  "app.listen(3000, () => log('system online'))",
];

const GHOST = "#20313a"; // màu code CHƯA viết (mờ sẵn) → khung luôn đầy

export const HackScene: React.FC<{ scene: BuiltScene; height: number }> = ({ scene, height }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = useTheme();
  const lines = scene.code ? scene.code.split("\n") : DEFAULT_CODE;

  // Kích thước theo chiều cao khung → LẤP ĐẦY: số dòng thấy được lấp trọn vùng code.
  const TOP = 100;
  const areaH = height - TOP - Math.round(height * 0.19); // chừa đáy cho phụ đề
  const VISIBLE = 14;
  const LINE_H = Math.floor(areaH / VISIBLE);
  const FS = Math.min(38, Math.round(LINE_H * 0.4));

  // Gõ dần: số ký tự hiện ra theo thời gian (nhanh, kiểu AI phun code).
  const totalChars = lines.reduce((n, l) => n + l.length + 1, 0);
  const cps = Math.max(45, totalChars / Math.max(1.4, durationInFrames / fps - 0.5));
  const revealed = Math.min(totalChars, (frame / fps) * cps);

  let acc = 0;
  let curLine = lines.length - 1;
  let curCol = lines[curLine]!.length;
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i]!.length + 1;
    if (revealed < acc + len) {
      curLine = i;
      curCol = Math.max(0, Math.floor(revealed - acc));
      break;
    }
    acc += len;
  }

  // Tự cuộn khi dòng đang gõ vượt quá vùng thấy.
  const scroll = Math.max(0, curLine - (VISIBLE - 3)) * LINE_H;
  const cursorOn = Math.floor(frame / (fps * 0.4)) % 2 === 0;
  const lineCount = curLine + 1;

  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 0%, #0a1620 0%, #05080d 60%, #02040a 100%)" }}>
      {/* Thanh terminal trên cùng */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "28px 34px",
          fontFamily: MONO_FAMILY,
          borderBottom: `1px solid ${p.hairline}`,
        }}
      >
        <span style={{ display: "flex", gap: 9 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 16, height: 16, borderRadius: 999, background: c }} />
          ))}
        </span>
        <span style={{ color: p.textMuted, fontSize: 26, letterSpacing: 0.5 }}>
          ai_agent — {scene.heading || "building entire system"}
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 24,
            fontWeight: 700,
            color: p.accent,
            border: `1px solid ${p.accent}`,
            borderRadius: 999,
            padding: "6px 16px",
            boxShadow: cursorOn ? `0 0 18px ${p.accentSoft}` : "none",
          }}
        >
          <span style={{ width: 12, height: 12, borderRadius: 999, background: p.accent, opacity: cursorOn ? 1 : 0.3 }} />
          AI ĐANG VIẾT
        </span>
      </div>

      {/* Vùng code — LẤP ĐẦY: mọi dòng hiện sẵn (mờ), phần AI đã viết thì sáng màu. */}
      <div style={{ position: "absolute", top: TOP, left: 0, right: 0, height: areaH, overflow: "hidden" }}>
        <div style={{ transform: `translateY(${-scroll}px)`, fontFamily: MONO_FAMILY, fontSize: FS, lineHeight: `${LINE_H}px` }}>
          {lines.map((line, i) => {
            const written = i < curLine;
            const typing = i === curLine;
            const revealedText = written ? line : typing ? line.slice(0, curCol) : "";
            const ghostText = written ? "" : typing ? line.slice(curCol) : line;
            return (
              <div key={i} style={{ display: "flex", height: LINE_H, alignItems: "center", padding: "0 34px" }}>
                <span style={{ width: 58, color: written || typing ? "#4b6069" : "#2b3940", fontSize: Math.round(FS * 0.7), textAlign: "right", marginRight: 22, flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ whiteSpace: "pre", minWidth: 0 }}>
                  {tokenize(revealedText).map((s, j) => (
                    <span key={j} style={{ color: s.c }}>{s.t}</span>
                  ))}
                  {typing && (
                    <span style={{ display: "inline-block", width: FS * 0.4, height: FS * 0.9, marginLeft: 2, background: p.accent, opacity: cursorOn ? 1 : 0, verticalAlign: "middle", boxShadow: `0 0 12px ${p.accent}` }} />
                  )}
                  {ghostText && <span style={{ color: GHOST }}>{ghostText}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Số dòng đếm lên — góc phải dưới */}
      <div
        style={{
          position: "absolute",
          right: 32,
          bottom: "23%",
          fontFamily: MONO_FAMILY,
          fontSize: 28,
          fontWeight: 800,
          color: p.accent,
          textShadow: `0 0 20px ${p.accentSoft}`,
        }}
      >
        {lineCount * 27}+ dòng
      </div>

      {/* Scanline + vignette cho chất hacking */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.22) 4px)",
          opacity: 0.5,
        }}
      />
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(0,0,0,0.6) 100%)" }} />
      {/* Scrim đáy cho phụ đề */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "linear-gradient(180deg, transparent 62%, rgba(2,4,10,0.85) 100%)" }} />
    </AbsoluteFill>
  );
};
