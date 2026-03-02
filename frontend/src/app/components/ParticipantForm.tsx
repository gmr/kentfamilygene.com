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
import { ArrowLeft, Trash2, Plus, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { TypeaheadSearch, type SearchResult } from './shared/TypeaheadSearch';
import {
  useAdminParticipantQuery,
  useCreateParticipantMutation,
  useUpdateParticipantMutation,
  useDeleteParticipantMutation,
  useLinkParticipantToPersonMutation,
  useUnlinkParticipantFromPersonMutation,
  useAddDnaTestMutation,
  useRemoveDnaTestMutation,
  useAddOnlineTreeMutation,
  useRemoveOnlineTreeMutation,
  useAssignHaplogroupMutation,
  useUnassignHaplogroupMutation,
  useAddParticipantToLineageMutation,
  useRemoveParticipantFromLineageMutation,
  useRecordGeneticMatchMutation,
  useRemoveGeneticMatchMutation,
  useCreateAdminNoteMutation,
  useAttachAdminNoteMutation,
  useUpdateAdminNoteMutation,
  useDeleteAdminNoteMutation,
  AnnotationTarget,
} from '../../generated/graphql';

const participantSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  email: z.string().optional(),
  membershipType: z.string().optional(),
  isActive: z.boolean().optional(),
  ftdnaKitNumber: z.string().optional(),
  joinDate: z.string().optional(),
  contactNote: z.string().optional(),
  researchGoal: z.string().optional(),
});

type ParticipantFormData = z.infer<typeof participantSchema>;

const NOTE_COLORS = [
  { value: 'BLUE', label: 'Blue', className: 'bg-blue-100 border-blue-300 text-blue-800' },
  { value: 'GREEN', label: 'Green', className: 'bg-green-100 border-green-300 text-green-800' },
  { value: 'ORANGE', label: 'Orange', className: 'bg-orange-100 border-orange-300 text-orange-800' },
  { value: 'PINK', label: 'Pink', className: 'bg-pink-100 border-pink-300 text-pink-800' },
];

function noteColorClass(color: string | null | undefined): string {
  return NOTE_COLORS.find((c) => c.value === color)?.className ?? 'bg-gray-100 border-gray-300 text-gray-800';
}

