import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
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
  useSnippetsQuery,
  useCreateSnippetMutation,
  useUpdateSnippetMutation,
  useDeleteSnippetMutation,
  type SnippetsQuery,
} from '../../generated/graphql';

type Snippet = SnippetsQuery['snippets'][number];

interface Draft {
  key: string;
  title: string;
  body: string;
}

const EMPTY: Draft = { key: '', title: '', body: '' };

export function Snippets() {
  const [{ data, fetching, error }, refetch] = useSnippetsQuery({
    requestPolicy: 'cache-and-network',
  });
  const [, createSnippet] = useCreateSnippetMutation();
  const [, updateSnippet] = useUpdateSnippetMutation();
  const [, deleteSnippet] = useDeleteSnippetMutation();

  const [editing, setEditing] = useState<Snippet | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const snippets = data?.snippets ?? [];
  const open = creating || editing !== null;

  const close = () => {
    setCreating(false);
    setEditing(null);
    setDraft(EMPTY);
  };

  const save = async () => {
    if (!draft.key.trim()) {
      toast.error('Key is required');
      return;
    }
    setSaving(true);
    const result = editing
      ? await updateSnippet({
          id: editing.id,
          input: { key: draft.key, title: draft.title, body: draft.body },
        })
      : await createSnippet({
          input: { key: draft.key, title: draft.title, body: draft.body },
        });
    setSaving(false);
    if (result.error) {
      toast.error(result.error.message.replace('[GraphQL] ', ''));
      return;
    }
    toast.success(editing ? 'Snippet updated' : 'Snippet created');
    close();
    refetch({ requestPolicy: 'network-only' });
  };

  const remove = async (snippet: Snippet) => {
    const result = await deleteSnippet({ id: snippet.id });
    if (result.error) {
      toast.error(result.error.message.replace('[GraphQL] ', ''));
      return;
    }
    toast.success('Snippet deleted');
    refetch({ requestPolicy: 'network-only' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Snippets</h2>
          <p className="text-sm text-gray-500">
            Reusable blocks of copy pulled into the public site by key.
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(EMPTY);
            setCreating(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New snippet
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {!fetching && snippets.length === 0 && (
        <p className="text-sm text-gray-500">No snippets yet.</p>
      )}

      <div className="space-y-2">
        {snippets.map((snippet) => (
          <div
            key={snippet.id}
            className="flex items-start justify-between gap-4 rounded-md border border-gray-200 bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <div className="font-mono text-sm font-medium">{snippet.key}</div>
              {snippet.title && <div className="text-sm text-gray-700">{snippet.title}</div>}
              <div className="mt-1 line-clamp-2 text-sm text-gray-500">{snippet.body}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                title="Edit"
                onClick={() => {
                  setDraft({
                    key: snippet.key,
                    title: snippet.title ?? '',
                    body: snippet.body,
                  });
                  setEditing(snippet);
                }}
              >
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
                    <AlertDialogTitle>Delete “{snippet.key}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Anywhere the site renders this key will fall back to its built-in copy.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(snippet)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit snippet' : 'New snippet'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="snippet-key">Key</Label>
              <Input
                id="snippet-key"
                className="font-mono"
                placeholder="footer-blurb"
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="snippet-title">Title (optional, admin-only label)</Label>
              <Input
                id="snippet-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="snippet-body">Body (Markdown)</Label>
              <Textarea
                id="snippet-body"
                rows={8}
                className="font-mono text-sm"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </div>
            <div>
              <Label>Preview</Label>
              <div className="kent-prose mt-2 rounded-md border border-gray-200 bg-white p-4">
                <ReactMarkdown>{draft.body}</ReactMarkdown>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create snippet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
