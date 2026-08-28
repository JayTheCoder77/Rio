import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rio-chi.vercel.app"),

  title: {
    default: "Rio — AI Code Review",
    template: "%s | Rio",
  },

  description:
    "Rio: reviews that understand your codebase. The code review platform for shipping-fast teams.",

  applicationName: "Rio",

  alternates: {
    canonical: "https://rio-chi.vercel.app",
  },

  openGraph: {
    type: "website",
    url: "https://rio-chi.vercel.app",
    title: "Rio — AI Code Review",
    description:
      "Rio: reviews that understand your codebase. The code review platform for shipping-fast teams.",
    siteName: "Rio",
  },

  twitter: {
    card: "summary_large_image",
    title: "Rio — AI Code Review",
    description:
      "Rio: reviews that understand your codebase. The code review platform for shipping-fast teams.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Rio",
    alternateName: "Rio AI Code Review",
    url: "https://rio-chi.vercel.app",
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
      </body>
    </html>
  );
}