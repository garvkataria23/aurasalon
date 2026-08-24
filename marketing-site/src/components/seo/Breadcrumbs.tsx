import Link from "next/link";
import { SITE_URL } from "@/lib/site";

export type Crumb = { name: string; href: string };

export function breadcrumbJsonLdFromCrumbs(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.href}`,
    })),
  };
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-xs font-semibold text-[var(--aura-muted)]">
      <ol className="flex flex-wrap items-center gap-2">
        {crumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {index === crumbs.length - 1 ? (
              <span className="text-[var(--aura-heading)]">{crumb.name}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-[var(--aura-purple)]">
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
