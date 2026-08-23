import { ImageResponse } from "next/og";
import { getPublishedProof } from "../../proof-data";

export const alt = "Base Attribution OS proof report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ImageProps = { params: Promise<{ code: string }> };

export default async function Image({ params }: ImageProps) {
  const { code } = await params;
  const proof = getPublishedProof(code);
  const coverage = proof?.coverage ?? 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fbfbfa",
        color: "#111111",
        padding: "64px 72px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>Base Attribution OS</div>
        <div style={{ display: "flex", color: "#787774", fontSize: 22 }}>Attribution Proof</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", color: "#787774", fontSize: 24 }}>BUILDER CODE</div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700 }}>{code}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28 }}>
          <span style={{ color: proof ? "#346538" : "#956400" }}>
            {proof ? "VERIFIED ON BASE" : "PROOF NOT PUBLISHED"}
          </span>
          <span style={{ color: "#787774" }}>·</span>
          <span>{coverage}% coverage</span>
        </div>
      </div>
      <div style={{ display: "flex", color: "#0052ff", fontSize: 22 }}>
        Source → CI → Mainnet → Proof
      </div>
    </div>,
    size,
  );
}
