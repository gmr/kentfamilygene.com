import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { haplogroupsAPI } from '../../../lib/api';
import { Haplogroup } from '../../../lib/mock-data';

const haplogroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name too long'),
  subclade: z
    .string()
    .min(1, 'Subclade is required')
    .max(20, 'Subclade too long'),
  abbreviation: z
    .string()
    .min(1, 'Abbreviation is required')
    .max(20, 'Abbreviation too long')
    .regex(/^[A-Z0-9]/, 'Must start with a letter or number'),
  type: z.enum(['y-DNA', 'mtDNA']),
});

type HaplogroupFormData = z.infer<typeof haplogroupSchema>;

interface HaplogroupFormProps {
  haplogroup?: Haplogroup | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function HaplogroupForm({
  haplogroup,
  onSuccess,
  onCancel,
}: HaplogroupFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<HaplogroupFormData>({
    resolver: zodResolver(haplogroupSchema),
    defaultValues: {
      name: haplogroup?.name || '',
      subclade: haplogroup?.subclade || '',
      abbreviation: haplogroup?.abbreviation || '',
      type: haplogroup?.type || 'y-DNA',
    },
  });

  // Watch name and subclade for auto-generation
  const name = watch('name');
  const subclade = watch('subclade');
  const type = watch('type');

  // Auto-generate abbreviation when creating new haplogroup
  useEffect(() => {
    if (!haplogroup && name && subclade) {
      const abbr = `${name.charAt(0).toUpperCase()}-${subclade}`;
      setValue('abbreviation', abbr);
    }
  }, [name, subclade, haplogroup, setValue]);

  const onSubmit = async (data: HaplogroupFormData) => {
    try {
      if (haplogroup) {
        await haplogroupsAPI.update(haplogroup.id, data);
        toast.success('Haplogroup updated successfully');
      } else {
        await haplogroupsAPI.create(data);
        toast.success('Haplogroup created successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error(`Failed to ${haplogroup ? 'update' : 'create'} haplogroup`);
      console.error('Error saving haplogroup:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="R1b1a2"
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && (
          <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Subclade */}
      <div>
        <Label htmlFor="subclade">Subclade</Label>
        <Input
          id="subclade"
          {...register('subclade')}
          placeholder="M269"
          className={errors.subclade ? 'border-red-500' : ''}
        />
        {errors.subclade && (
          <p className="text-sm text-red-500 mt-1">{errors.subclade.message}</p>
        )}
      </div>

      {/* Abbreviation */}
      <div>
        <Label htmlFor="abbreviation">Abbreviation</Label>
        <Input
          id="abbreviation"
          {...register('abbreviation')}
          placeholder="R-M269"
          className={errors.abbreviation ? 'border-red-500' : ''}
        />
        {!haplogroup && (
          <p className="text-xs text-muted-foreground mt-1">
            Auto-generated from name + subclade. You can override if needed.
          </p>
        )}
        {errors.abbreviation && (
          <p className="text-sm text-red-500 mt-1">
            {errors.abbreviation.message}
          </p>
        )}
      </div>

      {/* Type */}
      <div>
        <Label>Type</Label>
        <RadioGroup
          value={type}
          onValueChange={(value) => setValue('type', value as 'y-DNA' | 'mtDNA')}
          className="flex gap-4 mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="y-DNA" id="y-dna" />
            <Label htmlFor="y-dna" className="font-normal cursor-pointer">
              🧬 y-DNA
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mtDNA" id="mtdna" />
            <Label htmlFor="mtdna" className="font-normal cursor-pointer">
              🧬 mtDNA
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Help Text */}
      <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
        <p>
          The abbreviation is automatically generated from the first letter of
          the name plus the subclade: <code className="bg-background px-1 py-0.5 rounded">{'{Name[0]}-{Subclade}'}</code>
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : haplogroup ? 'Update Haplogroup' : 'Create Haplogroup'}
        </Button>
      </div>
    </form>
  );
}
