import { useNavigate, useParams } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ArrowLeft } from 'lucide-react';

export function ParticipantForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/participants')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Participants
        </Button>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <h2 className="text-xl font-semibold mb-2">
            {id ? 'Edit Participant' : 'New Participant'}
          </h2>
          <p className="text-sm text-gray-500">
            Participant form will be wired to GraphQL mutations in Phase 3c.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
