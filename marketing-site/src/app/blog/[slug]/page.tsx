import { BLOG_POSTS } from "@/lib/constants";
import { BlogPostContent } from "./BlogPostContent";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogPostContent slug={slug} />;
}
