import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FindEasy Admin",
  description: "Internal FindEasy listing review console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
