import type { Metadata, Viewport } from "next";
import { Yusei_Magic } from "next/font/google";
import "./globals.css";
import "./compact-form-fields.css";

// 手書き（サインペン）風の書体。日本語は分割数が多いため preload はしない。
const yuseiMagic = Yusei_Magic({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-handwritten",
});

export const metadata: Metadata = {
  title: "おでかけ記録",
  description: "訪れた場所を日本地図から振り返る、おでかけの記録帳です。",
  applicationName: "おでかけ記録",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "おでかけ記録",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#fbf8f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={yuseiMagic.variable}>
      <body>{children}</body>
    </html>
  );
}
