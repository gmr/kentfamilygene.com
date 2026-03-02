import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Plus, X, User, Heart } from 'lucide-react';
import { PersonRelationship, SpouseRelationship, Person, Place, DateModifier, mockPeople } from '../../../lib/mock-data';
import { GenealogyDateInput } from './GenealogyDateInput';
import { PlaceTypeahead } from './PlaceTypeahead';

interface RelationshipManagerProps {
  personId: string;
  parents: PersonRelationship[];
  spouses: SpouseRelationship[];
  children: PersonRelationship[];
  onUpdate: (relationships: {
    parents: PersonRelationship[];
    spouses: SpouseRelationship[];
    children: PersonRelationship[];
  }) => void;
}

export function RelationshipManager({ personId, parents, spouses, children, onUpdate }: RelationshipManagerProps) {
  const [showParentModal, setShowParentModal] = useState(false);
  const [showSpouseModal, setShowSpouseModal] = useState(false);
  const [showChildModal, setShowChildModal] = useState(false);
  const [editingSpouse, setEditingSpouse] = useState<SpouseRelationship | null>(null);

  const handleAddParent = (person: Person, role: 'father' | 'mother') => {
    const newParent: PersonRelationship = {
      id: `rel-${Date.now()}`,
      person,
      relationshipType: 'natural',
      role,
    };
    onUpdate({
      parents: [...parents, newParent],
      spouses,
      children,
    });
  };

  const handleRemoveParent = (relationshipId: string) => {
    if (!confirm('Remove this parent relationship?')) return;
    onUpdate({
      parents: parents.filter(p => p.id !== relationshipId),
      spouses,
      children,
    });
  };

  const handleAddSpouse = (spouseRel: SpouseRelationship) => {
    onUpdate({
      parents,
      spouses: [...spouses, spouseRel],
      children,
    });
  };

  const handleUpdateSpouse = (spouseRel: SpouseRelationship) => {
    onUpdate({
      parents,
      spouses: spouses.map(s => s.id === spouseRel.id ? spouseRel : s),
      children,
    });
  };

  const handleRemoveSpouse = (relationshipId: string) => {
    if (!confirm('Remove this spouse relationship?')) return;
    onUpdate({
      parents,
      spouses: spouses.filter(s => s.id !== relationshipId),
      children,
    });
  };

  const handleAddChild = (person: Person) => {
    const newChild: PersonRelationship = {
      id: `rel-${Date.now()}`,
      person,
      relationshipType: 'natural',
      role: 'child',
    };
    onUpdate({
      parents,
      spouses,
      children: [...children, newChild],
    });
  };

  const handleRemoveChild = (relationshipId: string) => {
    if (!confirm('Remove this child relationship?')) return;
    onUpdate({
      parents,
      spouses,
      children: children.filter(c => c.id !== relationshipId),
    });
  };

  const fathers = parents.filter(p => p.role === 'father');
  const mothers = parents.filter(p => p.role === 'mother');

  return (
    <div className="space-y-6">
      {/* Parents */}
      <div>
        <Label className="text-base font-semibold">Parents</Label>
        <div className="mt-2 space-y-2 border rounded-lg p-4 bg-gray-50">
          {fathers.length > 0 ? (
            fathers.map(parent => (
              <div key={parent.id} className="flex items-center justify-between bg-white p-3 rounded border">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="font-medium">
                      {parent.person.nameQualifier} {parent.person.givenName} {parent.person.surname}
                    </div>
                    <div className="text-xs text-gray-500">
                      (father, {parent.relationshipType})
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveParent(parent.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">No father added</div>
          )}

          {mothers.length > 0 ? (
            mothers.map(parent => (
              <div key={parent.id} className="flex items-center justify-between bg-white p-3 rounded border">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-pink-600" />
                  <div>
                    <div className="font-medium">
                      {parent.person.nameQualifier} {parent.person.givenName} {parent.person.surname}
                    </div>
                    <div className="text-xs text-gray-500">
                      (mother, {parent.relationshipType})
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveParent(parent.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">No mother added</div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowParentModal(true)}
            disabled={parents.length >= 2}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Parent
          </Button>
        </div>
      </div>

      {/* Spouses */}
      <div>
        <Label className="text-base font-semibold">Spouses</Label>
        <div className="mt-2 space-y-2 border rounded-lg p-4 bg-gray-50">
          {spouses.length > 0 ? (
            spouses
              .sort((a, b) => a.marriageOrder - b.marriageOrder)
              .map(spouse => (
                <div key={spouse.id} className="bg-white p-3 rounded border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Heart className="h-4 w-4 text-red-500" />
                      <div className="flex-1">
                        <div className="font-medium">
                          {spouse.marriageOrder}. {spouse.spouse.givenName} {spouse.spouse.surname}
                        </div>
                        <div className="text-xs text-gray-500">
                          {spouse.marriageDate && `m. ${spouse.marriageDate}`}
                          {spouse.marriagePlace && ` [${spouse.marriagePlace.name}]`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingSpouse(spouse);
                          setShowSpouseModal(true);
                        }}
                      >
                        Edit Details
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSpouse(spouse.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className="text-sm text-gray-500">No spouses added</div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingSpouse(null);
              setShowSpouseModal(true);
            }}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Spouse
          </Button>
        </div>
      </div>

      {/* Children */}
      <div>
        <Label className="text-base font-semibold">Children</Label>
        <div className="mt-2 space-y-2 border rounded-lg p-4 bg-gray-50">
          {children.length > 0 ? (
            children.map(child => (
              <div key={child.id} className="flex items-center justify-between bg-white p-3 rounded border">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-600" />
                  <div>
                    <div className="font-medium">
                      {child.person.givenName} {child.person.surname}
                    </div>
                    <div className="text-xs text-gray-500">({child.relationshipType})</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveChild(child.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">No children added</div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowChildModal(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Child
          </Button>
        </div>
      </div>

      {/* Modals */}
      {showParentModal && (
        <ParentModal
          onClose={() => setShowParentModal(false)}
          onAdd={handleAddParent}
          existingParents={parents}
        />
      )}

      {showSpouseModal && (
        <SpouseModal
          spouse={editingSpouse}
          onClose={() => {
            setShowSpouseModal(false);
            setEditingSpouse(null);
          }}
          onSave={(spouseRel) => {
            if (editingSpouse) {
              handleUpdateSpouse(spouseRel);
            } else {
              handleAddSpouse(spouseRel);
            }
            setShowSpouseModal(false);
            setEditingSpouse(null);
          }}
          nextMarriageOrder={spouses.length + 1}
        />
      )}

      {showChildModal && (
        <PersonSearchModal
          title="Add Child"
          onClose={() => setShowChildModal(false)}
          onSelect={(person) => {
            handleAddChild(person);
            setShowChildModal(false);
          }}
        />
      )}
    </div>
  );
}

// Parent Modal
interface ParentModalProps {
  onClose: () => void;
  onAdd: (person: Person, role: 'father' | 'mother') => void;
  existingParents: PersonRelationship[];
}

function ParentModal({ onClose, onAdd, existingParents }: ParentModalProps) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [role, setRole] = useState<'father' | 'mother'>('father');

  const hasFather = existingParents.some(p => p.role === 'father');
  const hasMother = existingParents.some(p => p.role === 'mother');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Parent</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Parent Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as 'father' | 'mother')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="father" disabled={hasFather}>Father</SelectItem>
                <SelectItem value="mother" disabled={hasMother}>Mother</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Search Person</Label>
            <PersonSearch onSelect={setSelectedPerson} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            onClick={() => {
              if (selectedPerson) {
                onAdd(selectedPerson, role);
                onClose();
              }
            }}
            disabled={!selectedPerson}
          >
            Add Parent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Spouse Modal
interface SpouseModalProps {
  spouse: SpouseRelationship | null;
  onClose: () => void;
  onSave: (spouse: SpouseRelationship) => void;
  nextMarriageOrder: number;
}

function SpouseModal({ spouse, onClose, onSave, nextMarriageOrder }: SpouseModalProps) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(spouse?.spouse || null);
  const [marriageDate, setMarriageDate] = useState(spouse?.marriageDate || '');
  const [marriageDateModifier, setMarriageDateModifier] = useState<DateModifier>(spouse?.marriageDateModifier || 'exact');
  const [marriagePlace, setMarriagePlace] = useState<Place | null>(spouse?.marriagePlace || null);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{spouse ? 'Edit Spouse Details' : 'Add Spouse'}</DialogTitle>
          <DialogDescription>
            {spouse ? 'Update the details of your spouse.' : 'Add a new spouse to your record.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Search Person</Label>
            <PersonSearch onSelect={setSelectedPerson} initialValue={selectedPerson} />
          </div>
          <GenealogyDateInput
            value={marriageDate}
            modifier={marriageDateModifier}
            onChange={(value, modifier) => {
              setMarriageDate(value);
              setMarriageDateModifier(modifier);
            }}
            label="Marriage Date"
          />
          <PlaceTypeahead
            value={marriagePlace}
            onChange={setMarriagePlace}
            label="Marriage Place"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            onClick={() => {
              if (selectedPerson) {
                onSave({
                  id: spouse?.id || `spouse-${Date.now()}`,
                  spouse: selectedPerson,
                  marriageOrder: spouse?.marriageOrder || nextMarriageOrder,
                  marriageDate,
                  marriageDateModifier,
                  marriagePlace: marriagePlace || undefined,
                });
              }
            }}
            disabled={!selectedPerson}
          >
            {spouse ? 'Save Changes' : 'Add Spouse'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Person Search Modal
interface PersonSearchModalProps {
  title: string;
  onClose: () => void;
  onSelect: (person: Person) => void;
}

function PersonSearchModal({ title, onClose, onSelect }: PersonSearchModalProps) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <PersonSearch onSelect={setSelectedPerson} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            onClick={() => {
              if (selectedPerson) {
                onSelect(selectedPerson);
              }
            }}
            disabled={!selectedPerson}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Person Search Component
interface PersonSearchProps {
  onSelect: (person: Person) => void;
  initialValue?: Person | null;
}

function PersonSearch({ onSelect, initialValue }: PersonSearchProps) {
  const [searchQuery, setSearchQuery] = useState(initialValue ? `${initialValue.givenName} ${initialValue.surname}` : '');
  const [results, setResults] = useState<Person[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = mockPeople.filter(person => {
      const fullName = `${person.givenName} ${person.surname}`.toLowerCase();
      return fullName.includes(query);
    });

    setResults(filtered.slice(0, 10));
  }, [searchQuery]);

  return (
    <div className="relative">
      <Input
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        placeholder="Search by name..."
      />
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => {
                onSelect(person);
                setSearchQuery(`${person.givenName} ${person.surname}`);
                setShowResults(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
            >
              <div className="font-medium text-sm">
                {person.givenName} {person.surname}
              </div>
              <div className="text-xs text-gray-500">
                {person.birthDate && `b. ${person.birthDate}`}
                {person.deathDate && ` - d. ${person.deathDate}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
