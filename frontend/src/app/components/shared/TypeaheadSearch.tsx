import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Search, X, Loader2 } from 'lucide-react';
import { useSearchQuery, SearchType } from '../../../generated/graphql';

export interface SearchResult {
  id: string;
  display: string;
  resultType: string;
}

export interface TypeaheadSearchProps {
  entityType: 'person' | 'participant' | 'place' | 'lineage' | 'haplogroup';
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
  label?: string;
  debounceMs?: number;
  minChars?: number;
  maxResults?: number;
  selectedValue?: SearchResult;
  onClear?: () => void;
  disabled?: boolean;
  error?: string;
  excludeIds?: string[];
}

const ENTITY_TO_SEARCH_TYPE: Record<string, SearchType> = {
  person: SearchType.Person,
  participant: SearchType.Participant,
  place: SearchType.Place,
  lineage: SearchType.Lineage,
  haplogroup: SearchType.Haplogroup,
};

export function TypeaheadSearch({
  entityType,
  onSelect,
  placeholder = `Search for ${entityType}...`,
  label,
  debounceMs = 250,
  minChars = 2,
  maxResults = 10,
  selectedValue,
  onClear,
  disabled = false,
  error,
  excludeIds = [],
}: TypeaheadSearchProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce input → query
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (inputValue.length >= minChars) {
      timerRef.current = setTimeout(() => setDebouncedQuery(inputValue), debounceMs);
    } else {
      setDebouncedQuery('');
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [inputValue, minChars, debounceMs]);

  const searchType = ENTITY_TO_SEARCH_TYPE[entityType];

  const [{ data, fetching }] = useSearchQuery({
    variables: {
      query: debouncedQuery,
      types: searchType ? [searchType] : null,
      limit: maxResults,
    },
    pause: debouncedQuery.length < minChars,
  });

  const results: SearchResult[] = (data?.search?.items ?? [])
    .filter((item) => !excludeIds.includes(item.id))
    .map((item) => ({
      id: item.id,
      display: item.display,
      resultType: item.resultType,
    }));

  const handleSelect = useCallback((result: SearchResult) => {
    onSelect(result);
    setOpen(false);
    setInputValue('');
    setDebouncedQuery('');
  }, [onSelect]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
    setInputValue('');
    setDebouncedQuery('');
  }, [onClear]);

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
              <span className="truncate">{selectedValue.display}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {selectedValue && onClear ? (
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
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              {fetching && (
                <CommandEmpty>
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                  </div>
                </CommandEmpty>
              )}

              {!fetching && inputValue.length > 0 && inputValue.length < minChars && (
                <CommandEmpty>
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Type at least {minChars} characters to search
                  </div>
                </CommandEmpty>
              )}

              {!fetching && debouncedQuery.length >= minChars && results.length === 0 && (
                <CommandEmpty>
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <Search className="mx-auto h-6 w-6 mb-2 opacity-50" />
                    No results found
                  </div>
                </CommandEmpty>
              )}

              {results.length > 0 && (
                <CommandGroup heading="Results">
                  {results.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result)}
                      className="cursor-pointer"
                    >
                      <div className="font-medium truncate">{result.display}</div>
                    </CommandItem>
                  ))}
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
