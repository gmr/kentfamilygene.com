import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { toast } from 'sonner';
import { notesAPI } from '../../../lib/api';
import { AdminNote } from '../../../lib/mock-data';
import { TypeaheadSearch } from '../shared/TypeaheadSearch';
import { useState } from 'react';

const noteColors = {
  pink: {
    label: 'Action Required',
    description: 'Needs attention or action',
    icon: '🟣',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
    borderColor: 'border-pink-300 dark:border-pink-700',
  },
  orange: {
    label: 'Question',
    description: 'Needs research or follow-up',
    icon: '🟠',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-300 dark:border-orange-700',
  },
  blue: {
    label: 'Information',
    description: 'Note or cross-reference',
    icon: '🔵',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-300 dark:border-blue-700',
  },
  green: {
    label: 'Completed',
    description: 'Verified or ready',
    icon: '✅',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-300 dark:border-green-700',
  },
};

const noteSchema = z.object({
  color: z.enum(['pink', 'orange', 'blue', 'green']),
  text: z.string().min(1, 'Note text is required'),
  entityType: z.enum(['person', 'participant', 'lineage', 'place']),
  entityId: z.string().min(1, 'Must attach to an entity'),
  entityDisplay: z.string().min(1, 'Entity display name is required'),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface NoteFormProps {
  note?: AdminNote | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function NoteForm({ note, onSuccess, onCancel }: NoteFormProps) {
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      color: note?.color || 'pink',
      text: note?.text || '',
      entityType: note?.entityType || 'person',
      entityId: note?.entityId || '',
      entityDisplay: note?.entityDisplay || '',
    },
  });

  const color = watch('color');
  const entityType = watch('entityType');

  const onSubmit = async (data: NoteFormData) => {
    try {
      if (note) {
        await notesAPI.update(note.id, data);
        toast.success('Note updated successfully');
      } else {
        await notesAPI.create(data);
        toast.success('Note created successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error(`Failed to ${note ? 'update' : 'create'} note`);
      console.error('Error saving note:', error);
    }
  };

  const formatEntityResult = (entity: any) => {
    if (entityType === 'person') {
      return {
        primary: `${entity.givenName} ${entity.surname}${entity.nameQualifier ? ` ${entity.nameQualifier}` : ''}`,
        secondary: entity.birthPlace || entity.birthDate,
      };
    } else if (entityType === 'participant') {
      return {
        primary: entity.displayName,
        secondary: entity.email,
      };
    } else if (entityType === 'lineage') {
      return {
        primary: entity.displayName,
        secondary: `${entity.participantCount} participants`,
      };
    } else if (entityType === 'place') {
      return {
        primary: entity.name,
        secondary: `${entity.state}, ${entity.country}`,
      };
    }
    return { primary: entity.name || entity.displayName, secondary: '' };
  };

  const handleEntitySelect = (entity: any) => {
    setSelectedEntity(entity);
    setValue('entityId', entity.id);

    // Set display name based on entity type
    let displayName = '';
    if (entityType === 'person') {
      displayName = `${entity.givenName} ${entity.surname}${entity.nameQualifier ? ` ${entity.nameQualifier}` : ''}`;
    } else if (entityType === 'participant') {
      displayName = entity.displayName;
    } else if (entityType === 'lineage') {
      displayName = entity.displayName;
    } else if (entityType === 'place') {
      displayName = entity.name;
    }

    setValue('entityDisplay', displayName);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Color Picker */}
      <div>
        <Label>Color</Label>
        <RadioGroup
          value={color}
          onValueChange={(value) => setValue('color', value as any)}
          className="grid grid-cols-2 gap-3 mt-2"
        >
          {Object.entries(noteColors).map(([colorKey, config]) => (
            <div key={colorKey}>
              <RadioGroupItem
                value={colorKey}
                id={colorKey}
                className="peer sr-only"
              />
              <label
                htmlFor={colorKey}
                className={`
                  flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer
                  transition-colors peer-checked:border-primary
                  ${config.bgColor}
                `}
              >
                <span className="text-xl">{config.icon}</span>
                <div>
                  <div className="font-medium text-sm">{config.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {config.description}
                  </div>
                </div>
              </label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Note Text */}
      <div>
        <Label htmlFor="text">Note</Label>
        <Textarea
          id="text"
          {...register('text')}
          rows={4}
          placeholder="Enter note text..."
          className={errors.text ? 'border-red-500' : ''}
        />
        {errors.text && (
          <p className="text-sm text-red-500 mt-1">{errors.text.message}</p>
        )}
      </div>

      {/* Entity Type */}
      <div>
        <Label>Attach To</Label>
        <Select
          value={entityType}
          onValueChange={(value) => {
            setValue('entityType', value as any);
            setValue('entityId', ''); // Reset entity selection
            setValue('entityDisplay', '');
            setSelectedEntity(null);
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="person">Person</SelectItem>
            <SelectItem value="participant">Participant</SelectItem>
            <SelectItem value="lineage">Lineage</SelectItem>
            <SelectItem value="place">Place</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Entity Search */}
      <div>
        <Label>{`Select ${entityType}`}</Label>
        <TypeaheadSearch
          entityType={entityType}
          formatResult={formatEntityResult}
          onSelect={handleEntitySelect}
        />
        {errors.entityId && (
          <p className="text-sm text-red-500 mt-1">{errors.entityId.message}</p>
        )}
        {selectedEntity && (
          <p className="text-sm text-muted-foreground mt-1">
            Selected: {formatEntityResult(selectedEntity).primary}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : note ? 'Update Note' : 'Create Note'}
        </Button>
      </div>
    </form>
  );
}
