import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Pencil, Trash2, User, Users, Building, MapPin } from 'lucide-react';
import { AdminNote } from '../../../lib/mock-data';

const noteColors = {
  pink: {
    label: 'Action Required',
    description: 'Needs attention or action',
    icon: '🟣',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
    borderColor: 'border-pink-300 dark:border-pink-700',
    textColor: 'text-pink-700 dark:text-pink-300',
  },
  orange: {
    label: 'Question',
    description: 'Needs research or follow-up',
    icon: '🟠',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-300 dark:border-orange-700',
    textColor: 'text-orange-700 dark:text-orange-300',
  },
  blue: {
    label: 'Information',
    description: 'Note or cross-reference',
    icon: '🔵',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-300 dark:border-blue-700',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  green: {
    label: 'Completed',
    description: 'Verified or ready',
    icon: '✅',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-300 dark:border-green-700',
    textColor: 'text-green-700 dark:text-green-300',
  },
};

interface NoteCardProps {
  note: AdminNote;
  onToggleResolved: (resolved: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function NoteCard({ note, onToggleResolved, onEdit, onDelete }: NoteCardProps) {
  const colorConfig = noteColors[note.color];

  const entityIcon = {
    person: User,
    participant: Users,
    lineage: Building,
    place: MapPin,
  }[note.entityType];

  const EntityIcon = entityIcon;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      className={`p-4 border-l-4 rounded-lg ${colorConfig.borderColor} ${colorConfig.bgColor}`}
    >
      <div className="flex items-start gap-3">
        {/* Color Icon */}
        <div className="flex-shrink-0 text-2xl pt-0.5">
          {colorConfig.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Note Text */}
          <p className="text-sm whitespace-pre-wrap">{note.text}</p>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            {/* Entity Link */}
            <div className="flex items-center gap-1">
              <EntityIcon className="h-3 w-3" />
              <span className="capitalize">{note.entityType}:</span>
              <span className="font-medium">{note.entityDisplay}</span>
            </div>

            {/* Created Date */}
            <span className="flex items-center gap-1">
              📅 {formatDate(note.createdAt)}
            </span>

            {/* Resolved Date */}
            {note.resolved && note.resolvedAt && (
              <span className="text-green-600 dark:text-green-400">
                Resolved on {new Date(note.resolvedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Resolved Checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`resolved-${note.id}`}
              checked={note.resolved}
              onCheckedChange={(checked) => onToggleResolved(checked as boolean)}
            />
            <label
              htmlFor={`resolved-${note.id}`}
              className="text-sm cursor-pointer"
            >
              Resolved
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}
