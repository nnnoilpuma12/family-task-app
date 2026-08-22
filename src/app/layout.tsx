import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/app/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "家族タスク",
  description: "カップル・夫婦向けタスク共有アプリ",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/icon-96x96.png?v=3", sizes: "96x96", type: "image/png" },
      { url: "/icon-192x192.png?v=3", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "家族タスク",
  },
};

/**
 * Supabase への接続（DNS + TLS ハンドシェイク）を HTML パース時点で始めるための origin。
 * 起動直後の tasks / categories 取得はハイドレーション後に初めて発火するため、
 * 何もしないとその瞬間からハンドシェイクが始まり、モバイル回線ではまるごと待ち時間になる。
 * 環境変数が未設定・不正な場合は preconnect を出さない（起動を壊さない）。
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
})();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        {/* React が <head> へ巻き上げる。CORS フェッチなので crossOrigin 付きで
            接続プールを合わせないと、実際のクエリでハンドシェイクをやり直すことになる */}
        {supabaseOrigin && (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        )}
        <ServiceWorkerRegister />
        <Toaster />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
