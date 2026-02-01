import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Using Inter as the primary font - lightweight, clean, and similar aesthetic
// To use TWK Continental, add font files to src/fonts/ and update this config
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-twk-continental",
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Relay - Feedback & Support Platform",
  description:
    "In-app feedback, bug reporting, session replay, and customer support",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
