import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { useSnippetQuery, type NavItemsQuery } from '../../generated/graphql';

export type CmsNavItem = NavItemsQuery['navItems'][number];

/** Markdown body rendered with the public site's prose styling. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="kent-prose">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

/**
 * A named block of CMS copy. Falls back to `children` when the snippet has not
 * been created yet, so the site never renders a hole.
 */
export function Snippet({ keyName, children }: { keyName: string; children: React.ReactNode }) {
  const [{ data }] = useSnippetQuery({ variables: { key: keyName } });
  const body = data?.snippet?.body;
  return body ? <Markdown>{body}</Markdown> : <>{children}</>;
}

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Nav targets are admin-authored, but never hand a scheme we did not vet to an
 * href — `javascript:` and `data:` targets are coerced to a dead link.
 */
export function safeTarget(target: string): string {
  // Internal path; "//host" would be protocol-relative, so reject it.
  if (target.startsWith('/') && !target.startsWith('//')) return target;
  try {
    return SAFE_PROTOCOLS.includes(new URL(target).protocol) ? target : '#';
  } catch {
    return '#';
  }
}

export function isExternal(target: string): boolean {
  return /^https?:\/\//i.test(target) || /^(mailto|tel):/i.test(target);
}

/** Renders a nav target as an <a> for external URLs, a <Link> for internal paths. */
export function NavTarget({
  target,
  className,
  style,
  children,
}: {
  target: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const href = safeTarget(target);
  if (href === '#' || isExternal(href)) {
    return (
      <a href={href} className={className} style={style} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className} style={style}>
      {children}
    </Link>
  );
}

/** Group footer items by their column heading, preserving server sort order. */
export function groupFooterItems(items: CmsNavItem[]): { heading: string; items: CmsNavItem[] }[] {
  const groups: { heading: string; items: CmsNavItem[] }[] = [];
  for (const item of items) {
    const heading = item.groupLabel || 'More';
    const existing = groups.find((g) => g.heading === heading);
    if (existing) existing.items.push(item);
    else groups.push({ heading, items: [item] });
  }
  return groups;
}
