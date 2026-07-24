import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { LanguageProvider } from "@/components/providers/LanguageProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aura — The Living Salon Operating System",
    template: "%s | Aura Salon CRM/POS",
  },
  description:
    "Aura connects Owner CRM and POS, customer booking, staff work, inventory, finance and branch-aware operations for Indian salons.",
  keywords: [
    "salon software", "salon CRM", "salon POS", "salon billing",
    "salon management", "appointment booking", "staff management",
    "salon inventory", "GST billing salon", "salon marketing",
    "salon POS India", "salon software India", "salon app India",
  ],
  openGraph: {
    title: "Aura — The Living Salon Operating System",
    description: "Owner CRM and POS, customer booking and staff operations connected around the same salon day.",
    type: "website",
    locale: "en_IN",
    siteName: "Aura Salon CRM/POS",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Aura Salon CRM/POS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Connected CRM, POS, customer booking and staff operations platform for salons in India.",
  offers: [
    {
      "@type": "Offer",
      price: "999",
      priceCurrency: "INR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "999",
        priceCurrency: "INR",
        billingDuration: "P1M",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased grain-overlay">
        {/* Skip to content */}
        <a href="#main-content" className="skip-link">Skip to content / मुख्य सामग्री</a>
        <LanguageProvider>
        <SmoothScrollProvider>
          <ScrollProgress />
          <WhatsAppButton />
          <CommandPalette />
          <Navbar />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
        </SmoothScrollProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
