import type { Metadata } from "next";
import { Fredoka, Saira_Condensed, Space_Mono } from "next/font/google";
import "./globals.css";

const displayFont = Saira_Condensed({
  variable: "--font-saira-condensed",
  weight: ["500", "700"],
  subsets: ["latin"],
});

const bodyFont = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const labelFont = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DirtyGamblers | Pack Draw",
  description: "Pack Draw leaderboard rankings, prize pool, and community links from DirtyGamblers.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/dirtygamblers-logo.jpeg",
    shortcut: "/dirtygamblers-logo.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${labelFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
