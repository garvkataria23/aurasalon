import type { BlogPost } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

export const AURA_AUTHOR = {
  name: "Aura Editorial Team",
  slug: "aura-editorial-team",
  title: "Salon operations, CRM and POS workflow specialists",
  url: `${SITE_URL}/authors/aura-editorial-team`,
  description:
    "The Aura Editorial Team writes practical guidance for Indian salon owners across CRM, POS, GST billing, booking, staff, inventory, marketing automation and growth operations.",
};

export const CITY_PAGES = [
  { slug: "delhi", name: "Delhi NCR" },
  { slug: "mumbai", name: "Mumbai" },
  { slug: "bangalore", name: "Bengaluru" },
  { slug: "pune", name: "Pune" },
  { slug: "hyderabad", name: "Hyderabad" },
  { slug: "ahmedabad", name: "Ahmedabad" },
  { slug: "jaipur", name: "Jaipur" },
  { slug: "chandigarh", name: "Chandigarh" },
  { slug: "kolkata", name: "Kolkata" },
  { slug: "chennai", name: "Chennai" },
  { slug: "lucknow", name: "Lucknow" },
  { slug: "indore", name: "Indore" },
  { slug: "surat", name: "Surat" },
  { slug: "nagpur", name: "Nagpur" },
  { slug: "kochi", name: "Kochi" },
  { slug: "bhopal", name: "Bhopal" },
  { slug: "ludhiana", name: "Ludhiana" },
  { slug: "noida", name: "Noida" },
  { slug: "gurgaon", name: "Gurgaon" },
  { slug: "coimbatore", name: "Coimbatore" },
  { slug: "visakhapatnam", name: "Visakhapatnam" },
  { slug: "vadodara", name: "Vadodara" },
  { slug: "patna", name: "Patna" },
  { slug: "guwahati", name: "Guwahati" },
  { slug: "bhubaneswar", name: "Bhubaneswar" },
  { slug: "rajkot", name: "Rajkot" },
  { slug: "nashik", name: "Nashik" },
  { slug: "mysore", name: "Mysuru" },
  { slug: "ranchi", name: "Ranchi" },
  { slug: "dehradun", name: "Dehradun" },
  { slug: "faridabad", name: "Faridabad" },
  { slug: "ghaziabad", name: "Ghaziabad" },
  { slug: "meerut", name: "Meerut" },
  { slug: "kanpur", name: "Kanpur" },
  { slug: "varanasi", name: "Varanasi" },
  { slug: "agra", name: "Agra" },
  { slug: "amritsar", name: "Amritsar" },
  { slug: "aurangabad", name: "Aurangabad" },
  { slug: "bareilly", name: "Bareilly" },
  { slug: "belgaum", name: "Belagavi" },
  { slug: "bilaspur", name: "Bilaspur" },
  { slug: "cuttack", name: "Cuttack" },
  { slug: "dhanbad", name: "Dhanbad" },
  { slug: "gwalior", name: "Gwalior" },
  { slug: "jabalpur", name: "Jabalpur" },
  { slug: "jalandhar", name: "Jalandhar" },
  { slug: "jamshedpur", name: "Jamshedpur" },
  { slug: "jodhpur", name: "Jodhpur" },
  { slug: "kota", name: "Kota" },
  { slug: "madurai", name: "Madurai" },
  { slug: "mangalore", name: "Mangalore" },
  { slug: "moradabad", name: "Moradabad" },
  { slug: "raipur", name: "Raipur" },
  { slug: "salem", name: "Salem" },
  { slug: "siliguri", name: "Siliguri" },
  { slug: "solapur", name: "Solapur" },
  { slug: "thiruvananthapuram", name: "Thiruvananthapuram" },
  { slug: "thrissur", name: "Thrissur" },
  { slug: "tiruchirappalli", name: "Tiruchirappalli" },
  { slug: "udaipur", name: "Udaipur" },
  { slug: "ujjain", name: "Ujjain" },
  { slug: "vijayawada", name: "Vijayawada" },
  { slug: "warangal", name: "Warangal" },
  { slug: "panaji", name: "Panaji" },
  { slug: "pondicherry", name: "Puducherry" },
  { slug: "shimla", name: "Shimla" },
  { slug: "srinagar", name: "Srinagar" },
  { slug: "gandhinagar", name: "Gandhinagar" },
  { slug: "anand", name: "Anand" },
  { slug: "jamnagar", name: "Jamnagar" },
  { slug: "tirupati", name: "Tirupati" },
  { slug: "vellore", name: "Vellore" },
  { slug: "aligarh", name: "Aligarh" },
  { slug: "prayagraj", name: "Prayagraj" },
  { slug: "gaya", name: "Gaya" },
  { slug: "karnal", name: "Karnal" },
] as const;

export const SEGMENT_PAGES = [
  { slug: "spa-software", name: "Spa Software", audience: "spas and wellness studios" },
  { slug: "bridal-salon-software", name: "Bridal Salon Software", audience: "bridal makeup and premium styling teams" },
  { slug: "salon-chain-software", name: "Salon Chain Software", audience: "multi-branch salon chains" },
  { slug: "barber-shop-software", name: "Barber Shop Software", audience: "barber shops and men's grooming studios" },
  { slug: "hair-salon-software", name: "Hair Salon Software", audience: "hair salons and styling studios" },
  { slug: "beauty-salon-software", name: "Beauty Salon Software", audience: "beauty salons and parlours" },
  { slug: "bridal-makeup-studio-software", name: "Bridal Makeup Studio Software", audience: "bridal makeup studios" },
  { slug: "nail-salon-software", name: "Nail Salon Software", audience: "nail salons and nail art studios" },
  { slug: "skin-clinic-software", name: "Skin Clinic Software", audience: "skin clinics and aesthetic studios" },
  { slug: "wellness-center-software", name: "Wellness Center Software", audience: "wellness centers" },
  { slug: "medspa-software", name: "Medspa Software", audience: "medspas and aesthetic clinics" },
  { slug: "franchise-salon-software", name: "Franchise Salon Software", audience: "franchise salon owners" },
  { slug: "home-salon-business-software", name: "Home Salon Business Software", audience: "home salon businesses" },
  { slug: "unisex-salon-software", name: "Unisex Salon Software", audience: "unisex salons" },
  { slug: "luxury-salon-software", name: "Luxury Salon Software", audience: "premium and luxury salons" },
] as const;

