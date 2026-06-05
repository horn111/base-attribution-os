import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Base Attribution OS",
  description: "Builder Code attribution helpers, validation, and CI for Base.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
