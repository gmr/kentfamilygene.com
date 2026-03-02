import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { peopleAPI, participantsAPI, placesAPI, lineagesAPI, haplogroupsAPI } from '../../../lib/api';

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export interface TypeaheadSearchProps<T extends { id: string }> {
  // Core behavior
  entityType: 'person' | 'participant' | 'place' | 'lineage' | 'haplogroup';
  onSelect: (entity: T) => void;
  onCreate?: () => void; // Show "Create New" option

  // Display
  placeholder?: string;
  label?: string;
  formatResult: (entity: T) => { primary: string; secondary?: string; avatar?: React.ReactNode };

  // Search configuration
  searchEndpoint?: string; // Override default /api/admin/{entityType}/search
  debounceMs?: number; // Default 200ms
  minChars?: number; // Default 2
  maxResults?: number; // Default 10

  // State
  initialValue?: T;
  disabled?: boolean;
  error?: string;
}

export function TypeaheadSearch<T extends { id: string }>({
  entityType,
  onSelect,
  onCreate,
  placeholder = `Search for ${entityType}...`,
  label,
  formatResult,
  searchEndpoint,
  debounceMs = 200,
  minChars = 2,
  maxResults = 10,
  initialValue,
  disabled = false,
  error,
}: TypeaheadSearchProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState<T | undefined>(initialValue);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search function with request cancellation
  const searchEntities = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < minChars) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let data: T[] = [];

        // Use the appropriate API method based on entity type
        switch (entityType) {
          case 'person':
            data = await peopleAPI.search(searchQuery) as unknown as T[];
            break;
          case 'participant':
            data = await participantsAPI.search(searchQuery, maxResults) as unknown as T[];
            break;
          case 'place':
            data = await placesAPI.search(searchQuery) as unknown as T[];
            break;
          case 'lineage':
            data = await lineagesAPI.search(searchQuery, maxResults) as unknown as T[];
            break;
          case 'haplogroup':
            data = await haplogroupsAPI.search(searchQuery, maxResults) as unknown as T[];
            break;
          default:
            // If custom endpoint is provided, use fetch
            if (searchEndpoint) {
              const response = await fetch(
                `${searchEndpoint}?q=${encodeURIComponent(searchQuery)}&limit=${maxResults}`
              );
              data = await response.json();
            }
        }

        setResults(data.slice(0, maxResults));
      } catch (error: any) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs),
    [entityType, searchEndpoint, debounceMs, minChars, maxResults]
  );

  // Trigger search on query change
  useEffect(() => {
    if (query.length > 0) {
      setLoading(true);
      searchEntities(query);
    } else {
      setResults([]);
      setLoading(false);
    }
  }, [query, searchEntities]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle selection
  const handleSelect = (entity: T) => {
    setSelectedValue(entity);
    onSelect(entity);
    setOpen(false);
    setQuery('');
  };

  // Handle clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedValue(undefined);
    setQuery('');
    setResults([]);
  };

  // Handle create new
  const handleCreate = () => {
    if (onCreate) {
      onCreate();
      setOpen(false);
    }
  };

  // Update selected value when initialValue changes
  useEffect(() => {
    setSelectedValue(initialValue);
  }, [initialValue]);

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={`w-full justify-between ${error ? 'border-red-500' : ''}`}
          >
            {selectedValue ? (
              <span className="flex items-center gap-2 truncate">
                {formatResult(selectedValue).primary}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {selectedValue ? (
              <X
                className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            ) : (
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={query}
              onValueChange={setQuery}
            />

            <CommandList>
              {loading && (
                <CommandEmpty>
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                  </div>
                </CommandEmpty>
              )}

              {!loading && query.length > 0 && query.length < minChars && (
                <CommandEmpty>
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Type at least {minChars} characters to search
                  </div>
                </CommandEmpty>
              )}

              {!loading && query.length >= minChars && results.length === 0 && (
                <CommandEmpty>
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <Search className="mx-auto h-6 w-6 mb-2 opacity-50" />
                    No results found
                  </div>
                </CommandEmpty>
              )}

              {results.length > 0 && (
                <CommandGroup heading="Results">
                  {results.map((entity) => {
                    const formatted = formatResult(entity);
                    return (
                      <CommandItem
                        key={entity.id}
                        value={entity.id}
                        onSelect={() => handleSelect(entity)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-start gap-3 w-full">
                          {formatted.avatar && (
                            <div className="mt-0.5 flex-shrink-0">
                              {formatted.avatar}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{formatted.primary}</div>
                            {formatted.secondary && (
                              <div className="text-sm text-muted-foreground truncate">
                                {formatted.secondary}
                              </div>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {onCreate && query.length >= minChars && (
                <CommandGroup>
                  <CommandItem
                    onSelect={handleCreate}
                    className="cursor-pointer text-blue-600 dark:text-blue-400"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
