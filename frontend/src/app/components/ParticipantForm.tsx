import { useEffect } from 'react';
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
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdminParticipantQuery,
  useCreateParticipantMutation,
  useUpdateParticipantMutation,
  useDeleteParticipantMutation,
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

export function ParticipantForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [{ data, fetching }] = useAdminParticipantQuery({
    variables: { id: id! },
    pause: !id,
  });

  const [, createParticipant] = useCreateParticipantMutation();
  const [, updateParticipant] = useUpdateParticipantMutation();
  const [, deleteParticipant] = useDeleteParticipantMutation();

  const participant = data?.adminParticipant;

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
    </div>
  );
}
