import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Plus, Search, Check, X, Pencil } from 'lucide-react';
import { usePlacesQuery, type Place } from '../../generated/graphql';

export function Places() {
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [missingCoords, setMissingCoords] = useState(false);
  const [missingFS, setMissingFS] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  // Fetch all places (unfiltered) to populate country dropdown
  const [{ data: allData }] = usePlacesQuery({
    variables: { offset: 0, limit: 1000 },
  });

  const [{ data, fetching, error }] = usePlacesQuery({
    variables: {
      country: countryFilter !== 'all' ? countryFilter : undefined,
      offset,
      limit: 50,
    },
  });

  const places = data?.places?.items ?? [];
  const total = data?.places?.total ?? 0;
  const hasMore = data?.places?.hasMore ?? false;

  // Get unique countries from ALL places for filter
  const countries = useMemo(() => {
    const allPlaces = allData?.places?.items ?? [];
    return Array.from(new Set(allPlaces.map(p => p.country).filter(Boolean))).sort() as string[];
  }, [allData]);

  // Client-side filters
  const filtered = useMemo(() => {
    let result = [...places];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.county?.toLowerCase().includes(query) ||
        p.state?.toLowerCase().includes(query)
      );
    }

    if (missingCoords) {
      result = result.filter(p => !p.lat || !p.lon);
    }

    if (missingFS) {
      result = result.filter(p => !p.familysearchUrl);
    }

    return result;
  }, [places, searchQuery, missingCoords, missingFS]);

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading places...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Failed to load places</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Places</h1>
          <p className="text-sm text-muted-foreground">
            Manage the place database for standardized location data.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Place
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap p-4 bg-muted/50 rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="missing-coords"
            checked={missingCoords}
            onCheckedChange={(checked) => setMissingCoords(checked as boolean)}
          />
          <label htmlFor="missing-coords" className="text-sm cursor-pointer">
            Missing Coords
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="missing-fs"
            checked={missingFS}
            onCheckedChange={(checked) => setMissingFS(checked as boolean)}
          />
          <label htmlFor="missing-fs" className="text-sm cursor-pointer">
            Missing FS URL
          </label>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-4">
            {searchQuery || countryFilter !== 'all' || missingCoords || missingFS
              ? 'No places found matching your filters.'
              : 'No places found.'}
          </p>
          {!searchQuery && countryFilter === 'all' && !missingCoords && !missingFS && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Place
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>County</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-center">Coords</TableHead>
                <TableHead className="text-center">FS</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((place) => (
                <TableRow key={place.id}>
                  <TableCell className="font-medium">{place.name}</TableCell>
                  <TableCell>{place.county || '-'}</TableCell>
                  <TableCell>{place.state}</TableCell>
                  <TableCell className="text-center">
                    {place.lat && place.lon ? (
                      <Check className="h-4 w-4 mx-auto text-green-500" />
                    ) : (
                      <X className="h-4 w-4 mx-auto text-red-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {place.familysearchUrl ? (
                      <Check className="h-4 w-4 mx-auto text-green-500" />
                    ) : (
                      <X className="h-4 w-4 mx-auto text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPlace(place)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="p-4 border-t bg-muted/20 text-sm text-muted-foreground">
            Showing {filtered.length} place{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between pt-2">
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

      {/* Create/Edit Modal — placeholder for Phase 3c */}
      {(isCreateModalOpen || editingPlace) && (
        <Dialog open onOpenChange={() => { setIsCreateModalOpen(false); setEditingPlace(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlace ? 'Edit Place' : 'Create Place'}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500 py-4">Form wiring coming in Phase 3c.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateModalOpen(false); setEditingPlace(null); }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
