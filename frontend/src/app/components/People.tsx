import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Pencil, Plus, Search, X } from 'lucide-react';
import { usePersonsQuery } from '../../generated/graphql';

export function People() {
  const navigate = useNavigate();
  const [sexFilter, setSexFilter] = useState<string>('all');
  const [livingFilter, setLivingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [immigrantFilter, setImmigrantFilter] = useState(false);
  const [offset, setOffset] = useState(0);

  const [{ data, fetching, error }] = usePersonsQuery({
    variables: {
      offset,
      limit: 50,
    },
  });

  const people = data?.persons?.items ?? [];
  const total = data?.persons?.total ?? 0;
  const hasMore = data?.persons?.hasMore ?? false;

  // Client-side filters on returned page
  const filteredPeople = useMemo(() => {
    let filtered = [...people];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.givenName.toLowerCase().includes(query) ||
        p.surname.toLowerCase().includes(query) ||
        p.birthPlace?.toLowerCase().includes(query) ||
        p.deathPlace?.toLowerCase().includes(query)
      );
    }

    if (sexFilter !== 'all') {
      filtered = filtered.filter(p => p.sex === sexFilter);
    }

    if (livingFilter === 'living') {
      filtered = filtered.filter(p => p.isLiving);
    } else if (livingFilter === 'deceased') {
      filtered = filtered.filter(p => !p.isLiving);
    }

    if (immigrantFilter) {
      filtered = filtered.filter(p => p.isImmigrantAncestor);
    }

    return filtered;
  }, [people, searchQuery, sexFilter, livingFilter, immigrantFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">People</h2>
          <p className="text-sm text-gray-600 mt-1">Manage person records and relationships</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/admin/people/new')}>
          <Plus className="h-4 w-4" />
          New Person
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
                  placeholder="Search by name or place..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label>Sex</Label>
              <Select value={sexFilter} onValueChange={setSexFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select sex..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Living Status</Label>
              <div className="flex gap-2">
                <Button
                  variant={livingFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLivingFilter('all')}
                  className="flex-1"
                >
                  All
                </Button>
                <Button
                  variant={livingFilter === 'living' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLivingFilter('living')}
                  className="flex-1"
                >
                  Living
                </Button>
                <Button
                  variant={livingFilter === 'deceased' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLivingFilter('deceased')}
                  className="flex-1"
                >
                  Deceased
                </Button>
              </div>
            </div>

            <div className="flex items-end">
              <Button
                variant={immigrantFilter ? 'default' : 'outline'}
                onClick={() => setImmigrantFilter(!immigrantFilter)}
                className="w-full"
              >
                Immigrant Ancestor
              </Button>
            </div>
          </div>

          {(searchQuery || sexFilter !== 'all' || livingFilter !== 'all' || immigrantFilter) && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                </Badge>
              )}
              {sexFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Sex: {sexFilter}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSexFilter('all')} />
                </Badge>
              )}
              {livingFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {livingFilter === 'living' ? 'Living' : 'Deceased'}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setLivingFilter('all')} />
                </Badge>
              )}
              {immigrantFilter && (
                <Badge variant="secondary" className="gap-1">
                  Immigrant Ancestor
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setImmigrantFilter(false)} />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* People Table */}
      <Card>
        <CardContent className="pt-6">
          {fetching ? (
            <div className="text-center py-8">Loading people...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">Failed to load people</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Birth Date</TableHead>
                    <TableHead>Birth Place</TableHead>
                    <TableHead>Death Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeople.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">
                        <div>
                          {person.givenName} {person.surname}
                          {person.nameQualifier && (
                            <span className="text-gray-500 ml-1">{person.nameQualifier}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {person.birthDateModifier && person.birthDateModifier !== 'EXACT' && (
                          <span className="text-xs text-gray-500 mr-1">
                            {person.birthDateModifier === 'ABOUT' ? 'abt' : person.birthDateModifier.toLowerCase()}
                          </span>
                        )}
                        {person.birthDate || '\u2014'}
                      </TableCell>
                      <TableCell>{person.birthPlace || '\u2014'}</TableCell>
                      <TableCell>
                        {person.deathDateModifier && person.deathDateModifier !== 'EXACT' && (
                          <span className="text-xs text-gray-500 mr-1">
                            {person.deathDateModifier === 'ABOUT' ? 'abt' : person.deathDateModifier.toLowerCase()}
                          </span>
                        )}
                        {person.deathDate || '\u2014'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {person.isLiving && (
                            <Badge variant="secondary" className="text-xs">Living</Badge>
                          )}
                          {person.isImmigrantAncestor && (
                            <Badge variant="outline" className="text-xs">Immigrant</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/people/${person.id}`)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredPeople.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No people found matching your filters
                </div>
              )}

              {/* Pagination */}
              {total > 50 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-600">
                    Showing {offset + 1}-{Math.min(offset + 50, total)} of {total}
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
