import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { X, Plus } from 'lucide-react';
import { AdminNote } from '../../../lib/mock-data';

interface AdminNotesListProps {
  notes: AdminNote[];
  onChange: (notes: AdminNote[]) => void;
  entityType: 'person' | 'participant' | 'lineage';
  entityId: string;
}

const NOTE_COLORS = [
  { value: 'pink', label: 'Pink', bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-900' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-900' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-900' },
  { value: 'green', label: 'Green', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-900' },
];

export function AdminNotesList({ notes, onChange, entityType, entityId }: AdminNotesListProps) {
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteColor, setNewNoteColor] = useState<AdminNote['color']>('pink');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddNote = () => {
    if (newNoteText.trim() === '') return;

    const newNote: AdminNote = {
      id: `note-${Date.now()}`,
      color: newNoteColor,
      text: newNoteText,
      entityType,
      entityId,
      entityName: '', // Would be populated from context
      resolved: false,
      createdDate: new Date().toISOString(),
    };

    onChange([...notes, newNote]);
    setNewNoteText('');
    setNewNoteColor('pink');
    setShowAddForm(false);
  };

  const handleRemoveNote = (id: string) => {
    if (!confirm('Remove this admin note?')) return;
    onChange(notes.filter(n => n.id !== id));
  };

  const handleToggleResolved = (id: string) => {
    onChange(
      notes.map(n =>
        n.id === id ? { ...n, resolved: !n.resolved } : n
      )
    );
  };

  const getColorClasses = (color: AdminNote['color']) => {
    return NOTE_COLORS.find(c => c.value === color) || NOTE_COLORS[0];
  };

  return (
    <div className="space-y-3">
      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((note) => {
            const colorClasses = getColorClasses(note.color);
            return (
              <div
                key={note.id}
                className={`p-3 border rounded-lg ${colorClasses.bg} ${colorClasses.border} ${note.resolved ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className={`text-sm ${colorClasses.text} ${note.resolved ? 'line-through' : ''}`}>
                      {note.text}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(note.createdDate).toLocaleDateString()}
                      {note.resolved && ' • Resolved'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleResolved(note.id)}
                      className="text-xs px-2 py-1 rounded hover:bg-white/50"
                    >
                      {note.resolved ? 'Unresolve' : 'Resolve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveNote(note.id)}
                      className="p-1 rounded hover:bg-white/50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!showAddForm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Admin Note
        </Button>
      ) : (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Note Text</Label>
              <Input
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Enter note text..."
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <Select value={newNoteColor} onValueChange={(value) => setNewNoteColor(value as AdminNote['color'])}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_COLORS.map(color => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${color.bg} ${color.border} border`} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddNote}
              disabled={newNoteText.trim() === ''}
            >
              Add Note
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewNoteText('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
