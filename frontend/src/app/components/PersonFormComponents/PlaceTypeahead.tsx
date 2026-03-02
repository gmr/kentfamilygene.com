import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Search, Plus, MapPin } from 'lucide-react';
import { Place, mockPlaces } from '../../../lib/mock-data';

interface PlaceTypeaheadProps {
  value: Place | null;
  onChange: (place: Place | null) => void;
  onCreateNew?: () => void;
  label: string;
}

export function PlaceTypeahead({ value, onChange, onCreateNew, label }: PlaceTypeaheadProps) {
  const [searchQuery, setSearchQuery] = useState(value?.name || '');
  const [showResults, setShowResults] = useState(false);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setSearchQuery(value.name);
    }
  }, [value]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPlaces([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = mockPlaces.filter(place => {
      const fullName = `${place.county ? place.county + ' Co., ' : ''}${place.state}`.toLowerCase();
      return (
        place.name.toLowerCase().includes(query) ||
        place.state.toLowerCase().includes(query) ||
        (place.county && place.county.toLowerCase().includes(query)) ||
        fullName.includes(query)
      );
    });

    setFilteredPlaces(filtered.slice(0, 10));
  }, [searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPlace = (place: Place) => {
    onChange(place);
    setSearchQuery(place.name);
    setShowResults(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearchQuery('');
    setFilteredPlaces([]);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>{label}</Label>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(true);
              if (e.target.value === '') {
                onChange(null);
              }
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search places..."
            className="pl-9 pr-20"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-2 text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>

        {showResults && filteredPlaces.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredPlaces.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => handleSelectPlace(place)}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-start gap-2 border-b last:border-b-0"
              >
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{place.name}</div>
                  <div className="text-xs text-gray-500">
                    {place.county && `${place.county} County, `}{place.state}, {place.country}
                  </div>
                </div>
              </button>
            ))}
            {onCreateNew && (
              <button
                type="button"
                onClick={onCreateNew}
                className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 border-t text-blue-600"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Create new place: "{searchQuery}"</span>
              </button>
            )}
          </div>
        )}

        {showResults && searchQuery.trim() !== '' && filteredPlaces.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
            <p className="text-sm text-gray-500">No places found</p>
            {onCreateNew && (
              <button
                type="button"
                onClick={onCreateNew}
                className="w-full mt-2 px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 border rounded text-blue-600"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Create new place: "{searchQuery}"</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
