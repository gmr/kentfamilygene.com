import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, CheckCircle, Circle } from 'lucide-react';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  useAdminNotesQuery,
  useCreateAdminNoteMutation,
  useUpdateAdminNoteMutation,
  useDeleteAdminNoteMutation,
  type AdminNote,
} from '../../generated/graphql';

const noteColorClasses: Record<string, string> = {
  PINK: 'border-pink-400 bg-pink-50',
  ORANGE: 'border-orange-400 bg-orange-50',
  BLUE: 'border-blue-400 bg-blue-50',
  GREEN: 'border-green-400 bg-green-50',
};

const noteColorBadge: Record<string, string> = {
  PINK: 'bg-pink-500',
  ORANGE: 'bg-orange-500',
  BLUE: 'bg-blue-500',
  GREEN: 'bg-green-500',
};

const noteColors = {
  PINK: { label: 'Action Required', bgColor: 'bg-pink-100', borderColor: 'border-pink-300' },
  ORANGE: { label: 'Question', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
  BLUE: { label: 'Information', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
  GREEN: { label: 'Completed', bgColor: 'bg-green-100', borderColor: 'border-green-300' },
};

const noteSchema = z.object({
  color: z.enum(['PINK', 'ORANGE', 'BLUE', 'GREEN']),
  text: z.string().min(1, 'Note text is required'),
});

type NoteFormData = z.infer<typeof noteSchema>;

export function AdminNotes() {
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<AdminNote | null>(null);
  const [offset, setOffset] = useState(0);

  const resolved = statusFilter === 'open' ? false : statusFilter === 'resolved' ? true : undefined;

  const [{ data, fetching, error }, refetchNotes] = useAdminNotesQuery({
    variables: {
      color: colorFilter !== 'all' ? colorFilter.toUpperCase() : undefined,
      resolved,
      offset,
      limit: 50,
    },
  });

  const [, createAdminNote] = useCreateAdminNoteMutation();
  const [, updateAdminNote] = useUpdateAdminNoteMutation();
  const [, deleteAdminNote] = useDeleteAdminNoteMutation();

  const notes = data?.adminNotes?.items ?? [];
  const total = data?.adminNotes?.total ?? 0;
  const hasMore = data?.adminNotes?.hasMore ?? false;

  const filtered = useMemo(() => {
    if (!searchQuery) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(n => n.text.toLowerCase().includes(query));
  }, [notes, searchQuery]);

  const isEditing = editingNote !== null;
  const modalOpen = isCreateModalOpen || isEditing;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      color: 'PINK',
      text: '',
    },
  });

  const color = watch('color');

  useEffect(() => {
    if (editingNote) {
      reset({
        color: (editingNote.color?.toUpperCase() as NoteFormData['color']) || 'PINK',
        text: editingNote.text,
      });
    } else if (isCreateModalOpen) {
      reset({ color: 'PINK', text: '' });
    }
  }, [editingNote, isCreateModalOpen, reset]);

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setEditingNote(null);
  };

  const onSubmit = async (formData: NoteFormData) => {
    if (isEditing) {
      const result = await updateAdminNote({
        id: editingNote!.id,
        input: { color: formData.color, text: formData.text },
      });
      if (result.error) {
        toast.error('Failed to update note');
        return;
      }
      toast.success('Note updated');
    } else {
      const result = await createAdminNote({
        input: { color: formData.color, text: formData.text },
      });
      if (result.error) {
        toast.error('Failed to create note');
        return;
      }
      toast.success('Note created');
    }
    refetchNotes({ requestPolicy: 'network-only' });
    closeModal();
  };

  const handleDelete = async () => {
    if (!editingNote) return;
    const result = await deleteAdminNote({ id: editingNote.id });
    if (result.error) {
      toast.error('Failed to delete note');
      return;
    }
    toast.success('Note deleted');
    refetchNotes({ requestPolicy: 'network-only' });
    closeModal();
  };

  const handleToggleResolved = async (note: AdminNote) => {
    const result = await updateAdminNote({
      id: note.id,
      input: { resolved: !note.resolved },
    });
    if (result.error) {
      toast.error('Failed to update note');
      return;
    }
    toast.success(note.resolved ? 'Note reopened' : 'Note resolved');
    refetchNotes({ requestPolicy: 'network-only' });
  };

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
            <SelectItem value="PINK">Pink</SelectItem>
            <SelectItem value="ORANGE">Orange</SelectItem>
            <SelectItem value="BLUE">Blue</SelectItem>
            <SelectItem value="GREEN">Green</SelectItem>
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
                className={`border-l-4 rounded-lg p-4 ${noteColorClasses[note.color?.toUpperCase() ?? ''] || 'border-gray-300 bg-gray-50'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${noteColorBadge[note.color?.toUpperCase() ?? ''] || 'bg-gray-400'}`} />
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
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleResolved(note)}
                      title={note.resolved ? 'Reopen' : 'Resolve'}
                    >
                      {note.resolved ? (
                        <Circle className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingNote(note)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
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

      {/* Create/Edit Modal */}
      {modalOpen && (
        <Dialog open onOpenChange={closeModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Note' : 'Create Note'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Color</Label>
                <RadioGroup
                  value={color}
                  onValueChange={(value) => setValue('color', value as NoteFormData['color'])}
                  className="grid grid-cols-2 gap-3 mt-2"
                >
                  {(Object.entries(noteColors) as [string, typeof noteColors.PINK][]).map(([colorKey, config]) => (
                    <div key={colorKey}>
                      <RadioGroupItem
                        value={colorKey}
                        id={`note-color-${colorKey}`}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor={`note-color-${colorKey}`}
                        className={`
                          flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer
                          transition-colors peer-checked:border-primary
                          ${config.bgColor}
                        `}
                      >
                        <div className={`w-3 h-3 rounded-full ${noteColorBadge[colorKey]}`} />
                        <span className="font-medium text-sm">{config.label}</span>
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="note-text">Note *</Label>
                <Textarea
                  id="note-text"
                  {...register('text')}
                  rows={4}
                  placeholder="Enter note text..."
                  className={errors.text ? 'border-red-500' : ''}
                />
                {errors.text && (
                  <p className="text-sm text-red-500 mt-1">{errors.text.message}</p>
                )}
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
                          <AlertDialogTitle>Delete Note</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this note? This action cannot be undone.
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
