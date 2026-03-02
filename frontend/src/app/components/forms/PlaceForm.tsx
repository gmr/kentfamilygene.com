import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { placesAPI } from '../../../lib/api';
import { Place } from '../../../lib/mock-data';
import { useState } from 'react';

const placeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  county: z.string().optional(),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  familySearchUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type PlaceFormData = z.infer<typeof placeSchema>;

interface PlaceFormProps {
  place?: Place | null;
  onSuccess: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function PlaceForm({ place, onSuccess, onCancel, onDelete }: PlaceFormProps) {
  const [isGeocoding, setIsGeocoding] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlaceFormData>({
    resolver: zodResolver(placeSchema),
    defaultValues: {
      name: place?.name || '',
      county: place?.county || '',
      state: place?.state || '',
      country: place?.country || 'United States',
      latitude: place?.latitude || null,
      longitude: place?.longitude || null,
      familySearchUrl: place?.familySearchUrl || '',
    },
  });

  const county = watch('county');
  const state = watch('state');
  const country = watch('country');

  // Geocode lookup
  const handleGeocodeLookup = async () => {
    if (!state || !country) {
      toast.error('State and Country are required for geocoding');
      return;
    }

    setIsGeocoding(true);
    try {
      const response = await placesAPI.geocode({
        name: state,
        county: county || undefined,
        state,
        country,
      });

      setValue('latitude', response.latitude);
      setValue('longitude', response.longitude);
      toast.success(`Coordinates found! (Source: ${response.source})`);
    } catch (error) {
      toast.error('Failed to lookup coordinates');
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  // FamilySearch search
  const handleFSSearch = () => {
    const searchQuery = county ? `${county}, ${state}` : state;
    const url = `https://www.familysearch.org/wiki/en/index.php?search=${encodeURIComponent(searchQuery)}`;
    window.open(url, '_blank');
  };

  const onSubmit = async (data: PlaceFormData) => {
    try {
      if (place) {
        await placesAPI.update(place.id, data);
        toast.success('Place updated successfully');
      } else {
        await placesAPI.create(data);
        toast.success('Place created successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error(`Failed to ${place ? 'update' : 'create'} place`);
      console.error('Error saving place:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Full Name */}
      <div>
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Warren Co., Georgia"
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && (
          <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* County */}
      <div>
        <Label htmlFor="county">County</Label>
        <Input
          id="county"
          {...register('county')}
          placeholder="Warren"
        />
      </div>

      {/* State */}
      <div>
        <Label htmlFor="state">State</Label>
        <Input
          id="state"
          {...register('state')}
          placeholder="Georgia"
          className={errors.state ? 'border-red-500' : ''}
        />
        {errors.state && (
          <p className="text-sm text-red-500 mt-1">{errors.state.message}</p>
        )}
      </div>

      {/* Country */}
      <div>
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          {...register('country')}
          placeholder="United States"
          className={errors.country ? 'border-red-500' : ''}
        />
        {errors.country && (
          <p className="text-sm text-red-500 mt-1">{errors.country.message}</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Coordinates</h3>
      </div>

      {/* Coordinates */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              {...register('latitude', {
                setValueAs: (v) => v === '' ? null : parseFloat(v)
              })}
              placeholder="33.4068"
              type="number"
              step="any"
            />
          </div>
          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              {...register('longitude', {
                setValueAs: (v) => v === '' ? null : parseFloat(v)
              })}
              placeholder="-82.6776"
              type="number"
              step="any"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGeocodeLookup}
          disabled={isGeocoding}
          className="w-full"
        >
          {isGeocoding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Looking up...
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              Lookup Coordinates
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Uses name + county + state to geocode via external API
        </p>
      </div>

      {/* Divider */}
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">References</h3>
      </div>

      {/* FamilySearch URL */}
      <div className="space-y-2">
        <Label htmlFor="familySearchUrl">FamilySearch Wiki URL</Label>
        <Input
          id="familySearchUrl"
          {...register('familySearchUrl')}
          placeholder="https://familysearch.org/wiki/..."
          className={errors.familySearchUrl ? 'border-red-500' : ''}
        />
        {errors.familySearchUrl && (
          <p className="text-sm text-red-500 mt-1">{errors.familySearchUrl.message}</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFSSearch}
          className="w-full"
        >
          <Search className="mr-2 h-4 w-4" />
          Search FamilySearch Wiki
        </Button>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <div>
          {place && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={isSubmitting}
            >
              Delete Place
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : place ? 'Update Place' : 'Create Place'}
          </Button>
        </div>
      </div>
    </form>
  );
}
