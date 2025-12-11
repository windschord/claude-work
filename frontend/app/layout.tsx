import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "Claude Work",
  description: "ClaudeWorkプロジェクト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
