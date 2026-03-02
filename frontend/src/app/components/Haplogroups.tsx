import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Plus, Search, Pencil } from 'lucide-react';
import { useHaplogroupsQuery, type Haplogroup } from '../../generated/graphql';

export function Haplogroups() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingHaplogroup, setEditingHaplogroup] = useState<Haplogroup | null>(null);

  // Small dataset — fetch all
  const [{ data, fetching, error }] = useHaplogroupsQuery({
    variables: { offset: 0, limit: 200 },
  });

  const haplogroups = data?.haplogroups?.items ?? [];

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!searchQuery) return haplogroups;
    const query = searchQuery.toLowerCase();
    return haplogroups.filter(h =>
      h.name.toLowerCase().includes(query) ||
      h.subclade?.toLowerCase().includes(query) ||
      h.abbreviation?.toLowerCase().includes(query)
    );
  }, [haplogroups, searchQuery]);

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading haplogroups...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Failed to load haplogroups</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Haplogroups</h1>
          <p className="text-sm text-muted-foreground">
            Manage haplogroup definitions and view assigned participants.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Haplogroup
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search haplogroups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-4">
            {searchQuery ? 'No haplogroups found matching your search.' : 'No haplogroups found.'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Haplogroup
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Abbreviation</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Subclade</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((haplogroup) => (
                <TableRow key={haplogroup.id}>
                  <TableCell className="font-medium">{haplogroup.abbreviation}</TableCell>
                  <TableCell>{haplogroup.name}</TableCell>
                  <TableCell>{haplogroup.subclade || '\u2014'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {haplogroup.haplogroupType === 'Y_DNA' ? 'y-DNA' : haplogroup.haplogroupType === 'MT_DNA' ? 'mt-DNA' : haplogroup.haplogroupType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {haplogroup.confirmationStatus && (
                      <Badge variant={haplogroup.confirmationStatus === 'CONFIRMED' ? 'default' : 'secondary'}>
                        {haplogroup.confirmationStatus === 'CONFIRMED' ? 'Confirmed' : 'Predicted'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Edit"
                      onClick={() => setEditingHaplogroup(haplogroup)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="p-4 border-t bg-muted/20 text-sm text-muted-foreground">
            Showing {filtered.length} haplogroup{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Create/Edit Modal — placeholder for Phase 3c */}
      {(isCreateModalOpen || editingHaplogroup) && (
        <Dialog open onOpenChange={() => { setIsCreateModalOpen(false); setEditingHaplogroup(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHaplogroup ? 'Edit Haplogroup' : 'Create Haplogroup'}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500 py-4">Form wiring coming in Phase 3c.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateModalOpen(false); setEditingHaplogroup(null); }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
