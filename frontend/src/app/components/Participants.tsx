import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Pencil, Plus, Search } from 'lucide-react';
import { useParticipantsQuery } from '../../generated/graphql';

export function Participants() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [membershipFilter, setMembershipFilter] = useState<'all' | 'member' | 'associate'>('all');
  const [offset, setOffset] = useState(0);

  const [{ data, fetching, error }] = useParticipantsQuery({
    variables: {
      activeOnly: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
      offset,
      limit: 50,
    },
  });

  const participants = data?.participants?.items ?? [];
  const total = data?.participants?.total ?? 0;
  const hasMore = data?.participants?.hasMore ?? false;

  // Client-side filters
  const filteredParticipants = useMemo(() => {
    let filtered = [...participants];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.displayName.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query)
      );
    }

    if (membershipFilter === 'member') {
      filtered = filtered.filter(p => p.membershipType === 'PROJECT_MEMBER');
    } else if (membershipFilter === 'associate') {
      filtered = filtered.filter(p => p.membershipType === 'ASSOCIATE_RESEARCHER');
    }

    return filtered;
  }, [participants, searchQuery, membershipFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Participants</h2>
          <p className="text-sm text-gray-600 mt-1">Manage project participants and DNA tests</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/admin/participants/new')}>
          <Plus className="h-4 w-4" />
          New Participant
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <div className="flex gap-2">
                <Button
                  variant={activeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setActiveFilter('all'); setOffset(0); }}
                  className="flex-1"
                >
                  All
                </Button>
                <Button
                  variant={activeFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setActiveFilter('active'); setOffset(0); }}
                  className="flex-1"
                >
                  Active
                </Button>
                <Button
                  variant={activeFilter === 'inactive' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setActiveFilter('inactive'); setOffset(0); }}
                  className="flex-1"
                >
                  Inactive
                </Button>
              </div>
            </div>

            <div>
              <Label>Membership</Label>
              <div className="flex gap-2">
                <Button
                  variant={membershipFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMembershipFilter('all')}
                  className="flex-1"
                >
                  All
                </Button>
                <Button
                  variant={membershipFilter === 'member' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMembershipFilter('member')}
                  className="flex-1"
                >
                  Member
                </Button>
                <Button
                  variant={membershipFilter === 'associate' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMembershipFilter('associate')}
                  className="flex-1"
                >
                  Associate
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants Table */}
      <Card>
        <CardContent className="pt-6">
          {fetching ? (
            <div className="text-center py-8">Loading participants...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">Failed to load participants</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Kit No.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell className="font-medium">{participant.displayName}</TableCell>
                      <TableCell className="text-sm text-gray-600">{participant.email}</TableCell>
                      <TableCell>
                        <Badge variant={participant.membershipType === 'PROJECT_MEMBER' ? 'default' : 'secondary'}>
                          {participant.membershipType === 'PROJECT_MEMBER' ? 'Member' : 'Associate'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {participant.ftdnaKitNumber || <span className="text-gray-400">{'\u2014'}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={participant.isActive ? 'default' : 'secondary'}>
                          {participant.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/participants/${participant.id}`)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredParticipants.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No participants found matching your filters
                </div>
              )}

              {/* Pagination */}
              {total > 50 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-600">
                    Showing {filteredParticipants.length} of {Math.min(50, total - offset)} on page ({total} total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - 50))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasMore}
                      onClick={() => setOffset(offset + 50)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
