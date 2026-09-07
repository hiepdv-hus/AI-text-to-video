import React from "react";
import {
  Award, BookOpen, Bot, Boxes, Brain, Briefcase, Bug, Calendar, Check, CircleCheck, CircleX,
  Clock, Cloud, Code, Cpu, Database, DollarSign, Eye, FileCode, Filter, Flame, Gauge,
  GitBranch, Globe, GraduationCap, Layers, Lightbulb, Lock, MessageSquare, Monitor, Network,
  Package, Play, Rocket, Search, Send, Server, Settings, Shield, Smartphone, Star, Target,
  Terminal, TrendingDown, TrendingUp, TriangleAlert, User, Users, Wrench, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Palette } from "../../theme/claude";
import { EMOJI_FAMILY } from "../fontsEmoji";

/**
 * Icon.tsx — BẢNG ICON CÓ KIỂM SOÁT.
 *
 * Vì sao là bảng cố định chứ không phải "import icon nào cũng được": lucide có hơn 6000
 * icon. Cho spec gọi tự do thì (a) bundle phình, (b) agent sẽ đoán tên icon và trượt,
 * (c) mỗi video một bộ icon khác nhau — mất luôn tính đồng bộ mà cả hệ theme đang giữ.
 * Bảng ~50 icon dưới đây phủ đúng mảng nội dung đang làm: lập trình, AI, phỏng vấn,
 * nghề nghiệp, hạ tầng.
 *
 * Icon lucide là SVG dùng `currentColor` và `stroke` → tô theo Palette được, khác hẳn
 * emoji (màu cố định, không đổi theo theme). Emoji vẫn dùng được để tương thích ngược.
 *
 * CÚ PHÁP trong `labels` của spec:
 *   "@cpu Xử lý cục bộ"   → icon lucide tên "cpu"
 *   "🤖 Tự động"           → emoji (đường cũ, vẫn chạy)
 *   "Không có icon"        → không icon, widget tự đánh số
 */

const ICONS = {
  /* Lập trình */
  code: Code,
  terminal: Terminal,
  bug: Bug,
  file: FileCode,
  git: GitBranch,
  package: Package,
  layers: Layers,
  boxes: Boxes,
  /* Hạ tầng */
  cpu: Cpu,
  db: Database,
  server: Server,
  cloud: Cloud,
  network: Network,
  lock: Lock,
  shield: Shield,
  globe: Globe,
  mobile: Smartphone,
  monitor: Monitor,
  settings: Settings,
  wrench: Wrench,
  gauge: Gauge,
  /* AI */
  ai: Bot,
  brain: Brain,
  chat: MessageSquare,
  send: Send,
  /* Nhấn mạnh */
  zap: Zap,
  rocket: Rocket,
  flame: Flame,
  star: Star,
  award: Award,
  target: Target,
  play: Play,
  eye: Eye,
  search: Search,
  filter: Filter,
  /* Đúng / sai / cảnh báo */
  check: Check,
  "check-circle": CircleCheck,
  x: X,
  "x-circle": CircleX,
  warn: TriangleAlert,
  idea: Lightbulb,
  /* Nghề nghiệp */
  money: DollarSign,
  "trend-up": TrendingUp,
  "trend-down": TrendingDown,
  users: Users,
  user: User,
  clock: Clock,
  calendar: Calendar,
  book: BookOpen,
  grad: GraduationCap,
  work: Briefcase,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Tên icon hợp lệ — để studio.html và SKILL.md liệt kê mà không phải chép tay. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

const EMOJI_RE = /^(\p{Extended_Pictographic}️?)\s+(.*)$/u;
const TOKEN_RE = /^@([a-z0-9-]+)\s+(.*)$/i;

export interface ParsedLabel {
  /** Icon lucide, nếu nhãn mở đầu bằng "@tên" hợp lệ. */
  name?: IconName;
  /** Emoji, nếu nhãn mở đầu bằng emoji. */
  emoji?: string;
  /** Phần chữ còn lại. */
  text: string;
}

/**
 * Tách phần icon ra khỏi nhãn. Token "@tên" KHÔNG khớp bảng thì trả nguyên chuỗi làm
 * chữ — cố ý không ném lỗi: một icon gõ sai không đáng làm hỏng cả lần render, và
 * người dùng sẽ thấy ngay "@abc" hiện ra trong video nên tự sửa được.
 */
export function parseLabel(raw: string): ParsedLabel {
  const t = raw.match(TOKEN_RE);
  if (t) {
    const key = t[1]!.toLowerCase();
    if (key in ICONS) return { name: key as IconName, text: t[2]!.trim() };
    return { text: raw };
  }
  const e = raw.match(EMOJI_RE);
  if (e) return { emoji: e[1], text: e[2]!.trim() };
  return { text: raw };
}

/**
 * Glyph — vẽ phần icon đã tách. Trả `null` khi nhãn không có icon, để chỗ gọi tự quyết
 * định thay bằng gì (feature-cards thay bằng số thứ tự, checklist thì luôn có sẵn ✓/✗).
 *
 * `strokeWidth` 2.2 chứ không phải mặc định 2: khung 1080x1920 xem trên điện thoại,
 * nét 2 ở cỡ 40px trông mảnh và bị nhoè khi nén H.264.
 */
export const Glyph: React.FC<{
  parsed: ParsedLabel;
  size: number;
  color: string;
  p: Palette;
}> = ({ parsed, size, color, p }) => {
  if (parsed.name) {
    const Ico = ICONS[parsed.name];
    return <Ico size={size} color={color} strokeWidth={2.2} absoluteStrokeWidth />;
  }
  if (parsed.emoji) {
    // Emoji không nhận `color` — nó tự mang màu. Giữ nguyên, chỉ khớp cỡ.
    return <span style={{ fontFamily: EMOJI_FAMILY, fontSize: Math.round(size * 0.95), lineHeight: 1 }}>{parsed.emoji}</span>;
  }
  void p;
  return null;
};
