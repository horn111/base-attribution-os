import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Base Attribution OS - Attribution Doctor",
  description:
    "Audit Base Builder Code coverage across transaction paths before they reach production.",
  other: {
    "talentapp:project_verification":
      "23654c79d1303187820e11b6203dcf6c7ae24e2490cfa7e3b0fd9121ba0997a8b3eab754dc3dd72b5c4db30a8efae2bf32fb46fda460ca17f05c6b6c5c9cb0b4",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
