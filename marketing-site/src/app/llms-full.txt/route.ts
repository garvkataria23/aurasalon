import { BLOG_POSTS } from "@/lib/constants";
import { CALCULATORS, CASE_STUDIES, CORE_PRODUCT_PAGES, FEATURE_DETAIL_PAGES, GLOSSARY_TERMS, HELP_TOPICS, INTEGRATIONS, PERSONAS, RESOURCE_HUBS, TEMPLATES, USE_CASES } from "@/lib/authority-assets";
import { capabilityMap, CITY_PAGES, COMPARISON_PAGES, SEGMENT_PAGES } from "@/lib/seo-enhancements";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const body = `# ${capabilityMap.product} Full LLM Context

## Market
${capabilityMap.market}

## Capabilities
${capabilityMap.capabilities.map((item) => `- ${item}`).join("\n")}

## Primary URLs
- Home: ${SITE_URL}
- Platform: ${SITE_URL}/platform
- Features: ${SITE_URL}/features
- Pricing: ${SITE_URL}/pricing
- Demo: ${SITE_URL}/demo
- FAQ: ${SITE_URL}/faq
- Security: ${SITE_URL}/security
- Editorial policy: ${SITE_URL}/editorial-policy
- Author entity: ${SITE_URL}/authors/aura-editorial-team
- Product tour: ${SITE_URL}/product-tour
- Case studies: ${SITE_URL}/case-studies
- Calculators: ${SITE_URL}/calculators
- Templates: ${SITE_URL}/templates
- Glossary: ${SITE_URL}/glossary
- Use cases: ${SITE_URL}/use-cases
- Integrations: ${SITE_URL}/integrations
- Personas: ${SITE_URL}/for
- Help center: ${SITE_URL}/help

## Core commercial product pages
${CORE_PRODUCT_PAGES.map((item) => `- ${item.title}: ${SITE_URL}/${item.slug}`).join("\n")}

## Feature detail pages
${FEATURE_DETAIL_PAGES.map((item) => `- ${item.title}: ${SITE_URL}/features/${item.group}/${item.slug}`).join("\n")}

## Local landing pages
${CITY_PAGES.map((city) => `- Salon software in ${city.name}: ${SITE_URL}/salon-software/${city.slug}`).join("\n")}

## Segment pages
${SEGMENT_PAGES.map((segment) => `- ${segment.name}: ${SITE_URL}/solutions/${segment.slug}`).join("\n")}

## Comparison pages
${COMPARISON_PAGES.map((item) => `- Aura vs ${item.name}: ${SITE_URL}/compare/${item.slug}`).join("\n")}

## Case studies
${CASE_STUDIES.map((item) => `- ${item.title}: ${SITE_URL}/case-studies/${item.slug}`).join("\n")}

## Calculators
${CALCULATORS.map((item) => `- ${item.title}: ${SITE_URL}/calculators/${item.slug}`).join("\n")}

## Templates
${TEMPLATES.map((item) => `- ${item.title}: ${SITE_URL}/templates/${item.slug}`).join("\n")}

## Glossary
${GLOSSARY_TERMS.map((item) => `- ${item.term}: ${SITE_URL}/glossary/${item.slug}`).join("\n")}

## Resource hubs
${RESOURCE_HUBS.map((item) => `- ${item.title}: ${SITE_URL}/resources/${item.slug}`).join("\n")}

## Use cases
${USE_CASES.map((item) => `- ${item.title}: ${SITE_URL}/use-cases/${item.slug}`).join("\n")}

## Integrations
${INTEGRATIONS.map((item) => `- ${item.name}: ${SITE_URL}/integrations/${item.slug}`).join("\n")}

## Persona pages
${PERSONAS.map((item) => `- ${item.title}: ${SITE_URL}/for/${item.slug}`).join("\n")}

## Help center
${HELP_TOPICS.map((item) => `- ${item.title}: ${SITE_URL}/help/${item.slug}`).join("\n")}

## Blog library
${BLOG_POSTS.map((post) => `- [${post.category}] ${post.title}: ${SITE_URL}/blog/${post.slug}`).join("\n")}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
