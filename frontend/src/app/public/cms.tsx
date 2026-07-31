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

export function isExternal(target: string): boolean {
  return /^https?:\/\//i.test(target) || target.startsWith('mailto:');
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
  if (isExternal(target)) {
    return (
      <a href={target} className={className} style={style} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link to={target} className={className} style={style}>
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
