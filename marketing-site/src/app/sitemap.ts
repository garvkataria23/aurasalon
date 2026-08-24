import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { BLOG_POSTS } from "@/lib/constants";
import { CALCULATORS, CASE_STUDIES, CORE_PRODUCT_PAGES, FEATURE_DETAIL_PAGES, GLOSSARY_TERMS, HELP_TOPICS, INTEGRATIONS, PERSONAS, RESOURCE_HUBS, TEMPLATES, USE_CASES } from "@/lib/authority-assets";
import { CITY_PAGES, COMPARISON_PAGES, SEGMENT_PAGES } from "@/lib/seo-enhancements";

const BASE_URL = SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 1.0 },
    { url: `${BASE_URL}/platform`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE_URL}/owner-crm`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.85 },
    { url: `${BASE_URL}/customer-app`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.85 },
    { url: `${BASE_URL}/staff-app`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.85 },
    { url: `${BASE_URL}/workflows`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.85 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${BASE_URL}/demo`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${BASE_URL}/features`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.75 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${BASE_URL}/customers`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.6 },
    { url: `${BASE_URL}/security`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.55 },
    { url: `${BASE_URL}/editorial-policy`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.45 },
    { url: `${BASE_URL}/authors/aura-editorial-team`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.45 },
    { url: `${BASE_URL}/case-studies`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.62 },
    { url: `${BASE_URL}/product-tour`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.62 },
    { url: `${BASE_URL}/calculators`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.62 },
    { url: `${BASE_URL}/resources`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.61 },
    { url: `${BASE_URL}/salon-software`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.61 },
    { url: `${BASE_URL}/tools`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.6 },
    { url: `${BASE_URL}/templates`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.58 },
    { url: `${BASE_URL}/glossary`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.58 },
    { url: `${BASE_URL}/compare`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.58 },
    { url: `${BASE_URL}/solutions`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.62 },
    { url: `${BASE_URL}/use-cases`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.58 },
    { url: `${BASE_URL}/integrations`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.56 },
    { url: `${BASE_URL}/for`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.55 },
    { url: `${BASE_URL}/help`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.54 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.3 },
    { url: `${BASE_URL}/cookies`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.3 },
  ];

  const featureRoutes = [
    "appointments", "billing", "client-crm", "compliance",
    "finance", "inventory", "marketing-ai", "staff-management", "white-label",
  ].map((slug) => ({
    url: `${BASE_URL}/features/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const featureDetailRoutes = FEATURE_DETAIL_PAGES.map((item) => ({
    url: `${BASE_URL}/features/${item.group}/${item.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.55,
  }));

  const coreProductRoutes = CORE_PRODUCT_PAGES.map((item) => ({
    url: `${BASE_URL}/${item.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.67,
  }));

  const blogSlugs = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: post.date >= "2026-01-01" ? 0.62 : 0.54,
  }));

  const cityRoutes = CITY_PAGES.map((city) => ({
    url: `${BASE_URL}/salon-software/${city.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.58,
  }));

  const segmentRoutes = SEGMENT_PAGES.map((segment) => ({
    url: `${BASE_URL}/solutions/${segment.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.57,
  }));

  const comparisonRoutes = COMPARISON_PAGES.map((item) => ({
    url: `${BASE_URL}/compare/${item.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.52,
  }));

  const caseStudyRoutes = CASE_STUDIES.map((item) => ({ url: `${BASE_URL}/case-studies/${item.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.56 }));
  const calculatorRoutes = CALCULATORS.map((item) => ({ url: `${BASE_URL}/calculators/${item.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.56 }));
  const templateRoutes = TEMPLATES.map((item) => ({ url: `${BASE_URL}/templates/${item.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.54 }));
  const glossaryRoutes = GLOSSARY_TERMS.map((item) => ({ url: `${BASE_URL}/glossary/${item.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.52 }));
  const resourceRoutes = RESOURCE_HUBS.map((item) => ({ url: `${BASE_URL}/resources/${item.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.57 }));
  const useCaseRoutes = USE_CASES.map((item) => ({ url: `${BASE_URL}/use-cases/${item.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.56 }));
  const integrationRoutes = INTEGRATIONS.map((item) => ({ url: `${BASE_URL}/integrations/${item.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.52 }));
  const personaRoutes = PERSONAS.map((item) => ({ url: `${BASE_URL}/for/${item.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.51 }));
  const helpRoutes = HELP_TOPICS.map((item) => ({ url: `${BASE_URL}/help/${item.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.5 }));

  return [...staticRoutes, ...featureRoutes, ...featureDetailRoutes, ...coreProductRoutes, ...cityRoutes, ...segmentRoutes, ...comparisonRoutes, ...caseStudyRoutes, ...calculatorRoutes, ...templateRoutes, ...glossaryRoutes, ...resourceRoutes, ...useCaseRoutes, ...integrationRoutes, ...personaRoutes, ...helpRoutes, ...blogSlugs];
}
