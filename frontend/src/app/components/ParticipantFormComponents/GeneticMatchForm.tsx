import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { GeneticMatch, Participant } from '../../../lib/mock-data';
import { participantsAPI } from '../../../lib/api';

interface GeneticMatchFormProps {
  match?: GeneticMatch & { matchType: 'y-DNA' | 'atDNA' | 'mtDNA' };
  open: boolean;
  onSave: (match: Omit<GeneticMatch, 'id'> & { matchType: 'y-DNA' | 'atDNA' | 'mtDNA' }) => void;
  onCancel: () => void;
  currentParticipantId?: string;
}

const geneticMatchSchema = z.object({
  matchedParticipantId: z.string().min(1, 'Matched participant is required'),
  matchType: z.enum(['y-DNA', 'atDNA', 'mtDNA']),
  markerLevel: z.string().min(1, 'Marker level is required'),
  note: z.string().optional(),
});

type GeneticMatchFormData = z.infer<typeof geneticMatchSchema>;

export function GeneticMatchForm({ match, open, onSave, onCancel, currentParticipantId }: GeneticMatchFormProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showParticipantList, setShowParticipantList] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<GeneticMatchFormData>({
    resolver: zodResolver(geneticMatchSchema),
    defaultValues: match || {
      matchedParticipantId: '',
      matchType: 'y-DNA',
      markerLevel: '',
      note: '',
    },
  });

  useEffect(() => {
    loadParticipants();
  }, []);

  const loadParticipants = async () => {
    try {
      const data = await participantsAPI.list();
      // Filter out current participant
      setParticipants(data.filter(p => p.id !== currentParticipantId));
    } catch (error) {
      console.error('Failed to load participants:', error);
    }
  };

  const selectedParticipantId = watch('matchedParticipantId');
  const selectedParticipant = participants.find(p => p.id === selectedParticipantId);

  const filteredParticipants = searchQuery
    ? participants.filter(p =>
        p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.dnaTests.some(t => t.kitNumber.includes(searchQuery))
      )
    : participants;

  const onSubmit = (data: GeneticMatchFormData) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{match ? 'Edit Genetic Match' : 'Add Genetic Match'}</DialogTitle>
          <DialogDescription>
            {match ? 'Update the genetic match information.' : 'Add a new genetic match for this participant.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Matched Participant */}
          <div>
            <Label htmlFor="matchedParticipant">Matched Participant *</Label>
            <div className="relative">
              <Input
                id="matchedParticipant"
                placeholder="Search by name or kit number..."
                value={selectedParticipant?.displayName || searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowParticipantList(true);
                }}
                onFocus={() => setShowParticipantList(true)}
              />
              {showParticipantList && filteredParticipants.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredParticipants.map((participant) => (
                    <button
                      key={participant.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                      onClick={() => {
                        setValue('matchedParticipantId', participant.id);
                        setSearchQuery('');
                        setShowParticipantList(false);
                      }}
                    >
                      <div className="font-medium">{participant.displayName}</div>
                      {participant.dnaTests.length > 0 && (
                        <div className="text-xs text-gray-600">
                          Kits: {participant.dnaTests.map(t => t.kitNumber).join(', ')}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.matchedParticipantId && (
              <p className="text-sm text-red-600 mt-1">{errors.matchedParticipantId.message}</p>
            )}
          </div>

          {/* Match Type */}
          <div>
            <Label>Match Type *</Label>
            <RadioGroup
              value={watch('matchType')}
              onValueChange={(value) => setValue('matchType', value as GeneticMatchFormData['matchType'])}
              className="grid-cols-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="y-DNA" id="match-y-dna" />
                <Label htmlFor="match-y-dna" className="font-normal cursor-pointer">y-DNA</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="atDNA" id="match-atdna" />
                <Label htmlFor="match-atdna" className="font-normal cursor-pointer">atDNA</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mtDNA" id="match-mtdna" />
                <Label htmlFor="match-mtdna" className="font-normal cursor-pointer">mtDNA</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Marker Level */}
          <div>
            <Label htmlFor="markerLevel">Marker Level *</Label>
            <Input
              id="markerLevel"
              placeholder="e.g., 111/111, 37/37, or 2000 cM"
              {...register('markerLevel')}
            />
            <p className="text-xs text-gray-600 mt-1">
              For y-DNA: e.g., "111/111" or "37/37". For atDNA: e.g., "2000 cM"
            </p>
            {errors.markerLevel && (
              <p className="text-sm text-red-600 mt-1">{errors.markerLevel.message}</p>
            )}
          </div>

          {/* Note */}
          <div>
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="Additional notes about this match..."
              rows={3}
              {...register('note')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {match ? 'Save Changes' : 'Add Match'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
