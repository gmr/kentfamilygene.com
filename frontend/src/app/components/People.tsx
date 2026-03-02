import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, Search, X } from 'lucide-react';
import { useAdminPersonsQuery } from '../../generated/graphql';

export function People() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sexFilter, setSexFilter] = useState<string>('all');
  const [livingFilter, setLivingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [immigrantFilter, setImmigrantFilter] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  // Initialize search from URL params
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  const [{ data, fetching, error }] = useAdminPersonsQuery({
    variables: {
      includePlaceholders: showPlaceholders || undefined,
    },
  });

  const people = data?.adminPersons?.items ?? [];
  const total = data?.adminPersons?.total ?? 0;

  // Client-side filters on full dataset
  const filteredPeople = useMemo(() => {
    let filtered = [...people];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        (p.givenName ?? '').toLowerCase().includes(query) ||
        (p.surname ?? '').toLowerCase().includes(query) ||
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
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
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

            <div className="flex items-end gap-2">
              <Button
                variant={immigrantFilter ? 'default' : 'outline'}
                onClick={() => setImmigrantFilter(!immigrantFilter)}
                className="flex-1"
              >
                Immigrant Ancestor
              </Button>
              <Button
                variant={showPlaceholders ? 'default' : 'outline'}
                onClick={() => setShowPlaceholders(!showPlaceholders)}
                className="flex-1"
              >
                Show Placeholders
              </Button>
            </div>
          </div>

          {(searchQuery || sexFilter !== 'all' || livingFilter !== 'all' || immigrantFilter || showPlaceholders) && (
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
              {showPlaceholders && (
                <Badge variant="secondary" className="gap-1">
                  Placeholders
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setShowPlaceholders(false)} />
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeople.map((person) => (
                    <TableRow key={person.id} className="cursor-pointer" onClick={() => navigate(`/admin/people/${person.id}`)}>
                      <TableCell className="font-medium">
                        <div>
                          {person.givenName || person.surname ? (
                            <>
                              {person.givenName} {person.surname}
                              {person.nameQualifier && (
                                <span className="text-gray-500 ml-1">{person.nameQualifier}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 italic">
                              [{person.privacyLabel || 'Unknown'}]
                            </span>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredPeople.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No people found matching your filters
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <span className="text-sm text-gray-600">
                  Showing {filteredPeople.length} of {total} people
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
