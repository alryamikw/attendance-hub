import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AttendanceHub - SaaS Geolocation Attendance System",
    template: "%s | AttendanceHub",
  },
  description: "Multi-tenant SaaS Attendance & Time Tracking Platform with geolocation, geofencing, PWA offline support, face recognition, and payroll integration.",
  keywords: [
    "attendance",
    "time tracking",
    "geolocation",
    "geofencing",
    "payroll",
    "SaaS",
    "HR",
    "workforce management",
    "PWA",
  ],
  authors: [{ name: "AttendanceHub Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AttendanceHub",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "AttendanceHub - SaaS Attendance System",
    description: "Multi-tenant SaaS Attendance & Time Tracking Platform",
    type: "website",
    siteName: "AttendanceHub",
  },
  twitter: {
    card: "summary_large_image",
    title: "AttendanceHub",
    description: "SaaS Geolocation Attendance System",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
