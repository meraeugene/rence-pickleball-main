import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/system/ServiceWorkerRegister";
import { getAppUrl } from "@/utils/env/appEnv";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const rallyDisplay = Orbitron({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: { default: "UNO RALLY | Your Court. Your Crew. Your Rally.", template: "%s | UNO RALLY" },
  description: "Good games. Great company. One more rally. Meet UNO RALLY, find your court time, and make room for your next favorite sport.",
  applicationName: "UNO RALLY",
  alternates: { canonical: "/" },
  keywords: ["UNO RALLY", "pickleball", "pickleball court booking", "court reservations"],
  icons: { icon: "/uno-rally-icon-v2.png", shortcut: "/uno-rally-icon-v2.png", apple: "/apple-touch-icon-v2.png" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "UNO RALLY | Your Court. Your Crew. Your Rally.",
    description: "Good games. Great company. One more rally. Find your next game at UNO RALLY.",
    url: "/", siteName: "UNO RALLY",
    images: [{ url: "/uno-rally-social-v2.png", width: 1200, height: 630, alt: "UNO RALLY pickleball club" }],
    locale: "en_PH", type: "website",
  },
  twitter: { card: "summary_large_image", title: "UNO RALLY | Your Court. Your Crew. Your Rally.", description: "Good games. Great company. One more rally.", images: ["/uno-rally-social-v2.png"] },
};
export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

const splashSeenScript = `try{if(sessionStorage.getItem("uno-rally-splash-seen"))document.documentElement.classList.add("splash-seen")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${rallyDisplay.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Runs before paint so a returning tab never flashes the splash. */}
        <script dangerouslySetInnerHTML={{ __html: splashSeenScript }} />
      </head>
      <body className="min-h-full">{children}<ServiceWorkerRegister /></body>
    </html>
  );
}
