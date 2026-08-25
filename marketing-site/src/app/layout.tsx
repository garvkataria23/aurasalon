import type { Metadata } from "next";
import "./globals.css";
import { StaticNavbar } from "@/components/layout/StaticNavbar";
import { NavbarDeferredLoader } from "@/components/layout/NavbarDeferredLoader";
import { StaticFooter } from "@/components/layout/StaticFooter";
import { FooterDeferredLoader } from "@/components/layout/FooterDeferredLoader";
import { SkipLink } from "@/components/ui/SkipLink";
import { DeferredMarketingWidgets } from "@/components/ui/DeferredMarketingWidgets";
import { softwareAppJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Aura — All-in-One Salon CRM, POS, Booking & Business Operating System",
    template: "%s | Aura Salon OS",
  },
  description:
    "Aura is the modern cloud operating system for salons, spas, and aesthetic clinics worldwide. Manage pay-at-salon booking, smart POS billing, staff rosters, client 360 CRM, and automated marketing from one connected screen.",
  keywords: [
    "salon software", "salon CRM", "salon POS system", "all in one salon software",
    "salon booking software", "spa management software", "salon appointment app",
    "cloud salon pos", "salon staff management", "salon marketing automation",
    "salon billing software", "hair salon POS", "aesthetic clinic software", "best salon software",
  ],
  authors: [{ name: "Aura" }],
  creator: "Aura",
  publisher: "Aura",
  formatDetection: { telephone: false },
  openGraph: {
    title: "Aura — Salon CRM, POS & Booking Software for India",
    description:
      "Connected CRM, POS, pay-at-salon booking, staff and inventory for Indian salons. Request a demo.",
    url: SITE_URL,
    siteName: "Aura Salon CRM/POS",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/og?path=/",
        width: 1200,
        height: 630,
        alt: "Aura Salon CRM/POS — Connected salon operating system",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aura — Salon CRM, POS & Booking Software for India",
    description:
      "Connected CRM, POS, booking, staff and inventory for Indian salons.",
    images: ["/og?path=/"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en-IN": SITE_URL,
      "hi-IN": `${SITE_URL}?lang=hi`,
    },
  },
};

const jsonLdScripts = [softwareAppJsonLd, organizationJsonLd, websiteJsonLd];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className="h-full" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {jsonLdScripts.map((ld, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
          />
        ))}
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <SkipLink />
          <DeferredMarketingWidgets />
          <StaticNavbar />
          <NavbarDeferredLoader />
          <main id="main-content" className="flex-1">{children}</main>
          <StaticFooter />
          <FooterDeferredLoader />
      </body>
    </html>
  );
}
