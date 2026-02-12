import { ImageResponse } from "next/og";

export const alt = "GitPreflight PR reviews before commit and push";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #111827 45%, #1f2937 100%)",
          color: "#f8fafc",
          padding: "64px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: 28, opacity: 0.95 }}>
          <div
            style={{
              display: "flex",
              height: "12px",
              width: "12px",
              borderRadius: "9999px",
              background: "#34d399",
            }}
          />
          GitPreflight
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1000px" }}>
          <div style={{ fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.02em", fontWeight: 700 }}>
            PR-quality reviews before every commit and push.
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.3, color: "#cbd5e1" }}>
            Feedback goes straight back into your coding agent.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#93c5fd" }}>
          <div>gitpreflight.ai</div>
          <div>Result: PASS</div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
