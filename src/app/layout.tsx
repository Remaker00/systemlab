import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});


const description =
  "Learn system design by building and breaking it. Draw an architecture of load balancers, caches, queues and databases, " +
  "send traffic through it, and watch where it fails.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SystemLab — Learn System Design by Breaking Systems",
    template: "%s · SystemLab",
  },
  description,
  applicationName: "SystemLab",
  keywords: [
    "system design",
    "learn system design",
    "system design interview",
    "distributed systems",
    "load balancer",
    "caching",
    "Redis",
    "message queue",
    "database replication",
    "scalability",
    "architecture simulator",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "SystemLab",
    title: "SystemLab — Learn System Design by Breaking Systems",
    description,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SystemLab — Learn System Design by Breaking Systems",
    description,
  },
  robots: { index: true, follow: true },
  category: "education",
};

export const viewport: Viewport = {
  themeColor: "#0c0c0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
