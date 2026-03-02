import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Pencil, Trash2, Dna } from 'lucide-react';
import { DNATest } from '../../../lib/mock-data';

interface DNATestCardProps {
  test: DNATest;
  onEdit: () => void;
  onDelete: () => void;
}

const testTypeBadges = {
  'y-DNA': { color: 'bg-blue-100 text-blue-800', label: 'y-DNA' },
  'atDNA': { color: 'bg-green-100 text-green-800', label: 'atDNA' },
  'mtDNA': { color: 'bg-purple-100 text-purple-800', label: 'mtDNA' },
};

const providers = {
  'FTDNA': 'FamilyTreeDNA',
  'AncestryDNA': 'AncestryDNA',
  '23andMe': '23andMe',
  'Other': 'Other',
};

export function DNATestCard({ test, onEdit, onDelete }: DNATestCardProps) {
  const badge = testTypeBadges[test.testType];

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Dna className="h-4 w-4 text-gray-500" />
              <Badge className={badge.color}>
                {badge.label}
              </Badge>
              <span className="font-medium">{test.testName}</span>
              <span className="text-sm text-gray-600">·</span>
              <span className="text-sm text-gray-600">{providers[test.provider]}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
              <div>
                <span className="text-gray-600">Kit:</span>{' '}
                <span className="font-mono">{test.kitNumber}</span>
                {test.registered && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    ✓ Registered
                  </Badge>
                )}
              </div>

              {test.markerCount && (
                <div>
                  <span className="text-gray-600">Markers:</span>{' '}
                  <span>{test.markerCount}</span>
                </div>
              )}

              {test.gedmatchKit && (
                <div>
                  <span className="text-gray-600">GEDmatch:</span>{' '}
                  <span className="font-mono">{test.gedmatchKit}</span>
                </div>
              )}
            </div>
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
