import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { DM_Sans, Lora } from 'next/font/google'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const dm_sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrialMind · AI Co-Pilot for Clinical Trials",
  description:
    "Explainable AI screening, risk prediction, adherence monitoring, and compliance-grade audit for clinical trials.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${dm_sans.variable} ${lora.variable} h-full`}>
      <body className="min-h-full w-full flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
