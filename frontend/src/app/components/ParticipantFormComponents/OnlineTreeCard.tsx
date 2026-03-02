import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { OnlineTree } from '../../../lib/mock-data';

interface OnlineTreeCardProps {
  tree: OnlineTree;
  onEdit: () => void;
  onDelete: () => void;
}

const platformConfig: Record<string, { icon: string; color: string }> = {
  'Ancestry': { icon: '🌳', color: 'text-green-600' },
  'FamilySearch': { icon: '🌲', color: 'text-blue-600' },
  'MyHeritage': { icon: '🌴', color: 'text-orange-600' },
  'FindMyPast': { icon: '🌿', color: 'text-teal-600' },
  'Other': { icon: '🌱', color: 'text-gray-600' },
};

export function OnlineTreeCard({ tree, onEdit, onDelete }: OnlineTreeCardProps) {
  const config = platformConfig[tree.provider] || platformConfig['Other'];

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{config.icon}</span>
              <span className={`font-medium ${config.color}`}>{tree.provider}</span>
            </div>

            <div className="space-y-1 text-sm">
              <div>
                <span className="text-gray-600">Username:</span>{' '}
                <span className="font-medium">{tree.username}</span>
              </div>
              <div>
                <span className="text-gray-600">Tree:</span>{' '}
                <span>"{tree.treeName}"</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-600">URL:</span>{' '}
                <a
                  href={tree.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  {tree.url.length > 40 ? tree.url.substring(0, 40) + '...' : tree.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
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