export function ParticipantForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [{ data, fetching }, reexecuteQuery] = useAdminParticipantQuery({
    variables: { id: id! },
    pause: !id,
  });

  const [, createParticipant] = useCreateParticipantMutation();
  const [, updateParticipant] = useUpdateParticipantMutation();
  const [, deleteParticipant] = useDeleteParticipantMutation();

  // Relationship mutations
  const [, linkToPerson] = useLinkParticipantToPersonMutation();
  const [, unlinkFromPerson] = useUnlinkParticipantFromPersonMutation();
  const [, addDnaTest] = useAddDnaTestMutation();
  const [, removeDnaTest] = useRemoveDnaTestMutation();
  const [, addOnlineTree] = useAddOnlineTreeMutation();
  const [, removeOnlineTree] = useRemoveOnlineTreeMutation();
  const [, assignHaplogroup] = useAssignHaplogroupMutation();
  const [, unassignHaplogroup] = useUnassignHaplogroupMutation();
  const [, addToLineage] = useAddParticipantToLineageMutation();
  const [, removeFromLineage] = useRemoveParticipantFromLineageMutation();
  const [, recordMatch] = useRecordGeneticMatchMutation();
  const [, removeMatch] = useRemoveGeneticMatchMutation();
  const [, createAdminNote] = useCreateAdminNoteMutation();
  const [, attachAdminNote] = useAttachAdminNoteMutation();
  const [, updateAdminNote] = useUpdateAdminNoteMutation();
  const [, deleteAdminNote] = useDeleteAdminNoteMutation();

  const participant = data?.adminParticipant;

  const refetch = useCallback(() => {
    reexecuteQuery({ requestPolicy: 'network-only' });
  }, [reexecuteQuery]);

  // Dialog states
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [personSelection, setPersonSelection] = useState<SearchResult | null>(null);

  const [dnaDialogOpen, setDnaDialogOpen] = useState(false);
  const [dnaTestType, setDnaTestType] = useState('Y_DNA');
  const [dnaTestName, setDnaTestName] = useState('');
  const [dnaProvider, setDnaProvider] = useState('FTDNA');
  const [dnaKitNumber, setDnaKitNumber] = useState('');
  const [dnaMarkerCount, setDnaMarkerCount] = useState('');
  const [dnaRegistered, setDnaRegistered] = useState(false);
  const [dnaGedmatchKit, setDnaGedmatchKit] = useState('');

  const [treeDialogOpen, setTreeDialogOpen] = useState(false);
  const [treePlatform, setTreePlatform] = useState('FamilySearch');
  const [treeUsername, setTreeUsername] = useState('');
  const [treeTreeName, setTreeTreeName] = useState('');
  const [treeUrl, setTreeUrl] = useState('');

  const [hapDialogOpen, setHapDialogOpen] = useState(false);
  const [hapSelection, setHapSelection] = useState<SearchResult | null>(null);

  const [lineageDialogOpen, setLineageDialogOpen] = useState(false);
  const [lineageSelection, setLineageSelection] = useState<SearchResult | null>(null);
  const [branchLabel, setBranchLabel] = useState('');

  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchSelection, setMatchSelection] = useState<SearchResult | null>(null);
  const [matchMarkerLevel, setMatchMarkerLevel] = useState('');
  const [matchType, setMatchType] = useState('');
  const [matchNotes, setMatchNotes] = useState('');

  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState('BLUE');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ParticipantFormData>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      displayName: '',
      email: '',
      membershipType: 'PROJECT_MEMBER',
      isActive: true,
      ftdnaKitNumber: '',
      joinDate: '',
      contactNote: '',
      researchGoal: '',
    },
  });

  const isActive = watch('isActive');
  const membershipType = watch('membershipType');

  useEffect(() => {
    if (participant) {
      reset({
        displayName: participant.displayName,
        email: participant.email ?? '',
        membershipType: participant.membershipType ?? 'PROJECT_MEMBER',
        isActive: participant.isActive ?? true,
        ftdnaKitNumber: participant.ftdnaKitNumber ?? '',
        joinDate: participant.joinDate ?? '',
        contactNote: participant.contactNote ?? '',
        researchGoal: participant.researchGoal ?? '',
      });
    }
  }, [participant, reset]);

  const onSubmit = async (formData: ParticipantFormData) => {
    const input = {
      displayName: formData.displayName,
      email: formData.email || undefined,
      membershipType: formData.membershipType || undefined,
      isActive: formData.isActive,
      ftdnaKitNumber: formData.ftdnaKitNumber || undefined,
      joinDate: formData.joinDate || undefined,
      contactNote: formData.contactNote || undefined,
      researchGoal: formData.researchGoal || undefined,
    };

    if (isEditing) {
      const result = await updateParticipant({ id: id!, input });
      if (result.error) {
        toast.error('Failed to update participant');
        return;
      }
      toast.success('Participant updated');
    } else {
      const result = await createParticipant({ input });
      if (result.error) {
        toast.error('Failed to create participant');
        return;
      }
      toast.success('Participant created');
    }
    navigate('/admin/participants');
  };

  const handleDelete = async () => {
    if (!id) return;
    const result = await deleteParticipant({ id });
    if (result.error) {
      toast.error('Failed to delete participant');
      return;
    }
    toast.success('Participant deleted');
    navigate('/admin/participants');
  };

  // ── Relationship handlers ──

  const handleLinkPerson = async () => {
    if (!personSelection || !id) return;
    const result = await linkToPerson({ participantId: id, personId: personSelection.id });
    if (result.error) { toast.error('Failed to link person'); return; }
    toast.success('Person linked');
    setPersonDialogOpen(false);
    setPersonSelection(null);
    refetch();
  };

  const handleUnlinkPerson = async () => {
    if (!id) return;
    const result = await unlinkFromPerson({ participantId: id });
    if (result.error) { toast.error('Failed to unlink person'); return; }
    toast.success('Person unlinked');
    refetch();
  };

  const handleAddDnaTest = async () => {
    if (!id) return;
    const result = await addDnaTest({
      participantId: id,
      input: {
        testType: dnaTestType || undefined,
        testName: dnaTestName || undefined,
        provider: dnaProvider || undefined,
        kitNumber: dnaKitNumber || undefined,
        markerCount: dnaMarkerCount ? parseInt(dnaMarkerCount, 10) : undefined,
        registeredWithProject: dnaRegistered,
        gedmatchKit: dnaGedmatchKit || undefined,
      },
    });
    if (result.error) { toast.error('Failed to add DNA test'); return; }
    toast.success('DNA test added');
    setDnaDialogOpen(false);
    setDnaTestType('Y_DNA');
    setDnaTestName('');
    setDnaProvider('FTDNA');
    setDnaKitNumber('');
    setDnaMarkerCount('');
    setDnaRegistered(false);
    setDnaGedmatchKit('');
    refetch();
  };

  const handleRemoveDnaTest = async (testId: string) => {
    const result = await removeDnaTest({ testId });
    if (result.error) { toast.error('Failed to remove DNA test'); return; }
    toast.success('DNA test removed');
    refetch();
  };

  const handleAddOnlineTree = async () => {
    if (!id) return;
    const result = await addOnlineTree({
      participantId: id,
      input: {
        platform: treePlatform || undefined,
        username: treeUsername || undefined,
        treeName: treeTreeName || undefined,
        url: treeUrl || undefined,
      },
    });
    if (result.error) { toast.error('Failed to add online tree'); return; }
    toast.success('Online tree added');
    setTreeDialogOpen(false);
    setTreePlatform('FamilySearch');
    setTreeUsername('');
    setTreeTreeName('');
    setTreeUrl('');
    refetch();
  };

  const handleRemoveOnlineTree = async (treeId: string) => {
    const result = await removeOnlineTree({ treeId });
    if (result.error) { toast.error('Failed to remove online tree'); return; }
    toast.success('Online tree removed');
    refetch();
  };

  const handleAssignHaplogroup = async () => {
    if (!hapSelection || !id) return;
    const result = await assignHaplogroup({ participantId: id, haplogroupId: hapSelection.id });
    if (result.error) { toast.error('Failed to assign haplogroup'); return; }
    toast.success('Haplogroup assigned');
    setHapDialogOpen(false);
    setHapSelection(null);
    refetch();
  };

  const handleUnassignHaplogroup = async (haplogroupId: string) => {
    if (!id) return;
    const result = await unassignHaplogroup({ participantId: id, haplogroupId });
    if (result.error) { toast.error('Failed to unassign haplogroup'); return; }
    toast.success('Haplogroup unassigned');
    refetch();
  };

  const handleAddLineage = async () => {
    if (!lineageSelection || !id) return;
    const result = await addToLineage({
      participantId: id,
      lineageId: lineageSelection.id,
      input: { branchLabel: branchLabel || undefined },
    });
    if (result.error) { toast.error('Failed to add lineage membership'); return; }
    toast.success('Lineage membership added');
    setLineageDialogOpen(false);
    setLineageSelection(null);
    setBranchLabel('');
    refetch();
  };

  const handleRemoveLineage = async (lineageId: string) => {
    if (!id) return;
    const result = await removeFromLineage({ participantId: id, lineageId });
    if (result.error) { toast.error('Failed to remove lineage membership'); return; }
    toast.success('Lineage membership removed');
    refetch();
  };

  const handleAddGeneticMatch = async () => {
    if (!matchSelection || !id) return;
    const result = await recordMatch({
      participant1Id: id,
      participant2Id: matchSelection.id,
      input: {
        markerLevel: matchMarkerLevel ? parseInt(matchMarkerLevel, 10) : undefined,
        matchType: matchType || undefined,
        notes: matchNotes || undefined,
      },
    });
    if (result.error) { toast.error('Failed to record genetic match'); return; }
    toast.success('Genetic match recorded');
    setMatchDialogOpen(false);
    setMatchSelection(null);
    setMatchMarkerLevel('');
    setMatchType('');
    setMatchNotes('');
    refetch();
  };

  const handleRemoveGeneticMatch = async (otherId: string) => {
    if (!id) return;
    const result = await removeMatch({ participant1Id: id, participant2Id: otherId });
    if (result.error) { toast.error('Failed to remove genetic match'); return; }
    toast.success('Genetic match removed');
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
    const attachResult = await attachAdminNote({ noteId, targetId: id, targetType: AnnotationTarget.Participant });
    if (attachResult.error) { toast.error('Failed to attach note'); return; }
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
          <p className="text-muted-foreground">Loading participant...</p>
        </div>
      </div>
    );
  }

  if (isEditing && !fetching && !participant) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/participants')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Participants
        </Button>
        <div className="text-center py-8 text-red-500">Participant not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/participants')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Participants
        </Button>
        {isEditing && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Participant
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Participant</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this participant? This action cannot be undone.
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
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                {...register('displayName')}
                placeholder="John Kent"
                className={errors.displayName ? 'border-red-500' : ''}
              />
              {errors.displayName && (
                <p className="text-sm text-red-500 mt-1">{errors.displayName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} placeholder="john@example.com" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Membership Type</Label>
                <Select
                  value={membershipType || 'PROJECT_MEMBER'}
                  onValueChange={(v) => setValue('membershipType', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROJECT_MEMBER">Project Member</SelectItem>
                    <SelectItem value="ASSOCIATE_RESEARCHER">Associate Researcher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="joinDate">Join Date</Label>
                <Input id="joinDate" {...register('joinDate')} placeholder="2024-01-15" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setValue('isActive', checked as boolean)}
              />
              <Label htmlFor="isActive" className="font-normal cursor-pointer">Active Participant</Label>
            </div>
          </CardContent>
        </Card>

        {/* DNA Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">DNA Testing</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="ftdnaKitNumber">FTDNA Kit Number</Label>
              <Input id="ftdnaKitNumber" {...register('ftdnaKitNumber')} placeholder="123456" />
            </div>
          </CardContent>
        </Card>

        {/* Research */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Research</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="contactNote">Contact Note</Label>
              <Textarea
                id="contactNote"
                {...register('contactNote')}
                rows={2}
                placeholder="Notes about contacting this participant..."
              />
            </div>
            <div>
              <Label htmlFor="researchGoal">Research Goal</Label>
              <Textarea
                id="researchGoal"
                {...register('researchGoal')}
                rows={3}
                placeholder="What this participant hopes to learn..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/participants')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Participant' : 'Create Participant'}
          </Button>
        </div>
      </form>

      {/* ── Relationship Sections (edit mode only) ── */}
      {isEditing && participant && (
        <div className="space-y-6">
          {/* Linked Person Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Linked Person</CardTitle>
              {!participant.linkedPerson && (
                <Button size="sm" variant="outline" onClick={() => setPersonDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Link Person
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {participant.linkedPerson ? (
                <div className="flex items-center justify-between p-2 border rounded">
                  <span className="font-medium">
                    {participant.linkedPerson.givenName} {participant.linkedPerson.surname}
                  </span>
                  <Button size="sm" variant="ghost" onClick={handleUnlinkPerson}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not linked to a person record</p>
              )}
            </CardContent>
          </Card>

          {/* DNA Tests Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">DNA Tests</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDnaDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Test
              </Button>
            </CardHeader>
            <CardContent>
              {participant.dnaTests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No DNA tests recorded</p>
              ) : (
                <div className="space-y-2">
                  {participant.dnaTests.map((test) => (
                    <div key={test.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{test.testName || test.testType || 'Test'}</span>
                        {test.provider && <span className="text-sm text-muted-foreground ml-2">({test.provider})</span>}
                        {test.kitNumber && <span className="text-sm text-muted-foreground ml-2">Kit: {test.kitNumber}</span>}
                        {test.markerCount && <span className="text-sm text-muted-foreground ml-2">{test.markerCount} markers</span>}
                        {test.registeredWithProject && <Badge variant="secondary" className="ml-2">Registered</Badge>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveDnaTest(test.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Online Trees Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Online Trees</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setTreeDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Tree
              </Button>
            </CardHeader>
            <CardContent>
              {participant.onlineTrees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No online trees recorded</p>
              ) : (
                <div className="space-y-2">
                  {participant.onlineTrees.map((tree) => (
                    <div key={tree.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tree.treeName || tree.platform || 'Tree'}</span>
                        {tree.platform && <Badge variant="secondary">{tree.platform}</Badge>}
                        {tree.username && <span className="text-sm text-muted-foreground">by {tree.username}</span>}
                        {tree.url && (
                          <a href={tree.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveOnlineTree(tree.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Haplogroups Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Haplogroups</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setHapDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Assign Haplogroup
              </Button>
            </CardHeader>
            <CardContent>
              {participant.haplogroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No haplogroups assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {participant.haplogroups.map((hap) => (
                    <div key={hap.id} className="flex items-center gap-1 border rounded px-2 py-1">
                      <span className="font-medium text-sm">{hap.name}</span>
                      {hap.subclade && <span className="text-xs text-muted-foreground">({hap.subclade})</span>}
                      {hap.haplogroupType && <Badge variant="outline" className="text-xs">{hap.haplogroupType}</Badge>}
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 ml-1" onClick={() => handleUnassignHaplogroup(hap.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lineage Memberships Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Lineage Memberships</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setLineageDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Membership
              </Button>
            </CardHeader>
            <CardContent>
              {participant.lineageMemberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lineage memberships</p>
              ) : (
                <div className="space-y-2">
                  {participant.lineageMemberships.map((lm) => (
                    <div key={lm.lineage.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lm.lineage.displayName}</span>
                        {lm.lineage.region && <span className="text-sm text-muted-foreground">({lm.lineage.region})</span>}
                        {lm.branchLabel && <Badge variant="secondary">{lm.branchLabel}</Badge>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveLineage(lm.lineage.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Genetic Matches Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Genetic Matches</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setMatchDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Match
              </Button>
            </CardHeader>
            <CardContent>
              {participant.geneticMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No genetic matches recorded</p>
              ) : (
                <div className="space-y-2">
                  {participant.geneticMatches.map((gm) => (
                    <div key={gm.participant.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{gm.participant.displayName}</span>
                        {gm.participant.ftdnaKitNumber && (
                          <span className="text-sm text-muted-foreground ml-2">Kit: {gm.participant.ftdnaKitNumber}</span>
                        )}
                        {gm.matchType && <Badge variant="secondary" className="ml-2">{gm.matchType}</Badge>}
                        {gm.markerLevel && <span className="text-sm text-muted-foreground ml-2">{gm.markerLevel} markers</span>}
                        {gm.notes && <span className="text-sm text-muted-foreground ml-2">- {gm.notes}</span>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveGeneticMatch(gm.participant.id)}>
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
              {participant.adminNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No admin notes</p>
              ) : (
                <div className="space-y-2">
                  {participant.adminNotes.map((note) => (
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

      {/* Link Person Dialog */}
      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Person</DialogTitle>
          </DialogHeader>
          <TypeaheadSearch
            entityType="person"
            label="Search for person"
            onSelect={setPersonSelection}
            selectedValue={personSelection ?? undefined}
            onClear={() => setPersonSelection(null)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLinkPerson} disabled={!personSelection}>Link Person</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add DNA Test Dialog */}
      <Dialog open={dnaDialogOpen} onOpenChange={setDnaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add DNA Test</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Test Type</Label>
                <Select value={dnaTestType} onValueChange={setDnaTestType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Y_DNA">Y-DNA</SelectItem>
                    <SelectItem value="MT_DNA">mtDNA</SelectItem>
                    <SelectItem value="AUTOSOMAL">Autosomal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Provider</Label>
                <Select value={dnaProvider} onValueChange={setDnaProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FTDNA">FTDNA</SelectItem>
                    <SelectItem value="AncestryDNA">AncestryDNA</SelectItem>
                    <SelectItem value="23andMe">23andMe</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Test Name</Label>
              <Input value={dnaTestName} onChange={(e) => setDnaTestName(e.target.value)} placeholder="Y-DNA 37" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kit Number</Label>
                <Input value={dnaKitNumber} onChange={(e) => setDnaKitNumber(e.target.value)} placeholder="123456" />
              </div>
              <div>
                <Label>Marker Count</Label>
                <Input type="number" value={dnaMarkerCount} onChange={(e) => setDnaMarkerCount(e.target.value)} placeholder="37" />
              </div>
            </div>
            <div>
              <Label>GEDmatch Kit</Label>
              <Input value={dnaGedmatchKit} onChange={(e) => setDnaGedmatchKit(e.target.value)} placeholder="A123456" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="dnaRegistered"
                checked={dnaRegistered}
                onCheckedChange={(checked) => setDnaRegistered(checked as boolean)}
              />
              <Label htmlFor="dnaRegistered" className="font-normal cursor-pointer">Registered with Project</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDnaDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDnaTest}>Add Test</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Online Tree Dialog */}
      <Dialog open={treeDialogOpen} onOpenChange={setTreeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Online Tree</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Platform</Label>
              <Select value={treePlatform} onValueChange={setTreePlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FamilySearch">FamilySearch</SelectItem>
                  <SelectItem value="Ancestry">Ancestry</SelectItem>
                  <SelectItem value="MyHeritage">MyHeritage</SelectItem>
                  <SelectItem value="FindAGrave">Find A Grave</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Username</Label>
              <Input value={treeUsername} onChange={(e) => setTreeUsername(e.target.value)} placeholder="username" />
            </div>
            <div>
              <Label>Tree Name</Label>
              <Input value={treeTreeName} onChange={(e) => setTreeTreeName(e.target.value)} placeholder="Kent Family Tree" />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={treeUrl} onChange={(e) => setTreeUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTreeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddOnlineTree}>Add Tree</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Haplogroup Dialog */}
      <Dialog open={hapDialogOpen} onOpenChange={setHapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Haplogroup</DialogTitle>
          </DialogHeader>
          <TypeaheadSearch
            entityType="haplogroup"
            label="Search for haplogroup"
            onSelect={setHapSelection}
            selectedValue={hapSelection ?? undefined}
            onClear={() => setHapSelection(null)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHapDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignHaplogroup} disabled={!hapSelection}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lineage Membership Dialog */}
      <Dialog open={lineageDialogOpen} onOpenChange={setLineageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Lineage Membership</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TypeaheadSearch
              entityType="lineage"
              label="Search for lineage"
              onSelect={setLineageSelection}
              selectedValue={lineageSelection ?? undefined}
              onClear={() => setLineageSelection(null)}
            />
            <div>
              <Label>Branch Label</Label>
              <Input value={branchLabel} onChange={(e) => setBranchLabel(e.target.value)} placeholder="Optional branch label" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLineage} disabled={!lineageSelection}>Add Membership</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Genetic Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Genetic Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TypeaheadSearch
              entityType="participant"
              label="Search for participant"
              onSelect={setMatchSelection}
              selectedValue={matchSelection ?? undefined}
              onClear={() => setMatchSelection(null)}
              excludeIds={id ? [id] : []}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Match Type</Label>
                <Select value={matchType} onValueChange={setMatchType}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact</SelectItem>
                    <SelectItem value="close">Close</SelectItem>
                    <SelectItem value="distant">Distant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marker Level</Label>
                <Input type="number" value={matchMarkerLevel} onChange={(e) => setMatchMarkerLevel(e.target.value)} placeholder="37" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={matchNotes} onChange={(e) => setMatchNotes(e.target.value)} rows={2} placeholder="Match notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddGeneticMatch} disabled={!matchSelection}>Record Match</Button>
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
