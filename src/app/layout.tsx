import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sidequest IRL - Good people. Small quests.",
  description:
    "Five minutes. One less thing you are stuck on. Meet people through small useful quests.",
  applicationName: "Sidequest IRL",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Sidequest" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f0e5",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
