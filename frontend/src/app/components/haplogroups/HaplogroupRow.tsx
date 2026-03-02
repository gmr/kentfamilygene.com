import { useState } from 'react';
import { ChevronRight, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { TableCell, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Haplogroup, Participant } from '../../../lib/mock-data';
import { haplogroupsAPI } from '../../../lib/api';
import { ParticipantCard } from './ParticipantCard';

interface HaplogroupRowProps {
  haplogroup: Haplogroup;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const typeBadges = {
  'y-dna': {
    label: 'y-DNA',
    icon: '🧬',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  'mt-dna': {
    label: 'mtDNA',
    icon: '🧬',
    bgColor: 'bg-purple-100 dark:bg-purple-900',
    textColor: 'text-purple-700 dark:text-purple-300',
  },
};

export function HaplogroupRow({
  haplogroup,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: HaplogroupRowProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Fetch participants when expanded
  const handleToggle = async () => {
    if (!isExpanded && participants.length === 0 && haplogroup.participantCount > 0) {
      setLoadingParticipants(true);
      try {
        const data = await haplogroupsAPI.getParticipants(haplogroup.id);
        setParticipants(data);
      } catch (error) {
        console.error('Error loading participants:', error);
      } finally {
        setLoadingParticipants(false);
      }
    }
    onToggle();
  };

  const typeBadge = typeBadges[haplogroup.type];

  return (
    <>
      {/* Main Row */}
      <TableRow className="cursor-pointer hover:bg-muted/50">
        <TableCell onClick={handleToggle} className="w-[50px]">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </TableCell>
        <TableCell onClick={handleToggle} className="font-medium">
          {haplogroup.name}
        </TableCell>
        <TableCell onClick={handleToggle}>{haplogroup.subclade}</TableCell>
        <TableCell onClick={handleToggle}>{haplogroup.subclade}</TableCell>
        <TableCell onClick={handleToggle}>
          <Badge className={`${typeBadge.bgColor} ${typeBadge.textColor} border-0`}>
            {typeBadge.icon} {typeBadge.label}
          </Badge>
        </TableCell>
        <TableCell onClick={handleToggle} className="text-right">
          {haplogroup.participantCount}
        </TableCell>
        <TableCell className="w-[100px]">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded Content */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/20 p-4">
            <div className="space-y-3">
              <h4 className="font-semibold">
                Assigned Participants ({haplogroup.participantCount})
              </h4>
              {loadingParticipants ? (
                <p className="text-sm text-muted-foreground">Loading participants...</p>
              ) : participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No participants assigned to this haplogroup yet.
                </p>
              ) : (
                <div className="grid gap-2">
                  {participants.slice(0, 5).map((participant) => (
                    <ParticipantCard key={participant.id} participant={participant} />
                  ))}
                  {participants.length > 5 && (
                    <Button
                      variant="link"
                      className="justify-start p-0 h-auto"
                      onClick={() => {
                        // Navigate to participants list filtered by this haplogroup
                        console.log('View all participants for haplogroup:', haplogroup.id);
                      }}
                    >
                      View all {participants.length} participants →
                    </Button>
                  )}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
