import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/system/ServiceWorkerRegister";
import { getAppUrl } from "@/utils/env/appEnv";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });
const rallyDisplay = Orbitron({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800", "900"] });

const SITE_TITLE = "UNO RALLY | Indoor Pickleball Court in Cagayan de Oro";
const SITE_DESCRIPTION =
  "Book indoor pickleball court time at UNO RALLY in Cagayan de Oro. Open daily, reserve online in minutes, and play with the UNO RALLY community.";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: { default: SITE_TITLE, template: "%s | UNO RALLY" },
  description: SITE_DESCRIPTION,
  applicationName: "UNO RALLY",
  alternates: { canonical: "/" },
  keywords: [
    "UNO RALLY",
    "pickleball Cagayan de Oro",
    "pickleball court CDO",
    "indoor pickleball court",
    "pickleball court booking",
    "pickleball Philippines",
  ],
  category: "sports",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  icons: { icon: "/uno-rally-icon-v2.png", shortcut: "/uno-rally-icon-v2.png", apple: "/apple-touch-icon-v2.png" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: SITE_TITLE,
    description: "Your Court. Your Crew. Your Rally. Book indoor pickleball court time in Cagayan de Oro.",
    url: "/", siteName: "UNO RALLY",
    images: [{ url: "/uno-rally-social-v2.png", width: 1200, height: 630, alt: "UNO RALLY indoor pickleball, Cagayan de Oro" }],
    locale: "en_PH", type: "website",
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: "Book indoor pickleball court time in Cagayan de Oro.", images: ["/uno-rally-social-v2.png"] },
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
