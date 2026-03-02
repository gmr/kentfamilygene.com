import { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Pencil, Plus, Search, X } from 'lucide-react';
import { useLineagesQuery, type Lineage } from '../../generated/graphql';

export function Lineages() {
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newLineagesFilter, setNewLineagesFilter] = useState(false);
  const [offset, setOffset] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLineage, setEditingLineage] = useState<Lineage | null>(null);

  // Fetch all lineages (unfiltered) to populate region dropdown
  const [{ data: allData }] = useLineagesQuery({
    variables: { offset: 0, limit: 500 },
  });

  const [{ data, fetching, error }] = useLineagesQuery({
    variables: {
      region: regionFilter !== 'all' ? regionFilter : undefined,
      offset,
      limit: 50,
    },
  });

  const lineages = data?.lineages?.items ?? [];
  const total = data?.lineages?.total ?? 0;
  const hasMore = data?.lineages?.hasMore ?? false;

  // Extract unique regions from ALL lineages for filter dropdown
  const regions = useMemo(() => {
    const allLineages = allData?.lineages?.items ?? [];
    return Array.from(new Set(allLineages.map(l => l.region).filter(Boolean))).sort() as string[];
  }, [allData]);

  // Client-side filters
  const filteredLineages = useMemo(() => {
    let filtered = [...lineages];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.displayName.toLowerCase().includes(query) ||
        l.statusNote?.toLowerCase().includes(query)
      );
    }

    if (newLineagesFilter) {
      filtered = filtered.filter(l => l.isNew);
    }

    return filtered;
  }, [lineages, searchQuery, newLineagesFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Lineages</h2>
          <p className="text-sm text-gray-600 mt-1">Manage project lineages and migration paths</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Lineage
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Region</Label>
              <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setOffset(0); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map(region => (
                    <SelectItem key={region} value={region}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search lineages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button
                variant={newLineagesFilter ? 'default' : 'outline'}
                onClick={() => setNewLineagesFilter(!newLineagesFilter)}
                className="w-full"
              >
                New Lineages
              </Button>
            </div>
          </div>

          {(regionFilter !== 'all' || searchQuery || newLineagesFilter) && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm text-gray-600">Active filters:</span>
              {regionFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Region: {regionFilter}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setRegionFilter('all')} />
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                </Badge>
              )}
              {newLineagesFilter && (
                <Badge variant="secondary" className="gap-1">
                  New Lineages
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setNewLineagesFilter(false)} />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lineages Table */}
      <Card>
        <CardContent className="pt-6">
          {fetching ? (
            <div className="text-center py-8">Loading lineages...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">Failed to load lineages</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>No.</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLineages.map((lineage) => (
                    <TableRow key={lineage.id}>
                      <TableCell className="font-medium">{lineage.region}</TableCell>
                      <TableCell>{lineage.originState}</TableCell>
                      <TableCell>{lineage.lineageNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {lineage.displayName}
                          {lineage.isNew && (
                            <Badge variant="secondary" className="text-xs">New</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lineage.statusNote && (
                          <span className="text-sm text-gray-600">{lineage.statusNote}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingLineage(lineage)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredLineages.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No lineages found matching your filters
                </div>
              )}

              {/* Pagination */}
              {total > 50 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-600">
                    Showing {offset + 1}-{Math.min(offset + 50, total)} of {total}
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
        </CardContent>
      </Card>

      {/* Create/Edit Modal — placeholder for Phase 3c */}
      {(showCreateModal || editingLineage) && (
        <Dialog open onOpenChange={() => { setShowCreateModal(false); setEditingLineage(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLineage ? 'Edit Lineage' : 'Create Lineage'}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500 py-4">Form wiring coming in Phase 3c.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditingLineage(null); }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
