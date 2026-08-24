import type { BlogPost } from "@/lib/types";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Business Growth": ["salon", "business", "beauty", "entrepreneur"],
  Marketing: ["salon", "marketing", "social-media", "beauty"],
  Operations: ["salon", "reception", "beauty", "workspace"],
  "Staff Management": ["hair-stylist", "salon", "team", "training"],
  "Client CRM": ["salon", "customer", "beauty", "consultation"],
  Compliance: ["salon", "clean", "hygiene", "tools"],
  "Industry Insights": ["beauty-salon", "spa", "interior", "technology"],
};

const CATEGORY_PHOTOS: Record<string, string[]> = {
  "Business Growth": [
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  ],
  Marketing: [
    "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  ],
  Operations: [
    "https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=1200&q=80",
  ],
  "Staff Management": [
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
  ],
  "Client CRM": [
    "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1200&q=80",
  ],
  Compliance: [
    "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=1200&q=80",
  ],
  "Industry Insights": [
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
  ],
};

const CATEGORY_THEMES: Record<string, { from: string; via: string; to: string; accent: string }> = {
  "Business Growth": { from: "#2A173D", via: "#6F4FD8", to: "#B89CFF", accent: "#F6D365" },
  Marketing: { from: "#3B185F", via: "#A855F7", to: "#F0ABFC", accent: "#FDE68A" },
  Operations: { from: "#17324D", via: "#2563EB", to: "#93C5FD", accent: "#A7F3D0" },
  "Staff Management": { from: "#3B2416", via: "#F97316", to: "#FDBA74", accent: "#C4B5FD" },
  "Client CRM": { from: "#123C35", via: "#14B8A6", to: "#99F6E4", accent: "#FBCFE8" },
  Compliance: { from: "#243044", via: "#64748B", to: "#CBD5E1", accent: "#A7F3D0" },
  "Industry Insights": { from: "#2B214A", via: "#4F46E5", to: "#A5B4FC", accent: "#FDE68A" },
};

function escapeSvg(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function initials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function slugKeywords(slug: string) {
  return slug
    .split("-")
    .filter((word) => !["salon", "guide", "for", "and", "the"].includes(word))
    .slice(0, 3);
}

function hashSlug(slug: string) {
  return slug.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

export function getBlogImage(post: BlogPost) {
  const photos = CATEGORY_PHOTOS[post.category] ?? CATEGORY_PHOTOS["Business Growth"];
  return photos[hashSlug(post.slug) % photos.length];
}

export function getBlogFallbackImage(post: BlogPost) {
  const theme = CATEGORY_THEMES[post.category] ?? CATEGORY_THEMES["Business Growth"];
  const safeTitle = escapeSvg(post.title);
  const safeCategory = escapeSvg(post.category);
  const safeInitials = escapeSvg(initials(post.title));
  const firstLine = safeTitle.slice(0, 44);
  const secondLine = safeTitle.length > 44 ? safeTitle.slice(44, 84) : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${theme.from}"/><stop offset="0.58" stop-color="${theme.via}"/><stop offset="1" stop-color="${theme.to}"/></linearGradient><radialGradient id="r" cx="75%" cy="25%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="675" rx="54" fill="url(#g)"/><rect width="1200" height="675" rx="54" fill="url(#r)"/><circle cx="1010" cy="118" r="210" fill="#fff" opacity="0.12"/><circle cx="130" cy="600" r="260" fill="#fff" opacity="0.1"/><circle cx="210" cy="190" r="72" fill="${theme.accent}" opacity="0.95"/><text x="210" y="214" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="52" font-weight="900" fill="#1E1530">${safeInitials}</text><text x="96" y="100" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="800" letter-spacing="3" fill="#fff" opacity="0.82">AURA INSIGHTS</text><text x="96" y="330" font-family="Inter,Arial,sans-serif" font-size="62" font-weight="900" fill="#fff"><tspan x="96" dy="0">${firstLine}</tspan>${secondLine ? `<tspan x="96" dy="76">${secondLine}</tspan>` : ""}</text><rect x="96" y="516" width="${Math.min(520, 210 + safeCategory.length * 14)}" height="54" rx="27" fill="#fff" opacity="0.18"/><text x="124" y="551" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="#fff">${safeCategory}</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
