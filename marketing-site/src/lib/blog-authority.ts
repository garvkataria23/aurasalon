import type { BlogPost } from "@/lib/types";

export type BlogCitation = {
  name: string;
  url: string;
  publisher: string;
};

const CORE_CITATIONS: BlogCitation[] = [
  {
    name: "Google Search Central: Article structured data",
    url: "https://developers.google.com/search/docs/appearance/structured-data/article",
    publisher: "Google Search Central",
  },
  {
    name: "Schema.org BlogPosting vocabulary",
    url: "https://schema.org/BlogPosting",
    publisher: "Schema.org",
  },
];

const CATEGORY_CITATIONS: Record<string, BlogCitation[]> = {
  "Business Growth": [
    {
      name: "Google Business Profile Help",
      url: "https://support.google.com/business/",
      publisher: "Google",
    },
    {
      name: "Startup India learning resources",
      url: "https://www.startupindia.gov.in/content/sih/en/learning-and-development.html",
      publisher: "Startup India",
    },
  ],
  Marketing: [
    {
      name: "WhatsApp Business Messaging Policy",
      url: "https://www.whatsapp.com/legal/business-policy/",
      publisher: "WhatsApp",
    },
    {
      name: "Google Business Profile Help",
      url: "https://support.google.com/business/",
      publisher: "Google",
    },
  ],
  Operations: [
    {
      name: "Bureau of Indian Standards",
      url: "https://www.bis.gov.in/",
      publisher: "BIS",
    },
    {
      name: "Google Search Central: Ecommerce and product structured data",
      url: "https://developers.google.com/search/docs/appearance/structured-data/product",
      publisher: "Google Search Central",
    },
  ],
  "Staff Management": [
    {
      name: "EPFO employer resources",
      url: "https://www.epfindia.gov.in/",
      publisher: "EPFO",
    },
    {
      name: "ESIC employer information",
      url: "https://www.esic.gov.in/",
      publisher: "ESIC",
    },
  ],
  "Client CRM": [
    {
      name: "Digital Personal Data Protection Act resources",
      url: "https://www.meity.gov.in/data-protection-framework",
      publisher: "MeitY",
    },
    {
      name: "Google Business Profile Help",
      url: "https://support.google.com/business/",
      publisher: "Google",
    },
  ],
  Compliance: [
    {
      name: "GST Portal",
      url: "https://www.gst.gov.in/",
      publisher: "Goods and Services Tax Network",
    },
    {
      name: "Central Board of Indirect Taxes and Customs",
      url: "https://www.cbic.gov.in/",
      publisher: "CBIC",
    },
  ],
  "Industry Insights": [
    {
      name: "Google Trends",
      url: "https://trends.google.com/trends/",
      publisher: "Google",
    },
    {
      name: "Startup India learning resources",
      url: "https://www.startupindia.gov.in/content/sih/en/learning-and-development.html",
      publisher: "Startup India",
    },
  ],
};

export function getBlogCitations(post: BlogPost) {
  return [...(CATEGORY_CITATIONS[post.category] ?? CATEGORY_CITATIONS["Business Growth"]), ...CORE_CITATIONS];
}
