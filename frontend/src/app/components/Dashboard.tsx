import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Users, Dna, MapPin } from 'lucide-react';
import { useStatsQuery, useAdminNotesQuery } from '../../generated/graphql';
import { cn } from './ui/utils';

const noteColorClasses: Record<string, string> = {
  PINK: 'bg-pink-500',
  ORANGE: 'bg-orange-500',
  BLUE: 'bg-blue-500',
  GREEN: 'bg-green-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
};

export function Dashboard() {
  const navigate = useNavigate();
  const [{ data: statsData, fetching: statsLoading }] = useStatsQuery();
  const [{ data: notesData, fetching: notesLoading }] = useAdminNotesQuery({
    variables: { resolved: false, limit: 5 },
  });

  const stats = statsData?.stats;
  const notes = notesData?.adminNotes?.items ?? [];

  if (statsLoading || notesLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-gray-600 mt-1">Overview of project health and recent activity</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Lineages</CardTitle>
            <Dna className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.lineageCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">People</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.personCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Participants</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.participantCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Places</CardTitle>
            <MapPin className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.placeCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Open Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed — placeholder */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 text-center py-4">
                Activity feed coming soon
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Open Admin Notes */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Open Admin Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="border-l-4 pl-3 py-2 border-gray-200">
                    <div className="flex items-start gap-2">
                      <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', noteColorClasses[note.color ?? ''] || 'bg-gray-400')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-2">{note.text}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {notes.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No open admin notes</p>
                )}

                {notes.length > 0 && (
                  <button
                    onClick={() => navigate('/admin/notes')}
                    className="text-xs text-blue-600 hover:underline mt-1"
                  >
                    View all notes
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
