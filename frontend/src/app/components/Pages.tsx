import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import {
  usePagesQuery,
  useCreatePageMutation,
  useUpdatePageMutation,
  useDeletePageMutation,
  type PagesQuery,
} from '../../generated/graphql';

type Page = PagesQuery['pages'][number];

interface Draft {
  slug: string;
  title: string;
  summary: string;
  body: string;
  isPublished: boolean;
}

const EMPTY: Draft = { slug: '', title: '', summary: '', body: '', isPublished: false };

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function Pages() {
  const [{ data, fetching, error }, refetch] = usePagesQuery({
    requestPolicy: 'cache-and-network',
  });
  const [, createPage] = useCreatePageMutation();
  const [, updatePage] = useUpdatePageMutation();
  const [, deletePage] = useDeletePageMutation();

  const [editing, setEditing] = useState<Page | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const pages = data?.pages ?? [];
  const open = creating || editing !== null;

  const openCreate = () => {
    setDraft(EMPTY);
    setCreating(true);
  };

  const openEdit = (page: Page) => {
    setDraft({
      slug: page.slug,
      title: page.title,
      summary: page.summary ?? '',
      body: page.body,
      isPublished: page.isPublished,
    });
    setEditing(page);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
    setDraft(EMPTY);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error('Title is required');
      return;
    }
    const slug = slugify(draft.slug || draft.title);
    if (!slug) {
      toast.error('Slug is required');
      return;
    }
    setSaving(true);
    const input = {
      slug,
      title: draft.title,
      body: draft.body,
      summary: draft.summary || undefined,
      isPublished: draft.isPublished,
    };
    const result = editing
      ? await updatePage({ id: editing.id, input })
      : await createPage({ input });
    setSaving(false);
    if (result.error) {
      toast.error(result.error.message.replace('[GraphQL] ', ''));
      return;
    }
    toast.success(editing ? 'Page updated' : 'Page created');
    close();
    refetch({ requestPolicy: 'network-only' });
  };

  const togglePublished = async (page: Page) => {
    const result = await updatePage({
      id: page.id,
      input: { isPublished: !page.isPublished },
    });
    if (result.error) {
      toast.error(result.error.message.replace('[GraphQL] ', ''));
      return;
    }
    toast.success(page.isPublished ? 'Page unpublished' : 'Page published');
    refetch({ requestPolicy: 'network-only' });
  };

  const remove = async (page: Page) => {
    const result = await deletePage({ id: page.id });
    if (result.error) {
      toast.error(result.error.message.replace('[GraphQL] ', ''));
      return;
    }
    toast.success('Page deleted');
    refetch({ requestPolicy: 'network-only' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pages</h2>
          <p className="text-sm text-gray-500">
            Standalone Markdown pages served at /&lt;slug&gt; on the public site.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New page
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {fetching && pages.length === 0 && <p className="text-sm text-gray-500">Loading…</p>}
      {!fetching && pages.length === 0 && (
        <p className="text-sm text-gray-500">No pages yet. Create one to get started.</p>
      )}

      <div className="space-y-2">
        {pages.map((page) => (
          <div
            key={page.id}
            className="flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{page.title}</span>
                <Badge variant={page.isPublished ? 'default' : 'secondary'}>
                  {page.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </div>
              <div className="truncate text-sm text-gray-500">
                /{page.slug}
                {page.updatedDate ? ` · updated ${page.updatedDate.slice(0, 10)}` : ''}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <a href={`/${page.slug}`} target="_blank" rel="noreferrer" title="View page">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePublished(page)}
                title={page.isPublished ? 'Unpublish' : 'Publish'}
              >
                {page.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(page)} title="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" title="Delete">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{page.title}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the page and any links pointing at /{page.slug} will 404.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(page)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit page' : 'New page'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
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
                <p className="mt-1 text-xs text-gray-500">
                  Public URL: /{slugify(draft.slug || draft.title) || '…'}
                </p>
              </div>
              <div>
                <Label htmlFor="page-summary">Summary (optional)</Label>
                <Input
                  id="page-summary"
                  value={draft.summary}
                  onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="page-body">Body (Markdown)</Label>
                <Textarea
                  id="page-body"
                  rows={18}
                  className="font-mono text-sm"
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
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

            <div>
              <Label>Preview</Label>
              <div className="mt-2 h-[32rem] overflow-y-auto rounded-md border border-gray-200 bg-white p-4">
                <h1 className="mb-3 text-2xl font-semibold">{draft.title || 'Untitled'}</h1>
                <div className="kent-prose">
                  <ReactMarkdown>{draft.body}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
