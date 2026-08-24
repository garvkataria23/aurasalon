import type { Metadata } from "next";
import { BLOG_POSTS } from "@/lib/constants";
import { breadcrumbJsonLd } from "@/lib/seo";
import { BlogPostContent } from "./BlogPostContent";
import { SITE_URL } from "@/lib/site";
import { getBlogImage } from "@/lib/blog-images";
import { getBlogCitations } from "@/lib/blog-authority";
import { getArticleJsonLdExtras } from "@/lib/seo-enhancements";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return { title: "Post Not Found" };

  const url = `${SITE_URL}/blog/${post.slug}`;
  const image = getBlogImage(post);

  return {
    title: post.title,
    description: post.excerpt,
    keywords: [
      `salon ${post.category.toLowerCase()}`, "salon tips India", "salon business guide",
      post.title.split(" ").slice(0, 4).join(" ").toLowerCase(),
    ],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.date,
      authors: ["Aura Editorial Team"],
      tags: [post.category, "salon", "India"],
      url,
      images: [{ url: image, width: 1200, height: 675, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [image],
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  const citations = post ? getBlogCitations(post) : [];
  const extras = post ? getArticleJsonLdExtras(post) : null;

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Blog", url: "/blog" },
    { name: post?.title || "Article", url: `/blog/${slug}` },
  ]);

  const jsonLd = post
    ? {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${SITE_URL}/blog/${post.slug}#article`,
        headline: post.title,
        description: post.excerpt,
        datePublished: post.date,
        dateModified: post.date,
        url: `${SITE_URL}/blog/${post.slug}`,
        image: [getBlogImage(post)],
        inLanguage: "en-IN",
        articleSection: post.category,
        keywords: [post.category, "salon software India", "salon CRM", "salon POS", "salon operations"],
        citation: citations.map((citation) => citation.url),
        isAccessibleForFree: true,
        author: {
          "@type": "Organization",
          name: "Aura Editorial Team",
          url: SITE_URL,
        },
        publisher: {
          "@type": "Organization",
          name: "Aura Salon CRM/POS",
          url: SITE_URL,
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${SITE_URL}/blog/${post.slug}`,
        },
        about: {
          "@type": "SoftwareApplication",
          name: "Aura Salon CRM/POS",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
        },
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {extras && (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(extras.faqJsonLd) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(extras.howToJsonLd) }} />
        </>
      )}
      <BlogPostContent slug={slug} />
    </>
  );
}
