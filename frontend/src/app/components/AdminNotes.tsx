import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Plus, Search } from 'lucide-react';
import { Badge } from './ui/badge';
import { useAdminNotesQuery, type AdminNote } from '../../generated/graphql';

const noteColorClasses: Record<string, string> = {
  PINK: 'border-pink-400 bg-pink-50',
  ORANGE: 'border-orange-400 bg-orange-50',
  BLUE: 'border-blue-400 bg-blue-50',
  GREEN: 'border-green-400 bg-green-50',
  pink: 'border-pink-400 bg-pink-50',
  orange: 'border-orange-400 bg-orange-50',
  blue: 'border-blue-400 bg-blue-50',
  green: 'border-green-400 bg-green-50',
};

const noteColorBadge: Record<string, string> = {
  PINK: 'bg-pink-500',
  ORANGE: 'bg-orange-500',
  BLUE: 'bg-blue-500',
  GREEN: 'bg-green-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
};

export function AdminNotes() {
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  const resolved = statusFilter === 'open' ? false : statusFilter === 'resolved' ? true : undefined;

  const [{ data, fetching, error }] = useAdminNotesQuery({
    variables: {
      color: colorFilter !== 'all' ? colorFilter.toUpperCase() : undefined,
      resolved,
      offset,
      limit: 50,
    },
  });

  const notes = data?.adminNotes?.items ?? [];
  const total = data?.adminNotes?.total ?? 0;
  const hasMore = data?.adminNotes?.hasMore ?? false;

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!searchQuery) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(n => n.text.toLowerCase().includes(query));
  }, [notes, searchQuery]);

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading notes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Failed to load notes</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Notes</h1>
          <p className="text-sm text-muted-foreground">
            Track color-coded notes across all entities.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap p-4 bg-muted/50 rounded-lg">
        <Select value={colorFilter} onValueChange={(v) => { setColorFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Colors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Colors</SelectItem>
            <SelectItem value="pink">Pink</SelectItem>
            <SelectItem value="orange">Orange</SelectItem>
            <SelectItem value="blue">Blue</SelectItem>
            <SelectItem value="green">Green</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Notes List */}
      {filtered.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-4">
            {searchQuery || colorFilter !== 'all' || statusFilter !== 'all'
              ? 'No notes found matching your filters.'
              : 'No notes found.'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Note
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((note) => (
              <div
                key={note.id}
                className={`border-l-4 rounded-lg p-4 ${noteColorClasses[note.color ?? ''] || 'border-gray-300 bg-gray-50'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${noteColorBadge[note.color ?? ''] || 'bg-gray-400'}`} />
                      <span className="text-xs text-muted-foreground capitalize">{note.color?.toLowerCase()}</span>
                      {note.resolved && (
                        <Badge variant="secondary" className="text-xs">Resolved</Badge>
                      )}
                    </div>
                    <p className="text-sm">{note.text}</p>
                    {note.createdDate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Created: {note.createdDate}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border rounded-lg bg-muted/20 text-sm text-muted-foreground text-center">
            Showing {filtered.length} note{filtered.length !== 1 ? 's' : ''}
            {(searchQuery || filtered.length !== notes.length) && ` of ${notes.length} on this page`}
            {total > 50 && ` (${total} total)`}
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Page {Math.floor(offset / 50) + 1}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setOffset(offset + 50)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Modal — placeholder for Phase 3c */}
      {isCreateModalOpen && (
        <Dialog open onOpenChange={() => setIsCreateModalOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Note</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500 py-4">Form wiring coming in Phase 3c.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
