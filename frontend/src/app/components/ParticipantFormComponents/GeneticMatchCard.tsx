import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Pencil, Trash2, Dna } from 'lucide-react';
import { GeneticMatch } from '../../../lib/mock-data';

interface GeneticMatchCardProps {
  match: GeneticMatch;
  matchedParticipantName: string;
  matchedParticipantKit: string;
  matchType: 'y-DNA' | 'atDNA' | 'mtDNA';
  onEdit: () => void;
  onDelete: () => void;
}

const matchTypeBadges = {
  'y-DNA': { color: 'bg-blue-100 text-blue-800', label: 'y-DNA' },
  'atDNA': { color: 'bg-green-100 text-green-800', label: 'atDNA' },
  'mtDNA': { color: 'bg-purple-100 text-purple-800', label: 'mtDNA' },
};

export function GeneticMatchCard({
  match,
  matchedParticipantName,
  matchedParticipantKit,
  matchType,
  onEdit,
  onDelete
}: GeneticMatchCardProps) {
  const badge = matchTypeBadges[matchType];

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Dna className="h-4 w-4 text-gray-500" />
              <span className="font-medium">
                Kit {matchedParticipantKit} ({matchedParticipantName})
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">{match.markerLevel}</span>
              <span className="text-sm text-gray-600">·</span>
              <Badge className={badge.color}>
                {badge.label}
              </Badge>
            </div>

            {match.note && (
              <div className="text-sm text-gray-700 mt-2">
                <span className="text-gray-600">Note:</span> "{match.note}"
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
