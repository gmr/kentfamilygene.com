import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Plus, Search, Check, X, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePlacesQuery,
  useCreatePlaceMutation,
  useUpdatePlaceMutation,
  useDeletePlaceMutation,
  type Place,
} from '../../generated/graphql';

const placeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  county: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  lat: z.union([z.number(), z.nan()]).optional().nullable(),
  lon: z.union([z.number(), z.nan()]).optional().nullable(),
  familysearchUrl: z.string().optional(),
});

type PlaceFormData = z.infer<typeof placeSchema>;

export function Places() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [missingCoords, setMissingCoords] = useState(false);
  const [missingFS, setMissingFS] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [{ data, fetching, error }, refetchPlaces] = usePlacesQuery();

  const [, createPlace] = useCreatePlaceMutation();
  const [, updatePlace] = useUpdatePlaceMutation();
  const [, deletePlace] = useDeletePlaceMutation();

  const places = data?.places?.items ?? [];
  const total = data?.places?.total ?? 0;

  const countries = useMemo(() => {
    return Array.from(new Set(places.map(p => p.country).filter(Boolean))).sort() as string[];
  }, [places]);

  const filtered = useMemo(() => {
    let result = [...places];

    if (countryFilter !== 'all') {
      result = result.filter(p => p.country === countryFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.county?.toLowerCase().includes(query) ||
        p.state?.toLowerCase().includes(query)
      );
    }

    if (missingCoords) {
      result = result.filter(p => !p.lat || !p.lon);
    }

    if (missingFS) {
      result = result.filter(p => !p.familysearchUrl);
    }

    return result;
  }, [places, countryFilter, searchQuery, missingCoords, missingFS]);

  const isEditing = editingPlace !== null;
  const modalOpen = isCreateModalOpen || isEditing;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlaceFormData>({
    resolver: zodResolver(placeSchema),
    defaultValues: {
      name: '',
      county: '',
      state: '',
      country: 'United States',
      lat: null,
      lon: null,
      familysearchUrl: '',
    },
  });

  useEffect(() => {
    if (editingPlace) {
      reset({
        name: editingPlace.name,
        county: editingPlace.county ?? '',
        state: editingPlace.state ?? '',
        country: editingPlace.country ?? 'United States',
        lat: editingPlace.lat ?? null,
        lon: editingPlace.lon ?? null,
        familysearchUrl: editingPlace.familysearchUrl ?? '',
      });
    } else if (isCreateModalOpen) {
      reset({
        name: '',
        county: '',
        state: '',
        country: 'United States',
        lat: null,
        lon: null,
        familysearchUrl: '',
      });
    }
  }, [editingPlace, isCreateModalOpen, reset]);

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setEditingPlace(null);
  };

  const onSubmit = async (formData: PlaceFormData) => {
    const input = {
      name: formData.name,
      county: formData.county || undefined,
      state: formData.state || undefined,
      country: formData.country || undefined,
      lat: formData.lat != null && !isNaN(formData.lat) ? formData.lat : undefined,
      lon: formData.lon != null && !isNaN(formData.lon) ? formData.lon : undefined,
      familysearchUrl: formData.familysearchUrl || undefined,
    };

    if (isEditing) {
      const result = await updatePlace({ id: editingPlace!.id, input });
      if (result.error) {
        toast.error('Failed to update place');
        return;
      }
      toast.success('Place updated');
    } else {
      const result = await createPlace({ input });
      if (result.error) {
        toast.error('Failed to create place');
        return;
      }
      toast.success('Place created');
    }
    refetchPlaces({ requestPolicy: 'network-only' });
    closeModal();
  };

  const handleDelete = async () => {
    if (!editingPlace) return;
    const result = await deletePlace({ id: editingPlace.id });
    if (result.error) {
      toast.error('Failed to delete place');
      return;
    }
    toast.success('Place deleted');
    refetchPlaces({ requestPolicy: 'network-only' });
    closeModal();
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading places...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Failed to load places</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Places</h1>
          <p className="text-sm text-muted-foreground">
            Manage the place database for standardized location data.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Place
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap p-4 bg-muted/50 rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={countryFilter} onValueChange={(v) => setCountryFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="missing-coords"
            checked={missingCoords}
            onCheckedChange={(checked) => setMissingCoords(checked as boolean)}
          />
          <label htmlFor="missing-coords" className="text-sm cursor-pointer">
            Missing Coords
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="missing-fs"
            checked={missingFS}
            onCheckedChange={(checked) => setMissingFS(checked as boolean)}
          />
          <label htmlFor="missing-fs" className="text-sm cursor-pointer">
            Missing FS URL
          </label>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-4">
            {searchQuery || countryFilter !== 'all' || missingCoords || missingFS
              ? 'No places found matching your filters.'
              : 'No places found.'}
          </p>
          {!searchQuery && countryFilter === 'all' && !missingCoords && !missingFS && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Place
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>County</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-center">Coords</TableHead>
                <TableHead className="text-center">FS</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((place) => (
                <TableRow key={place.id} className="cursor-pointer" onClick={() => setEditingPlace(place)}>
                  <TableCell className="font-medium">{place.name}</TableCell>
                  <TableCell>{place.county || '-'}</TableCell>
                  <TableCell>{place.state}</TableCell>
                  <TableCell className="text-center">
                    {place.lat && place.lon ? (
                      <Check className="h-4 w-4 mx-auto text-green-500" />
                    ) : (
                      <X className="h-4 w-4 mx-auto text-red-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {place.familysearchUrl ? (
                      <Check className="h-4 w-4 mx-auto text-green-500" />
                    ) : (
                      <X className="h-4 w-4 mx-auto text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      title="Find people from this place"
                      className="p-1 rounded hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/people?q=${encodeURIComponent(place.name)}`);
                      }}
                    >
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="p-4 border-t bg-muted/20 text-sm text-muted-foreground">
            Showing {filtered.length} place{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <Dialog open onOpenChange={closeModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Place' : 'Create Place'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="place-name">Full Name *</Label>
                <Input
                  id="place-name"
                  {...register('name')}
                  placeholder="Warren Co., Georgia"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="place-county">County</Label>
                <Input id="place-county" {...register('county')} placeholder="Warren" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="place-state">State</Label>
                  <Input id="place-state" {...register('state')} placeholder="Georgia" />
                </div>
                <div>
                  <Label htmlFor="place-country">Country</Label>
                  <Input id="place-country" {...register('country')} placeholder="United States" />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2 text-sm">Coordinates</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="place-lat">Latitude</Label>
                    <Input
                      id="place-lat"
                      type="number"
                      step="any"
                      {...register('lat', { setValueAs: (v) => v === '' ? null : parseFloat(v) })}
                      placeholder="33.4068"
                    />
                  </div>
                  <div>
                    <Label htmlFor="place-lon">Longitude</Label>
                    <Input
                      id="place-lon"
                      type="number"
                      step="any"
                      {...register('lon', { setValueAs: (v) => v === '' ? null : parseFloat(v) })}
                      placeholder="-82.6776"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label htmlFor="place-fs">FamilySearch Wiki URL</Label>
                <Input
                  id="place-fs"
                  {...register('familysearchUrl')}
                  placeholder="https://familysearch.org/wiki/..."
                />
              </div>

              <DialogFooter className="flex justify-between sm:justify-between">
                <div>
                  {isEditing && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Place</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{editingPlace?.name}"? This action cannot be undone.
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
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
