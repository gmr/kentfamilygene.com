import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
  useUpdatePageMutation,
  useDeletePageMutation,
  type PagesQuery,
} from '../../generated/graphql';

type Page = PagesQuery['pages'][number];

export function Pages() {
  const [{ data, fetching, error }, refetch] = usePagesQuery({
    requestPolicy: 'cache-and-network',
  });
  const [, updatePage] = useUpdatePageMutation();
  const [, deletePage] = useDeletePageMutation();
  const navigate = useNavigate();

  const pages = data?.pages ?? [];

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
        <Button onClick={() => navigate('/admin/pages/new')} className="gap-2">
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
              <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/pages/${page.id}`)} title="Edit">
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

    </div>
  );
}
