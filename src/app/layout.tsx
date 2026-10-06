import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import { ToastProvider } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";

export const viewport: Viewport = {
  themeColor: "#5e0f1e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
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
    <html lang="id" className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" style={{ background: "var(--surface-100)", color: "var(--ink)" }}>
        <ErrorBoundary>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ErrorBoundary>
        <PWARegister />
      </body>
    </html>
  );
}
