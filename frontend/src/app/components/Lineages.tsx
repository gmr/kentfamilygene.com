import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, Search, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useLineagesQuery,
  useCreateLineageMutation,
  useUpdateLineageMutation,
  useDeleteLineageMutation,
  type Lineage,
} from '../../generated/graphql';

const lineageSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  region: z.string().optional(),
  originState: z.string().optional(),
  lineageNumber: z.union([z.number().int().positive(), z.nan()]).optional(),
  statusNote: z.string().optional(),
  isNew: z.boolean().optional(),
  newLineageDate: z.string().optional(),
});

type LineageFormData = z.infer<typeof lineageSchema>;

export function Lineages() {
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newLineagesFilter, setNewLineagesFilter] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLineage, setEditingLineage] = useState<Lineage | null>(null);

  const [{ data, fetching, error }, refetchLineages] = useLineagesQuery();

  const [, createLineage] = useCreateLineageMutation();
  const [, updateLineage] = useUpdateLineageMutation();
  const [, deleteLineage] = useDeleteLineageMutation();

  const lineages = data?.lineages?.items ?? [];
  const total = data?.lineages?.total ?? 0;

  const regions = useMemo(() => {
    return Array.from(new Set(lineages.map(l => l.region).filter(Boolean))).sort() as string[];
  }, [lineages]);

  const filteredLineages = useMemo(() => {
    let filtered = [...lineages];

    if (regionFilter !== 'all') {
      filtered = filtered.filter(l => l.region === regionFilter);
    }

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
  }, [lineages, regionFilter, searchQuery, newLineagesFilter]);

  const isEditing = editingLineage !== null;
  const modalOpen = showCreateModal || isEditing;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LineageFormData>({
    resolver: zodResolver(lineageSchema),
    defaultValues: {
      displayName: '',
      region: '',
      originState: '',
      lineageNumber: undefined,
      statusNote: '',
      isNew: false,
      newLineageDate: '',
    },
  });

  const isNewChecked = watch('isNew');

  useEffect(() => {
    if (editingLineage) {
      reset({
        displayName: editingLineage.displayName,
        region: editingLineage.region ?? '',
        originState: editingLineage.originState ?? '',
        lineageNumber: editingLineage.lineageNumber ?? undefined,
        statusNote: editingLineage.statusNote ?? '',
        isNew: editingLineage.isNew,
        newLineageDate: editingLineage.newLineageDate ?? '',
      });
    } else if (showCreateModal) {
      reset({
        displayName: '',
        region: '',
        originState: '',
        lineageNumber: undefined,
        statusNote: '',
        isNew: false,
        newLineageDate: '',
      });
    }
  }, [editingLineage, showCreateModal, reset]);

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingLineage(null);
  };

  const onSubmit = async (formData: LineageFormData) => {
    const input = {
      displayName: formData.displayName,
      region: formData.region || undefined,
      originState: formData.originState || undefined,
      lineageNumber: formData.lineageNumber && !isNaN(formData.lineageNumber) ? formData.lineageNumber : undefined,
      statusNote: formData.statusNote || undefined,
      isNew: formData.isNew || false,
      newLineageDate: formData.newLineageDate || undefined,
    };

    if (isEditing) {
      const result = await updateLineage({ id: editingLineage!.id, input });
      if (result.error) {
        toast.error('Failed to update lineage');
        return;
      }
      toast.success('Lineage updated');
    } else {
      const result = await createLineage({ input });
      if (result.error) {
        toast.error('Failed to create lineage');
        return;
      }
      toast.success('Lineage created');
    }
    refetchLineages({ requestPolicy: 'network-only' });
    closeModal();
  };

  const handleDelete = async () => {
    if (!editingLineage) return;
    const result = await deleteLineage({ id: editingLineage.id });
    if (result.error) {
      toast.error('Failed to delete lineage');
      return;
    }
    toast.success('Lineage deleted');
    refetchLineages({ requestPolicy: 'network-only' });
    closeModal();
  };

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
              <Select value={regionFilter} onValueChange={(v) => setRegionFilter(v)}>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLineages.map((lineage) => (
                    <TableRow key={lineage.id} className="cursor-pointer" onClick={() => setEditingLineage(lineage)}>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredLineages.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No lineages found matching your filters
                </div>
              )}

              <div className="flex items-center justify-end mt-4 pt-4 border-t">
                <span className="text-sm text-gray-600">
                  Showing {filteredLineages.length} of {total} lineages
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <Dialog open onOpenChange={closeModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Lineage' : 'Create Lineage'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  {...register('displayName')}
                  placeholder="e.g., Kent of Virginia"
                  className={errors.displayName ? 'border-red-500' : ''}
                />
                {errors.displayName && (
                  <p className="text-sm text-red-500 mt-1">{errors.displayName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" {...register('region')} placeholder="Southeast" />
                </div>
                <div>
                  <Label htmlFor="originState">Origin State</Label>
                  <Input id="originState" {...register('originState')} placeholder="Virginia" />
                </div>
              </div>

              <div>
                <Label htmlFor="lineageNumber">Lineage Number</Label>
                <Input
                  id="lineageNumber"
                  type="number"
                  {...register('lineageNumber', { valueAsNumber: true })}
                  placeholder="1"
                />
              </div>

              <div>
                <Label htmlFor="statusNote">Status Note</Label>
                <Input id="statusNote" {...register('statusNote')} placeholder="Optional status note" />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isNew"
                  checked={isNewChecked}
                  onCheckedChange={(checked) => setValue('isNew', checked as boolean)}
                />
                <Label htmlFor="isNew" className="font-normal cursor-pointer">Mark as new lineage</Label>
              </div>

              {isNewChecked && (
                <div>
                  <Label htmlFor="newLineageDate">New Lineage Date</Label>
                  <Input id="newLineageDate" {...register('newLineageDate')} placeholder="2024-01-15" />
                </div>
              )}

              <DialogFooter className="flex justify-between sm:justify-between">
                <div>
                  {isEditing && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Lineage</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{editingLineage?.displayName}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
