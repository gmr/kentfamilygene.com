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
import { GenealogyDateInput, type DateModifier } from './PersonFormComponents/GenealogyDateInput';
import {
  useAdminPersonQuery,
  useCreatePersonMutation,
  useUpdatePersonMutation,
  useDeletePersonMutation,
} from '../../generated/graphql';

function extractYear(dateStr: string): string | undefined {
  const match = dateStr.match(/\b(\d{4})\b/);
  return match ? match[1] : undefined;
}

const personSchema = z.object({
  givenName: z.string().min(1, 'Given name is required'),
  surname: z.string().min(1, 'Surname is required'),
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

export function PersonForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [{ data, fetching }] = useAdminPersonQuery({
    variables: { id: id! },
    pause: !id,
  });

  const [, createPerson] = useCreatePersonMutation();
  const [, updatePerson] = useUpdatePersonMutation();
  const [, deletePerson] = useDeletePersonMutation();

  const person = data?.adminPerson;

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
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="U">Unknown</SelectItem>
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
    </div>
  );
}
