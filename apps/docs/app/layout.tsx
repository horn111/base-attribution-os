import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Base Attribution OS",
  description: "Live scanner demo for Base Builder Code attribution in SDKs and CI.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
