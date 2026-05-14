import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edgecraft AI — Trading Copilot",
  description:
    "Your trading copilot. Audit every trade, find your edge, and protect your account from the moves that blow it up.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
