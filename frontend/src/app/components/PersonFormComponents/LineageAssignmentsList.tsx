import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Plus, X, Dna } from 'lucide-react';
import { LineageAssignment, Lineage, mockLineages } from '../../../lib/mock-data';

interface LineageAssignmentsListProps {
  assignments: LineageAssignment[];
  onChange: (assignments: LineageAssignment[]) => void;
}

const ROLE_OPTIONS = [
  { value: 'potential_ancestor', label: 'Potential Ancestor', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed_ancestor', label: 'Confirmed Ancestor', color: 'bg-green-100 text-green-800' },
  { value: 'brick_wall', label: 'Brick Wall', color: 'bg-red-100 text-red-800' },
  { value: 'immigrant_ancestor', label: 'Immigrant Ancestor', color: 'bg-blue-100 text-blue-800' },
  { value: 'descendant', label: 'Descendant', color: 'bg-purple-100 text-purple-800' },
];

const CERTAINTY_OPTIONS = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'potential', label: 'Potential' },
  { value: 'unknown', label: 'Unknown' },
];

export function LineageAssignmentsList({ assignments, onChange }: LineageAssignmentsListProps) {
  const [showModal, setShowModal] = useState(false);

  const handleAddAssignment = (assignment: LineageAssignment) => {
    onChange([...assignments, assignment]);
  };

  const handleUpdateAssignment = (id: string, field: 'role' | 'certainty', value: string) => {
    onChange(
      assignments.map(a =>
        a.id === id ? { ...a, [field]: value } : a
      )
    );
  };

  const handleRemoveAssignment = (id: string) => {
    if (!confirm('Remove this lineage assignment?')) return;
    onChange(assignments.filter(a => a.id !== id));
  };

  const getRoleColor = (role: string) => {
    return ROLE_OPTIONS.find(r => r.value === role)?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {assignments.length > 0 ? (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Dna className="h-5 w-5 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">{assignment.lineage.displayName}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {assignment.lineage.region} • {assignment.lineage.originState}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1">
                        <Label className="text-xs">Role</Label>
                        <Select
                          value={assignment.role}
                          onValueChange={(value) => handleUpdateAssignment(assignment.id, 'role', value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map(role => (
                              <SelectItem key={role.value} value={role.value}>
                                <span className={`px-2 py-0.5 rounded ${role.color}`}>
                                  {role.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Certainty</Label>
                        <Select
                          value={assignment.certainty}
                          onValueChange={(value) => handleUpdateAssignment(assignment.id, 'certainty', value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CERTAINTY_OPTIONS.map(cert => (
                              <SelectItem key={cert.value} value={cert.value}>
                                {cert.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveAssignment(assignment.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getRoleColor(assignment.role)}>
                  {ROLE_OPTIONS.find(r => r.value === assignment.role)?.label}
                </Badge>
                <Badge variant="outline">{assignment.certainty}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 text-center py-4 border rounded-lg bg-gray-50">
          No lineage assignments yet
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowModal(true)}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Assign to Lineage
      </Button>

      {showModal && (
        <LineageAssignmentModal
          onClose={() => setShowModal(false)}
          onAdd={handleAddAssignment}
          existingAssignments={assignments}
        />
      )}
    </div>
  );
}

// Lineage Assignment Modal
interface LineageAssignmentModalProps {
  onClose: () => void;
  onAdd: (assignment: LineageAssignment) => void;
  existingAssignments: LineageAssignment[];
}

function LineageAssignmentModal({ onClose, onAdd, existingAssignments }: LineageAssignmentModalProps) {
  const [selectedLineage, setSelectedLineage] = useState<Lineage | null>(null);
  const [role, setRole] = useState<LineageAssignment['role']>('potential_ancestor');
  const [certainty, setCertainty] = useState<LineageAssignment['certainty']>('potential');

  const availableLineages = mockLineages.filter(
    lineage => !existingAssignments.some(a => a.lineage.id === lineage.id)
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to Lineage</DialogTitle>
          <DialogDescription>
            Select a lineage and specify the role and certainty of the assignment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Lineage</Label>
            <Select
              value={selectedLineage?.id || ''}
              onValueChange={(value) => {
                const lineage = availableLineages.find(l => l.id === value);
                setSelectedLineage(lineage || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a lineage..." />
              </SelectTrigger>
              <SelectContent>
                {availableLineages.map(lineage => (
                  <SelectItem key={lineage.id} value={lineage.id}>
                    {lineage.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Role in Lineage</Label>
            <Select value={role} onValueChange={(value) => setRole(value as LineageAssignment['role'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>
                    <span className={`px-2 py-0.5 rounded ${r.color}`}>
                      {r.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Certainty</Label>
            <Select value={certainty} onValueChange={(value) => setCertainty(value as LineageAssignment['certainty'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CERTAINTY_OPTIONS.map(cert => (
                  <SelectItem key={cert.value} value={cert.value}>
                    {cert.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (selectedLineage) {
                onAdd({
                  id: `la-${Date.now()}`,
                  lineage: selectedLineage,
                  role,
                  certainty,
                });
                onClose();
              }
            }}
            disabled={!selectedLineage}
          >
            Add Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
