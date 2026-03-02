import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Trash2, Building2 } from 'lucide-react';
import { LineageAssignment } from '../../../lib/mock-data';

interface LineageMembershipCardProps {
  assignment: LineageAssignment;
  branchLabel?: string;
  onEditBranch: () => void;
  onDelete: () => void;
}

export function LineageMembershipCard({
  assignment,
  branchLabel,
  onEditBranch,
  onDelete
}: LineageMembershipCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{assignment.lineage.displayName}</span>
            </div>

            <div className="text-sm">
              <span className="text-gray-600">Branch:</span>{' '}
              {branchLabel ? (
                <span>"{branchLabel}"</span>
              ) : (
                <span className="text-gray-400 italic">None</span>
              )}
            </div>

            <Button
              variant="link"
              size="sm"
              onClick={onEditBranch}
              className="px-0 h-auto text-xs mt-1"
            >
              Edit Branch Label
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
