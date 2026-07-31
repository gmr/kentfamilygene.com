import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  usePagesQuery,
  useCreatePageMutation,
  useUpdatePageMutation,
} from '../../generated/graphql';

interface Draft {
  slug: string;
  title: string;
  summary: string;
  body: string;
  isPublished: boolean;
}

const EMPTY: Draft = { slug: '', title: '', summary: '', body: '', isPublished: false };

// Mirrors RESERVED_SLUGS in crates/kent-domain/src/mutation.rs — a page on one
// of these is unreachable, since /:slug is registered after the real routes.
const RESERVED_SLUGS = ['admin', 'lineages', 'search', 'haplogroups', 'graphql', 'health'];

export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function PageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === undefined;

  const [{ data, fetching }] = usePagesQuery({ requestPolicy: 'cache-and-network' });
  const [, createPage] = useCreatePageMutation();
  const [, updatePage] = useUpdatePageMutation();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const page = data?.pages.find((p) => p.id === id);

  // Populate once the page arrives; don't clobber edits on later refetches.
  useEffect(() => {
    if (isNew || loaded || !page) return;
    setDraft({
      slug: page.slug,
      title: page.title,
      summary: page.summary ?? '',
      body: page.body,
      isPublished: page.isPublished,
    });
    setLoaded(true);
  }, [isNew, loaded, page]);

  if (!isNew && !page) {
    return (
      <p className="text-sm text-gray-500">{fetching ? 'Loading…' : 'Page not found.'}</p>
    );
  }

  const slug = slugify(draft.slug || draft.title);

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!slug) {
      toast.error('Slug is required');
      return;
    }
    if (RESERVED_SLUGS.includes(slug)) {
      toast.error(`"${slug}" is reserved by the site's own routes`);
      return;
    }
    setSaving(true);
    const input = {
      slug,
      title: draft.title,
      body: draft.body,
      summary: draft.summary,
      isPublished: draft.isPublished,
    };
    const result = isNew
      ? await createPage({ input })
      : await updatePage({ id: id!, input });
    setSaving(false);
    if (result.error) {
      toast.error(result.error.message.replace('[GraphQL] ', ''));
      return;
    }
    toast.success(isNew ? 'Page created' : 'Page saved');
    navigate('/admin/pages');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/pages')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Pages
          </Button>
          <h2 className="text-2xl font-semibold">{isNew ? 'New page' : draft.title || 'Edit page'}</h2>
          {!isNew && (
            <Badge variant={draft.isPublished ? 'default' : 'secondary'}>
              {draft.isPublished ? 'Published' : 'Draft'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/${page!.slug}`} target="_blank" rel="noreferrer" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                View
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/admin/pages')}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create page' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <div>
            <Label htmlFor="page-title">Title</Label>
            <Input
              id="page-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="page-slug">Slug</Label>
            <Input
              id="page-slug"
              value={draft.slug}
              placeholder={slugify(draft.title) || 'about'}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-500">Public URL: /{slug || '…'}</p>
          </div>
          <div>
            <Label htmlFor="page-summary">Summary (optional)</Label>
            <Input
              id="page-summary"
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })}
            />
            Published (visible to anonymous visitors)
          </label>
        </div>

        <div className="md:col-span-2">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Label htmlFor="page-body">Body (Markdown)</Label>
              <Textarea
                id="page-body"
                className="mt-2 h-[calc(100vh-19rem)] min-h-[24rem] resize-none font-mono text-sm"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </div>
            <div>
              <Label>Preview</Label>
              <div className="mt-2 h-[calc(100vh-19rem)] min-h-[24rem] overflow-y-auto rounded-md border border-gray-200 bg-white p-5">
                <h1 className="mb-2 text-2xl font-semibold">{draft.title || 'Untitled'}</h1>
                {draft.summary && <p className="mb-4 text-gray-600">{draft.summary}</p>}
                <div className="kent-prose">
                  <ReactMarkdown>{draft.body}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
