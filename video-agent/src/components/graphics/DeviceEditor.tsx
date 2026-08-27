import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../../theme/tokens";
import { TEXT_STACK } from "../textStack";
import { NeonGear } from "./NeonGear";

/**
 * DeviceEditor — laptop viền neon với timeline biên tập (track V1/V2/AU + playhead
 * chạy) và cụm bánh răng quay, minh hoạ ý "xử lý cục bộ / biên tập ngay trên máy".
 */

const N = tokens.neon;

const Track: React.FC<{
  label: string;
  color: string;
  blocks: Array<[number, number]>; // [left%, width%]
}> = ({ label, color, blocks }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, height: 30 }}>
    <div
      style={{
        width: 34,
        fontSize: 13,
        color: "rgba(201,190,234,0.7)",
        fontWeight: tokens.weight.semibold,
        border: "1px solid rgba(148,120,255,0.25)",
        borderRadius: 5,
        textAlign: "center",
        padding: "3px 0",
      }}
    >
      {label}
    </div>
    <div style={{ position: "relative", flex: 1, height: "100%" }}>
      {blocks.map(([l, w], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${l}%`,
            width: `${w}%`,
            top: 4,
            bottom: 4,
            borderRadius: 5,
            background: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
      ))}
    </div>
  </div>
);

export const DeviceEditor: React.FC<{ timecode?: string }> = ({ timecode = "00:02:17" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const playX = interpolate(Math.sin(t * 0.5), [-1, 1], [8, 92]); // playhead chạy tới lui

  return (
    <div style={{ width: "100%", fontFamily: TEXT_STACK, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Màn hình laptop */}
      <div
        style={{
          width: "94%",
          borderRadius: 20,
          border: "2px solid rgba(120,180,255,0.62)",
          background: "#0A0C18",
          boxShadow: `${N.cardShadow}, 0 0 40px rgba(80,140,255,0.22)`,
          padding: 20,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 14, right: 20, fontSize: 20, color: "#8fb8ff", fontFamily: TEXT_STACK }}>
          {timecode}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 30, position: "relative" }}>
          <Track label="V1" color="#4aa3ff" blocks={[[0, 22], [26, 20], [50, 24]]} />
          <Track label="V2" color={N.purple} blocks={[[2, 40], [46, 30]]} />
          {/* Track audio: các vạch waveform */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 30 }}>
            <div
              style={{
                width: 34,
                fontSize: 13,
                color: "rgba(201,190,234,0.7)",
                fontWeight: tokens.weight.semibold,
                border: "1px solid rgba(148,120,255,0.25)",
                borderRadius: 5,
                textAlign: "center",
                padding: "3px 0",
              }}
            >
              AU
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, height: "100%" }}>
              {Array.from({ length: 26 }, (_, i) => {
                const hh = 6 + Math.abs(Math.sin(i * 1.7)) * 20;
                return <div key={i} style={{ flex: 1, height: hh, background: "#3fe0d0", opacity: 0.8, borderRadius: 2 }} />;
              })}
            </div>
          </div>
          {/* Playhead đỏ chạy */}
          <div
            style={{
              position: "absolute",
              top: -6,
              bottom: -6,
              left: `${8 + playX * 0.9}%`,
              width: 2,
              background: "#ff4d5e",
              boxShadow: "0 0 8px #ff4d5e",
            }}
          >
            <div style={{ position: "absolute", top: -6, left: -4, width: 10, height: 10, borderRadius: "50% 50% 50% 0", background: "#ff4d5e" }} />
          </div>
        </div>
      </div>

      {/* Đế laptop */}
      <div
        style={{
          width: "100%",
          height: 26,
          marginTop: -2,
          borderRadius: "0 0 26px 26px",
          border: "2px solid rgba(120,180,255,0.62)",
          borderTop: "none",
          background: "#0C0E1C",
        }}
      />

      {/* Cụm bánh răng quay, đè lên bản lề */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: -70 }}>
        <div style={{ marginBottom: -30 }}>
          <NeonGear size={90} angle={t * 60} teeth={9} color="#3fe0d0" glow="rgba(63,224,208,0.7)" />
        </div>
        <NeonGear size={140} angle={-t * 45} teeth={11} color={N.purpleBright} glow={N.glowPurple}>
          <span style={{ color: "#ffd34d" }}>⚡</span>
        </NeonGear>
        <div style={{ marginBottom: -30 }}>
          <NeonGear size={96} angle={t * 50} teeth={10} color={N.purple} glow={N.glowPurple} />
        </div>
      </div>
    </div>
  );
};
