import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { OnlineTree } from '../../../lib/mock-data';

interface OnlineTreeFormProps {
  tree?: OnlineTree;
  open: boolean;
  onSave: (tree: Omit<OnlineTree, 'id'>) => void;
  onCancel: () => void;
}

const onlineTreeSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  username: z.string().min(1, 'Username is required'),
  treeName: z.string().min(1, 'Tree name is required'),
  url: z.string().url('Must be a valid URL'),
});

type OnlineTreeFormData = z.infer<typeof onlineTreeSchema>;

export function OnlineTreeForm({ tree, open, onSave, onCancel }: OnlineTreeFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<OnlineTreeFormData>({
    resolver: zodResolver(onlineTreeSchema),
    defaultValues: tree || {
      provider: 'Ancestry',
      username: '',
      treeName: '',
      url: '',
    },
  });

  const onSubmit = (data: OnlineTreeFormData) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tree ? 'Edit Online Tree' : 'Add Online Tree'}</DialogTitle>
          <DialogDescription>
            {tree ? 'Update the online tree information.' : 'Add a new online genealogy tree.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Provider */}
          <div>
            <Label htmlFor="provider">Platform *</Label>
            <Select
              value={watch('provider')}
              onValueChange={(value) => setValue('provider', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ancestry">Ancestry.com</SelectItem>
                <SelectItem value="FamilySearch">FamilySearch</SelectItem>
                <SelectItem value="MyHeritage">MyHeritage</SelectItem>
                <SelectItem value="FindMyPast">FindMyPast</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.provider && (
              <p className="text-sm text-red-600 mt-1">{errors.provider.message}</p>
            )}
          </div>

          {/* Username */}
          <div>
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              placeholder="Your username on this platform"
              {...register('username')}
            />
            {errors.username && (
              <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>
            )}
          </div>

          {/* Tree Name */}
          <div>
            <Label htmlFor="treeName">Tree Name *</Label>
            <Input
              id="treeName"
              placeholder="Name of your family tree"
              {...register('treeName')}
            />
            {errors.treeName && (
              <p className="text-sm text-red-600 mt-1">{errors.treeName.message}</p>
            )}
          </div>

          {/* URL */}
          <div>
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://..."
              {...register('url')}
            />
            {errors.url && (
              <p className="text-sm text-red-600 mt-1">{errors.url.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {tree ? 'Save Changes' : 'Add Tree'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
