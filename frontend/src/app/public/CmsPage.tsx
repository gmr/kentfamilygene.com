import { useParams, Link } from 'react-router-dom';
import { usePageQuery } from '../../generated/graphql';
import { Markdown } from './cms';

const serif = "'Source Serif 4', serif";

export function CmsPage() {
  const { slug = '' } = useParams();
  const [{ data, fetching }] = usePageQuery({ variables: { slug } });
  const page = data?.page;

  if (fetching) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '52px 22px', color: '#777' }}>
        Loading…
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '52px 22px' }}>
        <h1 style={{ fontFamily: serif, fontWeight: 700, fontSize: 34, margin: '0 0 10px' }}>
          Page not found
        </h1>
        <p style={{ color: '#555', fontSize: 16 }}>
          Nothing lives at /{slug}. Try the{' '}
          <Link to="/lineages" style={{ color: '#2b6c6e' }}>
            lineage browser
          </Link>{' '}
          or{' '}
          <Link to="/search" style={{ color: '#2b6c6e' }}>
            search
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <article style={{ maxWidth: 820, margin: '0 auto', padding: '52px 22px 60px' }}>
      {!page.isPublished && (
        <div
          style={{
            marginBottom: 20,
            padding: '8px 12px',
            background: '#ffdead',
            border: '1.5px solid #191919',
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          Draft — visible to you because you are signed in. Anonymous visitors get a 404.
        </div>
      )}
      <h1 style={{ fontFamily: serif, fontWeight: 700, fontSize: 40, margin: '0 0 8px' }}>
        {page.title}
      </h1>
      {page.summary && (
        <p style={{ color: '#555', fontSize: 17.5, margin: '0 0 24px', lineHeight: 1.6 }}>
          {page.summary}
        </p>
      )}
      <Markdown>{page.body}</Markdown>
      {page.updatedDate && (
        <p style={{ marginTop: 36, fontSize: 13, color: '#777' }}>
          Last updated {page.updatedDate.slice(0, 10)}
        </p>
      )}
    </article>
  );
}
