import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Streamer Billboard",
  description:
    "A live-streamer's interactive backdrop — viewers control what appears on screen in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
