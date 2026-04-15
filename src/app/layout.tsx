import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

export const viewport: Viewport = {
  themeColor: "#8B1A1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RedWine Attendance",
  description: "Sistem Absensi Karyawan RedWine Shoes & Bags",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RedWine",
  },
  icons: {
    icon: [
      { url: "/icon.png?v=2", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png?v=2", type: "image/png" },
    ],
    shortcut: "/icon.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