export const COMPARISON_PAGES = [
  { slug: "fresha", name: "Fresha" },
  { slug: "zoho", name: "Zoho" },
  { slug: "spreadsheet", name: "Spreadsheets" },
  { slug: "dingg", name: "Dingg" },
  { slug: "zenoti", name: "Zenoti" },
  { slug: "vagaro", name: "Vagaro" },
  { slug: "square", name: "Square" },
  { slug: "miosalon", name: "MioSalon" },
  { slug: "goeasypos", name: "GoEasyPOS" },
  { slug: "booksy", name: "Booksy" },
  { slug: "glossgenius", name: "GlossGenius" },
  { slug: "mindbody", name: "Mindbody" },
  { slug: "treatwell", name: "Treatwell" },
  { slug: "simple-salon", name: "Simple Salon" },
  { slug: "shortcuts", name: "Shortcuts" },
  { slug: "shedul", name: "Shedul" },
  { slug: "generic-booking-app", name: "Generic Booking Apps" },
  { slug: "whatsapp-and-excel", name: "WhatsApp and Excel" },
  { slug: "manual-salon-management", name: "Manual Salon Management" },
  { slug: "tally-only", name: "Tally-only Workflows" },
] as const;

const CATEGORY_FEATURE_LINKS: Record<string, { href: string; label: string }[]> = {
  "Business Growth": [
    { href: "/pricing", label: "Pricing" },
    { href: "/features/finance", label: "Finance Engine" },
    { href: "/demo", label: "Demo" },
  ],
  Marketing: [
    { href: "/features/marketing-ai", label: "Marketing AI" },
    { href: "/customer-app", label: "Customer App" },
    { href: "/blog/salon-campaign-calendar-guide", label: "Campaign Calendar" },
  ],
  Operations: [
    { href: "/features/appointments", label: "Appointments" },
    { href: "/features/inventory", label: "Inventory" },
    { href: "/workflows", label: "Workflows" },
  ],
  "Staff Management": [
    { href: "/features/staff-management", label: "Staff Management" },
    { href: "/staff-app", label: "Staff App" },
    { href: "/blog/salon-training-calendar", label: "Training Calendar" },
  ],
  "Client CRM": [
    { href: "/features/client-crm", label: "Client CRM" },
    { href: "/customer-app", label: "Customer App" },
    { href: "/blog/client-360-profile-guide", label: "Client 360" },
  ],
  Compliance: [
    { href: "/features/billing", label: "GST Billing" },
    { href: "/features/compliance", label: "Compliance" },
    { href: "/security", label: "Security" },
  ],
  "Industry Insights": [
    { href: "/platform", label: "Platform" },
    { href: "/features", label: "All Features" },
    { href: "/llms.txt", label: "AI Summary" },
  ],
};

export function getTopicLinks(category: string) {
  return CATEGORY_FEATURE_LINKS[category] ?? CATEGORY_FEATURE_LINKS["Business Growth"];
}

export function getBlogFaq(post: BlogPost) {
  return [
    {
      question: `What is the fastest way to improve ${post.title.toLowerCase()}?`,
      answer: `Start by mapping the current workflow, writing one clear operating rule, and measuring it weekly. For ${post.category.toLowerCase()} topics, the biggest gains usually come from making the rule visible inside booking, CRM, POS, staff or inventory workflows.`,
    },
    {
      question: `How does Aura help with ${post.category.toLowerCase()}?`,
      answer: `Aura connects salon booking, POS, CRM, staff, inventory, marketing and owner reports so the team does not depend on disconnected spreadsheets or memory-based follow-ups.`,
    },
    {
      question: "Is this useful for single-location salons?",
      answer: "Yes. The same process discipline that helps chains scale also helps single-location salons reduce leakage, improve client experience and make owner reviews calmer.",
    },
  ];
}

export function getHowToSteps(post: BlogPost) {
  return [
    `Audit the current ${post.category.toLowerCase()} workflow and write where handoffs break.`,
    "Create one simple rule the team can repeat without owner approval.",
    "Put the rule inside the daily workflow rather than a separate spreadsheet.",
    "Review the relevant metrics weekly for 30 days.",
  ];
}

export function getArticleJsonLdExtras(post: BlogPost) {
  const faq = getBlogFaq(post);
  const steps = getHowToSteps(post);
  return {
    faqJsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
    howToJsonLd: {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How to apply ${post.title}`,
      description: post.excerpt,
      step: steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        text: step,
      })),
    },
  };
}

export const capabilityMap = {
  product: "Aura Salon CRM/POS",
  market: "Indian salons, spas, barber shops, salon chains and beauty businesses",
  capabilities: [
    "Online booking and appointment reminders",
    "POS and GST-ready billing",
    "Client CRM and consultation records",
    "Staff attendance, shifts, commissions and payroll workflows",
    "Inventory batch, expiry and reorder workflows",
    "Marketing automation and WhatsApp-ready follow-ups",
    "Owner reporting, daily closing and finance context",
  ],
};
