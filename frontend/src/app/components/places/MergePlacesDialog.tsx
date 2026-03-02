import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Check, X } from 'lucide-react';
import { Place } from '../../../lib/mock-data';
import { toast } from 'sonner';
import { placesAPI } from '../../../lib/api';

interface MergePlacesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  places: Place[];
  onSuccess: () => void;
}

export function MergePlacesDialog({
  open,
  onOpenChange,
  places,
  onSuccess,
}: MergePlacesDialogProps) {
  const [targetPlaceId, setTargetPlaceId] = useState<string>(places[0]?.id || '');
  const [isMerging, setIsMerging] = useState(false);

  const handleMerge = async () => {
    if (!targetPlaceId) {
      toast.error('Please select a place to keep');
      return;
    }

    setIsMerging(true);
    try {
      const sourceIds = places.filter(p => p.id !== targetPlaceId).map(p => p.id);
      await placesAPI.merge(sourceIds, targetPlaceId);

      const targetPlace = places.find(p => p.id === targetPlaceId);
      const totalUsage = places.reduce((sum, p) => sum + (p.usedByCount || 0), 0);

      toast.success(
        `Successfully merged ${places.length} places. ${totalUsage} entities now reference "${targetPlace?.name}".`
      );
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to merge places');
      console.error('Merge error:', error);
    } finally {
      setIsMerging(false);
    }
  };

  if (places.length < 2) {
    return null;
  }

  const targetPlace = places.find(p => p.id === targetPlaceId);
  const totalUsage = places.reduce((sum, p) => sum + (p.usedByCount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge Places</DialogTitle>
          <DialogDescription>
            You are merging {places.length} places. Select which place to keep as the primary record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* List of places being merged */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Places to merge:</h4>
            {places.map((place, index) => (
              <div key={place.id} className="p-3 border rounded-lg bg-muted/20">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">
                      {index + 1}. {place.name}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Used by: {place.usedByCount || 0} entities
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {place.latitude && place.longitude ? (
                      <Check className="h-4 w-4 text-green-500" title="Has coordinates" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" title="Missing coordinates" />
                    )}
                    {place.familySearchUrl ? (
                      <Check className="h-4 w-4 text-green-500" title="Has FamilySearch URL" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" title="Missing FamilySearch URL" />
                    )}
                  </div>
                </div>
                {place.county && (
                  <div className="text-xs text-muted-foreground mt-1">
                    County: {place.county}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Selection */}
          <div className="border-t pt-4">
            <Label className="font-semibold mb-3 block">Select the place to keep:</Label>
            <RadioGroup value={targetPlaceId} onValueChange={setTargetPlaceId}>
              {places.map((place) => (
                <div key={place.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={place.id} id={`place-${place.id}`} />
                  <Label
                    htmlFor={`place-${place.id}`}
                    className="font-normal cursor-pointer flex-1"
                  >
                    {place.name}
                    {place.county && ` (${place.county} County)`}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Preview */}
          {targetPlace && (
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-sm mb-2">Preview of merge:</h4>
              <ul className="text-sm space-y-1">
                <li>
                  • {totalUsage} total entities will reference "<strong>{targetPlace.name}</strong>"
                </li>
                {places.filter(p => p.id !== targetPlaceId).length > 0 && (
                  <li>
                    • {places.filter(p => p.id !== targetPlaceId).map(p => `"${p.name}"`).join(', ')} will be deleted
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isMerging}
            >
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={isMerging}>
              {isMerging ? 'Merging...' : 'Merge Places'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
