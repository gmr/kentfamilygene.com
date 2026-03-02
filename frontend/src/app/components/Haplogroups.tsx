import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useHaplogroupsQuery,
  useCreateHaplogroupMutation,
  useUpdateHaplogroupMutation,
  useDeleteHaplogroupMutation,
  type Haplogroup,
} from '../../generated/graphql';

const haplogroupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subclade: z.string().optional(),
  abbreviation: z.string().optional(),
  haplogroupType: z.enum(['Y_DNA', 'MT_DNA']),
  confirmationStatus: z.enum(['PREDICTED', 'CONFIRMED']),
});

type HaplogroupFormData = z.infer<typeof haplogroupSchema>;

export function Haplogroups() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingHaplogroup, setEditingHaplogroup] = useState<Haplogroup | null>(null);

  const [{ data, fetching, error }, refetchHaplogroups] = useHaplogroupsQuery();

  const [, createHaplogroup] = useCreateHaplogroupMutation();
  const [, updateHaplogroup] = useUpdateHaplogroupMutation();
  const [, deleteHaplogroup] = useDeleteHaplogroupMutation();

  const haplogroups = data?.haplogroups?.items ?? [];
  const total = data?.haplogroups?.total ?? 0;

  const filtered = useMemo(() => {
    if (!searchQuery) return haplogroups;
    const query = searchQuery.toLowerCase();
    return haplogroups.filter(h =>
      h.name.toLowerCase().includes(query) ||
      h.subclade?.toLowerCase().includes(query) ||
      h.abbreviation?.toLowerCase().includes(query)
    );
  }, [haplogroups, searchQuery]);

  const isEditing = editingHaplogroup !== null;
  const modalOpen = isCreateModalOpen || isEditing;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<HaplogroupFormData>({
    resolver: zodResolver(haplogroupSchema),
    defaultValues: {
      name: '',
      subclade: '',
      abbreviation: '',
      haplogroupType: 'Y_DNA',
      confirmationStatus: 'PREDICTED',
    },
  });

  const haplogroupType = watch('haplogroupType');
  const name = watch('name');
  const subclade = watch('subclade');

  // Auto-generate abbreviation on create
  useEffect(() => {
    if (!isEditing && name && subclade) {
      setValue('abbreviation', `${name.charAt(0).toUpperCase()}-${subclade}`);
    }
  }, [name, subclade, isEditing, setValue]);

  useEffect(() => {
    if (editingHaplogroup) {
      reset({
        name: editingHaplogroup.name,
        subclade: editingHaplogroup.subclade ?? '',
        abbreviation: editingHaplogroup.abbreviation ?? '',
        haplogroupType: (editingHaplogroup.haplogroupType as 'Y_DNA' | 'MT_DNA') || 'Y_DNA',
        confirmationStatus: (editingHaplogroup.confirmationStatus as 'PREDICTED' | 'CONFIRMED') || 'PREDICTED',
      });
    } else if (isCreateModalOpen) {
      reset({
        name: '',
        subclade: '',
        abbreviation: '',
        haplogroupType: 'Y_DNA',
        confirmationStatus: 'PREDICTED',
      });
    }
  }, [editingHaplogroup, isCreateModalOpen, reset]);

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setEditingHaplogroup(null);
  };

  const onSubmit = async (formData: HaplogroupFormData) => {
    const input = {
      name: formData.name,
      subclade: formData.subclade || undefined,
      abbreviation: formData.abbreviation || undefined,
      haplogroupType: formData.haplogroupType,
      confirmationStatus: formData.confirmationStatus,
    };

    if (isEditing) {
      const result = await updateHaplogroup({ id: editingHaplogroup!.id, input });
      if (result.error) {
        toast.error('Failed to update haplogroup');
        return;
      }
      toast.success('Haplogroup updated');
    } else {
      const result = await createHaplogroup({ input });
      if (result.error) {
        toast.error('Failed to create haplogroup');
        return;
      }
      toast.success('Haplogroup created');
    }
    refetchHaplogroups({ requestPolicy: 'network-only' });
    closeModal();
  };

  const handleDelete = async () => {
    if (!editingHaplogroup) return;
    const result = await deleteHaplogroup({ id: editingHaplogroup.id });
    if (result.error) {
      toast.error('Failed to delete haplogroup');
      return;
    }
    toast.success('Haplogroup deleted');
    refetchHaplogroups({ requestPolicy: 'network-only' });
    closeModal();
  };

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((haplogroup) => (
                <TableRow key={haplogroup.id} className="cursor-pointer" onClick={() => setEditingHaplogroup(haplogroup)}>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="p-4 border-t bg-muted/20 text-sm text-muted-foreground text-right">
            Showing {filtered.length} of {total} haplogroups
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <Dialog open onOpenChange={closeModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Haplogroup' : 'Create Haplogroup'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="hg-name">Name *</Label>
                <Input
                  id="hg-name"
                  {...register('name')}
                  placeholder="R1b1a2"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="hg-subclade">Subclade</Label>
                <Input id="hg-subclade" {...register('subclade')} placeholder="M269" />
              </div>

              <div>
                <Label htmlFor="hg-abbreviation">Abbreviation</Label>
                <Input id="hg-abbreviation" {...register('abbreviation')} placeholder="R-M269" />
                {!isEditing && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-generated from name + subclade. You can override.
                  </p>
                )}
              </div>

              <div>
                <Label>Type</Label>
                <RadioGroup
                  value={haplogroupType}
                  onValueChange={(value) => setValue('haplogroupType', value as 'Y_DNA' | 'MT_DNA')}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Y_DNA" id="y-dna" />
                    <Label htmlFor="y-dna" className="font-normal cursor-pointer">y-DNA</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="MT_DNA" id="mt-dna" />
                    <Label htmlFor="mt-dna" className="font-normal cursor-pointer">mt-DNA</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Confirmation Status</Label>
                <RadioGroup
                  value={watch('confirmationStatus')}
                  onValueChange={(value) => setValue('confirmationStatus', value as 'PREDICTED' | 'CONFIRMED')}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PREDICTED" id="predicted" />
                    <Label htmlFor="predicted" className="font-normal cursor-pointer">Predicted</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="CONFIRMED" id="confirmed" />
                    <Label htmlFor="confirmed" className="font-normal cursor-pointer">Confirmed</Label>
                  </div>
                </RadioGroup>
              </div>

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
                          <AlertDialogTitle>Delete Haplogroup</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{editingHaplogroup?.name}"? This action cannot be undone.
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
