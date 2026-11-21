import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

const zenMaru = Zen_Maru_Gothic({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-maru",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bag Palette｜私だけのカバン見つけパレット",
  description:
    "コスメパレットのように4つのカバンから直感で選ぶだけ。AIがあなたの好みをリアルタイムで言語化＆可視化するパーソナルバッグ診断アプリ。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bag Palette",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FFF8F9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${zenMaru.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[#FFF8F9] text-[#4A353B] selection:bg-[#F7D1DC] selection:text-[#4A353B]">
        {children}
      </body>
    </html>
  );
}
