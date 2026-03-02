import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { ArrowLeft, Trash2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { GenealogyDateInput, type DateModifier } from './PersonFormComponents/GenealogyDateInput';
import { TypeaheadSearch, type SearchResult } from './shared/TypeaheadSearch';
import {
  useAdminPersonQuery,
  useCreatePersonMutation,
  useUpdatePersonMutation,
  useDeletePersonMutation,
  useSetParentOfMutation,
  useRemoveParentOfMutation,
  useSetSpouseOfMutation,
  useRemoveSpouseOfMutation,
  useAddPersonToLineageMutation,
  useRemovePersonFromLineageMutation,
  useCreateAdminNoteMutation,
  useAttachAdminNoteMutation,
  useUpdateAdminNoteMutation,
  useDeleteAdminNoteMutation,
  AnnotationTarget,
} from '../../generated/graphql';

function extractYear(dateStr: string): string | undefined {
  const match = dateStr.match(/\b(\d{4})\b/);
  return match ? match[1] : undefined;
}

const personSchema = z.object({
  givenName: z.string(),
  surname: z.string(),
  namePrefix: z.string().optional(),
  nameSuffix: z.string().optional(),
  nameQualifier: z.string().optional(),
  sex: z.string().optional(),
  birthDate: z.string().optional(),
  birthDateModifier: z.string().optional(),
  birthPlace: z.string().optional(),
  deathDate: z.string().optional(),
  deathDateModifier: z.string().optional(),
  deathPlace: z.string().optional(),
  privacyLabel: z.string().optional(),
  isImmigrantAncestor: z.boolean().optional(),
  notes: z.string().optional(),
});

type PersonFormData = z.infer<typeof personSchema>;

const NOTE_COLORS = [
  { value: 'BLUE', label: 'Blue', className: 'bg-blue-100 border-blue-300 text-blue-800' },
  { value: 'GREEN', label: 'Green', className: 'bg-green-100 border-green-300 text-green-800' },
  { value: 'ORANGE', label: 'Orange', className: 'bg-orange-100 border-orange-300 text-orange-800' },
  { value: 'PINK', label: 'Pink', className: 'bg-pink-100 border-pink-300 text-pink-800' },
];

function noteColorClass(color: string | null | undefined): string {
  return NOTE_COLORS.find((c) => c.value === color)?.className ?? 'bg-gray-100 border-gray-300 text-gray-800';
}

export function PersonForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [{ data, fetching }, reexecuteQuery] = useAdminPersonQuery({
    variables: { id: id! },
    pause: !id,
  });

  const [, createPerson] = useCreatePersonMutation();
  const [, updatePerson] = useUpdatePersonMutation();
  const [, deletePerson] = useDeletePersonMutation();

  // Relationship mutations
  const [, setParentOf] = useSetParentOfMutation();
  const [, removeParentOf] = useRemoveParentOfMutation();
  const [, setSpouseOf] = useSetSpouseOfMutation();
  const [, removeSpouseOf] = useRemoveSpouseOfMutation();
  const [, addPersonToLineage] = useAddPersonToLineageMutation();
  const [, removePersonFromLineage] = useRemovePersonFromLineageMutation();
  const [, createAdminNote] = useCreateAdminNoteMutation();
  const [, attachAdminNote] = useAttachAdminNoteMutation();
  const [, updateAdminNote] = useUpdateAdminNoteMutation();
  const [, deleteAdminNote] = useDeleteAdminNoteMutation();

  const person = data?.adminPerson;

  const refetch = useCallback(() => {
    reexecuteQuery({ requestPolicy: 'network-only' });
  }, [reexecuteQuery]);

  // Dialog states
  const [parentDialogOpen, setParentDialogOpen] = useState(false);
  const [parentSelection, setParentSelection] = useState<SearchResult | null>(null);
  const [parentRelType, setParentRelType] = useState('natural');

  const [spouseDialogOpen, setSpouseDialogOpen] = useState(false);
  const [spouseSelection, setSpouseSelection] = useState<SearchResult | null>(null);
  const [marriageDate, setMarriageDate] = useState('');
  const [marriagePlace, setMarriagePlace] = useState('');
  const [marriageOrder, setMarriageOrder] = useState('1');
  const [spouseSurname, setSpouseSurname] = useState('');

  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [childSelection, setChildSelection] = useState<SearchResult | null>(null);

  const [lineageDialogOpen, setLineageDialogOpen] = useState(false);
  const [lineageSelection, setLineageSelection] = useState<SearchResult | null>(null);
  const [lineageRole, setLineageRole] = useState('descendant');
  const [lineageCertainty, setLineageCertainty] = useState('unknown');
  const [lineageGenNumber, setLineageGenNumber] = useState('');

  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState('BLUE');
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      givenName: '',
      surname: '',
      namePrefix: '',
      nameSuffix: '',
      nameQualifier: '',
      sex: '',
      birthDate: '',
      birthDateModifier: 'EXACT',
      birthPlace: '',
      deathDate: '',
      deathDateModifier: 'EXACT',
      deathPlace: '',
      privacyLabel: '',
      isImmigrantAncestor: false,
      notes: '',
    },
  });

  const isImmigrantAncestor = watch('isImmigrantAncestor');
  const sex = watch('sex');

  useEffect(() => {
    if (person) {
      reset({
        givenName: person.givenName,
        surname: person.surname,
        namePrefix: person.namePrefix ?? '',
        nameSuffix: person.nameSuffix ?? '',
        nameQualifier: person.nameQualifier ?? '',
        sex: person.sex ?? '',
        birthDate: person.birthDate ?? '',
        birthDateModifier: person.birthDateModifier ?? 'EXACT',
        birthPlace: person.birthPlace ?? '',
        deathDate: person.deathDate ?? '',
        deathDateModifier: person.deathDateModifier ?? 'EXACT',
        deathPlace: person.deathPlace ?? '',
        privacyLabel: person.privacyLabel ?? '',
        isImmigrantAncestor: person.isImmigrantAncestor ?? false,
        notes: person.notes ?? '',
      });
    }
  }, [person, reset]);

  const onSubmit = async (formData: PersonFormData) => {
    const birthDateSort = formData.birthDate ? extractYear(formData.birthDate) : undefined;
    const deathDateSort = formData.deathDate ? extractYear(formData.deathDate) : undefined;

    const input = {
      givenName: formData.givenName,
      surname: formData.surname,
      namePrefix: formData.namePrefix || undefined,
      nameSuffix: formData.nameSuffix || undefined,
      nameQualifier: formData.nameQualifier || undefined,
      sex: formData.sex || undefined,
      birthDate: formData.birthDate || undefined,
      birthDateSort,
      birthDateModifier: formData.birthDateModifier || undefined,
      birthPlace: formData.birthPlace || undefined,
      deathDate: formData.deathDate || undefined,
      deathDateSort,
      deathDateModifier: formData.deathDateModifier || undefined,
      deathPlace: formData.deathPlace || undefined,
      privacyLabel: formData.privacyLabel || undefined,
      isImmigrantAncestor: formData.isImmigrantAncestor || false,
      notes: formData.notes || undefined,
    };

    if (isEditing) {
      const result = await updatePerson({ id: id!, input });
      if (result.error) {
        toast.error('Failed to update person');
        return;
      }
      toast.success('Person updated');
    } else {
      const result = await createPerson({ input });
      if (result.error) {
        toast.error('Failed to create person');
        return;
      }
      toast.success('Person created');
    }
    navigate('/admin/people');
  };

  const handleDelete = async () => {
    if (!id) return;
    const result = await deletePerson({ id });
    if (result.error) {
      toast.error('Failed to delete person');
      return;
    }
    toast.success('Person deleted');
    navigate('/admin/people');
  };

  // ── Relationship handlers ──

  const handleAddParent = async () => {
    if (!parentSelection || !id) return;
    const result = await setParentOf({
      parentId: parentSelection.id,
      childId: id,
      relationshipType: parentRelType,
    });
    if (result.error) {
      toast.error('Failed to add parent');
      return;
    }
    toast.success('Parent added');
    setParentDialogOpen(false);
    setParentSelection(null);
    setParentRelType('natural');
    refetch();
  };

  const handleRemoveParent = async (parentId: string) => {
    if (!id) return;
    const result = await removeParentOf({ parentId, childId: id });
    if (result.error) { toast.error('Failed to remove parent'); return; }
    toast.success('Parent removed');
    refetch();
  };

  const handleAddSpouse = async () => {
    if (!spouseSelection || !id) return;
    const result = await setSpouseOf({
      person1Id: id,
      person2Id: spouseSelection.id,
      input: {
        marriageDate: marriageDate || undefined,
        marriagePlace: marriagePlace || undefined,
        marriageOrder: marriageOrder ? parseInt(marriageOrder, 10) : undefined,
        spouseSurname: spouseSurname || undefined,
      },
    });
    if (result.error) {
      toast.error('Failed to add spouse');
      return;
    }
    toast.success('Spouse added');
    setSpouseDialogOpen(false);
    setSpouseSelection(null);
    setMarriageDate('');
    setMarriagePlace('');
    setMarriageOrder('1');
    setSpouseSurname('');
    refetch();
  };

  const handleRemoveSpouse = async (spouseId: string) => {
    if (!id) return;
    const result = await removeSpouseOf({ person1Id: id, person2Id: spouseId });
    if (result.error) { toast.error('Failed to remove spouse'); return; }
    toast.success('Spouse removed');
    refetch();
  };

  const handleAddChild = async () => {
    if (!childSelection || !id) return;
    const result = await setParentOf({ parentId: id, childId: childSelection.id });
    if (result.error) {
      toast.error('Failed to add child');
      return;
    }
    toast.success('Child added');
    setChildDialogOpen(false);
    setChildSelection(null);
    refetch();
  };

  const handleRemoveChild = async (childId: string) => {
    if (!id) return;
    const result = await removeParentOf({ parentId: id, childId });
    if (result.error) { toast.error('Failed to remove child'); return; }
    toast.success('Child removed');
    refetch();
  };

  const handleAddLineage = async () => {
    if (!lineageSelection || !id) return;
    const result = await addPersonToLineage({
      personId: id,
      lineageId: lineageSelection.id,
      input: {
        role: lineageRole || undefined,
        generationNumber: lineageGenNumber ? parseInt(lineageGenNumber, 10) : undefined,
        certainty: lineageCertainty || undefined,
      },
    });
    if (result.error) {
      toast.error('Failed to add to lineage');
      return;
    }
    toast.success('Lineage assignment added');
    setLineageDialogOpen(false);
    setLineageSelection(null);
    setLineageRole('descendant');
    setLineageCertainty('unknown');
    setLineageGenNumber('');
    refetch();
  };

  const handleRemoveLineage = async (lineageId: string) => {
    if (!id) return;
    const result = await removePersonFromLineage({ personId: id, lineageId });
    if (result.error) { toast.error('Failed to remove lineage assignment'); return; }
    toast.success('Lineage assignment removed');
    refetch();
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !id) return;
    const createResult = await createAdminNote({ input: { color: noteColor, text: noteText.trim() } });
    if (createResult.error || !createResult.data?.createAdminNote) {
      toast.error('Failed to create note');
      return;
    }
    const noteId = createResult.data.createAdminNote.id;
    const attachResult = await attachAdminNote({ noteId, targetId: id, targetType: AnnotationTarget.Person });
    if (attachResult.error) {
      toast.error('Failed to attach note');
      return;
    }
    toast.success('Note added');
    setNoteDialogOpen(false);
    setNoteText('');
    setNoteColor('BLUE');
    refetch();
  };

  const handleToggleNoteResolved = async (noteId: string, currentResolved: boolean) => {
    const result = await updateAdminNote({ id: noteId, input: { resolved: !currentResolved } });
    if (result.error) { toast.error('Failed to update note'); return; }
    refetch();
  };

  const handleDeleteNote = async (noteId: string) => {
    const result = await deleteAdminNote({ id: noteId });
    if (result.error) { toast.error('Failed to delete note'); return; }
    toast.success('Note deleted');
    refetch();
  };

  if (isEditing && fetching) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading person...</p>
        </div>
      </div>
    );
  }

  if (isEditing && !fetching && !person) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/people')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to People
        </Button>
        <div className="text-center py-8 text-red-500">Person not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/people')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to People
        </Button>
        {isEditing && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Person
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Person</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this person record? This action cannot be undone.
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Name</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="givenName">Given Name *</Label>
                <Input
                  id="givenName"
                  {...register('givenName')}
                  placeholder="John"
                  className={errors.givenName ? 'border-red-500' : ''}
                />
                {errors.givenName && (
                  <p className="text-sm text-red-500 mt-1">{errors.givenName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="surname">Surname *</Label>
                <Input
                  id="surname"
                  {...register('surname')}
                  placeholder="Kent"
                  className={errors.surname ? 'border-red-500' : ''}
                />
                {errors.surname && (
                  <p className="text-sm text-red-500 mt-1">{errors.surname.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="namePrefix">Prefix</Label>
                <Input id="namePrefix" {...register('namePrefix')} placeholder="Rev." />
              </div>
              <div>
                <Label htmlFor="nameSuffix">Suffix</Label>
                <Input id="nameSuffix" {...register('nameSuffix')} placeholder="Jr." />
              </div>
              <div>
                <Label htmlFor="nameQualifier">Qualifier</Label>
                <Input id="nameQualifier" {...register('nameQualifier')} placeholder="(of Warren Co.)" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Birth Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Birth</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <GenealogyDateInput
              label="Birth Date"
              value={watch('birthDate') ?? ''}
              modifier={(watch('birthDateModifier') ?? 'EXACT') as DateModifier}
              onChange={(value, modifier) => {
                setValue('birthDate', value);
                setValue('birthDateModifier', modifier);
              }}
            />
            <div>
              <Label htmlFor="birthPlace">Birth Place</Label>
              <Input id="birthPlace" {...register('birthPlace')} placeholder="Warren Co., Georgia" />
            </div>
          </CardContent>
        </Card>

        {/* Death Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Death</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <GenealogyDateInput
              label="Death Date"
              value={watch('deathDate') ?? ''}
              modifier={(watch('deathDateModifier') ?? 'EXACT') as DateModifier}
              onChange={(value, modifier) => {
                setValue('deathDate', value);
                setValue('deathDateModifier', modifier);
              }}
            />
            <div>
              <Label htmlFor="deathPlace">Death Place</Label>
              <Input id="deathPlace" {...register('deathPlace')} placeholder="Warren Co., Georgia" />
            </div>
          </CardContent>
        </Card>

        {/* Status Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sex</Label>
                <Select value={sex || ''} onValueChange={(v) => setValue('sex', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="privacyLabel">Privacy Label</Label>
                <Input id="privacyLabel" {...register('privacyLabel')} placeholder="Optional" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isImmigrantAncestor"
                checked={isImmigrantAncestor}
                onCheckedChange={(checked) => setValue('isImmigrantAncestor', checked as boolean)}
              />
              <Label htmlFor="isImmigrantAncestor" className="font-normal cursor-pointer">
                Immigrant Ancestor
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Notes Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register('notes')}
              rows={4}
              placeholder="Additional notes about this person..."
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/people')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Person' : 'Create Person'}
          </Button>
        </div>
      </form>

      {/* ── Relationship Sections (edit mode only) ── */}
      {isEditing && person && (
        <div className="space-y-6">
          {/* Parents Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Parents</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setParentDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Parent
              </Button>
            </CardHeader>
            <CardContent>
              {person.parents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No parents recorded</p>
              ) : (
                <div className="space-y-2">
                  {person.parents.map((p) => (
                    <div key={p.person.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <button className="font-medium text-blue-600 hover:underline text-left" onClick={() => navigate(`/admin/people/${p.person.id}`)}>
                          {p.person.givenName || p.person.surname
                            ? `${p.person.givenName ?? ''} ${p.person.surname ?? ''}`.trim()
                            : <span className="italic text-gray-400">[{p.person.privacyLabel || 'Unknown'}]</span>}
                        </button>
                        {p.relationshipType && (
                          <Badge variant="secondary">{p.relationshipType}</Badge>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveParent(p.person.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Spouses Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Spouses</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setSpouseDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Spouse
              </Button>
            </CardHeader>
            <CardContent>
              {person.spouses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No spouses recorded</p>
              ) : (
                <div className="space-y-2">
                  {person.spouses.map((s) => (
                    <div key={s.spouse.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <button className="font-medium text-blue-600 hover:underline text-left" onClick={() => navigate(`/admin/people/${s.spouse.id}`)}>
                          {s.spouse.givenName || s.spouse.surname
                            ? `${s.spouse.givenName ?? ''} ${s.spouse.surname ?? ''}`.trim()
                            : <span className="italic text-gray-400">[{s.spouse.privacyLabel || 'Unknown'}]</span>}
                        </button>
                        {s.spouseSurname && <span className="text-sm text-muted-foreground ml-2">(nee {s.spouseSurname})</span>}
                        {s.marriageDate && <span className="text-sm text-muted-foreground ml-2">m. {s.marriageDate}</span>}
                        {s.marriagePlace && <span className="text-sm text-muted-foreground ml-1">at {s.marriagePlace}</span>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveSpouse(s.spouse.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Children Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Children</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setChildDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Child
              </Button>
            </CardHeader>
            <CardContent>
              {person.children.length === 0 ? (
                <p className="text-sm text-muted-foreground">No children recorded</p>
              ) : (
                <div className="space-y-2">
                  {person.children.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2 border rounded">
                      <button className="font-medium text-blue-600 hover:underline text-left" onClick={() => navigate(`/admin/people/${c.id}`)}>
                        {c.givenName || c.surname
                          ? `${c.givenName ?? ''} ${c.surname ?? ''}`.trim()
                          : <span className="italic text-gray-400">[{c.privacyLabel || 'Unknown'}]</span>}
                      </button>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveChild(c.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lineage Assignments Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Lineage Assignments</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setLineageDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add to Lineage
              </Button>
            </CardHeader>
            <CardContent>
              {person.lineageAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lineage assignments</p>
              ) : (
                <div className="space-y-2">
                  {person.lineageAssignments.map((la) => (
                    <div key={la.lineage.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{la.lineage.displayName}</span>
                        {la.lineage.region && <span className="text-sm text-muted-foreground">({la.lineage.region})</span>}
                        {la.role && <Badge variant="secondary">{la.role}</Badge>}
                        {la.certainty && <Badge variant="outline">{la.certainty}</Badge>}
                        {la.generationNumber != null && (
                          <span className="text-xs text-muted-foreground">Gen {la.generationNumber}</span>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveLineage(la.lineage.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Notes Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Admin Notes</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setNoteDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Note
              </Button>
            </CardHeader>
            <CardContent>
              {person.adminNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No admin notes</p>
              ) : (
                <div className="space-y-2">
                  {person.adminNotes.map((note) => (
                    <div key={note.id} className={`p-3 border rounded ${noteColorClass(note.color)} ${note.resolved ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm">{note.text}</p>
                          {note.createdDate && (
                            <p className="text-xs mt-1 opacity-70">{note.createdDate}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => handleToggleNoteResolved(note.id, note.resolved)}
                          >
                            {note.resolved ? 'Reopen' : 'Resolve'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteNote(note.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* Add Parent Dialog */}
      <Dialog open={parentDialogOpen} onOpenChange={setParentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Parent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TypeaheadSearch
              entityType="person"
              label="Search for parent"
              onSelect={setParentSelection}
              selectedValue={parentSelection ?? undefined}
              onClear={() => setParentSelection(null)}
              excludeIds={id ? [id] : []}
            />
            <div>
              <Label>Relationship Type</Label>
              <Select value={parentRelType} onValueChange={setParentRelType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="adopted">Adopted</SelectItem>
                  <SelectItem value="step">Step</SelectItem>
                  <SelectItem value="foster">Foster</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddParent} disabled={!parentSelection}>Add Parent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Spouse Dialog */}
      <Dialog open={spouseDialogOpen} onOpenChange={setSpouseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Spouse</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TypeaheadSearch
              entityType="person"
              label="Search for spouse"
              onSelect={setSpouseSelection}
              selectedValue={spouseSelection ?? undefined}
              onClear={() => setSpouseSelection(null)}
              excludeIds={id ? [id] : []}
            />
            <div>
              <Label>Marriage Date</Label>
              <Input value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)} placeholder="1850" />
            </div>
            <div>
              <Label>Marriage Place</Label>
              <Input value={marriagePlace} onChange={(e) => setMarriagePlace(e.target.value)} placeholder="Warren Co., GA" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Marriage Order</Label>
                <Input type="number" value={marriageOrder} onChange={(e) => setMarriageOrder(e.target.value)} min="1" />
              </div>
              <div>
                <Label>Spouse Surname</Label>
                <Input value={spouseSurname} onChange={(e) => setSpouseSurname(e.target.value)} placeholder="Maiden name" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpouseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSpouse} disabled={!spouseSelection}>Add Spouse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Child Dialog */}
      <Dialog open={childDialogOpen} onOpenChange={setChildDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Child</DialogTitle>
          </DialogHeader>
          <TypeaheadSearch
            entityType="person"
            label="Search for child"
            onSelect={setChildSelection}
            selectedValue={childSelection ?? undefined}
            onClear={() => setChildSelection(null)}
            excludeIds={id ? [id] : []}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChildDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddChild} disabled={!childSelection}>Add Child</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lineage Dialog */}
      <Dialog open={lineageDialogOpen} onOpenChange={setLineageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Lineage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TypeaheadSearch
              entityType="lineage"
              label="Search for lineage"
              onSelect={setLineageSelection}
              selectedValue={lineageSelection ?? undefined}
              onClear={() => setLineageSelection(null)}
            />
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Role</Label>
                <Select value={lineageRole} onValueChange={setLineageRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="descendant">Descendant</SelectItem>
                    <SelectItem value="confirmed_ancestor">Confirmed Ancestor</SelectItem>
                    <SelectItem value="potential_ancestor">Potential Ancestor</SelectItem>
                    <SelectItem value="brick_wall">Brick Wall</SelectItem>
                    <SelectItem value="immigrant_ancestor">Immigrant Ancestor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Certainty</Label>
                <Select value={lineageCertainty} onValueChange={setLineageCertainty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="probable">Probable</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Generation #</Label>
                <Input type="number" value={lineageGenNumber} onChange={(e) => setLineageGenNumber(e.target.value)} min="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLineage} disabled={!lineageSelection}>Add to Lineage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Color</Label>
              <Select value={noteColor} onValueChange={setNoteColor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTE_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Text</Label>
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Note text..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={!noteText.trim()}>Add Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
