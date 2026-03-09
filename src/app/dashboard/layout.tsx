import type { Metadata } from "next";
import { Bebas_Neue, IBM_Plex_Mono } from "next/font/google";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

const mono = IBM_Plex_Mono({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "SBB Control Room",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bebas.variable} ${mono.variable}`} style={{ minHeight: "100vh" }}>
      {children}
    </div>
  );
}
