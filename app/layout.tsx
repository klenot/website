import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import {
  GoogleTagManagerHead,
  GoogleTagManagerNoscript,
} from "@/components/analytics/GoogleTagManager";
import MixpanelProvider from "@/components/analytics/MixpanelProvider";
import { ibmPlexMono } from "./fonts";
import { defaultMetadata } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = defaultMetadata;

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GoogleTagManagerHead />
        <GoogleTagManagerNoscript />
        <MixpanelProvider>{children}</MixpanelProvider>
      </body>
    </html>
  );
}
