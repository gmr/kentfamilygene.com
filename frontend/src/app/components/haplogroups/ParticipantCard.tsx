import { User } from 'lucide-react';
import { Participant } from '../../../lib/mock-data';

interface ParticipantCardProps {
  participant: Participant;
}

export function ParticipantCard({ participant }: ParticipantCardProps) {
  // Get kit number from DNA tests
  const kitNumber = participant.dnaTests?.[0]?.kitNumber || 'No Kit';

  // Get primary lineage
  const primaryLineage = participant.lineageMemberships?.[0]?.lineageDisplay;

  return (
    <a
      href={`#/admin/participants/${participant.id}`}
      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
      onClick={(e) => {
        e.preventDefault();
        // In a real app, this would navigate to the participant detail page
        console.log('Navigate to participant:', participant.id);
      }}
    >
      <div className="flex-shrink-0 mt-0.5">
        <User className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{participant.displayName}</div>
        <div className="text-sm text-muted-foreground">
          Kit: {kitNumber}
          {participant.haplogroupStatus && (
            <>
              {' · '}
              Status:{' '}
              {participant.haplogroupStatus === 'Confirmed' ? (
                <span className="text-green-600">Confirmed</span>
              ) : (
                <span className="text-yellow-600">Predicted</span>
              )}
            </>
          )}
          {primaryLineage && (
            <>
              {' · '}
              {primaryLineage}
            </>
          )}
        </div>
      </div>
    </a>
  );
}
